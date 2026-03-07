import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { behavioralProfiles, behavioralEvents } from "../../drizzle/schema";
import { eq, desc, and, like, or } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// ─── Progi behawioralne per grupa wiekowa ─────────────────────────────────────
const AGE_GROUP_THRESHOLDS = {
  zerowka: {
    parentPresenceNormal: true,       // obecność rodzica = NORMALNA
    minCompletionTimeMs: 30_000,      // min 30s (dziecko 5-6 lat)
    maxCompletionTimeMs: 3_600_000,   // max 60 min
    perfectScoreSuspiciousMs: 120_000, // idealny wynik w <2 min = podejrzane
    copyPasteRisk: "low",
    cheatingRiskMultiplier: 0.3,      // niskie ryzyko ściągania
    notes: "Zerówka: obecność rodzica normalna, wolne tempo akceptowane, brak podejrzeń o ściąganie",
  },
  klasa_1: {
    parentPresenceNormal: true,
    minCompletionTimeMs: 60_000,
    maxCompletionTimeMs: 3_600_000,
    perfectScoreSuspiciousMs: 180_000,
    copyPasteRisk: "low",
    cheatingRiskMultiplier: 0.4,
    notes: "Klasa 1: obecność rodzica akceptowalna, wsparcie techniczne OK",
  },
  klasa_2: {
    parentPresenceNormal: true,
    minCompletionTimeMs: 90_000,
    maxCompletionTimeMs: 2_700_000,
    perfectScoreSuspiciousMs: 240_000,
    copyPasteRisk: "low",
    cheatingRiskMultiplier: 0.5,
    notes: "Klasa 2: obecność rodzica akceptowalna, samodzielność rosnąca",
  },
  klasa_3: {
    parentPresenceNormal: false,      // obecność rodzica = żółta flaga
    minCompletionTimeMs: 120_000,
    maxCompletionTimeMs: 2_400_000,
    perfectScoreSuspiciousMs: 300_000,
    copyPasteRisk: "medium",
    cheatingRiskMultiplier: 0.7,
    notes: "Klasa 3: samodzielność oczekiwana, obecność rodzica wymaga wyjaśnienia",
  },
  klasa_4: {
    parentPresenceNormal: false,
    minCompletionTimeMs: 150_000,
    maxCompletionTimeMs: 2_100_000,
    perfectScoreSuspiciousMs: 360_000,
    copyPasteRisk: "high",
    cheatingRiskMultiplier: 0.9,
    notes: "Klasa 4: pełna samodzielność oczekiwana, ryzyko ściągania przez AI",
  },
  klasa_5: {
    parentPresenceNormal: false,
    minCompletionTimeMs: 180_000,
    maxCompletionTimeMs: 1_800_000,
    perfectScoreSuspiciousMs: 420_000,
    copyPasteRisk: "high",
    cheatingRiskMultiplier: 1.0,
    notes: "Klasa 5: pełna samodzielność, wysokie ryzyko użycia AI/ściągania",
  },
  klasa_6: {
    parentPresenceNormal: false,
    minCompletionTimeMs: 180_000,
    maxCompletionTimeMs: 1_800_000,
    perfectScoreSuspiciousMs: 480_000,
    copyPasteRisk: "high",
    cheatingRiskMultiplier: 1.0,
    notes: "Klasa 6: pełna samodzielność, najwyższe ryzyko użycia AI/ściągania",
  },
};

