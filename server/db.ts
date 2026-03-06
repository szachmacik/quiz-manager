import { eq, desc, and, sql, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  wpConnections, WpConnection,
  quizSnapshots, QuizSnapshot,
  quizQuestions, QuizQuestion,
  quizAnswers, QuizAnswer,
  aiReviews, AiReview,
  simulations, Simulation,
  simulationAgents, SimulationAgent,
  patchProposals, PatchProposal,
  reports, Report,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── WP Connections ───────────────────────────────────────────────────────────
export async function listConnections() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wpConnections).orderBy(desc(wpConnections.createdAt));
}

export async function getConnection(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(wpConnections).where(eq(wpConnections.id, id)).limit(1);
  return r[0];
}

export async function createConnection(data: Omit<WpConnection, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(wpConnections).values(data as any);
  return (result as any).insertId as number;
}

export async function updateConnectionStatus(id: number, status: "active" | "error" | "untested") {
  const db = await getDb();
  if (!db) return;
  await db.update(wpConnections).set({ status, lastTestedAt: new Date() }).where(eq(wpConnections.id, id));
}

// ─── Quiz Snapshots ───────────────────────────────────────────────────────────
export async function listSnapshots(connectionId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (connectionId) {
    return db.select().from(quizSnapshots).where(eq(quizSnapshots.connectionId, connectionId)).orderBy(desc(quizSnapshots.createdAt));
  }
  return db.select().from(quizSnapshots).orderBy(desc(quizSnapshots.createdAt));
}

export async function getSnapshot(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(quizSnapshots).where(eq(quizSnapshots.id, id)).limit(1);
  return r[0];
}

export async function createSnapshot(data: Omit<QuizSnapshot, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(quizSnapshots).values(data as any);
  return (result as any).insertId as number;
}

export async function getSnapshotWithQA(snapshotId: number) {
  const db = await getDb();
  if (!db) return null;
  const snapshot = await getSnapshot(snapshotId);
  if (!snapshot) return null;
  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.snapshotId, snapshotId)).orderBy(quizQuestions.position);
  const answers = await db.select().from(quizAnswers).where(eq(quizAnswers.snapshotId, snapshotId)).orderBy(quizAnswers.position);
  const questionsWithAnswers = questions.map(q => ({
    ...q,
    answers: answers.filter(a => a.questionId === q.id),
  }));
  return { snapshot, questions: questionsWithAnswers };
}

export async function saveSnapshotQuestions(snapshotId: number, questions: Omit<QuizQuestion, "id">[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (questions.length === 0) return;
  await db.insert(quizQuestions).values(questions as any);
}

export async function saveSnapshotAnswers(snapshotId: number, answers: Omit<QuizAnswer, "id">[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (answers.length === 0) return;
  await db.insert(quizAnswers).values(answers as any);
}

// ─── AI Reviews ───────────────────────────────────────────────────────────────
export async function createAiReview(snapshotId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(aiReviews).values({ snapshotId, status: "pending" } as any);
  return (result as any).insertId as number;
}

export async function updateAiReview(id: number, data: Partial<AiReview>) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiReviews).set(data as any).where(eq(aiReviews.id, id));
}

export async function getAiReview(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(aiReviews).where(eq(aiReviews.id, id)).limit(1);
  return r[0];
}

export async function listAiReviews(snapshotId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (snapshotId) return db.select().from(aiReviews).where(eq(aiReviews.snapshotId, snapshotId)).orderBy(desc(aiReviews.createdAt));
  return db.select().from(aiReviews).orderBy(desc(aiReviews.createdAt));
}

// ─── Simulations ──────────────────────────────────────────────────────────────
export async function createSimulation(data: Omit<Simulation, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(simulations).values(data as any);
  return (result as any).insertId as number;
}

export async function updateSimulation(id: number, data: Partial<Simulation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(simulations).set(data as any).where(eq(simulations.id, id));
}

export async function getSimulation(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(simulations).where(eq(simulations.id, id)).limit(1);
  return r[0];
}

export async function listSimulations(snapshotId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (snapshotId) return db.select().from(simulations).where(eq(simulations.snapshotId, snapshotId)).orderBy(desc(simulations.createdAt));
  return db.select().from(simulations).orderBy(desc(simulations.createdAt));
}

export async function createSimulationAgent(data: Omit<SimulationAgent, "id">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(simulationAgents).values(data as any);
  return (result as any).insertId as number;
}

export async function updateSimulationAgent(id: number, data: Partial<SimulationAgent>) {
  const db = await getDb();
  if (!db) return;
  await db.update(simulationAgents).set(data as any).where(eq(simulationAgents.id, id));
}

