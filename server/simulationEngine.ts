/**
 * Simulation engine — runs N virtual agents solving a quiz concurrently
 * Uses a semaphore pattern to limit concurrency and avoid overwhelming the server
 */

import { WpApiClient, generateRandomAnswers } from "./wpConnector";
import {
  updateSimulation,
  createSimulationAgent,
  updateSimulationAgent,
  getSnapshotWithQA,
  getConnection,
} from "./db";

// In-memory simulation state for real-time updates
const activeSimulations = new Map<number, {
  status: "running" | "completed" | "failed" | "cancelled";
  progress: number;
  logs: string[];
  responseTimes: number[];
}>();

export function getSimulationState(simulationId: number) {
  return activeSimulations.get(simulationId);
}

export function cancelSimulation(simulationId: number) {
  const state = activeSimulations.get(simulationId);
  if (state) state.status = "cancelled";
}

export async function runSimulation(params: {
  simulationId: number;
  snapshotId: number;
  connectionId: number;
  agentCount: number;
  agentDomain: string;
  strategy: "random" | "all_correct" | "all_wrong" | "mixed";
  concurrency: number;
  delayMs: number;
}): Promise<void> {
  const {
    simulationId, snapshotId, connectionId,
    agentCount, agentDomain, strategy, concurrency, delayMs,
  } = params;

  // Initialize in-memory state
  activeSimulations.set(simulationId, {
    status: "running",
    progress: 0,
    logs: [`[${new Date().toISOString()}] Simulation started — ${agentCount} agents, concurrency: ${concurrency}`],
    responseTimes: [],
  });

  const state = activeSimulations.get(simulationId)!;

  try {
    await updateSimulation(simulationId, { status: "running", startedAt: new Date() });

    // Load quiz data
    const quizData = await getSnapshotWithQA(snapshotId);
    if (!quizData) throw new Error("Snapshot not found");

    const connection = await getConnection(connectionId);
    if (!connection) throw new Error("WP connection not found");

    const client = new WpApiClient({
      siteUrl: connection.siteUrl,
      apiUser: connection.apiUser,
      apiPassword: connection.apiPassword,
    });

    const { snapshot, questions } = quizData;
    const questionIds = questions.map(q => q.wpQuestionId);

    // Determine target URL — use quiz page URL or site URL
    const targetUrl = snapshot.settings && (snapshot.settings as any).page_url
      ? (snapshot.settings as any).page_url
      : connection.siteUrl;

    state.logs.push(`[${new Date().toISOString()}] Target URL: ${targetUrl}`);
    state.logs.push(`[${new Date().toISOString()}] Quiz: "${snapshot.title}" — ${questions.length} questions`);

    // Create agent records
    const agentIds: number[] = [];
    for (let i = 0; i < agentCount; i++) {
      const email = `agent${i + 1}@${agentDomain}`;
      const agentId = await createSimulationAgent({
        simulationId,
        agentIndex: i,
        email,
        status: "pending",
        score: null,
        responseMs: null,
        httpStatus: null,
        errorMessage: null,
        answers: null,
        startedAt: null,
        completedAt: null,
      });
      agentIds.push(agentId);
    }

    // Semaphore-based concurrency control
    let activeCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    const responseTimes: number[] = [];
    let agentIndex = 0;

    const runAgent = async (i: number, agentId: number): Promise<void> => {
      if (state.status === "cancelled") return;

      const email = `agent${i + 1}@${agentDomain}`;
      await updateSimulationAgent(agentId, { status: "running", startedAt: new Date() });

      // Generate answers based on strategy
      const answers = generateRandomAnswers(
        questions.map(q => ({
          wpQuestionId: q.wpQuestionId,
          type: q.type,
          answers: q.answers.map(a => ({ wpAnswerId: a.wpAnswerId, isCorrect: a.isCorrect })),
        })),
        strategy
      );

      const result = await client.submitQuiz({
        pageUrl: targetUrl,
        quizId: snapshot.wpQuizId,
        questionIds,
        answers,
        email,
      });

      responseTimes.push(result.responseMs);
      state.responseTimes.push(result.responseMs);

      if (result.success) {
        completedCount++;
        await updateSimulationAgent(agentId, {
          status: "completed",
          score: result.score ?? null,
          responseMs: result.responseMs,
          httpStatus: result.httpStatus ?? null,
          answers: answers as any,
          completedAt: new Date(),
        });
      } else {
        failedCount++;
        await updateSimulationAgent(agentId, {
          status: "failed",
          responseMs: result.responseMs,
          httpStatus: result.httpStatus ?? null,
          errorMessage: result.error ?? "Unknown error",
          completedAt: new Date(),
        });
        state.logs.push(`[${new Date().toISOString()}] Agent ${i + 1} FAILED: ${result.error || `HTTP ${result.httpStatus}`}`);
      }

      const total = completedCount + failedCount;
      state.progress = Math.round((total / agentCount) * 100);

      // Update simulation progress every 10 agents
      if (total % 10 === 0 || total === agentCount) {
        const sorted = [...responseTimes].sort((a, b) => a - b);
        const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] ?? 0;

        await updateSimulation(simulationId, {
          completedAgents: completedCount,
          failedAgents: failedCount,
          avgResponseMs: avg,
          minResponseMs: sorted[0] ?? 0,
          maxResponseMs: sorted[sorted.length - 1] ?? 0,
          p95ResponseMs: p95,
          errorRate: (failedCount / agentCount) * 100,
        });

        state.logs.push(`[${new Date().toISOString()}] Progress: ${total}/${agentCount} (${state.progress}%) | avg: ${avg.toFixed(0)}ms | p95: ${p95.toFixed(0)}ms`);
      }
    };

    // Process agents with concurrency limit
    const queue = Array.from({ length: agentCount }, (_, i) => ({ i, agentId: agentIds[i] }));

    const workers = Array.from({ length: Math.min(concurrency, agentCount) }, async () => {
      while (queue.length > 0 && state.status !== "cancelled") {
        const task = queue.shift();
        if (!task) break;
        activeCount++;
        try {
          await runAgent(task.i, task.agentId);
        } finally {
          activeCount--;
        }
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      }
    });

    await Promise.all(workers);

    // Final stats
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const avg = sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] ?? 0 : 0;

    const finalStatus = state.status === "cancelled" ? "cancelled" : "completed";
    state.status = finalStatus as any;

    await updateSimulation(simulationId, {
      status: finalStatus,
      completedAgents: completedCount,
      failedAgents: failedCount,
      totalAgents: agentCount,
      avgResponseMs: avg,
      minResponseMs: sorted[0] ?? 0,
      maxResponseMs: sorted[sorted.length - 1] ?? 0,
      p95ResponseMs: p95,
      errorRate: (failedCount / agentCount) * 100,
      completedAt: new Date(),
    });

    state.logs.push(`[${new Date().toISOString()}] Simulation ${finalStatus}. Completed: ${completedCount}, Failed: ${failedCount}`);
    state.logs.push(`[${new Date().toISOString()}] Stats — avg: ${avg.toFixed(0)}ms | min: ${sorted[0]?.toFixed(0)}ms | max: ${sorted[sorted.length - 1]?.toFixed(0)}ms | p95: ${p95.toFixed(0)}ms | error rate: ${((failedCount / agentCount) * 100).toFixed(1)}%`);

  } catch (err: any) {
    state.status = "failed";
    state.logs.push(`[${new Date().toISOString()}] FATAL ERROR: ${err.message}`);
    await updateSimulation(simulationId, { status: "failed", completedAt: new Date() });
  }
}
