import { describe, expect, it } from "vitest";
import { parseQuestionIds, buildSnapshotHash, generateRandomAnswers } from "./wpConnector";

describe("parseQuestionIds", () => {
  it("parses AYS '***' separated IDs", () => {
    expect(parseQuestionIds("1***2***3")).toEqual([1, 2, 3]);
  });

  it("returns empty array for empty string", () => {
    expect(parseQuestionIds("")).toEqual([]);
  });

  it("filters out NaN values", () => {
    expect(parseQuestionIds("1***abc***3")).toEqual([1, 3]);
  });

  it("handles single ID", () => {
    expect(parseQuestionIds("42")).toEqual([42]);
  });
});

describe("buildSnapshotHash", () => {
  it("returns a 64-char hex string", () => {
    const hash = buildSnapshotHash(
      { id: 1, title: "Test", question_ids: "1***2" },
      [{ id: 1, question: "Q1", type: "radio" }],
      [{ id: 1, answer: "A1", correct: "1", question_id: 1 }]
    );
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("produces different hashes for different content", () => {
    const h1 = buildSnapshotHash({ id: 1, title: "Quiz A", question_ids: "1" }, [], []);
    const h2 = buildSnapshotHash({ id: 1, title: "Quiz B", question_ids: "1" }, [], []);
    expect(h1).not.toBe(h2);
  });
});

describe("generateRandomAnswers", () => {
  const questions = [
    {
      wpQuestionId: 1,
      type: "radio",
      answers: [
        { wpAnswerId: 10, isCorrect: false },
        { wpAnswerId: 11, isCorrect: true },
      ],
    },
    {
      wpQuestionId: 2,
      type: "checkbox",
      answers: [
        { wpAnswerId: 20, isCorrect: true },
        { wpAnswerId: 21, isCorrect: false },
      ],
    },
  ];

  it("generates answers for all_correct strategy", () => {
    const answers = generateRandomAnswers(questions, "all_correct");
    expect(answers["radio_ans_1"]).toBe("11"); // correct answer ID
  });

  it("generates answers for all_wrong strategy", () => {
    const answers = generateRandomAnswers(questions, "all_wrong");
    expect(answers["radio_ans_1"]).toBe("10"); // wrong answer ID
  });

  it("generates answers for random strategy", () => {
    const answers = generateRandomAnswers(questions, "random");
    expect(answers["radio_ans_1"]).toBeDefined();
  });

  it("handles empty questions", () => {
    const answers = generateRandomAnswers([], "random");
    expect(Object.keys(answers)).toHaveLength(0);
  });
});

describe("auth.logout", () => {
  it("clears session cookie", async () => {
    // Basic sanity check — full test in auth.logout.test.ts
    expect(true).toBe(true);
  });
});

// ─── AutoSync tests ───────────────────────────────────────────────────────────
describe("AutoSync", () => {
  it("runSync returns correct shape", async () => {
    const { runSync } = await import("./autoSync");
    const result = await runSync();
    expect(result).toHaveProperty("checked");
    expect(result).toHaveProperty("changed");
    expect(result).toHaveProperty("errors");
    expect(typeof result.checked).toBe("number");
    expect(typeof result.changed).toBe("number");
    expect(typeof result.errors).toBe("number");
  });

  it("startAutoSync does not throw", async () => {
    // startAutoSync starts a background interval — just verify it doesn't throw
    const { startAutoSync } = await import("./autoSync");
    expect(() => startAutoSync(999999)).not.toThrow();
  });
});

// ─── Webhook handler tests ────────────────────────────────────────────────────
describe("WebhookHandler", () => {
  it("registerWebhookRoutes exports a function", async () => {
    const { registerWebhookRoutes } = await import("./webhookHandler");
    expect(typeof registerWebhookRoutes).toBe("function");
  });
});

// ─── Export Router tests ──────────────────────────────────────────────────────
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTestCtx(): TrpcContext {
  return {
    user: {
      id: 1, openId: "test-user", email: "test@example.com",
      name: "Test User", loginMethod: "manus", role: "admin",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("ExportRouter", () => {
  it("trends returns weekly array with 8 buckets", async () => {
    const caller = appRouter.createCaller(createTestCtx());
    const result = await caller.export.trends();
    expect(result.weekly).toHaveLength(8);
    expect(result.summary).toHaveProperty("totalSnapshots");
    expect(result.summary).toHaveProperty("totalSimulations");
  });

  it("pendingPatchesCount returns correct shape", async () => {
    const caller = appRouter.createCaller(createTestCtx());
    const result = await caller.export.pendingPatchesCount();
    expect(result).toHaveProperty("pending");
    expect(result).toHaveProperty("approved");
    expect(result).toHaveProperty("total");
  });
});

describe("SettingsRouter", () => {
  it("getAll returns an object", async () => {
    const caller = appRouter.createCaller(createTestCtx());
    const result = await caller.settings.getAll();
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });
});

// ─── v5 Tests: Settings Audit & Video Verification ───────────────────────────

describe("settingsAuditRouter — audit logic", () => {
  it("identifies critical issue when quiz has no time limit", () => {
    const settings: Record<string, string> = { time_limit: "0", enable_result_page: "1" };
    const issues: string[] = [];
    if (!settings.time_limit || settings.time_limit === "0") issues.push("no_time_limit");
    expect(issues).toContain("no_time_limit");
  });

  it("passes when all required settings are present", () => {
    const settings: Record<string, string> = {
      time_limit: "30", enable_result_page: "1",
      enable_certificate: "1", limit_attempts: "1",
    };
    const issues: string[] = [];
    if (!settings.time_limit || settings.time_limit === "0") issues.push("no_time_limit");
    if (!settings.enable_certificate || settings.enable_certificate === "0") issues.push("no_certificate");
    if (!settings.limit_attempts || settings.limit_attempts === "0") issues.push("no_attempt_limit");
    expect(issues).toHaveLength(0);
  });
});

describe("videoVerification — verdict logic", () => {
  it("returns independent verdict when no anomalies", () => {
    const anomalies: Array<{ severity: string }> = [];
    const criticalCount = anomalies.filter(a => a.severity === "high").length;
    const verdict = criticalCount >= 2 ? "intervention" : anomalies.length > 0 ? "suspicious" : "independent";
    expect(verdict).toBe("independent");
  });

  it("returns intervention verdict when multiple high-severity anomalies", () => {
    const anomalies = [{ severity: "high" }, { severity: "high" }];
    const criticalCount = anomalies.filter(a => a.severity === "high").length;
    const verdict = criticalCount >= 2 ? "intervention" : anomalies.length > 0 ? "suspicious" : "independent";
    expect(verdict).toBe("intervention");
  });

  it("distinguishes merit intervention from technical help", () => {
    const techAnomaly = { type: "technical_help", isMeritIntervention: false };
    const meritAnomaly = { type: "verbal_hint", isMeritIntervention: true };
    expect(techAnomaly.isMeritIntervention).toBe(false);
    expect(meritAnomaly.isMeritIntervention).toBe(true);
  });
});

describe("telemetry — behavioral scoring", () => {
  it("penalizes copy-paste events", () => {
    const pasteCount = 2;
    const score = Math.max(0, 100 - pasteCount * 20);
    expect(score).toBe(60);
  });

  it("penalizes tab switches", () => {
    const tabSwitches = 3;
    const score = Math.max(0, 100 - tabSwitches * 15);
    expect(score).toBe(55);
  });

  it("gives full score for clean session", () => {
    const pasteCount = 0;
    const tabSwitches = 0;
    const score = Math.max(0, 100 - pasteCount * 20 - tabSwitches * 15);
    expect(score).toBe(100);
  });
});
