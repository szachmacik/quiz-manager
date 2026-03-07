/**
 * Video Verification Router
 * Two modes:
 * 1. MANUAL — participant submits video URL (Dropbox, Google Drive, direct link)
 *    AI analyzes the video for independence (no external help)
 * 2. TELEMETRY — native browser session with behavioral data collection
 *    AI analyzes behavioral patterns for anomalies
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  videoVerifications,
  telemetrySessions,
  telemetryEvents,
} from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import { nanoid } from "nanoid";

// ─── Video Analysis ───────────────────────────────────────────────────────────

async function analyzeVideoWithAI(verificationId: number, videoUrl: string, participantName: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(videoVerifications)
    .set({ status: "processing", startedAt: new Date() })
    .where(eq(videoVerifications.id, verificationId));

  try {
    // Determine if URL is accessible as direct video
    const isDirectVideo = videoUrl.match(/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i);
    const isDropbox = videoUrl.includes("dropbox.com");
    const isDrive = videoUrl.includes("drive.google.com");

    // Convert Dropbox share link to direct download
    let directUrl = videoUrl;
    if (isDropbox) {
      directUrl = videoUrl.replace("www.dropbox.com", "dl.dropboxusercontent.com")
        .replace("?dl=0", "?dl=1").replace("&dl=0", "&dl=1");
    }
    // For Google Drive: extract file ID and use export URL
    if (isDrive) {
      const match = videoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        directUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }

    // AI analysis using multimodal LLM
    const systemPrompt = `Jesteś ekspertem ds. weryfikacji nagrań wideo z konkursów edukacyjnych dla dzieci.
Twoim zadaniem jest ocena czy uczestnik rozwiązał quiz SAMODZIELNIE, bez pomocy osób trzecich.

Kryteria oceny:
1. SAMODZIELNIE (independent) — dziecko rozwiązuje quiz bez widocznej pomocy, może być nerwowe/zastanawiać się, to normalne
2. WĄTPLIWE (suspicious) — widoczne są anomalie: nagłe przerwy, ktoś wchodzi do pokoju, dziecko patrzy w bok, szepty
3. INTERWENCJA (intervention) — wyraźna pomoc merytoryczna: ktoś podpowiada odpowiedzi, wskazuje na ekran, dziecko czyta z kartki

WAŻNE: Odróżnij pomoc TECHNICZNĄ (rodzic poprawia kamerę, przynosi wodę) od MERYTORYCZNEJ (podpowiada odpowiedzi).
Pomoc techniczna NIE dyskwalifikuje — zaznacz ją jako notatkę, ale nie zmieniaj werdyktu na "intervention".
Bądź wyrozumiały — dzieci mogą się wiercić, patrzeć w sufit, mówić do siebie. To normalne zachowanie.`;

    const userPrompt = `Przeanalizuj nagranie wideo uczestnika konkursu: ${participantName}

URL nagrania: ${directUrl}

Oceń:
1. Czy uczestnik rozwiązuje quiz samodzielnie?
2. Czy widoczna jest jakakolwiek pomoc zewnętrzna?
3. Jakie anomalie (jeśli są) zostały wykryte?
4. Czy anomalie to pomoc techniczna czy merytoryczna?

Zwróć szczegółową analizę z timestampami anomalii (jeśli dostępne).`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            ...(isDirectVideo || isDropbox || isDrive ? [{
              type: "file_url" as const,
              file_url: {
                url: directUrl,
                mime_type: "video/mp4" as const,
              },
            }] : []),
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "video_verification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["independent", "suspicious", "intervention"] },
              confidenceScore: { type: "number" },
              overallScore: { type: "number" },
              summary: { type: "string" },
              anomalies: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestampSec: { type: "number" },
                    type: { type: "string", enum: ["technical_help", "verbal_hint", "pointing", "external_person", "pause", "looking_away", "reading_notes", "other"] },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                    description: { type: "string" },
                    isMeritIntervention: { type: "boolean" },
                  },
                  required: ["timestampSec", "type", "severity", "description", "isMeritIntervention"],
                  additionalProperties: false,
                },
              },
              technicalIssues: { type: "array", items: { type: "string" } },
              positiveIndicators: { type: "array", items: { type: "string" } },
            },
            required: ["verdict", "confidenceScore", "overallScore", "summary", "anomalies", "technicalIssues", "positiveIndicators"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("No AI response");

    const parsed = JSON.parse(content);

    await db.update(videoVerifications).set({
      status: "completed",
      verdict: parsed.verdict,
      confidenceScore: parsed.confidenceScore,
      overallScore: parsed.overallScore,
      anomalies: parsed.anomalies,
      aiAnalysis: parsed,
      summary: parsed.summary,
      completedAt: new Date(),
    }).where(eq(videoVerifications.id, verificationId));

    // Notify owner
    const verdictMap: Record<string, string> = {
      independent: "✅ SAMODZIELNIE",
      suspicious: "⚠️ WĄTPLIWE",
      intervention: "🚨 INTERWENCJA",
    };
    const verdictLabel = verdictMap[parsed.verdict as string] ?? parsed.verdict;

    await notifyOwner({
      title: `${verdictLabel} — Weryfikacja nagrania: ${participantName}`,
      content: `Weryfikacja zakończona.\n\nWerdykt: ${verdictLabel}\nPewność: ${parsed.confidenceScore}%\nWynik samodzielności: ${parsed.overallScore}/100\n\n${parsed.summary}\n\nAnomalie: ${parsed.anomalies.length} wykrytych`,
    }).catch(() => {});

  } catch (err: any) {
    // Fallback: text-only analysis if video not accessible
    try {
      const fallbackResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Jesteś ekspertem weryfikacji konkursów. Nie możesz obejrzeć wideo, więc informuj o tym i daj wstępną ocenę na podstawie metadanych URL.",
          },
          {
            role: "user",
            content: `Nie udało się załadować wideo dla uczestnika ${participantName} (URL: ${videoUrl}). Błąd: ${err.message}. Podaj informację o problemie i co należy zrobić.`,
          },
        ],
      });
      const fallbackContent = fallbackResponse.choices?.[0]?.message?.content;

      await db.update(videoVerifications).set({
        status: "completed",
        verdict: "suspicious",
        confidenceScore: 0,
        overallScore: 0,
        summary: `Nie udało się załadować wideo do analizy. ${typeof fallbackContent === "string" ? fallbackContent : "Sprawdź link i spróbuj ponownie."}`,
        anomalies: [{ type: "other", severity: "high", description: `Błąd ładowania wideo: ${err.message}`, timestampSec: 0, isMeritIntervention: false }],
        completedAt: new Date(),
      }).where(eq(videoVerifications.id, verificationId));
    } catch {
      await db.update(videoVerifications).set({
        status: "failed",
        summary: `Błąd analizy: ${err.message}`,
        completedAt: new Date(),
      }).where(eq(videoVerifications.id, verificationId));
    }
  }
}

// ─── Telemetry Analysis ───────────────────────────────────────────────────────

async function analyzeTelemetryWithAI(sessionId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [session] = await db.select().from(telemetrySessions)
    .where(eq(telemetrySessions.id, sessionId)).limit(1);
  if (!session) return;

  // Get events summary (not all events — too many)
  const events = await db.select().from(telemetryEvents)
    .where(eq(telemetryEvents.sessionId, sessionId))
    .orderBy(telemetryEvents.timestampMs)
    .limit(500);

  // Compute behavioral metrics
  const mouseEvents = events.filter(e => e.eventType === "mousemove");
  const clickEvents = events.filter(e => e.eventType === "click");
  const keyEvents = events.filter(e => e.eventType === "keydown");
  const pasteEvents = events.filter(e => e.eventType === "paste");
  const visibilityEvents = events.filter(e => e.eventType === "visibility");
  const tabHidden = visibilityEvents.filter(e => (e.metadata as any)?.hidden === true);

  // Detect long pauses (> 30s without any event)
  const pauses: { startMs: number; durationMs: number }[] = [];
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].timestampMs - events[i - 1].timestampMs;
    if (gap > 30000) {
      pauses.push({ startMs: events[i - 1].timestampMs, durationMs: gap });
    }
  }

  // Detect suspiciously fast answers (< 2s per question)
  const answerEvents = events.filter(e => e.eventType === "answer_selected");
  const fastAnswers = answerEvents.filter((e, i) => {
    if (i === 0) return false;
    return e.timestampMs - answerEvents[i - 1].timestampMs < 2000;
  });

  const anomalies: any[] = [];

  if (pasteEvents.length > 0) {
    anomalies.push({
      type: "copy_paste",
      severity: "high",
      timestampMs: pasteEvents[0].timestampMs,
      description: `Wykryto ${pasteEvents.length} operacji wklejania tekstu.`,
    });
  }

  if (tabHidden.length > 2) {
    anomalies.push({
      type: "tab_switch",
      severity: "medium",
      timestampMs: tabHidden[0]?.timestampMs ?? 0,
      description: `Uczestnik przełączył zakładkę/okno ${tabHidden.length} razy.`,
    });
  }

  if (pauses.length > 0) {
    anomalies.push({
      type: "long_pause",
      severity: pauses[0].durationMs > 120000 ? "high" : "medium",
      timestampMs: pauses[0].startMs,
      description: `${pauses.length} długich przerw (>${Math.round(pauses[0].durationMs / 1000)}s).`,
    });
  }

  if (fastAnswers.length > 3) {
    anomalies.push({
      type: "fast_answers",
      severity: "medium",
      timestampMs: fastAnswers[0]?.timestampMs ?? 0,
      description: `${fastAnswers.length} odpowiedzi udzielonych w czasie < 2s — możliwe korzystanie z gotowych odpowiedzi.`,
    });
  }

  // Mouse movement analysis — too linear = suspicious (bot-like)
  if (mouseEvents.length > 10) {
    const speeds: number[] = [];
    for (let i = 1; i < Math.min(mouseEvents.length, 100); i++) {
      const dx = (mouseEvents[i].x ?? 0) - (mouseEvents[i - 1].x ?? 0);
      const dy = (mouseEvents[i].y ?? 0) - (mouseEvents[i - 1].y ?? 0);
      const dt = mouseEvents[i].timestampMs - mouseEvents[i - 1].timestampMs;
      if (dt > 0) speeds.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((a, b) => a + Math.pow(b - avgSpeed, 2), 0) / speeds.length;

    if (variance < 0.0001 && mouseEvents.length > 50) {
      anomalies.push({
        type: "unnatural_mouse",
        severity: "high",
        timestampMs: 0,
        description: "Ruchy myszy są zbyt regularne — możliwe użycie automatyzacji.",
      });
    }
  }

  // AI verdict
  const behaviorScore = Math.max(0, 100 - anomalies.reduce((sum, a) => {
    return sum + (a.severity === "high" ? 25 : a.severity === "medium" ? 10 : 5);
  }, 0));

  const behaviorVerdict = behaviorScore >= 70 ? "normal" : behaviorScore >= 40 ? "suspicious" : "anomaly";

  // AI analysis of behavioral patterns
  let aiAnalysis: any = null;
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem analizy behawioralnej w konkursach online. Analizujesz dane telemetryczne z sesji rozwiązywania quizu przez dziecko.",
        },
        {
          role: "user",
          content: `Przeanalizuj dane behawioralne sesji quizu:

Czas trwania: ${Math.round((session.totalDurationMs ?? 0) / 1000)}s
Kliknięcia: ${session.totalClicks}
Klawiatura: ${session.totalKeystrokes} naciśnięć
Przełączenia zakładek: ${session.tabSwitchCount}
Copy-paste: ${session.copyPasteCount}
Długie przerwy: ${pauses.length}
Wykryte anomalie: ${JSON.stringify(anomalies)}

Oceń czy zachowanie jest typowe dla dziecka rozwiązującego quiz samodzielnie. Zwróć ocenę i uzasadnienie.`,
        },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string") aiAnalysis = { summary: content };
  } catch { /* ignore */ }

  await db.update(telemetrySessions).set({
    behaviorVerdict,
    behaviorScore,
    anomalies,
    aiAnalysis,
    status: "analysed",
    totalClicks: clickEvents.length,
    totalKeystrokes: keyEvents.length,
    tabSwitchCount: tabHidden.length,
    copyPasteCount: pasteEvents.length,
    pauseCount: pauses.length,
  }).where(eq(telemetrySessions.id, sessionId));
}