// ─── Router ──────────────────────────────────────────────────────────────────
export const behavioralProfileRouter = router({

  // Pobierz lub utwórz profil uczestnika
  getOrCreate: protectedProcedure
    .input(z.object({
      participantEmail: z.string().email(),
      participantName: z.string().optional(),
      role: z.enum(["child", "parent", "teacher"]),
      ageGroup: z.enum(["zerowka", "klasa_1", "klasa_2", "klasa_3", "klasa_4", "klasa_5", "klasa_6"]).optional(),
      schoolId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      const existing = await db.select().from(behavioralProfiles)
        .where(and(
          eq(behavioralProfiles.participantEmail, input.participantEmail),
          eq(behavioralProfiles.role, input.role),
        )).limit(1);

      if (existing.length > 0) return existing[0];

      const [result] = await db.insert(behavioralProfiles).values({
        participantEmail: input.participantEmail,
        participantName: input.participantName,
        role: input.role,
        ageGroup: input.ageGroup,
        schoolId: input.schoolId,
        participationCount: 0,
        cheatingRiskScore: 0,
        interventionRiskScore: 0,
        complaintRiskScore: 0,
        organizationalRiskScore: 0,
        isHighRisk: false,
        requiresSpecialAttention: false,
      });

      const id = (result as any).insertId;
      const [created] = await db.select().from(behavioralProfiles).where(eq(behavioralProfiles.id, id));
      return created;
    }),

  // Aktualizuj profil po sesji quizu (telemetria)
  updateFromTelemetry: protectedProcedure
    .input(z.object({
      participantEmail: z.string().email(),
      ageGroup: z.enum(["zerowka", "klasa_1", "klasa_2", "klasa_3", "klasa_4", "klasa_5", "klasa_6"]),
      sessionData: z.object({
        completionTimeMs: z.number(),
        score: z.number(),          // 0-100
        copyPasteCount: z.number().default(0),
        tabSwitchCount: z.number().default(0),
        longPauseCount: z.number().default(0),
        answerChangedCount: z.number().default(0),
        parentDetectedInVideo: z.boolean().default(false),
        parentInterventionDetected: z.boolean().default(false),
      }),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      const thresholds = AGE_GROUP_THRESHOLDS[input.ageGroup];

      // Oblicz ryzyko ściągania
      let cheatingRisk = 0;
      const { sessionData: s } = input;

      // Zbyt szybkie rozwiązanie z idealnym wynikiem
      if (s.score >= 95 && s.completionTimeMs < thresholds.perfectScoreSuspiciousMs) {
        cheatingRisk += 40 * thresholds.cheatingRiskMultiplier;
      }
      // Copy-paste
      if (s.copyPasteCount > 0) cheatingRisk += 20 * thresholds.cheatingRiskMultiplier;
      if (s.copyPasteCount > 3) cheatingRisk += 20 * thresholds.cheatingRiskMultiplier;
      // Przełączanie zakładek
      if (s.tabSwitchCount > 2) cheatingRisk += 15 * thresholds.cheatingRiskMultiplier;
      // Ingerencja rodzica (tylko dla kl.3+)
      if (s.parentInterventionDetected && !thresholds.parentPresenceNormal) {
        cheatingRisk += 30;
      }

      cheatingRisk = Math.min(100, Math.round(cheatingRisk));

      // Pobierz istniejący profil
      const existing = await db.select().from(behavioralProfiles)
        .where(and(
          eq(behavioralProfiles.participantEmail, input.participantEmail),
          eq(behavioralProfiles.role, "child"),
        )).limit(1);

      if (existing.length > 0) {
        const profile = existing[0];
        const newCount = (profile.participationCount ?? 0) + 1;
        const newAvgScore = Math.round(((profile.averageScore ?? 0) * (newCount - 1) + s.score) / newCount);
        const newAvgTime = Math.round(((profile.averageCompletionTimeMs ?? 0) * (newCount - 1) + s.completionTimeMs) / newCount);
        const newCheatingRisk = Math.max(profile.cheatingRiskScore ?? 0, cheatingRisk);

        await db.update(behavioralProfiles).set({
          participationCount: newCount,
          averageScore: newAvgScore,
          averageCompletionTimeMs: newAvgTime,
          cheatingRiskScore: newCheatingRisk,
          isHighRisk: newCheatingRisk >= 60,
          requiresSpecialAttention: newCheatingRisk >= 80,
          ageGroup: input.ageGroup,
        }).where(eq(behavioralProfiles.id, profile.id));

        // Dodaj zdarzenia behawioralne
        const events: any[] = [];
        if (s.copyPasteCount > 0) {
          events.push({
            profileId: profile.id,
            eventType: "copy_paste_detected",
            severity: s.copyPasteCount > 3 ? "critical" : "warning",
            description: `Wykryto ${s.copyPasteCount} operacji copy-paste podczas quizu`,
            evidence: JSON.stringify({ count: s.copyPasteCount }),
          });
        }
        if (s.tabSwitchCount > 2) {
          events.push({
            profileId: profile.id,
            eventType: "tab_switch",
            severity: "warning",
            description: `Uczestnik przełączał zakładki ${s.tabSwitchCount} razy`,
            evidence: JSON.stringify({ count: s.tabSwitchCount }),
          });
        }
        if (s.score >= 95 && s.completionTimeMs < thresholds.perfectScoreSuspiciousMs) {
          events.push({
            profileId: profile.id,
            eventType: "perfect_score_fast",
            severity: "warning",
            description: `Idealny wynik (${s.score}%) w podejrzanie krótkim czasie (${Math.round(s.completionTimeMs / 1000)}s)`,
            evidence: JSON.stringify({ score: s.score, timeMs: s.completionTimeMs }),
          });
        }
        if (s.parentInterventionDetected && !thresholds.parentPresenceNormal) {
          events.push({
            profileId: profile.id,
            eventType: "parent_intervention",
            severity: "critical",
            description: "Wykryto ingerencję rodzica/opiekuna w trakcie quizu",
            evidence: JSON.stringify({ ageGroup: input.ageGroup }),
          });
        }

        if (events.length > 0) {
          await db.insert(behavioralEvents).values(events);
        }

        // Powiadom właściciela jeśli wysokie ryzyko
        if (newCheatingRisk >= 80) {
          await notifyOwner({
            title: `⚠️ Wysokie ryzyko niesamodzielności: ${input.participantEmail}`,
            content: `Uczestnik ${input.participantEmail} (${input.ageGroup}) uzyskał wynik ryzyka ${newCheatingRisk}/100.\n\nWykryte zdarzenia:\n${events.map(e => `- ${e.description}`).join("\n")}\n\nWymagana ręczna weryfikacja.`,
          });
        }

        return { profileId: profile.id, cheatingRisk: newCheatingRisk, events: events.length };
      }

      return { profileId: null, cheatingRisk, events: 0 };
    }),

  // Analiza AI profilu uczestnika — predykcja potrzeb i ryzyk
  analyzeWithAI: protectedProcedure
    .input(z.object({
      profileId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      const [profile] = await db.select().from(behavioralProfiles).where(eq(behavioralProfiles.id, input.profileId));
      if (!profile) throw new Error("Profil nie znaleziony");

      const events = await db.select().from(behavioralEvents)
        .where(eq(behavioralEvents.profileId, input.profileId))
        .orderBy(desc(behavioralEvents.occurredAt))
        .limit(20);

      const prompt = `Jesteś ekspertem ds. edukacji dzieci i organizacji konkursów dla uczniów klas 0-6.

Analizujesz profil behawioralny uczestnika konkursu:

**Dane profilu:**
- Email: ${profile.participantEmail}
- Rola: ${profile.role}
- Grupa wiekowa: ${profile.ageGroup ?? "nieznana"}
- Liczba edycji: ${profile.participationCount ?? 0}
- Średni wynik: ${profile.averageScore ?? "brak"}%
- Średni czas: ${profile.averageCompletionTimeMs ? Math.round((profile.averageCompletionTimeMs ?? 0) / 60000) + " min" : "brak"}
- Ryzyko niesamodzielności: ${profile.cheatingRiskScore ?? 0}/100
- Ryzyko ingerencji rodzica: ${profile.interventionRiskScore ?? 0}/100
- Ryzyko pretensji: ${profile.complaintRiskScore ?? 0}/100
- Wymaga uwagi: ${profile.requiresSpecialAttention ? "TAK" : "NIE"}

**Ostatnie zdarzenia behawioralne (${events.length}):**
${events.map(e => `- [${e.severity}] ${e.eventType}: ${e.description}`).join("\n") || "Brak zdarzeń"}

Odpowiedz w JSON:
{
  "needsAnalysis": "Analiza potrzeb uczestnika (2-3 zdania, po polsku)",
  "predictedRisks": ["lista przewidywanych ryzyk"],
  "recommendations": ["lista rekomendacji dla organizatora"],
  "requiresSpecialAttention": true/false,
  "specialAttentionNote": "Notatka dla organizatora jeśli wymaga uwagi",
  "confidence": 0-100
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Jesteś ekspertem ds. edukacji dzieci. Odpowiadasz wyłącznie w JSON." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "behavioral_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                needsAnalysis: { type: "string" },
                predictedRisks: { type: "array", items: { type: "string" } },
                recommendations: { type: "array", items: { type: "string" } },
                requiresSpecialAttention: { type: "boolean" },
                specialAttentionNote: { type: "string" },
                confidence: { type: "integer" },
              },
              required: ["needsAnalysis", "predictedRisks", "recommendations", "requiresSpecialAttention", "specialAttentionNote", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent ?? {});
      const analysis = JSON.parse(content);

      // Zapisz analizę do profilu
      await db.update(behavioralProfiles).set({
        aiNeedsAnalysis: analysis.needsAnalysis,
        aiRecommendations: JSON.stringify(analysis.recommendations),
        predictedRisks: JSON.stringify(analysis.predictedRisks),
        requiresSpecialAttention: analysis.requiresSpecialAttention,
        specialAttentionNote: analysis.specialAttentionNote,
        predictionConfidence: analysis.confidence,
      }).where(eq(behavioralProfiles.id, input.profileId));

      return analysis;
    }),

  // Lista profili z filtrami
  list: protectedProcedure
    .input(z.object({
      role: z.enum(["child", "parent", "teacher"]).optional(),
      ageGroup: z.string().optional(),
      isHighRisk: z.boolean().optional(),
      requiresAttention: z.boolean().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { profiles: [], total: 0 };

      const conditions = [];
      if (input.role) conditions.push(eq(behavioralProfiles.role, input.role));
      if (input.isHighRisk !== undefined) conditions.push(eq(behavioralProfiles.isHighRisk, input.isHighRisk));
      if (input.requiresAttention !== undefined) conditions.push(eq(behavioralProfiles.requiresSpecialAttention, input.requiresAttention));

      const profiles = await db.select().from(behavioralProfiles)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(behavioralProfiles.cheatingRiskScore))
        .limit(100);

      // Filtruj po wyszukiwaniu
      const filtered = input.search
        ? profiles.filter(p =>
            p.participantEmail?.toLowerCase().includes(input.search!.toLowerCase()) ||
            p.participantName?.toLowerCase().includes(input.search!.toLowerCase())
          )
        : profiles;

      return { profiles: filtered, total: filtered.length };
    }),

  // Pobierz szczegóły profilu z zdarzeniami
  getDetail: protectedProcedure
    .input(z.object({ profileId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      const [profile] = await db.select().from(behavioralProfiles).where(eq(behavioralProfiles.id, input.profileId));
      if (!profile) throw new Error("Profil nie znaleziony");

      const events = await db.select().from(behavioralEvents)
        .where(eq(behavioralEvents.profileId, input.profileId))
        .orderBy(desc(behavioralEvents.occurredAt))
        .limit(50);

      const thresholds = profile.ageGroup ? AGE_GROUP_THRESHOLDS[profile.ageGroup as keyof typeof AGE_GROUP_THRESHOLDS] : null;

      return { profile, events, thresholds };
    }),

  // Pobierz progi dla grupy wiekowej
  getThresholds: protectedProcedure
    .input(z.object({
      ageGroup: z.enum(["zerowka", "klasa_1", "klasa_2", "klasa_3", "klasa_4", "klasa_5", "klasa_6"]),
    }))
    .query(({ input }) => {
      return AGE_GROUP_THRESHOLDS[input.ageGroup];
    }),

  // Statystyki wszystkich profili
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const all = await db.select().from(behavioralProfiles);
    return {
      total: all.length,
      children: all.filter(p => p.role === "child").length,
      parents: all.filter(p => p.role === "parent").length,
      teachers: all.filter(p => p.role === "teacher").length,
      highRisk: all.filter(p => p.isHighRisk).length,
      requiresAttention: all.filter(p => p.requiresSpecialAttention).length,
      avgCheatingRisk: all.length > 0
        ? Math.round(all.reduce((s, p) => s + (p.cheatingRiskScore ?? 0), 0) / all.length)
        : 0,
      byAgeGroup: ["zerowka", "klasa_1", "klasa_2", "klasa_3", "klasa_4", "klasa_5", "klasa_6"].map(ag => ({
        ageGroup: ag,
        count: all.filter(p => p.ageGroup === ag).length,
        avgRisk: (() => {
          const group = all.filter(p => p.ageGroup === ag);
          return group.length > 0 ? Math.round(group.reduce((s, p) => s + (p.cheatingRiskScore ?? 0), 0) / group.length) : 0;
        })(),
      })),
    };
  }),
});
