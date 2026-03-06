/**
 * Auto-sync module — periodically checks WordPress for quiz changes
 * and creates new snapshots when content differs from the last known hash.
 */
import { WpApiClient, parseQuestionIds, buildSnapshotHash } from "./wpConnector";
import {
  listConnections, getConnection, listSnapshots, createSnapshot,
  saveSnapshotQuestions, saveSnapshotAnswers, getSnapshotWithQA,
  addSyncLog, getSetting, getPendingScheduledSimulations,
  updateScheduledSimulation, createSimulation,
} from "./db";
import { runSimulation } from "./simulationEngine";
import { notifyOwner } from "./_core/notification";

// In-memory state
let syncIntervalHandle: NodeJS.Timeout | null = null;
let schedulerIntervalHandle: NodeJS.Timeout | null = null;
let isSyncing = false;

export function startAutoSync(intervalMs = 5 * 60 * 1000) {
  if (syncIntervalHandle) return; // already running
  console.log(`[AutoSync] Starting with interval ${intervalMs}ms`);
  syncIntervalHandle = setInterval(() => runSync(), intervalMs);
  // Also start the scheduler
  schedulerIntervalHandle = setInterval(() => runScheduler(), 60 * 1000); // every minute
}

export function stopAutoSync() {
  if (syncIntervalHandle) { clearInterval(syncIntervalHandle); syncIntervalHandle = null; }
  if (schedulerIntervalHandle) { clearInterval(schedulerIntervalHandle); schedulerIntervalHandle = null; }
  console.log("[AutoSync] Stopped");
}

export async function runSync(): Promise<{ checked: number; changed: number; errors: number }> {
  if (isSyncing) return { checked: 0, changed: 0, errors: 0 };
  isSyncing = true;
  let checked = 0, changed = 0, errors = 0;

  try {
    const connections = await listConnections();
    const activeConns = connections.filter(c => c.status === "active");

    for (const conn of activeConns) {
      try {
        const client = new WpApiClient({ siteUrl: conn.siteUrl, apiUser: conn.apiUser, apiPassword: conn.apiPassword });
        const wpQuizzes = await client.fetchQuizzes();

        for (const wpQuiz of wpQuizzes) {
          checked++;
          try {
            // Get latest snapshot for this quiz
            const snapshots = await listSnapshots(conn.id);
            const latestSnap = snapshots.find(s => s.wpQuizId === wpQuiz.id);

            // Fetch full quiz data
            const quiz = await client.fetchQuiz(wpQuiz.id);
            if (!quiz) continue;

            const questionIds = parseQuestionIds(quiz.question_ids);
            const wpQuestions = await client.fetchQuestions(questionIds);
            const allAnswers: any[] = [];
            for (const q of wpQuestions) {
              const answers = await client.fetchAnswers(q.id);
              allAnswers.push(...answers.map(a => ({ ...a, question_id: q.id })));
            }

            const newHash = buildSnapshotHash(quiz, wpQuestions, allAnswers);

            if (!latestSnap || latestSnap.snapshotHash !== newHash) {
              // Content changed — create new snapshot
              const snapshotId = await createSnapshot({
                connectionId: conn.id,
                wpQuizId: wpQuiz.id,
                title: quiz.title,
                slug: null,
                shortcode: `[ays_quiz id="${wpQuiz.id}"]`,
                settings: quiz.settings ?? null,
                questionIds: quiz.question_ids,
                questionCount: questionIds.length,
                snapshotType: "auto",
                snapshotHash: newHash,
                rawData: quiz as any,
              });

              const questionRecords = wpQuestions.map((q, idx) => ({
                snapshotId, wpQuestionId: q.id, question: q.question,
                type: q.type, position: idx, rawData: q as any,
              }));
              await saveSnapshotQuestions(snapshotId, questionRecords);

              const savedData = await getSnapshotWithQA(snapshotId);
              if (savedData) {
                const answerRecords = allAnswers.map((a, idx) => {
                  const dbQ = savedData.questions.find(q => q.wpQuestionId === a.question_id);
                  return { questionId: dbQ?.id ?? 0, snapshotId, wpAnswerId: a.id, answer: a.answer, isCorrect: a.correct === "1", position: idx };
                });
                await saveSnapshotAnswers(snapshotId, answerRecords);
              }

              await addSyncLog({ connectionId: conn.id, wpQuizId: wpQuiz.id, status: "changed", snapshotId, message: `Quiz "${quiz.title}" zmieniony — nowy snapshot #${snapshotId}` });
              changed++;

              // Notify owner
              await notifyOwner({
                title: `[Auto-sync] Quiz zmieniony: "${quiz.title}"`,
                content: `Wykryto zmiany w quizie "${quiz.title}" (WP ID: ${wpQuiz.id}). Nowy snapshot #${snapshotId} został utworzony automatycznie.`,
              }).catch(() => {});
            } else {
              await addSyncLog({ connectionId: conn.id, wpQuizId: wpQuiz.id, status: "no_change", snapshotId: latestSnap.id, message: `Brak zmian` });
            }
          } catch (err: any) {
            errors++;
            await addSyncLog({ connectionId: conn.id, wpQuizId: wpQuiz.id, status: "error", snapshotId: null, message: err.message });
          }
        }
      } catch (err: any) {
        errors++;
        await addSyncLog({ connectionId: conn.id, wpQuizId: null, status: "error", snapshotId: null, message: `Connection error: ${err.message}` });
      }
    }
  } finally {
    isSyncing = false;
  }

  console.log(`[AutoSync] Done: checked=${checked} changed=${changed} errors=${errors}`);
  return { checked, changed, errors };
}