export const videoVerificationRouter = router({
  // ── Manual video verification ──────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      connectionId: z.number().optional(),
      verdict: z.enum(["independent", "suspicious", "intervention"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(videoVerifications)
        .orderBy(desc(videoVerifications.createdAt))
        .limit(100);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [v] = await db.select().from(videoVerifications)
        .where(eq(videoVerifications.id, input.id)).limit(1);
      return v ?? null;
    }),

  // Submit video for verification (manual mode)
  submit: protectedProcedure
    .input(z.object({
      connectionId: z.number().optional(),
      snapshotId: z.number().optional(),
      participantName: z.string(),
      participantEmail: z.string().optional(),
      videoUrl: z.string().url(),
      videoSource: z.enum(["dropbox", "google_drive", "direct_url", "email_attachment"]).default("direct_url"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [result] = await db.insert(videoVerifications).values({
        connectionId: input.connectionId ?? null,
        snapshotId: input.snapshotId ?? null,
        participantName: input.participantName,
        participantEmail: input.participantEmail ?? null,
        videoUrl: input.videoUrl,
        videoSource: input.videoSource,
        status: "pending",
      });
      const verificationId = (result as any).insertId as number;

      // Run async analysis
      analyzeVideoWithAI(verificationId, input.videoUrl, input.participantName).catch(console.error);

      return { id: verificationId };
    }),

  // Public endpoint — participant submits their own video
  publicSubmit: publicProcedure
    .input(z.object({
      participantName: z.string().min(2),
      participantEmail: z.string().email(),
      videoUrl: z.string().url(),
      videoSource: z.enum(["dropbox", "google_drive", "direct_url", "email_attachment"]).default("direct_url"),
      quizToken: z.string().optional(), // optional quiz identifier
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [result] = await db.insert(videoVerifications).values({
        connectionId: null,
        snapshotId: null,
        participantName: input.participantName,
        participantEmail: input.participantEmail,
        videoUrl: input.videoUrl,
        videoSource: input.videoSource,
        status: "pending",
      });
      const verificationId = (result as any).insertId as number;

      analyzeVideoWithAI(verificationId, input.videoUrl, input.participantName).catch(console.error);

      return { id: verificationId, message: "Nagranie zostało przyjęte do weryfikacji. Wynik zostanie wysłany na podany adres email." };
    }),

  // Update reviewer notes
  addNotes: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(videoVerifications)
        .set({ reviewerNotes: input.notes })
        .where(eq(videoVerifications.id, input.id));
      return { success: true };
    }),

  // Override verdict manually
  overrideVerdict: protectedProcedure
    .input(z.object({
      id: z.number(),
      verdict: z.enum(["independent", "suspicious", "intervention"]),
      notes: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(videoVerifications).set({
        verdict: input.verdict,
        reviewerNotes: `[RĘCZNA ZMIANA] ${input.notes}`,
      }).where(eq(videoVerifications.id, input.id));
      return { success: true };
    }),

  // Re-analyze
  reanalyze: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [v] = await db.select().from(videoVerifications)
        .where(eq(videoVerifications.id, input.id)).limit(1);
      if (!v) throw new Error("Not found");
      await db.update(videoVerifications).set({ status: "pending", verdict: null }).where(eq(videoVerifications.id, input.id));
      analyzeVideoWithAI(input.id, v.videoUrl, v.participantName ?? "Uczestnik").catch(console.error);
      return { success: true };
    }),

  // Stats
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, independent: 0, suspicious: 0, intervention: 0, pending: 0 };
    const all = await db.select().from(videoVerifications);
    return {
      total: all.length,
      independent: all.filter(v => v.verdict === "independent").length,
      suspicious: all.filter(v => v.verdict === "suspicious").length,
      intervention: all.filter(v => v.verdict === "intervention").length,
      pending: all.filter(v => v.status === "pending" || v.status === "processing").length,
    };
  }),

  // ── Telemetry ──────────────────────────────────────────────────────────────
  telemetry: router({
    // Create new session (called when participant opens quiz browser)
    createSession: publicProcedure
      .input(z.object({
        connectionId: z.number().optional(),
        snapshotId: z.number().optional(),
        wpQuizId: z.number().optional(),
        participantName: z.string().optional(),
        participantEmail: z.string().optional(),
        userAgent: z.string().optional(),
        screenWidth: z.number().optional(),
        screenHeight: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const token = nanoid(32);
        const [result] = await db.insert(telemetrySessions).values({
          sessionToken: token,
          connectionId: input.connectionId ?? null,
          snapshotId: input.snapshotId ?? null,
          wpQuizId: input.wpQuizId ?? null,
          participantName: input.participantName ?? null,
          participantEmail: input.participantEmail ?? null,
          userAgent: input.userAgent ?? null,
          screenWidth: input.screenWidth ?? null,
          screenHeight: input.screenHeight ?? null,
          status: "active",
        });
        return { sessionId: (result as any).insertId as number, token };
      }),

    // Batch insert events (called periodically from browser)
    pushEvents: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        events: z.array(z.object({
          eventType: z.string(),
          timestampMs: z.number(),
          x: z.number().optional(),
          y: z.number().optional(),
          targetElement: z.string().optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { saved: 0 };

        const [session] = await db.select().from(telemetrySessions)
          .where(eq(telemetrySessions.sessionToken, input.sessionToken)).limit(1);
        if (!session) return { saved: 0 };

        if (input.events.length === 0) return { saved: 0 };

        await db.insert(telemetryEvents).values(
          input.events.map(e => ({
            sessionId: session.id,
            eventType: e.eventType,
            timestampMs: e.timestampMs,
            x: e.x ?? null,
            y: e.y ?? null,
            targetElement: e.targetElement ?? null,
            metadata: e.metadata ?? null,
          }))
        );

        return { saved: input.events.length };
      }),

    // Complete session and trigger AI analysis
    completeSession: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        totalDurationMs: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };

        const [session] = await db.select().from(telemetrySessions)
          .where(eq(telemetrySessions.sessionToken, input.sessionToken)).limit(1);
        if (!session) return { success: false };

        await db.update(telemetrySessions).set({
          status: "completed",
          totalDurationMs: input.totalDurationMs,
          completedAt: new Date(),
        }).where(eq(telemetrySessions.id, session.id));

        // Trigger AI analysis async
        analyzeTelemetryWithAI(session.id).catch(console.error);

        return { success: true };
      }),

    // List sessions (admin)
    listSessions: protectedProcedure
      .input(z.object({
        verdict: z.enum(["normal", "suspicious", "anomaly"]).optional(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(telemetrySessions)
          .orderBy(desc(telemetrySessions.createdAt))
          .limit(input.limit);
      }),

    // Get session detail with events
    getSession: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [session] = await db.select().from(telemetrySessions)
          .where(eq(telemetrySessions.id, input.id)).limit(1);
        if (!session) return null;

        const events = await db.select().from(telemetryEvents)
          .where(eq(telemetryEvents.sessionId, input.id))
          .orderBy(telemetryEvents.timestampMs)
          .limit(1000);

        return { session, events };
      }),

    // Re-analyze session
    reanalyze: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        analyzeTelemetryWithAI(input.id).catch(console.error);
        return { success: true };
      }),

    // Telemetry stats
    stats: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, normal: 0, suspicious: 0, anomaly: 0, active: 0 };
      const all = await db.select().from(telemetrySessions);
      return {
        total: all.length,
        normal: all.filter(s => s.behaviorVerdict === "normal").length,
        suspicious: all.filter(s => s.behaviorVerdict === "suspicious").length,
        anomaly: all.filter(s => s.behaviorVerdict === "anomaly").length,
        active: all.filter(s => s.status === "active").length,
      };
    }),
  }),
});
