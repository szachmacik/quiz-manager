/**
 * Settings Audit Router
 * Audits AYS Quiz settings against competition rules, historical data, and best practices.
 * Checks: schedule times, anti-copy, captcha, certificate generator, attempt limits, etc.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  quizSettingsAudits,
  competitionRules,
  historicalQuizSettings,
  quizSnapshots,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// ─── AYS Quiz Settings structure (known fields) ──────────────────────────────
interface AysQuizSettings {
  // Timing
  start_date?: string;
  end_date?: string;
  time_limit?: number; // minutes, 0 = no limit
  // Access
  require_login?: boolean;
  require_email?: boolean;
  limit_attempts?: number; // 0 = unlimited
  // Security
  disable_copy?: boolean; // anti-copy
  disable_right_click?: boolean;
  shuffle_questions?: boolean;
  shuffle_answers?: boolean;
  // Certificate
  certificate?: boolean;
  certificate_template?: string;
  passing_grade?: number; // 0-100
  // Results
  show_results?: boolean;
  show_correct_answers?: boolean;
  // Other
  captcha?: boolean;
  [key: string]: unknown;
}

interface AuditFinding {
  category: "schedule" | "security" | "certificate" | "access" | "results" | "consistency";
  severity: "critical" | "high" | "medium" | "low";
  field: string;
  message: string;
  currentValue: string | null;
  expectedValue: string | null;
  suggestion: string;
  source: "rules" | "history" | "best_practice";
}

async function runSettingsAudit(
  auditId: number,
  snapshotId: number,
  rulesId: number | null
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(quizSettingsAudits)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(quizSettingsAudits.id, auditId));

  try {
    // Fetch snapshot
    const [snapshot] = await db.select().from(quizSnapshots)
      .where(eq(quizSnapshots.id, snapshotId)).limit(1);
    if (!snapshot) throw new Error("Snapshot not found");

    const settings = (snapshot.settings || {}) as AysQuizSettings;
    const findings: AuditFinding[] = [];

    // ── Phase 1: Structural checks ────────────────────────────────────────────

    // 1. Anti-copy / disable right click
    if (!settings.disable_copy && !settings.disable_right_click) {
      findings.push({
        category: "security",
        severity: "high",
        field: "disable_copy",
        message: "Zabezpieczenie przed kopiowaniem treści jest wyłączone.",
        currentValue: "false",
        expectedValue: "true",
        suggestion: "Włącz opcję 'Disable Copy' w ustawieniach quizu AYS.",
        source: "best_practice",
      });
    }

    // 2. Shuffle questions (anti-cheat)
    if (!settings.shuffle_questions) {
      findings.push({
        category: "security",
        severity: "medium",
        field: "shuffle_questions",
        message: "Pytania nie są losowane — uczestnicy mogą się porozumiewać co do kolejności.",
        currentValue: "false",
        expectedValue: "true",
        suggestion: "Włącz losowanie pytań w ustawieniach quizu.",
        source: "best_practice",
      });
    }

    // 3. Shuffle answers
    if (!settings.shuffle_answers) {
      findings.push({
        category: "security",
        severity: "low",
        field: "shuffle_answers",
        message: "Odpowiedzi nie są losowane.",
        currentValue: "false",
        expectedValue: "true",
        suggestion: "Włącz losowanie odpowiedzi w ustawieniach quizu.",
        source: "best_practice",
      });
    }

    // 4. Attempt limit
    if (!settings.limit_attempts || settings.limit_attempts === 0) {
      findings.push({
        category: "access",
        severity: "critical",
        field: "limit_attempts",
        message: "Brak limitu prób — uczestnik może rozwiązywać quiz wielokrotnie.",
        currentValue: "0 (brak limitu)",
        expectedValue: "1",
        suggestion: "Ustaw limit prób na 1 w ustawieniach quizu.",
        source: "best_practice",
      });
    }

    // 5. Email required
    if (!settings.require_email) {
      findings.push({
        category: "access",
        severity: "high",
        field: "require_email",
        message: "Quiz nie wymaga podania adresu email — brak identyfikacji uczestnika.",
        currentValue: "false",
        expectedValue: "true",
        suggestion: "Włącz wymaganie adresu email przed rozpoczęciem quizu.",
        source: "best_practice",
      });
    }

    // 6. Certificate
    if (!settings.certificate) {
      findings.push({
        category: "certificate",
        severity: "medium",
        field: "certificate",
        message: "Generator dyplomów jest wyłączony — uczestnicy nie otrzymają certyfikatu.",
        currentValue: "false",
        expectedValue: "true",
        suggestion: "Włącz generator dyplomów i skonfiguruj szablon certyfikatu.",
        source: "best_practice",
      });
    } else if (!settings.certificate_template) {
      findings.push({
        category: "certificate",
        severity: "high",
        field: "certificate_template",
        message: "Generator dyplomów jest włączony, ale nie wybrano szablonu certyfikatu.",
        currentValue: "null",
        expectedValue: "wybrany szablon",
        suggestion: "Wybierz lub utwórz szablon certyfikatu w ustawieniach AYS.",
        source: "best_practice",
      });
    }

    // 7. Passing grade
    if (settings.passing_grade === undefined || settings.passing_grade === null) {
      findings.push({
        category: "certificate",
        severity: "medium",
        field: "passing_grade",
        message: "Nie ustawiono progu zaliczenia — każdy uczestnik otrzyma certyfikat.",
        currentValue: "null",
        expectedValue: "np. 70",
        suggestion: "Ustaw próg zaliczenia (np. 70%) aby certyfikat był przyznawany tylko za poprawne wyniki.",
        source: "best_practice",
      });
    }

    // 8. Schedule check
    const now = new Date();
    if (settings.start_date) {
      const startDate = new Date(settings.start_date);
      if (startDate > now) {
        // Quiz not yet open — OK if it's a future competition
        const diffHours = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (diffHours > 72) {
          findings.push({
            category: "schedule",
            severity: "low",
            field: "start_date",
            message: `Quiz otwiera się za ${Math.round(diffHours)} godzin (${settings.start_date}).`,
            currentValue: settings.start_date,
            expectedValue: null,
            suggestion: "Sprawdź czy data otwarcia quizu jest zgodna z harmonogramem konkursu.",
            source: "best_practice",
          });
        }
      }
    } else {
      findings.push({
        category: "schedule",
        severity: "medium",
        field: "start_date",
        message: "Brak daty otwarcia quizu — quiz jest dostępny bez ograniczeń czasowych.",
        currentValue: "null",
        expectedValue: "data i godzina otwarcia",
        suggestion: "Ustaw datę i godzinę otwarcia quizu zgodnie z regulaminem konkursu.",
        source: "best_practice",
      });
    }

    if (!settings.end_date) {
      findings.push({
        category: "schedule",
        severity: "high",
        field: "end_date",
        message: "Brak daty zamknięcia quizu — quiz pozostanie otwarty bezterminowo.",
        currentValue: "null",
        expectedValue: "data i godzina zamknięcia",
        suggestion: "Ustaw datę i godzinę zamknięcia quizu.",
        source: "best_practice",
      });
    }

    // 9. Show correct answers after submission
    if (settings.show_correct_answers) {
      findings.push({
        category: "results",
        severity: "high",
        field: "show_correct_answers",
        message: "Poprawne odpowiedzi są pokazywane po zakończeniu quizu — uczestnicy mogą przekazywać je innym.",
        currentValue: "true",
        expectedValue: "false",
        suggestion: "Wyłącz pokazywanie poprawnych odpowiedzi do czasu zakończenia konkursu.",
        source: "best_practice",
      });
    }

    // ── Phase 2: Compare with competition rules ────────────────────────────────
    let rules = null;
    if (rulesId) {
      const [r] = await db.select().from(competitionRules)
        .where(eq(competitionRules.id, rulesId)).limit(1);
      rules = r;
    }

    if (rules) {
      // Check anti-copy requirement from rules
      if (rules.requireAntiCopy && !settings.disable_copy) {
        findings.push({
          category: "security",
          severity: "critical",
          field: "disable_copy",
          message: `Regulamin wymaga zabezpieczenia przed kopiowaniem, ale opcja jest wyłączona.`,
          currentValue: "false",
          expectedValue: "true (wymagane przez regulamin)",
          suggestion: "Włącz 'Disable Copy' — wymagane przez regulamin konkursu.",
          source: "rules",
        });
      }

      // Check certificate requirement
      if (rules.requireCertificate && !settings.certificate) {
        findings.push({
          category: "certificate",
          severity: "critical",
          field: "certificate",
          message: "Regulamin wymaga generowania dyplomów, ale opcja jest wyłączona.",
          currentValue: "false",
          expectedValue: "true (wymagane przez regulamin)",
          suggestion: "Włącz generator dyplomów — wymagane przez regulamin konkursu.",
          source: "rules",
        });
      }

      // Check max attempts
      if (rules.maxAttempts && settings.limit_attempts !== rules.maxAttempts) {
        findings.push({
          category: "access",
          severity: "high",
          field: "limit_attempts",
          message: `Regulamin określa maksymalnie ${rules.maxAttempts} próbę, ale quiz ma ustawione: ${settings.limit_attempts ?? "bez limitu"}.`,
          currentValue: String(settings.limit_attempts ?? 0),
          expectedValue: String(rules.maxAttempts),
          suggestion: `Ustaw limit prób na ${rules.maxAttempts} zgodnie z regulaminem.`,
          source: "rules",
        });
      }

      // Check time limit against expected duration
      if (rules.expectedDurationMin && settings.time_limit) {
        const diff = Math.abs(settings.time_limit - rules.expectedDurationMin);
        if (diff > 5) {
          findings.push({
            category: "schedule",
            severity: "medium",
            field: "time_limit",
            message: `Czas quizu (${settings.time_limit} min) różni się od oczekiwanego (${rules.expectedDurationMin} min) o ${diff} minut.`,
            currentValue: `${settings.time_limit} min`,
            expectedValue: `${rules.expectedDurationMin} min`,
            suggestion: "Dostosuj limit czasu do regulaminu konkursu.",
            source: "rules",
          });
        }
      }
    }

    // ── Phase 3: Compare with historical quizzes ──────────────────────────────
    const historicalList = await db.select().from(historicalQuizSettings)
      .where(eq(historicalQuizSettings.connectionId, snapshot.connectionId))
      .orderBy(desc(historicalQuizSettings.recordedAt))
      .limit(5);

    if (historicalList.length > 0) {
      // Find most common settings pattern
      const historicalSettings = historicalList.map(h => h.settings as AysQuizSettings);
      const avgAttemptLimit = historicalSettings
        .filter(s => s.limit_attempts !== undefined)
        .reduce((sum, s) => sum + (s.limit_attempts ?? 1), 0) / historicalSettings.length;

      if (avgAttemptLimit <= 1 && (!settings.limit_attempts || settings.limit_attempts > 1)) {
        findings.push({
          category: "consistency",
          severity: "medium",
          field: "limit_attempts",
          message: `Poprzednie quizy miały limit 1 próby, ale ten quiz ma: ${settings.limit_attempts ?? "bez limitu"}.`,
          currentValue: String(settings.limit_attempts ?? 0),
          expectedValue: "1 (jak w poprzednich quizach)",
          suggestion: "Ustaw limit prób na 1, zgodnie z historycznym wzorcem.",
          source: "history",
        });
      }
    }

    // ── Phase 4: AI analysis of settings vs rules ─────────────────────────────
    if (rules?.rulesText) {
      try {
        const settingsSummary = JSON.stringify(settings, null, 2);
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Jesteś ekspertem od konkursów edukacyjnych i quizów online. Analizujesz ustawienia quizu pod kątem zgodności z regulaminem konkursu. Odpowiadaj WYŁĄCZNIE w formacie JSON.`,
            },
            {
              role: "user",
              content: `Przeanalizuj ustawienia quizu "${snapshot.title}" pod kątem zgodności z regulaminem konkursu.

REGULAMIN:
${rules.rulesText}

USTAWIENIA QUIZU (AYS Quiz Maker):
${settingsSummary}

Zwróć JSON:
{
  "findings": [
    {
      "category": "schedule|security|certificate|access|results|consistency",
      "severity": "critical|high|medium|low",
      "field": "nazwa_pola",
      "message": "opis niezgodności po polsku",
      "suggestion": "konkretna sugestia poprawki po polsku",
      "source": "rules"
    }
  ],
  "overallCompliance": 0-100,
  "summary": "ogólna ocena zgodności po polsku"
}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "settings_audit",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", enum: ["schedule", "security", "certificate", "access", "results", "consistency"] },
                        severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                        field: { type: "string" },
                        message: { type: "string" },
                        suggestion: { type: "string" },
                        source: { type: "string", enum: ["rules", "history", "best_practice"] },
                      },
                      required: ["category", "severity", "field", "message", "suggestion", "source"],
                      additionalProperties: false,
                    },
                  },
                  overallCompliance: { type: "number" },
                  summary: { type: "string" },
                },
                required: ["findings", "overallCompliance", "summary"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (typeof content === "string") {
          const parsed = JSON.parse(content);
          for (const f of parsed.findings || []) {
            findings.push({
              category: f.category,
              severity: f.severity,
              field: f.field,
              message: f.message,
              currentValue: null,
              expectedValue: null,
              suggestion: f.suggestion,
              source: f.source,
            });
          }
        }
      } catch (aiErr: any) {
        console.error("[SettingsAudit] AI error:", aiErr.message);
      }
    }

    // ── Save results ──────────────────────────────────────────────────────────
    const issuesFound = findings.filter(f => f.severity === "critical" || f.severity === "high").length;
    const warningsFound = findings.filter(f => f.severity === "medium" || f.severity === "low").length;
    const overallScore = Math.max(0, 100 - issuesFound * 15 - warningsFound * 5);

    await db.update(quizSettingsAudits).set({
      status: "completed",
      overallScore,
      issuesFound,
      warningsFound,
      findings: findings as any,
      settingsSnapshot: settings as any,
      summary: `Audyt ustawień: ${issuesFound} problemów krytycznych/wysokich, ${warningsFound} ostrzeżeń. Wynik zgodności: ${overallScore}/100.`,
      completedAt: new Date(),
    }).where(eq(quizSettingsAudits.id, auditId));

    // Notify owner
    if (issuesFound > 0) {
      await notifyOwner({
        title: `⚠️ Audyt ustawień quizu "${snapshot.title}" — ${issuesFound} problemów`,
        content: `Audyt wykrył ${issuesFound} krytycznych/wysokich problemów w ustawieniach quizu.\n\nNajważniejsze:\n${findings.filter(f => f.severity === "critical" || f.severity === "high").slice(0, 3).map((f, i) => `${i + 1}. ${f.message}`).join("\n")}\n\nPrzejdź do Audytu Ustawień aby przejrzeć szczegóły.`,
      }).catch(() => {});
    } else {
      await notifyOwner({
        title: `✅ Audyt ustawień quizu "${snapshot.title}" — wszystko OK`,
        content: `Audyt ustawień zakończony. Wynik zgodności: ${overallScore}/100. Nie wykryto krytycznych problemów.`,
      }).catch(() => {});
    }

  } catch (err: any) {
    await db?.update(quizSettingsAudits).set({
      status: "failed",
      summary: `Błąd audytu: ${err.message}`,
      completedAt: new Date(),
    }).where(eq(quizSettingsAudits.id, auditId));
  }
}

export const settingsAuditRouter = router({
  // List all audits
  list: protectedProcedure
    .input(z.object({ connectionId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const audits = await db.select({
        audit: quizSettingsAudits,
        snapshot: { title: quizSnapshots.title, wpQuizId: quizSnapshots.wpQuizId },
      })
        .from(quizSettingsAudits)
        .leftJoin(quizSnapshots, eq(quizSettingsAudits.snapshotId, quizSnapshots.id))
        .orderBy(desc(quizSettingsAudits.createdAt))
        .limit(50);
      return audits;
    }),

  // Get single audit
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [audit] = await db.select().from(quizSettingsAudits)
        .where(eq(quizSettingsAudits.id, input.id)).limit(1);
      return audit ?? null;
    }),

  // Start new audit
  start: protectedProcedure
    .input(z.object({
      snapshotId: z.number(),
      connectionId: z.number(),
      rulesId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [result] = await db.insert(quizSettingsAudits).values({
        snapshotId: input.snapshotId,
        connectionId: input.connectionId,
        rulesId: input.rulesId ?? null,
        status: "pending",
      });
      const auditId = (result as any).insertId as number;

      // Run async
      runSettingsAudit(auditId, input.snapshotId, input.rulesId ?? null).catch(console.error);

      return { id: auditId };
    }),

  // Competition rules CRUD
  rules: router({
    list: protectedProcedure
      .input(z.object({ connectionId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const q = db.select().from(competitionRules).orderBy(desc(competitionRules.createdAt));
        return await q.limit(20);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [r] = await db.select().from(competitionRules)
          .where(eq(competitionRules.id, input.id)).limit(1);
        return r ?? null;
      }),

    create: protectedProcedure
      .input(z.object({
        connectionId: z.number(),
        name: z.string(),
        rulesText: z.string().optional(),
        intentNotes: z.string().optional(),
        expectedStartTime: z.string().optional(),
        expectedEndTime: z.string().optional(),
        expectedDurationMin: z.number().optional(),
        requireAntiCopy: z.boolean().default(true),
        requireCaptcha: z.boolean().default(false),
        requireEmailVerification: z.boolean().default(true),
        requireCertificate: z.boolean().default(true),
        maxAttempts: z.number().default(1),
        targetAgeGroup: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");

        // AI parse rules text into structured format
        let rawRulesJson = null;
        if (input.rulesText) {
          try {
            const response = await invokeLLM({
              messages: [
                { role: "system", content: "Jesteś ekspertem od regulaminów konkursów. Wyodrębnij kluczowe wymagania techniczne z regulaminu. Odpowiadaj WYŁĄCZNIE w formacie JSON." },
                { role: "user", content: `Przeanalizuj regulamin i wyodrębnij wymagania techniczne dotyczące quizu:\n\n${input.rulesText}\n\nZwróć JSON z polami: requireAntiCopy, requireCaptcha, requireEmailVerification, requireCertificate, maxAttempts, expectedDurationMin, targetAgeGroup, otherRequirements (array of strings).` },
              ],
            });
            const content = response.choices?.[0]?.message?.content;
            if (typeof content === "string") rawRulesJson = JSON.parse(content);
          } catch { /* ignore */ }
        }

        const [result] = await db.insert(competitionRules).values({
          ...input,
          rawRulesJson,
        });
        return { id: (result as any).insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        rulesText: z.string().optional(),
        intentNotes: z.string().optional(),
        expectedStartTime: z.string().optional(),
        expectedEndTime: z.string().optional(),
        expectedDurationMin: z.number().optional(),
        requireAntiCopy: z.boolean().optional(),
        requireCaptcha: z.boolean().optional(),
        requireEmailVerification: z.boolean().optional(),
        requireCertificate: z.boolean().optional(),
        maxAttempts: z.number().optional(),
        targetAgeGroup: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const { id, ...rest } = input;
        await db.update(competitionRules).set(rest).where(eq(competitionRules.id, id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.delete(competitionRules).where(eq(competitionRules.id, input.id));
        return { success: true };
      }),
  }),

  // Historical settings
  history: router({
    list: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(historicalQuizSettings)
          .where(eq(historicalQuizSettings.connectionId, input.connectionId))
          .orderBy(desc(historicalQuizSettings.recordedAt))
          .limit(20);
      }),

    save: protectedProcedure
      .input(z.object({
        connectionId: z.number(),
        wpQuizId: z.number(),
        quizTitle: z.string(),
        settings: z.record(z.string(), z.unknown()),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(historicalQuizSettings).values({
          connectionId: input.connectionId,
          wpQuizId: input.wpQuizId,
          quizTitle: input.quizTitle,
          settings: input.settings,
          notes: input.notes ?? null,
        });
        return { success: true };
      }),
  }),
});
