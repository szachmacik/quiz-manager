/**
 * AI Router — Quiz Manager
 * Claude integration for: fraud detection analysis, risk explanations, behavioral profiling
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.LLM_MODEL || "claude-haiku-4-5-20251001";

async function askClaude(system: string, prompt: string, maxTokens = 1000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  return ((await res.json()).content[0].text) as string;
}

export const aiRouter = router({
  /**
   * Explain anomaly in plain language for quiz administrator
   */
  explainAnomaly: protectedProcedure
    .input(z.object({
      anomalyType: z.string(),
      metrics: z.record(z.unknown()),
      participantCount: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const system = `You are a quiz fraud detection expert. Explain anomalies clearly for non-technical administrators. Be concise and actionable.`;
      const prompt = `Anomaly detected: ${input.anomalyType}
Metrics: ${JSON.stringify(input.metrics, null, 2)}
${input.participantCount ? `Participants: ${input.participantCount}` : ""}

Explain: 1) What happened, 2) Why suspicious, 3) Recommended action. Max 150 words.`;
      return { explanation: await askClaude(system, prompt, 400) };
    }),

  /**
   * Generate risk assessment summary from behavioral data
   */
  assessRisk: protectedProcedure
    .input(z.object({
      behavioralData: z.object({
        tabSwitches: z.number().default(0),
        copyPasteEvents: z.number().default(0),
        unusualTimings: z.number().default(0),
        suspiciousPatterns: z.array(z.string()).default([]),
      }),
      quizTitle: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const system = `You are a quiz integrity expert. Assess cheating risk from behavioral signals. Return JSON: { "riskLevel": "low|medium|high|critical", "confidence": 0-100, "primaryConcerns": string[], "recommendation": string }`;
      const prompt = `Quiz: ${input.quizTitle ?? "Unknown"}
Behavioral signals:
- Tab switches: ${input.behavioralData.tabSwitches}
- Copy/paste events: ${input.behavioralData.copyPasteEvents}
- Unusual timings: ${input.behavioralData.unusualTimings}
- Suspicious patterns: ${input.behavioralData.suspiciousPatterns.join(", ") || "none"}

Assess risk:`;
      const raw = await askClaude(system, prompt, 500);
      return JSON.parse(raw.replace(/```json|```/g, "").trim());
    }),

  /**
   * Generate diploma personalized text
   */
  generateDiplomaText: protectedProcedure
    .input(z.object({
      participantName: z.string(),
      quizTitle: z.string(),
      score: z.number(),
      maxScore: z.number(),
      completedAt: z.string(),
    }))
    .mutation(async ({ input }) => {
      const pct = Math.round((input.score / input.maxScore) * 100);
      const prompt = `Write a brief, professional diploma congratulations text (2-3 sentences) for:
Name: ${input.participantName}
Achievement: Completed "${input.quizTitle}" with ${input.score}/${input.maxScore} (${pct}%)
Date: ${input.completedAt}
Tone: formal but warm.`;
      return { text: await askClaude("You write diploma certificates.", prompt, 200) };
    }),

  ping: publicProcedure.query(() => ({ ok: true, model: MODEL })),
});
