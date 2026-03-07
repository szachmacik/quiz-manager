import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { anomalyCases, anomalyPatterns } from "../../drizzle/schema";
import { eq, desc, and, or, like } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import { nanoid } from "nanoid";

// ─── Znane wzorce anomalii technicznych (z symulacji i historii) ─────────────
const KNOWN_PATTERNS = [
  {
    name: "Przerwanie nagrania — utrata połączenia WebRTC",
    anomalyType: "recording_interrupted",
    signals: ["MediaRecorder.stop() error", "network disconnect", "ICE connection failed"],
    description: "Nagranie przerwało się z powodu utraty połączenia sieciowego podczas sesji WebRTC.",
  },
  {
    name: "Timeout AYS AJAX — serwer nie odpowiedział",
    anomalyType: "ajax_error",
    signals: ["wp_ajax_ays_quiz timeout", "504 Gateway Timeout", "AJAX 0 status"],
    description: "Plugin AYS Quiz nie zdążył zapisać wyników — serwer WordPress nie odpowiedział w czasie.",
  },
  {
    name: "Wygaśnięcie sesji WordPress",
    anomalyType: "session_expired",
    signals: ["wp_nonce expired", "403 Forbidden on quiz submit", "session cookie missing"],
    description: "Sesja WordPressa wygasła podczas rozwiązywania quizu (długi quiz + krótki timeout sesji).",
  },
  {
    name: "Crash pluginu AYS — PHP Fatal Error",
    anomalyType: "plugin_crash",
    signals: ["PHP Fatal error", "AYS_Quiz_Site", "Call to undefined function"],
    description: "Plugin AYS Quiz rzucił wyjątek PHP podczas przetwarzania odpowiedzi.",
  },
  {
    name: "Wyniki nie zapisały się — baza danych niedostępna",
    anomalyType: "quiz_not_saved",
    signals: ["MySQL connection refused", "SQLSTATE[HY000]", "Can't connect to MySQL"],
    description: "Wyniki quizu nie zostały zapisane z powodu chwilowej niedostępności bazy danych.",
  },
  {
    name: "Czarny łabędź — DDoS podczas konkursu",
    anomalyType: "black_swan",
    signals: ["429 Too Many Requests", "Cloudflare 503", "rate limit exceeded"],
    description: "Serwer był przeciążony podczas konkursu — przewidziane w symulacji 100+ agentów.",
    isBlackSwan: true,
  },
];

