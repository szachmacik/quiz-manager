import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  offlineContests, offlineSubmissions, offlineAnswerSheets, schoolRegistrations,
  schools, InsertOfflineContest, InsertOfflineSubmission, InsertOfflineAnswerSheet
} from "../../drizzle/schema";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

// ─── Generator HTML arkusza (do druku) ───────────────────────────────────────
function generateAnswerSheetHtml(params: {
  contestName: string;
  edition: string;
  ageGroup: string;
  questions: Array<{ id: number; text: string; options: string[]; imageUrl?: string }>;
  logoUrl?: string;
}): string {
  const { contestName, edition, ageGroup, questions } = params;

  const optionLetters = ["A", "B", "C", "D", "E"];

  // Rozmiar czcionki zależny od grupy wiekowej
  const isPreschool = ageGroup.toLowerCase().includes("przedszkolak") || ageGroup.includes("0");
  const fontSize = isPreschool ? "20px" : "14px";
  const circleSize = isPreschool ? "40px" : "28px";

  const questionsHtml = questions.map((q, qi) => `
    <div class="question" style="margin-bottom: ${isPreschool ? "32px" : "20px"}; page-break-inside: avoid;">
      <div class="question-text" style="font-size: ${fontSize}; font-weight: bold; margin-bottom: 10px;">
        ${qi + 1}. ${q.text}
      </div>
      ${q.imageUrl ? `<img src="${q.imageUrl}" style="max-height: 120px; margin-bottom: 8px;" />` : ""}
      <div class="options" style="display: flex; gap: ${isPreschool ? "20px" : "12px"}; flex-wrap: wrap;">
        ${q.options.map((opt, oi) => `
          <div class="option" style="display: flex; align-items: center; gap: 8px;">
            <div class="circle" style="
              width: ${circleSize}; height: ${circleSize};
              border: 3px solid #333;
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-size: ${isPreschool ? "18px" : "13px"};
              font-weight: bold;
              flex-shrink: 0;
            ">${optionLetters[oi]}</div>
            <span style="font-size: ${fontSize};">${opt}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Arkusz odpowiedzi — ${contestName}</title>
  <style>
    @page { margin: 15mm; }
    body { font-family: Arial, sans-serif; color: #000; }
    .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: ${isPreschool ? "28px" : "22px"}; font-weight: bold; }
    .subtitle { font-size: ${isPreschool ? "18px" : "14px"}; color: #555; }
    .data-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .field { border-bottom: 2px solid #000; padding: 6px 0; font-size: ${fontSize}; }
    .field-label { font-size: 11px; color: #666; margin-bottom: 2px; }
    .instructions { background: #f5f5f5; border: 2px solid #ccc; padding: 12px; margin-bottom: 20px; border-radius: 6px; }
    .instructions p { margin: 4px 0; font-size: ${isPreschool ? "16px" : "12px"}; }
    .footer { margin-top: 24px; border-top: 2px solid #000; padding-top: 10px; font-size: 11px; color: #666; text-align: center; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">🏆 ${contestName}</div>
    <div class="subtitle">Edycja: ${edition} | Kategoria: ${ageGroup}</div>
    <div class="subtitle">ARKUSZ ODPOWIEDZI</div>
  </div>

  <div class="data-fields">
    <div class="field">
      <div class="field-label">IMIĘ I NAZWISKO UCZESTNIKA</div>
      &nbsp;
    </div>
    <div class="field">
      <div class="field-label">WIEK / KLASA</div>
      &nbsp;
    </div>
    <div class="field">
      <div class="field-label">NAZWA SZKOŁY / PRZEDSZKOLA</div>
      &nbsp;
    </div>
    <div class="field">
      <div class="field-label">EMAIL RODZICA / OPIEKUNA</div>
      &nbsp;
    </div>
  </div>

  <div class="instructions">
    ${isPreschool ? `
      <p>📝 <strong>Jak wypełnić?</strong></p>
      <p>👉 Zamaluj kółko przy właściwej odpowiedzi</p>
      <p>✏️ Używaj ołówka lub długopisu</p>
      <p>❌ Jeśli się pomylisz, przekreśl i zaznacz właściwe</p>
    ` : `
      <p><strong>Instrukcja:</strong> Zamaluj lub zakreśl kółko przy właściwej odpowiedzi (A, B, C lub D).</p>
      <p>W razie pomyłki: przekreśl błędne kółko i wyraźnie zaznacz właściwe.</p>
      <p>Pisz czytelnie. Nie używaj korektora.</p>
    `}
  </div>

  <div class="questions">
    ${questionsHtml}
  </div>

  <div class="footer">
    <p>Po wypełnieniu: włóż arkusz do koperty i wyślij na adres organizatora.</p>
    <p>Nie zginaj arkusza. Piszącego nie wolno zakłócać podczas rozwiązywania testu.</p>
    <p>${contestName} | ${edition} | Arkusz wygenerowany automatycznie</p>
  </div>
</body>
</html>`;
}

// ─── Generator instrukcji dla nauczyciela ─────────────────────────────────────
function generateTeacherInstructionHtml(params: {
  contestName: string;
  edition: string;
  returnAddress: string;
  deadline: string;
}): string {
  const { contestName, edition, returnAddress, deadline } = params;
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Instrukcja dla nauczyciela — ${contestName}</title>
  <style>
    @page { margin: 20mm; }
    body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; }
    h1 { font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 20px; }
    .box { border: 2px solid #000; padding: 12px; margin: 16px 0; border-radius: 4px; }
    .address { font-size: 16px; font-weight: bold; background: #f0f0f0; padding: 12px; }
    .step { display: flex; gap: 12px; margin: 8px 0; }
    .step-num { font-size: 20px; font-weight: bold; color: #333; min-width: 28px; }
  </style>
</head>
<body>
  <h1>📋 Instrukcja dla nauczyciela / opiekuna<br><small>${contestName} — ${edition}</small></h1>

  <h2>Jak przeprowadzić konkurs?</h2>
  <div class="step"><div class="step-num">1.</div><div>Wydrukuj arkusze odpowiedzi — po jednym dla każdego uczestnika.</div></div>
  <div class="step"><div class="step-num">2.</div><div>Rozdaj arkusze uczestnikom. Upewnij się, że każdy ma ołówek lub długopis.</div></div>
  <div class="step"><div class="step-num">3.</div><div>Przeczytaj uczestnikom instrukcję: <em>"Zamaluj kółko przy właściwej odpowiedzi. Masz czas do końca lekcji."</em></div></div>
  <div class="step"><div class="step-num">4.</div><div>Podczas rozwiązywania: nie pomagaj w odpowiedziach. Możesz pomóc przeczytać pytanie.</div></div>
  <div class="step"><div class="step-num">5.</div><div>Zbierz wypełnione arkusze. Sprawdź czy każdy ma podpisane imię i nazwisko.</div></div>
  <div class="step"><div class="step-num">6.</div><div>Włóż arkusze do koperty i wyślij pocztą na adres poniżej.</div></div>

  <div class="box">
    <strong>⏰ Termin nadsyłania: ${deadline}</strong>
  </div>

  <h2>Adres do wysyłki:</h2>
  <div class="address">${returnAddress}</div>

  <h2>Ważne informacje:</h2>
  <ul>
    <li>Nie zginaj arkuszy — pomaga to w skanowaniu.</li>
    <li>Możesz wysłać arkusze wszystkich uczestników w jednej kopercie.</li>
    <li>Wyniki zostaną opublikowane na naszej stronie i przesłane emailem.</li>
    <li>Pytania? Napisz na: <strong>kontakt@konkurs.pl</strong></li>
  </ul>

  <p style="margin-top: 24px; font-size: 12px; color: #666;">
    Dziękujemy za udział w konkursie ${contestName}!
    Organizator zastrzega sobie prawo do weryfikacji prac.
  </p>
</body>
</html>`;
}

// ─── Router ────────────────────────────────────────────────────────────────────
export const offlineRouter = router({
  // Lista konkursów offline
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(offlineContests).orderBy(desc(offlineContests.createdAt));
  }),

  // Pobierz konkurs offline
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(offlineContests).where(eq(offlineContests.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  // Utwórz konkurs offline
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(3),
      edition: z.string(),
      description: z.string().optional(),
      contestDate: z.string().optional(),
      registrationDeadline: z.string().optional(),
      shippingDeadline: z.string().optional(),
      testFormat: z.enum(["paper_scan", "paper_manual", "hybrid"]).default("paper_scan"),
      questionsCount: z.number().default(20),
      passingScore: z.number().default(90),
      requireTeacherSignature: z.boolean().default(true),
      requireParentConsent: z.boolean().default(true),
      rulesText: z.string().optional(),
      returnAddress: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");
      const data: InsertOfflineContest = {
        name: input.name,
        edition: input.edition,
        description: input.description,
        contestDate: input.contestDate ? new Date(input.contestDate) : undefined,
        registrationDeadline: input.registrationDeadline ? new Date(input.registrationDeadline) : undefined,
        shippingDeadline: input.shippingDeadline ? new Date(input.shippingDeadline) : undefined,
        testFormat: input.testFormat,
        questionsCount: input.questionsCount,
        passingScore: input.passingScore,
        requireTeacherSignature: input.requireTeacherSignature,
        requireParentConsent: input.requireParentConsent,
        rulesText: input.rulesText,
        notes: input.returnAddress ? `ADRES_ZWROTNY:${input.returnAddress}` : undefined,
        status: "draft",
      };
      const result = await db.insert(offlineContests).values(data);
      return { id: (result as any).insertId };
    }),

  // Aktualizuj status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "registration", "active", "scoring", "results", "shipping", "completed"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");
      await db.update(offlineContests).set({ status: input.status }).where(eq(offlineContests.id, input.id));
      return { success: true };
    }),

  // Generuj arkusz odpowiedzi (HTML do druku)
  generateAnswerSheet: protectedProcedure
    .input(z.object({
      offlineContestId: z.number(),
      ageGroup: z.string(),
      questions: z.array(z.object({
        id: z.number(),
        text: z.string(),
        options: z.array(z.string()),
        imageUrl: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");

      const contest = await db.select().from(offlineContests)
        .where(eq(offlineContests.id, input.offlineContestId)).limit(1);
      if (!contest[0]) throw new Error("Konkurs nie znaleziony");

      const html = generateAnswerSheetHtml({
        contestName: contest[0].name,
        edition: contest[0].edition ?? "",
        ageGroup: input.ageGroup,
        questions: input.questions,
      });

      // Zapisz arkusz w bazie
      const sheetData: InsertOfflineAnswerSheet = {
        offlineContestId: input.offlineContestId,
        version: `v${Date.now()}`,
        questions: input.questions,
        answerKey: {},
        isActive: true,
      };
      await db.insert(offlineAnswerSheets).values(sheetData);

      return { html, questionsCount: input.questions.length };
    }),

  // Generuj arkusz przez AI (na podstawie tematu)
  generateSheetWithAI: protectedProcedure
    .input(z.object({
      offlineContestId: z.number(),
      ageGroup: z.string(),
      topic: z.string(),
      questionsCount: z.number().default(15),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");

      const contest = await db.select().from(offlineContests)
        .where(eq(offlineContests.id, input.offlineContestId)).limit(1);
      if (!contest[0]) throw new Error("Konkurs nie znaleziony");

      const isPreschool = input.ageGroup.toLowerCase().includes("przedszkolak");
      const difficultyDesc = { easy: "bardzo łatwe", medium: "umiarkowane", hard: "trudne" }[input.difficulty];

      const prompt = `Jesteś ekspertem tworzącym pytania konkursowe dla dzieci.
Stwórz ${input.questionsCount} pytań konkursowych na temat: "${input.topic}"
Kategoria wiekowa: ${input.ageGroup}
Poziom trudności: ${difficultyDesc}
${isPreschool ? "WAŻNE: Pytania dla przedszkolaków muszą być bardzo proste, krótkie, z 3 opcjami odpowiedzi (A/B/C). Używaj prostego języka." : "Pytania z 4 opcjami odpowiedzi (A/B/C/D)."}

Odpowiedz TYLKO w formacie JSON:
{
  "questions": [
    {
      "id": 1,
      "text": "treść pytania",
      "options": ["opcja A", "opcja B", "opcja C"${isPreschool ? "" : ", \"opcja D\""}],
      "correctIndex": 0,
      "explanation": "krótkie wyjaśnienie"
    }
  ]
}`;

      const response = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_schema", json_schema: {
          name: "quiz_questions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    text: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correctIndex: { type: "integer" },
                    explanation: { type: "string" },
                  },
                  required: ["id", "text", "options", "correctIndex", "explanation"],
                  additionalProperties: false,
                },
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        }},
      });

      const content = String(response.choices[0]?.message?.content ?? "{}");
      const parsed = JSON.parse(content);
      const questions = parsed.questions ?? [];

      // Generuj HTML arkusza
      const html = generateAnswerSheetHtml({
        contestName: contest[0].name,
        edition: contest[0].edition ?? "",
        ageGroup: input.ageGroup,
        questions: questions.map((q: any) => ({ id: q.id, text: q.text, options: q.options })),
      });

      // Zapisz arkusz z kluczem odpowiedzi
      const answerKey: Record<string, number> = {};
      questions.forEach((q: any) => { answerKey[q.id] = q.correctIndex; });

      const sheetData: InsertOfflineAnswerSheet = {
        offlineContestId: input.offlineContestId,
        version: `ai-${Date.now()}`,
        questions,
        answerKey,
        isActive: true,
      };
      const result = await db.insert(offlineAnswerSheets).values(sheetData);

      return { html, questions, answerKey, sheetId: (result as any).insertId };
    }),

  // Generuj instrukcję dla nauczyciela
  generateTeacherInstruction: protectedProcedure
    .input(z.object({
      offlineContestId: z.number(),
      returnAddress: z.string(),
      deadline: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");
      const contest = await db.select().from(offlineContests)
        .where(eq(offlineContests.id, input.offlineContestId)).limit(1);
      if (!contest[0]) throw new Error("Konkurs nie znaleziony");

      const html = generateTeacherInstructionHtml({
        contestName: contest[0].name,
        edition: contest[0].edition ?? "",
        returnAddress: input.returnAddress,
        deadline: input.deadline,
      });
      return { html };
    }),

  // Prześlij skan arkusza (URL do obrazu)
  submitScan: protectedProcedure
    .input(z.object({
      offlineContestId: z.number(),
      scanImageUrl: z.string().url(),
      participantName: z.string().optional(),
      participantEmail: z.string().optional(),
      ageGroup: z.string().optional(),
      schoolId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");

      const data: InsertOfflineSubmission = {
        offlineContestId: input.offlineContestId,
        participantName: input.participantName,
        participantEmail: input.participantEmail,
        ageGroup: input.ageGroup,
        schoolId: input.schoolId,
        scanImageUrl: input.scanImageUrl,
        scanStatus: "scanned",
        verificationStatus: "pending",
      };
      const result = await db.insert(offlineSubmissions).values(data);
      return { id: (result as any).insertId };
    }),

  // OCR arkusza przez AI Vision
  runOcr: protectedProcedure
    .input(z.object({
      submissionId: z.number(),
      sheetId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");

      const submission = await db.select().from(offlineSubmissions)
        .where(eq(offlineSubmissions.id, input.submissionId)).limit(1);
      if (!submission[0]) throw new Error("Zgłoszenie nie znalezione");

      const sheet = await db.select().from(offlineAnswerSheets)
        .where(eq(offlineAnswerSheets.id, input.sheetId)).limit(1);
      if (!sheet[0]) throw new Error("Arkusz nie znaleziony");

      const imageUrl = submission[0].scanImageUrl;
      if (!imageUrl) throw new Error("Brak URL skanu");

      const questions = sheet[0].questions as any[];
      const answerKey = sheet[0].answerKey as Record<string, number>;

      // AI Vision — analiza skanu
      const ocrPrompt = `Analizujesz skan arkusza odpowiedzi z konkursu dla dzieci.
Na arkuszu są pytania z opcjami A/B/C/D. Uczestnik zaznaczył odpowiedzi przez zamalowanie lub zakreślenie kółka.

Pytania na arkuszu (${questions.length} pytań):
${questions.map((q: any, i: number) => `${i + 1}. ${q.text} [opcje: ${q.options.join(", ")}]`).join("\n")}

Odpowiedz w formacie JSON:
{
  "answers": { "1": "A", "2": "C", ... },
  "confidence": 85,
  "unclear": [3, 7],
  "participantName": "imię jeśli widoczne",
  "notes": "uwagi"
}

Gdzie answers to numer pytania → litera odpowiedzi (A/B/C/D).
confidence to pewność OCR 0-100.
unclear to lista numerów pytań gdzie zaznaczenie jest nieczytelne.`;

      const response = await invokeLLM({
        messages: [{
          role: "user" as const,
          content: [
            { type: "text" as const, text: ocrPrompt },
            { type: "image_url" as const, image_url: { url: imageUrl, detail: "high" as const } },
          ] as any,
        }],
      });

      const content = String(response.choices[0]?.message?.content ?? "{}");
      let ocrResult: any = {};
      try { ocrResult = JSON.parse(content); } catch { ocrResult = { answers: {}, confidence: 0, unclear: [] }; }

      // Oblicz wynik
      const answers = ocrResult.answers ?? {};
      const optionLetters = ["A", "B", "C", "D", "E"];
      let correct = 0;
      const total = questions.length;

      for (const q of questions) {
        const qId = String(q.id);
        const givenLetter = answers[qId];
        const correctIdx = answerKey[qId];
        if (givenLetter && correctIdx !== undefined) {
          if (givenLetter === optionLetters[correctIdx]) correct++;
        }
      }

      const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

      // Zapisz wyniki OCR
      await db.update(offlineSubmissions).set({
        scanStatus: "ocr_done",
        ocrRawText: String(content),
        ocrAnswers: answers,
        ocrConfidence: ocrResult.confidence ?? 0,
        correctAnswers: correct,
        totalQuestions: total,
        scorePercent,
        rawScore: scorePercent,
        maxScore: 100,
        isLaureate: scorePercent >= 90,
        verificationStatus: (ocrResult.confidence ?? 0) < 70 ? "manual_review" : "verified",
      }).where(eq(offlineSubmissions.id, input.submissionId));

      return {
        answers,
        correct,
        total,
        scorePercent,
        confidence: ocrResult.confidence ?? 0,
        unclear: ocrResult.unclear ?? [],
        needsManualReview: (ocrResult.confidence ?? 0) < 70,
      };
    }),

  // Lista zgłoszeń offline
  listSubmissions: protectedProcedure
    .input(z.object({
      offlineContestId: z.number(),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(offlineSubmissions.offlineContestId, input.offlineContestId)];
      if (input.status) conditions.push(eq(offlineSubmissions.scanStatus, input.status as any));
      return db.select().from(offlineSubmissions)
        .where(and(...conditions))
        .orderBy(desc(offlineSubmissions.createdAt));
    }),

  // Ręczna korekta OCR
  correctOcr: protectedProcedure
    .input(z.object({
      submissionId: z.number(),
      corrections: z.record(z.string(), z.string()), // { "3": "B", "7": "A" }
      sheetId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");

      const submission = await db.select().from(offlineSubmissions)
        .where(eq(offlineSubmissions.id, input.submissionId)).limit(1);
      if (!submission[0]) throw new Error("Zgłoszenie nie znalezione");

      const sheet = await db.select().from(offlineAnswerSheets)
        .where(eq(offlineAnswerSheets.id, input.sheetId)).limit(1);
      if (!sheet[0]) throw new Error("Arkusz nie znaleziony");

      const questions = sheet[0].questions as any[];
      const answerKey = sheet[0].answerKey as Record<string, number>;
      const currentAnswers = (submission[0].ocrAnswers as Record<string, string>) ?? {};

      // Połącz odpowiedzi OCR z korektami
      const mergedAnswers = { ...currentAnswers, ...input.corrections };

      // Przelicz wynik
      const optionLetters = ["A", "B", "C", "D", "E"];
      let correct = 0;
      for (const q of questions) {
        const qId = String(q.id);
        const givenLetter = mergedAnswers[qId];
        const correctIdx = answerKey[qId];
        if (givenLetter && correctIdx !== undefined) {
          if (givenLetter === optionLetters[correctIdx]) correct++;
        }
      }
      const total = questions.length;
      const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

      await db.update(offlineSubmissions).set({
        ocrAnswers: mergedAnswers,
        manualCorrections: input.corrections,
        correctAnswers: correct,
        scorePercent,
        rawScore: scorePercent,
        isLaureate: scorePercent >= 90,
        scanStatus: "verified",
        verificationStatus: "verified",
      }).where(eq(offlineSubmissions.id, input.submissionId));

      return { correct, total, scorePercent };
    }),

  // Oblicz ranking offline
  computeOfflineRanking: protectedProcedure
    .input(z.object({ offlineContestId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");

      const submissions = await db.select().from(offlineSubmissions)
        .where(and(
          eq(offlineSubmissions.offlineContestId, input.offlineContestId),
          eq(offlineSubmissions.scanStatus, "verified")
        ))
        .orderBy(desc(offlineSubmissions.scorePercent), asc(offlineSubmissions.createdAt));

      // Grupuj po kategoriach
      const byCategory: Record<string, typeof submissions> = {};
      for (const s of submissions) {
        const cat = s.ageGroup ?? "ogólna";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(s);
      }

      let updated = 0;
      for (const catSubs of Object.values(byCategory)) {
        for (let i = 0; i < catSubs.length; i++) {
          const rank = i + 1;
          const isWinner = rank <= 3;
          await db.update(offlineSubmissions).set({
            rank,
            isWinner,
            isLaureate: (catSubs[i].scorePercent ?? 0) >= 90,
          }).where(eq(offlineSubmissions.id, catSubs[i].id));
          updated++;
        }
      }

      await notifyOwner({
        title: `Ranking offline obliczony`,
        content: `Zaktualizowano ${updated} zgłoszeń w ${Object.keys(byCategory).length} kategoriach.`,
      });

      return { updated, categories: Object.keys(byCategory).length };
    }),

  // Pobierz arkusze dla konkursu
  listAnswerSheets: protectedProcedure
    .input(z.object({ offlineContestId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(offlineAnswerSheets)
        .where(eq(offlineAnswerSheets.offlineContestId, input.offlineContestId))
        .orderBy(desc(offlineAnswerSheets.createdAt));
    }),

  // Statystyki konkursu offline
  getStats: protectedProcedure
    .input(z.object({ offlineContestId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [total, scanned, verified, winners, laureates] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(offlineSubmissions)
          .where(eq(offlineSubmissions.offlineContestId, input.offlineContestId)),
        db.select({ count: sql<number>`count(*)` }).from(offlineSubmissions)
          .where(and(eq(offlineSubmissions.offlineContestId, input.offlineContestId), eq(offlineSubmissions.scanStatus, "scanned"))),
        db.select({ count: sql<number>`count(*)` }).from(offlineSubmissions)
          .where(and(eq(offlineSubmissions.offlineContestId, input.offlineContestId), eq(offlineSubmissions.scanStatus, "verified"))),
        db.select({ count: sql<number>`count(*)` }).from(offlineSubmissions)
          .where(and(eq(offlineSubmissions.offlineContestId, input.offlineContestId), eq(offlineSubmissions.isWinner, true))),
        db.select({ count: sql<number>`count(*)` }).from(offlineSubmissions)
          .where(and(eq(offlineSubmissions.offlineContestId, input.offlineContestId), eq(offlineSubmissions.isLaureate, true))),
      ]);

      return {
        total: total[0]?.count ?? 0,
        scanned: scanned[0]?.count ?? 0,
        verified: verified[0]?.count ?? 0,
        winners: winners[0]?.count ?? 0,
        laureates: laureates[0]?.count ?? 0,
        pendingOcr: (scanned[0]?.count ?? 0),
      };
    }),
});
