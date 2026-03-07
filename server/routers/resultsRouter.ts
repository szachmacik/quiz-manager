import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  contestResults, participants, schools, awards, awardHistory,
  shippingBatches, InsertContestResult, InsertShippingBatch
} from "../../drizzle/schema";
import { eq, desc, asc, and, gte, sql, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// ─── Silnik rankingowy ────────────────────────────────────────────────────────
async function computeRankings(edition: string) {
  const db = await getDb();
  if (!db) throw new Error("Brak połączenia z bazą danych");

  // Pobierz wszystkie wyniki dla danej edycji
  const results = await db.select().from(contestResults)
    .where(eq(contestResults.contestEdition, edition))
    .orderBy(desc(contestResults.score), asc(contestResults.completionTimeMs));

  // Grupuj po kategoriach wiekowych
  const byCategory: Record<string, typeof results> = {};
  for (const r of results) {
    const cat = r.ageGroup ?? "ogólna";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  }

  // Oblicz rankingi per kategoria
  const updates: Array<{ id: number; rank: number; isWinner: boolean; isLaureate: boolean }> = [];
  for (const [, catResults] of Object.entries(byCategory)) {
    // Posortowane już po score DESC, completionTimeMs ASC
    catResults.forEach((r, idx) => {
      const rank = idx + 1;
      const isWinner = rank <= 3;
      const isLaureate = (r.score ?? 0) >= 90;
      updates.push({ id: r.id, rank, isWinner, isLaureate });
    });
  }

  // Zapisz rankingi do bazy
  for (const u of updates) {
    await db.update(contestResults)
      .set({ rank: u.rank, isWinner: u.isWinner, isLaureate: u.isLaureate })
      .where(eq(contestResults.id, u.id));
  }

  return { updated: updates.length, categories: Object.keys(byCategory) };
}

// ─── Optymalizator wysyłki ────────────────────────────────────────────────────
async function optimizeShipping(edition: string) {
  const db = await getDb();
  if (!db) throw new Error("Brak połączenia z bazą danych");

  // Pobierz zwycięzców i laureatów
  const winners = await db.select({
    resultId: contestResults.id,
    participantId: contestResults.participantId,
    participantName: contestResults.participantName,
    participantEmail: contestResults.participantEmail,
    schoolId: contestResults.schoolId,
    ageGroup: contestResults.ageGroup,
    score: contestResults.score,
    rank: contestResults.rank,
    isWinner: contestResults.isWinner,
    isLaureate: contestResults.isLaureate,
  }).from(contestResults)
    .where(and(
      eq(contestResults.contestEdition, edition),
      sql`(${contestResults.isWinner} = 1 OR ${contestResults.isLaureate} = 1)`
    ));

  // Grupuj po szkołach
  const bySchool: Record<number, typeof winners> = {};
  const noSchool: typeof winners = [];

  for (const w of winners) {
    if (w.schoolId) {
      if (!bySchool[w.schoolId]) bySchool[w.schoolId] = [];
      bySchool[w.schoolId].push(w);
    } else {
      noSchool.push(w);
    }
  }

  // Pobierz dane szkół
  const schoolIds = Object.keys(bySchool).map(Number);
  const schoolData = schoolIds.length > 0
    ? await db.select().from(schools).where(inArray(schools.id, schoolIds))
    : [];
  const schoolMap = new Map(schoolData.map(s => [s.id, s]));

  // Sprawdź historię nagród dla każdego uczestnika
  const participantIds = winners.map(w => w.participantId).filter(Boolean) as number[];
  const awardHistoryData = participantIds.length > 0
    ? await db.select().from(awardHistory).where(inArray(awardHistory.participantId, participantIds))
    : [];
  const awardHistoryMap = new Map<number, typeof awardHistoryData>();
  for (const ah of awardHistoryData) {
    if (!awardHistoryMap.has(ah.participantId)) awardHistoryMap.set(ah.participantId, []);
    awardHistoryMap.get(ah.participantId)!.push(ah);
  }

  // Utwórz paczki zbiorcze
  const batches: InsertShippingBatch[] = [];

  for (const [schoolIdStr, schoolWinners] of Object.entries(bySchool)) {
    const schoolId = Number(schoolIdStr);
    const school = schoolMap.get(schoolId);

    // Sprawdź czy ktoś już dostał nagrodę
    const hasRepeatRecipient = schoolWinners.some(w => {
      if (!w.participantId) return false;
      const history = awardHistoryMap.get(w.participantId) ?? [];
      return history.length > 0;
    });

    batches.push({
      contestEdition: edition,
      schoolId,
      schoolName: school?.name ?? `Szkoła ID ${schoolId}`,
      recipientCount: schoolWinners.length,
      recipientIds: schoolWinners.map(w => w.resultId),
      shippingAddress: school
        ? `${school.teacherName ?? ""}\n${school.name}\n${school.address ?? ""}\n${school.postalCode ?? ""} ${school.city ?? ""}`.trim()
        : null,
      teacherName: school?.teacherName ?? null,
      teacherEmail: school?.teacherEmail ?? null,
      status: "draft",
      hasNewAwardNeeded: hasRepeatRecipient,
      notes: hasRepeatRecipient
        ? "⚠️ Uwaga: jeden lub więcej uczestników już wcześniej otrzymał nagrodę — przygotuj nową nagrodę"
        : null,
    });
  }

  // Paczka dla uczestników bez szkoły
  if (noSchool.length > 0) {
    batches.push({
      contestEdition: edition,
      schoolId: 0,
      schoolName: "Uczestnicy indywidualni",
      recipientCount: noSchool.length,
      recipientIds: noSchool.map(w => w.resultId),
      shippingAddress: null,
      teacherName: null,
      teacherEmail: null,
      status: "draft",
      hasNewAwardNeeded: false,
      notes: "Uczestnicy bez przypisanej szkoły — wymagają indywidualnych adresów",
    });
  }

  // Zapisz paczki do bazy (usuń stare dla tej edycji najpierw)
  await db.delete(shippingBatches).where(eq(shippingBatches.contestEdition, edition));
  if (batches.length > 0) {
    await db.insert(shippingBatches).values(batches);
  }

  return {
    totalBatches: batches.length,
    totalRecipients: winners.length,
    schoolBatches: Object.keys(bySchool).length,
    repeatRecipients: batches.filter(b => b.hasNewAwardNeeded).length,
  };
}

// ─── Router ────────────────────────────────────────────────────────────────────
export const resultsRouter = router({
  // Pobierz wszystkie edycje konkursów
  listEditions: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.selectDistinct({ edition: contestResults.contestEdition, name: contestResults.contestName })
      .from(contestResults)
      .orderBy(desc(contestResults.contestEdition));
    return rows;
  }),

  // Pobierz wyniki dla edycji
  getByEdition: protectedProcedure
    .input(z.object({ edition: z.string(), ageGroup: z.string().optional(), winnersOnly: z.boolean().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(contestResults.contestEdition, input.edition)];
      if (input.ageGroup) conditions.push(eq(contestResults.ageGroup, input.ageGroup));
      if (input.winnersOnly) conditions.push(sql`(${contestResults.isWinner} = 1 OR ${contestResults.isLaureate} = 1)`);
      return db.select().from(contestResults)
        .where(and(...conditions))
        .orderBy(asc(contestResults.rank), desc(contestResults.score));
    }),

  // Dodaj wynik ręcznie
  addResult: protectedProcedure
    .input(z.object({
      contestName: z.string(),
      contestEdition: z.string(),
      participantName: z.string(),
      participantEmail: z.string().email(),
      ageGroup: z.string().optional(),
      score: z.number().min(0).max(100),
      correctAnswers: z.number().optional(),
      totalQuestions: z.number().optional(),
      completionTimeMs: z.number().optional(),
      source: z.enum(["wp_quiz", "manual", "import_csv", "import_mailerlite", "import_facebook"]).default("manual"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");
      const data: InsertContestResult = {
        contestName: input.contestName,
        contestEdition: input.contestEdition,
        participantName: input.participantName,
        participantEmail: input.participantEmail,
        ageGroup: input.ageGroup,
        score: input.score,
        correctAnswers: input.correctAnswers ?? 0,
        totalQuestions: input.totalQuestions ?? 0,
        completionTimeMs: input.completionTimeMs,
        source: input.source,
        verificationStatus: "pending",
      };
      await db.insert(contestResults).values(data);
      return { success: true };
    }),

  // Import CSV
  importCsv: protectedProcedure
    .input(z.object({
      contestName: z.string(),
      contestEdition: z.string(),
      csvData: z.string(), // raw CSV string
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");

      const lines = input.csvData.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const rows: InsertContestResult[] = [];
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        try {
          const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });

          const score = parseFloat(row["score"] ?? row["wynik"] ?? "0");
          if (isNaN(score)) { errors++; continue; }

          rows.push({
            contestName: input.contestName,
            contestEdition: input.contestEdition,
            participantName: row["name"] ?? row["imie_nazwisko"] ?? row["uczestnik"] ?? "Nieznany",
            participantEmail: row["email"] ?? "",
            ageGroup: row["age_group"] ?? row["kategoria"] ?? row["wiek"],
            score,
            correctAnswers: parseInt(row["correct"] ?? row["poprawne"] ?? "0") || 0,
            totalQuestions: parseInt(row["total"] ?? row["pytania"] ?? "0") || 0,
            completionTimeMs: parseInt(row["time_ms"] ?? row["czas_ms"] ?? "0") || undefined,
            source: "import_csv",
            verificationStatus: "pending",
          });
        } catch {
          errors++;
        }
      }

      if (rows.length > 0) {
        await db.insert(contestResults).values(rows);
      }
      return { imported: rows.length, errors };
    }),

  // Oblicz rankingi
  computeRankings: protectedProcedure
    .input(z.object({ edition: z.string() }))
    .mutation(async ({ input }) => {
      return computeRankings(input.edition);
    }),

  // Optymalizuj wysyłkę
  optimizeShipping: protectedProcedure
    .input(z.object({ edition: z.string() }))
    .mutation(async ({ input }) => {
      const result = await optimizeShipping(input.edition);
      await notifyOwner({
        title: `Wysyłka zoptymalizowana — ${input.edition}`,
        content: `Przygotowano ${result.totalBatches} paczek dla ${result.totalRecipients} uczestników. ${result.repeatRecipients} szkół wymaga nowych nagród.`,
      });
      return result;
    }),

  // Pobierz paczki wysyłkowe
  getShippingBatches: protectedProcedure
    .input(z.object({ edition: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(shippingBatches)
        .where(eq(shippingBatches.contestEdition, input.edition))
        .orderBy(desc(shippingBatches.recipientCount));
    }),

  // Aktualizuj status paczki
  updateBatchStatus: protectedProcedure
    .input(z.object({
      batchId: z.number(),
      status: z.enum(["draft", "ready", "shipped", "delivered"]),
      trackingNumber: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");
      await db.update(shippingBatches)
        .set({ status: input.status, trackingNumber: input.trackingNumber ?? null })
        .where(eq(shippingBatches.id, input.batchId));
      return { success: true };
    }),

  // Eksport CSV adresów wysyłkowych
  exportShippingCsv: protectedProcedure
    .input(z.object({ edition: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return "";
      const batches = await db.select().from(shippingBatches)
        .where(eq(shippingBatches.contestEdition, input.edition));

      const lines = ["Szkoła,Adres,Nauczyciel,Email,Liczba uczestników,Nowa nagroda,Status"];
      for (const b of batches) {
        const addr = (b.shippingAddress ?? "").replace(/\n/g, " | ");
        lines.push(`"${b.schoolName}","${addr}","${b.teacherName ?? ""}","${b.teacherEmail ?? ""}",${b.recipientCount},${b.hasNewAwardNeeded ? "TAK" : "NIE"},${b.status}`);
      }
      return lines.join("\n");
    }),

  // Generuj raport finalny przez AI
  generateFinalReport: protectedProcedure
    .input(z.object({ edition: z.string(), contestName: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");

      const results = await db.select().from(contestResults)
        .where(eq(contestResults.contestEdition, input.edition))
        .orderBy(asc(contestResults.rank));

      const winners = results.filter(r => r.isWinner);
      const laureates = results.filter(r => r.isLaureate && !r.isWinner);
      const categories = Array.from(new Set(results.map(r => r.ageGroup ?? "ogólna")));

      const prompt = `Jesteś asystentem organizatora konkursu edukacyjnego dla dzieci.
Przygotuj profesjonalny raport końcowy konkursu "${input.contestName}" (edycja: ${input.edition}).

Dane:
- Łączna liczba uczestników: ${results.length}
- Zwycięzcy (miejsca 1-3): ${winners.length}
- Laureaci (≥90% poprawnych): ${laureates.length}
- Kategorie wiekowe: ${categories.join(", ")}

Zwycięzcy per kategoria:
${categories.map(cat => {
  const catWinners = winners.filter(w => (w.ageGroup ?? "ogólna") === cat);
  return `${cat}: ${catWinners.map(w => `${w.rank}. ${w.participantName} (${w.score?.toFixed(1)}%)`).join(", ")}`;
}).join("\n")}

Napisz raport w języku polskim zawierający:
1. Podsumowanie konkursu
2. Wyniki według kategorii wiekowych
3. Statystyki (średni wynik, najlepszy wynik, czas rozwiązywania)
4. Rekomendacje na przyszłość`;

      const response = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
      const reportText = response.choices[0]?.message?.content ?? "Błąd generowania raportu";

      await notifyOwner({
        title: `Raport finalny gotowy — ${input.contestName} ${input.edition}`,
        content: `Raport zawiera ${results.length} uczestników, ${winners.length} zwycięzców, ${laureates.length} laureatów.`,
      });

      return { report: reportText, stats: { total: results.length, winners: winners.length, laureates: laureates.length } };
    }),
});
