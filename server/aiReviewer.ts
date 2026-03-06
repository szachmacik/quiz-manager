/**
 * AI-powered quiz content reviewer
 * Analyzes questions and answers for linguistic, logical, and factual errors
 */

import { invokeLLM } from "./_core/llm";
import { updateAiReview, getSnapshotWithQA, createPatchProposal } from "./db";

export interface ReviewFinding {
  questionId: number;
  wpQuestionId: number;
  questionText: string;
  type: "error" | "warning" | "suggestion";
  severity: "critical" | "high" | "medium" | "low";
  category: "linguistic" | "logical" | "factual" | "ambiguous" | "duplicate_answer" | "no_correct_answer" | "multiple_correct" | "formatting";
  message: string;
  suggestion?: string;
  affectedAnswerIds?: number[];
}

export async function runAiReview(reviewId: number, snapshotId: number): Promise<void> {
  await updateAiReview(reviewId, { status: "running", startedAt: new Date() });

  try {
    const quizData = await getSnapshotWithQA(snapshotId);
    if (!quizData) throw new Error("Snapshot not found");

    const { snapshot, questions } = quizData;
    const findings: ReviewFinding[] = [];

    // ── Phase 1: Structural checks (no AI needed) ─────────────────────────────
    for (const q of questions) {
      // Check: no correct answer marked
      const correctAnswers = q.answers.filter(a => a.isCorrect);
      if (correctAnswers.length === 0 && q.type !== "text") {
        findings.push({
          questionId: q.id,
          wpQuestionId: q.wpQuestionId,
          questionText: q.question,
          type: "error",
          severity: "critical",
          category: "no_correct_answer",
          message: `Pytanie nie ma zaznaczonej żadnej poprawnej odpowiedzi.`,
          suggestion: "Zaznacz co najmniej jedną odpowiedź jako poprawną.",
        });
      }

      // Check: radio/select with multiple correct answers
      if ((q.type === "radio" || q.type === "select") && correctAnswers.length > 1) {
        findings.push({
          questionId: q.id,
          wpQuestionId: q.wpQuestionId,
          questionText: q.question,
          type: "error",
          severity: "high",
          category: "multiple_correct",
          message: `Pytanie typu "${q.type}" ma ${correctAnswers.length} poprawne odpowiedzi — powinno mieć dokładnie jedną.`,
          suggestion: "Zostaw tylko jedną odpowiedź zaznaczoną jako poprawną.",
          affectedAnswerIds: correctAnswers.map(a => a.wpAnswerId),
        });
      }

      // Check: duplicate answers
      const answerTexts = q.answers.map(a => a.answer.toLowerCase().trim());
      const duplicates = answerTexts.filter((t, i) => answerTexts.indexOf(t) !== i);
      if (duplicates.length > 0) {
        findings.push({
          questionId: q.id,
          wpQuestionId: q.wpQuestionId,
          questionText: q.question,
          type: "warning",
          severity: "medium",
          category: "duplicate_answer",
          message: `Pytanie zawiera zduplikowane odpowiedzi: "${duplicates[0]}"`,
          suggestion: "Usuń lub zmień zduplikowane odpowiedzi.",
        });
      }

      // Check: empty question text
      if (!q.question || q.question.trim().length < 5) {
        findings.push({
          questionId: q.id,
          wpQuestionId: q.wpQuestionId,
          questionText: q.question,
          type: "error",
          severity: "critical",
          category: "formatting",
          message: "Treść pytania jest pusta lub zbyt krótka.",
          suggestion: "Uzupełnij treść pytania.",
        });
      }
    }

    // ── Phase 2: AI linguistic & logical analysis ─────────────────────────────
    if (questions.length > 0) {
      const quizContent = questions.map((q, idx) => {
        const answersText = q.answers.map((a, ai) =>
          `  ${ai + 1}. [${a.isCorrect ? "POPRAWNA" : "błędna"}] ${a.answer}`
        ).join("\n");
        return `Pytanie ${idx + 1} (ID: ${q.wpQuestionId}, typ: ${q.type}):\n"${q.question}"\nOdpowiedzi:\n${answersText}`;
      }).join("\n\n---\n\n");

      const systemPrompt = `Jesteś ekspertem ds. tworzenia quizów i testów konkursowych. Analizujesz pytania quizów pod kątem:
1. Błędów językowych (ortografia, gramatyka, interpunkcja)
2. Błędów logicznych (sprzeczności, niejednoznaczności)
3. Błędów merytorycznych (niepoprawne odpowiedzi zaznaczone jako poprawne)
4. Jakości pytań (czy pytanie jest jasne, jednoznaczne, odpowiednio sformułowane)
5. Pułapek dla uczestników (mylące sformułowania)

Odpowiadaj WYŁĄCZNIE w formacie JSON. Nie dodawaj żadnego tekstu poza JSON.`;

      const userPrompt = `Przeanalizuj poniższe pytania quizu konkursowego "${snapshot.title}" i zwróć listę problemów.

${quizContent}

Zwróć JSON w formacie:
{
  "findings": [
    {
      "wpQuestionId": <number>,
      "type": "error" | "warning" | "suggestion",
      "severity": "critical" | "high" | "medium" | "low",
      "category": "linguistic" | "logical" | "factual" | "ambiguous" | "formatting",
      "message": "<opis problemu po polsku>",
      "suggestion": "<konkretna sugestia poprawki po polsku>"
    }
  ],
  "overallAssessment": "<ogólna ocena jakości quizu>",
  "overallScore": <0-100>
}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "quiz_review",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        wpQuestionId: { type: "integer" },
                        type: { type: "string", enum: ["error", "warning", "suggestion"] },
                        severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                        category: { type: "string", enum: ["linguistic", "logical", "factual", "ambiguous", "formatting"] },
                        message: { type: "string" },
                        suggestion: { type: "string" },
                      },
                      required: ["wpQuestionId", "type", "severity", "category", "message", "suggestion"],
                      additionalProperties: false,
                    },
                  },
                  overallAssessment: { type: "string" },
                  overallScore: { type: "number" },
                },
                required: ["findings", "overallAssessment", "overallScore"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices?.[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : null;
        if (content) {
          const parsed = JSON.parse(content);

          // Merge AI findings with structural findings
          for (const f of parsed.findings || []) {
            const question = questions.find(q => q.wpQuestionId === f.wpQuestionId);
            if (question) {
              findings.push({
                questionId: question.id,
                wpQuestionId: f.wpQuestionId,
                questionText: question.question,
                type: f.type,
                severity: f.severity,
                category: f.category,
                message: f.message,
                suggestion: f.suggestion,
              });
            }
          }

          const errorsFound = findings.filter(f => f.type === "error").length;
          const warningsFound = findings.filter(f => f.type === "warning").length;

          await updateAiReview(reviewId, {
            status: "completed",
            overallScore: parsed.overallScore ?? 100,
            errorsFound,
            warningsFound,
            summary: parsed.overallAssessment,
            findings: findings as any,
            rawResponse: parsed as any,
            completedAt: new Date(),
          });

          // Auto-generate patch proposals for critical/high errors
          for (const finding of findings) {
            if ((finding.type === "error" && finding.severity === "critical") || finding.severity === "high") {
              if (finding.suggestion) {
                await createPatchProposal({
                  snapshotId,
                  aiReviewId: reviewId,
                  title: `[AI] ${finding.category}: ${finding.message.slice(0, 100)}`,
                  description: finding.message,
                  patchType: finding.category === "linguistic" ? "question_text" : "other",
                  targetWpId: finding.wpQuestionId,
                  targetType: "question",
                  fieldName: "question",
                  originalValue: finding.questionText,
                  proposedValue: finding.suggestion,
                  reasoning: `Wykryty przez AI: ${finding.message}. Sugestia: ${finding.suggestion}`,
                  status: "pending",
                  preApplySnapshotId: null,
                  postSimulationId: null,
                  approvedBy: null,
                  approvedAt: null,
                  appliedAt: null,
                  rolledBackAt: null,
                });
              }
            }
          }

          return;
        }
      } catch (aiErr: any) {
        console.error("[AI Review] LLM error:", aiErr.message);
        // Continue with structural findings only
      }
    }

    // Save structural-only findings if AI failed
    const errorsFound = findings.filter(f => f.type === "error").length;
    const warningsFound = findings.filter(f => f.type === "warning").length;

    await updateAiReview(reviewId, {
      status: "completed",
      overallScore: Math.max(0, 100 - errorsFound * 20 - warningsFound * 5),
      errorsFound,
      warningsFound,
      summary: `Analiza strukturalna: ${errorsFound} błędów, ${warningsFound} ostrzeżeń. Analiza AI niedostępna.`,
      findings: findings as any,
      completedAt: new Date(),
    });

  } catch (err: any) {
    await updateAiReview(reviewId, {
      status: "failed",
      summary: `Błąd analizy: ${err.message}`,
      completedAt: new Date(),
    });
  }
}