// ─── Pomocnicze: ocena wiarygodności przez AI ────────────────────────────────
async function assessCredibility(input: {
  participantEmail: string;
  anomalyType: string;
  serverLogEvidence: string;
  telemetryEvidence: any;
  errorMessage: string;
}): Promise<{ score: number; reason: string; isSuspicious: boolean; suspicionReason: string }> {
  const prompt = `Jesteś ekspertem od weryfikacji technicznej konkursów online dla dzieci.
Oceń wiarygodność zgłoszonej anomalii technicznej. Twoim zadaniem jest odróżnić:
- PRAWDZIWY błąd techniczny (uczestnik zasługuje na drugą szansę)
- PODEJRZANE zachowanie (możliwa próba manipulacji)

Dane anomalii:
- Email uczestnika: ${input.participantEmail}
- Typ anomalii: ${input.anomalyType}
- Logi serwera: ${input.serverLogEvidence || "brak"}
- Błąd: ${input.errorMessage || "brak"}
- Dane telemetrii: ${JSON.stringify(input.telemetryEvidence || {}, null, 2)}

Odpowiedz w JSON:
{
  "credibilityScore": <0-100, gdzie 100 = pewny błąd techniczny>,
  "reason": "<uzasadnienie oceny po polsku, 2-3 zdania>",
  "isSuspicious": <true/false>,
  "suspicionReason": "<jeśli podejrzane, wyjaśnij dlaczego, inaczej null>"
}

Sygnały prawdziwego błędu technicznego:
- Błąd pojawił się nagle w połowie quizu (nie na początku)
- Logi serwera potwierdzają problem techniczny
- Telemetria pokazuje normalne zachowanie przed błędem
- Błąd dotknął wielu uczestników jednocześnie
- Uczestnik ma historię uczestnictwa (nie jest nowy)

Sygnały podejrzanego zachowania:
- Błąd zgłoszony dopiero po ogłoszeniu wyników
- Brak jakichkolwiek logów potwierdzających
- Telemetria pokazuje anomalie PRZED błędem (np. długie przerwy, copy-paste)
- Uczestnik wcześniej miał niskie wyniki, teraz chce powtórzyć
- Zgłoszenie przyszło długo po zakończeniu konkursu`;

  try {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "credibility_assessment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              credibilityScore: { type: "number" },
              reason: { type: "string" },
              isSuspicious: { type: "boolean" },
              suspicionReason: { type: ["string", "null"] },
            },
            required: ["credibilityScore", "reason", "isSuspicious", "suspicionReason"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = String(response.choices[0]?.message?.content ?? "{}");
    const parsed = JSON.parse(content);
    return {
      score: parsed.credibilityScore ?? 50,
      reason: parsed.reason ?? "Brak oceny",
      isSuspicious: parsed.isSuspicious ?? false,
      suspicionReason: parsed.suspicionReason ?? "",
    };
  } catch {
    return { score: 50, reason: "Błąd oceny AI — wymaga ręcznego przeglądu", isSuspicious: false, suspicionReason: "" };
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────
export const anomalyRouter = router({

  // Pobierz listę przypadków anomalii
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["detected", "under_review", "approved", "rejected", "retry_used", "all"]).default("all"),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input.status !== "all") conditions.push(eq(anomalyCases.status, input.status));
      if (input.search) conditions.push(
        or(
          like(anomalyCases.participantEmail, `%${input.search}%`),
          like(anomalyCases.participantName, `%${input.search}%`),
        )
      );
      return db.select().from(anomalyCases)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(anomalyCases.createdAt))
        .limit(100);
    }),

  // Pobierz szczegóły przypadku
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(anomalyCases).where(eq(anomalyCases.id, input.id)).limit(1);
      return result[0] ?? null;
    }),

  // Zgłoś nową anomalię (może być wywołane automatycznie przez system lub ręcznie)
  report: protectedProcedure
    .input(z.object({
      participantEmail: z.string().email(),
      participantName: z.string().optional(),
      contestEdition: z.string().optional(),
      quizId: z.number().optional(),
      snapshotId: z.number().optional(),
      anomalyType: z.enum([
        "recording_interrupted", "server_timeout", "ajax_error",
        "connection_lost", "quiz_not_saved", "session_expired",
        "plugin_crash", "black_swan", "other",
      ]),
      serverLogEvidence: z.string().optional(),
      telemetryEvidence: z.any().optional(),
      errorCode: z.string().optional(),
      errorMessage: z.string().optional(),
      occurredAt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      // Ocena wiarygodności przez AI
      const assessment = await assessCredibility({
        participantEmail: input.participantEmail,
        anomalyType: input.anomalyType,
        serverLogEvidence: input.serverLogEvidence ?? "",
        telemetryEvidence: input.telemetryEvidence,
        errorMessage: input.errorMessage ?? "",
      });

      // Znajdź pasujący wzorzec
      const matchedPattern = KNOWN_PATTERNS.find(p => p.anomalyType === input.anomalyType);
      const simulationRef = matchedPattern
        ? `Wzorzec: "${matchedPattern.name}" — ${matchedPattern.description}`
        : null;

      const [result] = await db.insert(anomalyCases).values({
        participantEmail: input.participantEmail,
        participantName: input.participantName,
        contestEdition: input.contestEdition,
        quizId: input.quizId,
        snapshotId: input.snapshotId,
        anomalyType: input.anomalyType,
        serverLogEvidence: input.serverLogEvidence,
        telemetryEvidence: input.telemetryEvidence,
        simulationReference: simulationRef,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        credibilityScore: assessment.score,
        credibilityReason: assessment.reason,
        isSuspiciousBehavior: assessment.isSuspicious,
        suspicionReason: assessment.suspicionReason,
        status: "detected",
      });

      const caseId = (result as any).insertId;

      // Powiadom admina jeśli wiarygodność wysoka (>70) i nie podejrzane
      if (assessment.score >= 70 && !assessment.isSuspicious) {
        await notifyOwner({
          title: `⚠️ Anomalia techniczna — ${input.participantEmail}`,
          content: `Wykryto wiarygodną anomalię techniczną (${assessment.score}/100).\n\nTyp: ${input.anomalyType}\nUczestnik: ${input.participantEmail}\nEdycja: ${input.contestEdition ?? "nieznana"}\n\nOcena AI: ${assessment.reason}\n\nCase ID: ${caseId} — wymaga decyzji admina.`,
        });
      }

      return { id: caseId, credibilityScore: assessment.score, isSuspicious: assessment.isSuspicious };
    }),

  // Decyzja admina: zatwierdź lub odrzuć drugą szansę
  decide: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      decision: z.enum(["approved", "rejected"]),
      adminDecision: z.string().min(10, "Uzasadnienie musi mieć co najmniej 10 znaków"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      let retryToken: string | null = null;
      let retryTokenExpiresAt: Date | null = null;

      if (input.decision === "approved") {
        // Generuj jednorazowy token do ponownego quizu (ważny 48h)
        retryToken = nanoid(32);
        retryTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      }

      await db.update(anomalyCases).set({
        status: input.decision,
        adminDecision: input.adminDecision,
        adminId: ctx.user?.id,
        decidedAt: new Date(),
        retryToken: retryToken ?? undefined,
        retryTokenExpiresAt: retryTokenExpiresAt ?? undefined,
      }).where(eq(anomalyCases.id, input.caseId));

      // Pobierz dane uczestnika
      const [caseData] = await db.select().from(anomalyCases).where(eq(anomalyCases.id, input.caseId)).limit(1);

      if (input.decision === "approved" && caseData) {
        // Powiadom admina o zatwierdzeniu
        await notifyOwner({
          title: `✅ Druga szansa zatwierdzona — ${caseData.participantEmail}`,
          content: `Admin zatwierdził drugą szansę dla uczestnika.\n\nUczestnik: ${caseData.participantEmail}\nToken: ${retryToken}\nWażny do: ${retryTokenExpiresAt?.toLocaleString("pl-PL")}\n\nUzasadnienie: ${input.adminDecision}`,
        });
      }

      return {
        success: true,
        retryToken,
        retryTokenExpiresAt,
        message: input.decision === "approved"
          ? `Druga szansa zatwierdzona. Token: ${retryToken} (ważny 48h)`
          : "Wniosek odrzucony.",
      };
    }),

  // Pobierz znane wzorce anomalii
  listPatterns: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return KNOWN_PATTERNS;
    const dbPatterns = await db.select().from(anomalyPatterns).orderBy(desc(anomalyPatterns.occurrenceCount));
    // Połącz wzorce z bazy z wbudowanymi
    return [...dbPatterns, ...KNOWN_PATTERNS.filter(p =>
      !dbPatterns.some(dp => dp.anomalyType === p.anomalyType)
    )];
  }),

  // Statystyki anomalii
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, pending: 0, approved: 0, rejected: 0, suspicious: 0 };
    const all = await db.select().from(anomalyCases);
    return {
      total: all.length,
      pending: all.filter(c => c.status === "detected" || c.status === "under_review").length,
      approved: all.filter(c => c.status === "approved" || c.status === "retry_used").length,
      rejected: all.filter(c => c.status === "rejected").length,
      suspicious: all.filter(c => c.isSuspiciousBehavior).length,
      avgCredibility: all.length > 0
        ? Math.round(all.reduce((s, c) => s + (c.credibilityScore ?? 0), 0) / all.length)
        : 0,
    };
  }),

  // Automatyczna detekcja na podstawie logów (wywołana po symulacji)
  autoDetect: protectedProcedure
    .input(z.object({
      simulationId: z.number(),
      logs: z.array(z.object({
        agentEmail: z.string(),
        errorType: z.string().optional(),
        errorMessage: z.string().optional(),
        httpStatus: z.number().optional(),
        responseTimeMs: z.number().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { detected: 0 };

      let detected = 0;
      const anomalySignals = [
        { pattern: /timeout|504|503/i, type: "server_timeout" as const },
        { pattern: /ajax.*0|status.*0/i, type: "ajax_error" as const },
        { pattern: /connection.*lost|ECONNRESET|network/i, type: "connection_lost" as const },
        { pattern: /session.*expired|nonce|403/i, type: "session_expired" as const },
        { pattern: /fatal.*error|PHP.*error/i, type: "plugin_crash" as const },
        { pattern: /429|rate.*limit|too.*many/i, type: "black_swan" as const },
      ];

      for (const log of input.logs) {
        if (!log.errorMessage && !log.errorType) continue;
        const errorText = `${log.errorType ?? ""} ${log.errorMessage ?? ""}`;

        for (const signal of anomalySignals) {
          if (signal.pattern.test(errorText)) {
            const assessment = await assessCredibility({
              participantEmail: log.agentEmail,
              anomalyType: signal.type,
              serverLogEvidence: `Symulacja #${input.simulationId}: ${errorText}`,
              telemetryEvidence: { responseTimeMs: log.responseTimeMs, httpStatus: log.httpStatus },
              errorMessage: log.errorMessage ?? "",
            });

            await db.insert(anomalyCases).values({
              participantEmail: log.agentEmail,
              anomalyType: signal.type,
              serverLogEvidence: `Symulacja #${input.simulationId}: ${errorText}`,
              telemetryEvidence: { responseTimeMs: log.responseTimeMs, httpStatus: log.httpStatus },
              simulationReference: `Automatycznie wykryte w symulacji #${input.simulationId}`,
              errorMessage: log.errorMessage,
              credibilityScore: assessment.score,
              credibilityReason: assessment.reason,
              isSuspiciousBehavior: assessment.isSuspicious,
              suspicionReason: assessment.suspicionReason,
              status: "detected",
            });
            detected++;
            break;
          }
        }
      }

      return { detected };
    }),
});