// ─── Scheduler — runs pending scheduled simulations ───────────────────────────
export async function runScheduler() {
  try {
    const pending = await getPendingScheduledSimulations();
    for (const sched of pending) {
      console.log(`[Scheduler] Triggering scheduled simulation: ${sched.name}`);
      const simulationId = await createSimulation({
        snapshotId: sched.snapshotId,
        connectionId: sched.connectionId,
        name: sched.name,
        agentCount: sched.agentCount,
        agentDomain: sched.agentDomain,
        strategy: sched.strategy,
        concurrency: sched.concurrency,
        delayMs: sched.delayMs ?? 500,
        status: "pending",
        totalAgents: sched.agentCount,
        completedAgents: 0,
        failedAgents: 0,
        avgResponseMs: null,
        minResponseMs: null,
        maxResponseMs: null,
        p95ResponseMs: null,
        errorRate: null,
        startedAt: null,
        completedAt: null,
      });

      await updateScheduledSimulation(sched.id, { status: "triggered", triggeredSimulationId: simulationId });

      runSimulation({
        simulationId,
        snapshotId: sched.snapshotId,
        connectionId: sched.connectionId,
        agentCount: sched.agentCount,
        agentDomain: sched.agentDomain,
        strategy: sched.strategy,
        concurrency: sched.concurrency,
        delayMs: sched.delayMs ?? 500,
      }).catch(console.error);
    }
  } catch (err) {
    console.error("[Scheduler] Error:", err);
  }
}

// ─── Diff engine — compare two snapshots ─────────────────────────────────────
export async function computeSnapshotDiff(snapshotAId: number, snapshotBId: number) {
  const { getSnapshotWithQA: getQA } = await import("./db");
  const [a, b] = await Promise.all([getQA(snapshotAId), getQA(snapshotBId)]);
  if (!a || !b) throw new Error("Snapshot not found");

  const aQMap = new Map(a.questions.map(q => [q.wpQuestionId, q]));
  const bQMap = new Map(b.questions.map(q => [q.wpQuestionId, q]));

  const allQIds = Array.from(new Set([...Array.from(aQMap.keys()), ...Array.from(bQMap.keys())]));
  const diffData: any[] = [];

  let addedQ = 0, removedQ = 0, modifiedQ = 0;
  let addedA = 0, removedA = 0, modifiedA = 0;

  for (const qId of allQIds) {
    const qa = aQMap.get(qId);
    const qb = bQMap.get(qId);

    if (!qa && qb) {
      addedQ++;
      diffData.push({ type: "question_added", wpQuestionId: qId, newValue: qb.question });
    } else if (qa && !qb) {
      removedQ++;
      diffData.push({ type: "question_removed", wpQuestionId: qId, oldValue: qa.question });
    } else if (qa && qb) {
      if (qa.question !== qb.question) {
        modifiedQ++;
        diffData.push({ type: "question_modified", wpQuestionId: qId, oldValue: qa.question, newValue: qb.question });
      }

      // Compare answers
      const aAMap = new Map(qa.answers.map(a => [a.wpAnswerId, a]));
      const bAMap = new Map(qb.answers.map(a => [a.wpAnswerId, a]));
      const allAIds = Array.from(new Set([...Array.from(aAMap.keys()), ...Array.from(bAMap.keys())]));

      for (const aId of allAIds) {
        const aa = aAMap.get(aId);
        const ab = bAMap.get(aId);
        if (!aa && ab) {
          addedA++;
          diffData.push({ type: "answer_added", wpQuestionId: qId, wpAnswerId: aId, newValue: ab.answer, isCorrect: ab.isCorrect });
        } else if (aa && !ab) {
          removedA++;
          diffData.push({ type: "answer_removed", wpQuestionId: qId, wpAnswerId: aId, oldValue: aa.answer });
        } else if (aa && ab) {
          if (aa.answer !== ab.answer || aa.isCorrect !== ab.isCorrect) {
            modifiedA++;
            diffData.push({ type: "answer_modified", wpQuestionId: qId, wpAnswerId: aId, oldValue: aa.answer, newValue: ab.answer, oldCorrect: aa.isCorrect, newCorrect: ab.isCorrect });
          }
        }
      }
    }
  }

  return {
    snapshotAId, snapshotBId,
    addedQuestions: addedQ, removedQuestions: removedQ, modifiedQuestions: modifiedQ,
    addedAnswers: addedA, removedAnswers: removedA, modifiedAnswers: modifiedA,
    diffData,
  };
}
