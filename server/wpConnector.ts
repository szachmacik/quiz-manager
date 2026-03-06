/**
 * WordPress REST API + AYS Quiz Maker connector
 * Supports both WP REST API (primary) and direct MySQL (fallback)
 */

import { createHash } from "crypto";

export interface WpQuiz {
  id: number;
  title: string;
  question_ids: string; // "***" separated
  settings?: Record<string, unknown>;
  shortcode?: string;
}

export interface WpQuestion {
  id: number;
  question: string;
  type: "radio" | "checkbox" | "select" | "text";
  quiz_id?: number;
}

export interface WpAnswer {
  id: number;
  answer: string;
  correct: "0" | "1";
  question_id: number;
}

export interface WpConnectionConfig {
  siteUrl: string;
  apiUser: string;
  apiPassword: string;
  tablePrefix?: string;
}

// ─── REST API client ──────────────────────────────────────────────────────────
export class WpApiClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: WpConnectionConfig) {
    this.baseUrl = config.siteUrl.replace(/\/$/, "");
    const credentials = Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString("base64");
    this.authHeader = `Basic ${credentials}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        "User-Agent": "AYS-Quiz-Manager/1.0",
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`WP API error ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json() as Promise<T>;
  }

  /** Test connection — returns WP site info */
  async testConnection(): Promise<{ name: string; url: string; version: string }> {
    return this.request("/wp-json/");
  }

  /** Fetch all AYS quizzes via WP REST API custom endpoint (if available) */
  async fetchQuizzes(): Promise<WpQuiz[]> {
    try {
      // Try AYS custom REST endpoint first
      const data = await this.request<any>("/wp-json/ays-quiz/v1/quizzes");
      if (Array.isArray(data)) return data;
    } catch {
      // Fallback: use WP posts API for quiz CPT
    }

    try {
      // Try quiz custom post type
      const posts = await this.request<any[]>("/wp-json/wp/v2/ays_quiz?per_page=100&_fields=id,title,meta,slug");
      return posts.map((p: any) => ({
        id: p.id,
        title: p.title?.rendered || p.title || `Quiz #${p.id}`,
        question_ids: p.meta?.question_ids || "",
        settings: p.meta || {},
        shortcode: `[ays_quiz id="${p.id}"]`,
      }));
    } catch {
      // Return empty — will be handled by caller
    }

    return [];
  }

  /** Fetch quiz by ID */
  async fetchQuiz(quizId: number): Promise<WpQuiz | null> {
    try {
      const data = await this.request<any>(`/wp-json/ays-quiz/v1/quizzes/${quizId}`);
      return data;
    } catch {
      try {
        const post = await this.request<any>(`/wp-json/wp/v2/ays_quiz/${quizId}`);
        return {
          id: post.id,
          title: post.title?.rendered || `Quiz #${quizId}`,
          question_ids: post.meta?.question_ids || "",
          settings: post.meta || {},
          shortcode: `[ays_quiz id="${quizId}"]`,
        };
      } catch {
        return null;
      }
    }
  }

  /** Fetch questions for a quiz */
  async fetchQuestions(questionIds: number[]): Promise<WpQuestion[]> {
    if (questionIds.length === 0) return [];
    try {
      const data = await this.request<any>(`/wp-json/ays-quiz/v1/questions?ids=${questionIds.join(",")}`);
      if (Array.isArray(data)) return data;
    } catch {}
    return [];
  }

  /** Fetch answers for a question */
  async fetchAnswers(questionId: number): Promise<WpAnswer[]> {
    try {
      const data = await this.request<any>(`/wp-json/ays-quiz/v1/answers?question_id=${questionId}`);
      if (Array.isArray(data)) return data;
    } catch {}
    return [];
  }

  /** Create a private test page with quiz shortcodes */
  async createTestPage(title: string, shortcodes: string[]): Promise<{ id: number; url: string }> {
    const content = shortcodes.map(sc => `<div class="ays-test-quiz">${sc}</div>`).join("\n\n");
    const page = await this.request<any>("/wp-json/wp/v2/pages", {
      method: "POST",
      body: JSON.stringify({
        title,
        content,
        status: "private",
        slug: `ays-quiz-test-${Date.now()}`,
      }),
    });
    return { id: page.id, url: page.link };
  }

  /** Update an existing page content */
  async updateTestPage(pageId: number, shortcodes: string[]): Promise<void> {
    const content = shortcodes.map(sc => `<div class="ays-test-quiz">${sc}</div>`).join("\n\n");
    await this.request(`/wp-json/wp/v2/pages/${pageId}`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  /** Apply a patch to a question or answer */
  async applyPatch(patch: {
    targetType: "question" | "answer" | "quiz";
    targetWpId: number;
    fieldName: string;
    proposedValue: string;
  }): Promise<boolean> {
    const endpointMap = {
      question: `/wp-json/ays-quiz/v1/questions/${patch.targetWpId}`,
      answer: `/wp-json/ays-quiz/v1/answers/${patch.targetWpId}`,
      quiz: `/wp-json/ays-quiz/v1/quizzes/${patch.targetWpId}`,
    };
    try {
      await this.request(endpointMap[patch.targetType], {
        method: "PUT",
        body: JSON.stringify({ [patch.fieldName]: patch.proposedValue }),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Submit quiz answers (simulate a participant) */
  async submitQuiz(params: {
    pageUrl: string;
    quizId: number;
    questionIds: number[];
    answers: Record<string, string | string[]>;
    email?: string;
  }): Promise<{ success: boolean; score?: number; responseMs: number; httpStatus?: number; error?: string }> {
    const start = Date.now();
    try {
      // Build form data matching AYS plugin POST format
      const formData = new URLSearchParams();
      formData.append("ays_finish", "FINISH");
      formData.append("check_qstns", params.questionIds.join("***"));
      if (params.email) formData.append("ays_email", params.email);

      for (const [key, value] of Object.entries(params.answers)) {
        if (Array.isArray(value)) {
          value.forEach(v => formData.append(key, v));
        } else {
          formData.append(key, value);
        }
      }

      const response = await fetch(params.pageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": `AYS-Quiz-Agent/${params.email || "anonymous"}`,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(20000),
      });

      const responseMs = Date.now() - start;
      const text = await response.text();

      // Parse score from AYS response ("Your score is X%")
      const scoreMatch = text.match(/Your score is ([\d.]+)%/i);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : undefined;

      return { success: response.ok, score, responseMs, httpStatus: response.status };
    } catch (err: any) {
      return { success: false, responseMs: Date.now() - start, error: err.message };
    }
  }
}

// ─── Quiz snapshot builder ────────────────────────────────────────────────────
export function buildSnapshotHash(quiz: WpQuiz, questions: WpQuestion[], answers: WpAnswer[]): string {
  const content = JSON.stringify({ quiz, questions, answers });
  return createHash("sha256").update(content).digest("hex");
}

/** Parse AYS "***" separated question IDs */
export function parseQuestionIds(raw: string): number[] {
  if (!raw) return [];
  return raw.split("***").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
}

/** Generate random answers for simulation */
export function generateRandomAnswers(
  questions: Array<{ wpQuestionId: number; type: string; answers: Array<{ wpAnswerId: number; isCorrect: boolean }> }>,
  strategy: "random" | "all_correct" | "all_wrong" | "mixed"
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const q of questions) {
    const { wpQuestionId, type, answers } = q;
    if (answers.length === 0) continue;

    if (type === "radio" || type === "select") {
      let chosen: number;
      if (strategy === "all_correct") {
        const correct = answers.find(a => a.isCorrect);
        chosen = correct ? correct.wpAnswerId : answers[0].wpAnswerId;
      } else if (strategy === "all_wrong") {
        const wrong = answers.find(a => !a.isCorrect);
        chosen = wrong ? wrong.wpAnswerId : answers[0].wpAnswerId;
      } else if (strategy === "mixed") {
        // 50/50
        const correct = answers.find(a => a.isCorrect);
        chosen = Math.random() > 0.5 && correct ? correct.wpAnswerId : answers[Math.floor(Math.random() * answers.length)].wpAnswerId;
      } else {
        // random
        chosen = answers[Math.floor(Math.random() * answers.length)].wpAnswerId;
      }
      const key = type === "radio" ? `radio_ans_${wpQuestionId}` : `select_ans_${wpQuestionId}`;
      result[key] = String(chosen);
    } else if (type === "checkbox") {
      const selected: string[] = [];
      for (const ans of answers) {
        let pick = false;
        if (strategy === "all_correct") pick = ans.isCorrect;
        else if (strategy === "all_wrong") pick = !ans.isCorrect;
        else if (strategy === "mixed") pick = Math.random() > 0.5;
        else pick = Math.random() > 0.5;
        if (pick) selected.push(String(ans.wpAnswerId));
      }
      if (selected.length > 0) result[`ans_${answers[0].wpAnswerId}`] = selected;
    } else if (type === "text") {
      result[`ans_${answers[0]?.wpAnswerId}`] = "test answer";
    }
  }

  return result;
}