export async function listSimulationAgents(simulationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simulationAgents).where(eq(simulationAgents.simulationId, simulationId)).orderBy(simulationAgents.agentIndex);
}

// ─── Patch Proposals ──────────────────────────────────────────────────────────
export async function createPatchProposal(data: Omit<PatchProposal, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(patchProposals).values(data as any);
  return (result as any).insertId as number;
}

export async function updatePatchProposal(id: number, data: Partial<PatchProposal>) {
  const db = await getDb();
  if (!db) return;
  await db.update(patchProposals).set(data as any).where(eq(patchProposals.id, id));
}

export async function getPatchProposal(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(patchProposals).where(eq(patchProposals.id, id)).limit(1);
  return r[0];
}

export async function listPatchProposals(snapshotId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (snapshotId) return db.select().from(patchProposals).where(eq(patchProposals.snapshotId, snapshotId)).orderBy(desc(patchProposals.createdAt));
  return db.select().from(patchProposals).orderBy(desc(patchProposals.createdAt));
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export async function createReport(data: Omit<Report, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(reports).values(data as any);
  return (result as any).insertId as number;
}

export async function listReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).orderBy(desc(reports.createdAt));
}

export async function getReport(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return r[0];
}

// ─── App Settings ─────────────────────────────────────────────────────────────
import { appSettings, scheduledSimulations, snapshotDiffs, syncLog, ScheduledSimulation, SnapshotDiff, SyncLog } from "../drizzle/schema";

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return r[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(appSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(appSettings);
  return Object.fromEntries(rows.map(r => [r.key, r.value ?? ""]));
}

// ─── Scheduled Simulations ────────────────────────────────────────────────────
export async function createScheduledSimulation(data: Omit<ScheduledSimulation, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(scheduledSimulations).values(data as any);
  return (result as any).insertId as number;
}

export async function listScheduledSimulations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledSimulations).orderBy(scheduledSimulations.scheduledAt);
}

export async function updateScheduledSimulation(id: number, data: Partial<ScheduledSimulation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduledSimulations).set(data as any).where(eq(scheduledSimulations.id, id));
}

export async function getPendingScheduledSimulations() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(scheduledSimulations)
    .where(and(eq(scheduledSimulations.status, "pending"), lte(scheduledSimulations.scheduledAt, now)));
}

// ─── Snapshot Diffs ───────────────────────────────────────────────────────────
export async function createSnapshotDiff(data: Omit<SnapshotDiff, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(snapshotDiffs).values(data as any);
  return (result as any).insertId as number;
}

export async function getSnapshotDiff(snapshotAId: number, snapshotBId: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(snapshotDiffs)
    .where(and(eq(snapshotDiffs.snapshotAId, snapshotAId), eq(snapshotDiffs.snapshotBId, snapshotBId)))
    .limit(1);
  return r[0] ?? null;
}

// ─── Sync Log ─────────────────────────────────────────────────────────────────
export async function addSyncLog(data: Omit<SyncLog, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) return;
  await db.insert(syncLog).values(data as any);
}

export async function listSyncLog(connectionId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  if (connectionId) {
    return db.select().from(syncLog).where(eq(syncLog.connectionId, connectionId)).orderBy(desc(syncLog.createdAt)).limit(limit);
  }
  return db.select().from(syncLog).orderBy(desc(syncLog.createdAt)).limit(limit);
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { connections: 0, snapshots: 0, simulations: 0, pendingPatches: 0, reviews: 0, lastSync: null };

  const [connCount] = await db.select({ count: sql<number>`count(*)` }).from(wpConnections);
  const [snapCount] = await db.select({ count: sql<number>`count(*)` }).from(quizSnapshots);
  const [simCount] = await db.select({ count: sql<number>`count(*)` }).from(simulations);
  const [patchCount] = await db.select({ count: sql<number>`count(*)` }).from(patchProposals).where(eq(patchProposals.status, "pending"));
  const [reviewCount] = await db.select({ count: sql<number>`count(*)` }).from(aiReviews);
  const lastSyncRow = await db.select().from(syncLog).orderBy(desc(syncLog.createdAt)).limit(1);

  return {
    connections: Number(connCount?.count ?? 0),
    snapshots: Number(snapCount?.count ?? 0),
    simulations: Number(simCount?.count ?? 0),
    pendingPatches: Number(patchCount?.count ?? 0),
    reviews: Number(reviewCount?.count ?? 0),
    lastSync: lastSyncRow[0]?.createdAt ?? null,
  };
}
