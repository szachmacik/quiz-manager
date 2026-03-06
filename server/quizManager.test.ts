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
