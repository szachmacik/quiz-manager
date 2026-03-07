import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  float,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Core auth ────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ─── WordPress connections ────────────────────────────────────────────────────
export const wpConnections = mysqlTable("wp_connections", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  siteUrl: varchar("siteUrl", { length: 512 }).notNull(),
  apiUser: varchar("apiUser", { length: 255 }).notNull(),
  apiPassword: text("apiPassword").notNull(), // Application Password (encrypted)
  mysqlHost: varchar("mysqlHost", { length: 255 }),
  mysqlPort: int("mysqlPort").default(3306),
  mysqlDb: varchar("mysqlDb", { length: 255 }),
  mysqlUser: varchar("mysqlUser", { length: 255 }),
  mysqlPassword: text("mysqlPassword"),
  tablePrefix: varchar("tablePrefix", { length: 32 }).default("wp_"),
  status: mysqlEnum("status", ["active", "error", "untested"]).default("untested").notNull(),
  lastTestedAt: timestamp("lastTestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Quiz snapshots (kopie quizów) ───────────────────────────────────────────
export const quizSnapshots = mysqlTable("quiz_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull(),
  wpQuizId: int("wpQuizId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  slug: varchar("slug", { length: 512 }),
  shortcode: varchar("shortcode", { length: 128 }),
  settings: json("settings"), // full quiz settings from AYS
  questionIds: text("questionIds"), // "***" separated IDs
  questionCount: int("questionCount").default(0),
  snapshotType: mysqlEnum("snapshotType", ["auto", "manual", "pre_test", "pre_patch"]).default("auto").notNull(),
  snapshotHash: varchar("snapshotHash", { length: 64 }), // SHA256 of content for change detection
  rawData: json("rawData"), // full raw quiz object from WP
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Quiz questions (snapshot) ────────────────────────────────────────────────
export const quizQuestions = mysqlTable("quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId").notNull(),
  wpQuestionId: int("wpQuestionId").notNull(),
  question: text("question").notNull(),
  type: mysqlEnum("type", ["radio", "checkbox", "select", "text"]).default("radio").notNull(),
  position: int("position").default(0),
  rawData: json("rawData"),
});

// ─── Quiz answers (snapshot) ──────────────────────────────────────────────────
export const quizAnswers = mysqlTable("quiz_answers", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  snapshotId: int("snapshotId").notNull(),
  wpAnswerId: int("wpAnswerId").notNull(),
  answer: text("answer").notNull(),
  isCorrect: boolean("isCorrect").default(false).notNull(),
  position: int("position").default(0),
});

// ─── AI Reviews ───────────────────────────────────────────────────────────────
export const aiReviews = mysqlTable("ai_reviews", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  overallScore: float("overallScore"), // 0-100
  errorsFound: int("errorsFound").default(0),
  warningsFound: int("warningsFound").default(0),
  summary: text("summary"),
  findings: json("findings"), // array of {questionId, type, severity, message, suggestion}
  rawResponse: json("rawResponse"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Simulations ──────────────────────────────────────────────────────────────
export const simulations = mysqlTable("simulations", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId").notNull(),
  connectionId: int("connectionId").notNull(),
  name: varchar("name", { length: 255 }),
  agentCount: int("agentCount").default(100).notNull(),
  agentDomain: varchar("agentDomain", { length: 255 }).notNull(), // email domain for agents
  strategy: mysqlEnum("strategy", ["random", "all_correct", "all_wrong", "mixed"]).default("random").notNull(),
  concurrency: int("concurrency").default(10).notNull(), // parallel agents at once
  delayMs: int("delayMs").default(500), // delay between agent requests
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).default("pending").notNull(),
  totalAgents: int("totalAgents").default(0),
  completedAgents: int("completedAgents").default(0),
  failedAgents: int("failedAgents").default(0),
  avgResponseMs: float("avgResponseMs"),
  minResponseMs: float("minResponseMs"),
  maxResponseMs: float("maxResponseMs"),
  p95ResponseMs: float("p95ResponseMs"),
  errorRate: float("errorRate"), // 0-100%
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Simulation agent results ─────────────────────────────────────────────────
export const simulationAgents = mysqlTable("simulation_agents", {
  id: int("id").autoincrement().primaryKey(),
  simulationId: int("simulationId").notNull(),
  agentIndex: int("agentIndex").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  score: float("score"), // percentage score
  responseMs: float("responseMs"), // total time to complete quiz
  httpStatus: int("httpStatus"),
  errorMessage: text("errorMessage"),
  answers: json("answers"), // submitted answers
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});

// ─── Patch proposals ──────────────────────────────────────────────────────────
export const patchProposals = mysqlTable("patch_proposals", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId").notNull(),
  aiReviewId: int("aiReviewId"),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  patchType: mysqlEnum("patchType", ["question_text", "answer_text", "correct_answer", "settings", "other"]).notNull(),
  targetWpId: int("targetWpId"), // WP question or answer ID to patch
  targetType: mysqlEnum("targetType", ["question", "answer", "quiz"]),
  fieldName: varchar("fieldName", { length: 128 }),
  originalValue: text("originalValue"),
  proposedValue: text("proposedValue"),
  reasoning: text("reasoning"), // AI justification
  status: mysqlEnum("status", ["pending", "approved", "rejected", "applied", "rolled_back"]).default("pending").notNull(),
  preApplySnapshotId: int("preApplySnapshotId"), // snapshot taken before applying
  postSimulationId: int("postSimulationId"), // simulation run after applying
  approvedBy: varchar("approvedBy", { length: 64 }),
  approvedAt: timestamp("approvedAt"),
  appliedAt: timestamp("appliedAt"),
  rolledBackAt: timestamp("rolledBackAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId"),
  simulationId: int("simulationId"),
  aiReviewId: int("aiReviewId"),
  title: varchar("title", { length: 512 }).notNull(),
  type: mysqlEnum("type", ["simulation", "ai_review", "combined", "patch_summary"]).notNull(),
  content: json("content"), // structured report data
  summary: text("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── App Settings ───────────────────────────────────────────────────────────
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Scheduled simulations ───────────────────────────────────────────────────
export const scheduledSimulations = mysqlTable("scheduled_simulations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  snapshotId: int("snapshotId").notNull(),
  connectionId: int("connectionId").notNull(),
  agentDomain: varchar("agentDomain", { length: 255 }).notNull(),
  agentCount: int("agentCount").default(100).notNull(),
  concurrency: int("concurrency").default(10).notNull(),
  delayMs: int("delayMs").default(500),
  strategy: mysqlEnum("strategy", ["random", "all_correct", "all_wrong", "mixed"]).default("random").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", ["pending", "triggered", "cancelled"]).default("pending").notNull(),
  triggeredSimulationId: int("triggeredSimulationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Snapshot diffs ───────────────────────────────────────────────────────────
export const snapshotDiffs = mysqlTable("snapshot_diffs", {
  id: int("id").autoincrement().primaryKey(),
  snapshotAId: int("snapshotAId").notNull(),
  snapshotBId: int("snapshotBId").notNull(),
  addedQuestions: int("addedQuestions").default(0),
  removedQuestions: int("removedQuestions").default(0),
  modifiedQuestions: int("modifiedQuestions").default(0),
  addedAnswers: int("addedAnswers").default(0),
  removedAnswers: int("removedAnswers").default(0),
  modifiedAnswers: int("modifiedAnswers").default(0),
  diffData: json("diffData"), // detailed diff per question/answer
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Auto-sync log ────────────────────────────────────────────────────────────
export const syncLog = mysqlTable("sync_log", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull(),
  wpQuizId: int("wpQuizId"),
  status: mysqlEnum("status", ["ok", "changed", "error", "no_change"]).default("ok").notNull(),
  snapshotId: int("snapshotId"),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Telemetry Sessions (natywna przeglądarka) ─────────────────────────────────
export const telemetrySessions = mysqlTable("telemetry_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionToken: varchar("sessionToken", { length: 128 }).notNull().unique(),
  connectionId: int("connectionId"),
  snapshotId: int("snapshotId"),
  wpQuizId: int("wpQuizId"),
  participantName: varchar("participantName", { length: 255 }),
  participantEmail: varchar("participantEmail", { length: 320 }),
  userAgent: text("userAgent"),
  screenWidth: int("screenWidth"),
  screenHeight: int("screenHeight"),
  // Behavioral metrics
  totalDurationMs: bigint("totalDurationMs", { mode: "number" }),
  avgMouseSpeed: float("avgMouseSpeed"),
  totalKeystrokes: int("totalKeystrokes").default(0),
  totalClicks: int("totalClicks").default(0),
  tabSwitchCount: int("tabSwitchCount").default(0),
  copyPasteCount: int("copyPasteCount").default(0),
  pauseCount: int("pauseCount").default(0), // pauses > 30s
  avgTimeBetweenAnswersMs: float("avgTimeBetweenAnswersMs"),
  // AI verdict
  behaviorVerdict: mysqlEnum("behaviorVerdict", ["normal", "suspicious", "anomaly"]),
  behaviorScore: float("behaviorScore"), // 0-100 (100 = very normal)
  anomalies: json("anomalies"), // list of detected anomalies
  aiAnalysis: json("aiAnalysis"),
  status: mysqlEnum("status", ["active", "completed", "analysed"]).default("active").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const telemetryEvents = mysqlTable("telemetry_events", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(), // mousemove, click, keydown, focus, blur, scroll, visibility, paste
  timestampMs: bigint("timestampMs", { mode: "number" }).notNull(), // ms since session start
  x: float("x"), // mouse X (normalized 0-1)
  y: float("y"), // mouse Y (normalized 0-1)
  targetElement: varchar("targetElement", { length: 128 }), // CSS selector
  metadata: json("metadata"), // extra data per event type
});

// ─── Competition Rules (regulamin + intencje twórcy) ────────────────────────
export const competitionRules = mysqlTable("competition_rules", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull(),
  name: varchar("name", { length: 255 }).notNull(), // np. "Konkurs Matematyczny 2025"
  rulesText: text("rulesText"), // pełny regulamin wklejony przez użytkownika
  intentNotes: text("intentNotes"), // dodatkowe intencje twórcy (np. "quiz dla dzieci 8-12 lat")
  expectedStartTime: varchar("expectedStartTime", { length: 8 }), // "HH:MM"
  expectedEndTime: varchar("expectedEndTime", { length: 8 }),
  expectedDurationMin: int("expectedDurationMin"), // oczekiwany czas trwania quizu w minutach
  requireAntiCopy: boolean("requireAntiCopy").default(true),
  requireCaptcha: boolean("requireCaptcha").default(false),
  requireEmailVerification: boolean("requireEmailVerification").default(true),
  requireCertificate: boolean("requireCertificate").default(true),
  maxAttempts: int("maxAttempts").default(1),
  targetAgeGroup: varchar("targetAgeGroup", { length: 64 }), // np. "8-12 lat"
  rawRulesJson: json("rawRulesJson"), // AI-parsed structured rules
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Quiz Settings Audits ─────────────────────────────────────────────────────
export const quizSettingsAudits = mysqlTable("quiz_settings_audits", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId").notNull(),
  connectionId: int("connectionId").notNull(),
  rulesId: int("rulesId"), // powiązany regulamin (opcjonalny)
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  overallScore: float("overallScore"), // 0-100
  issuesFound: int("issuesFound").default(0),
  warningsFound: int("warningsFound").default(0),
  findings: json("findings"), // array of {category, severity, message, currentValue, expectedValue, suggestion}
  settingsSnapshot: json("settingsSnapshot"), // pełne ustawienia quizu w momencie audytu
  summary: text("summary"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Historical Quiz Settings (baza odniesienia) ──────────────────────────────
export const historicalQuizSettings = mysqlTable("historical_quiz_settings", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull(),
  wpQuizId: int("wpQuizId").notNull(),
  quizTitle: varchar("quizTitle", { length: 512 }),
  settings: json("settings").notNull(), // pełne ustawienia AYS
  notes: text("notes"), // np. "Konkurs 2024 — działał poprawnie"
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

// ─── Video Verifications (weryfikator nagrań) ─────────────────────────────────
export const videoVerifications = mysqlTable("video_verifications", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId"),
  snapshotId: int("snapshotId"),
  participantName: varchar("participantName", { length: 255 }),
  participantEmail: varchar("participantEmail", { length: 320 }),
  videoUrl: text("videoUrl").notNull(), // URL do nagrania (Dropbox, Drive, bezpośredni link)
  videoSource: mysqlEnum("videoSource", ["dropbox", "google_drive", "direct_url", "email_attachment"]).default("direct_url").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  verdict: mysqlEnum("verdict", ["independent", "suspicious", "intervention"]), // SAMODZIELNIE / WĄTPLIWE / INTERWENCJA
  confidenceScore: float("confidenceScore"), // 0-100 pewność oceny
  overallScore: float("overallScore"), // 0-100 ocena samodzielności
  anomalies: json("anomalies"), // lista wykrytych anomalii z timestampami
  aiAnalysis: json("aiAnalysis"), // pełna analiza AI
  summary: text("summary"), // opis słowny
  reviewerNotes: text("reviewerNotes"), // notatki manualne recenzenta
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WpConnection = typeof wpConnections.$inferSelect;
export type QuizSnapshot = typeof quizSnapshots.$inferSelect;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type QuizAnswer = typeof quizAnswers.$inferSelect;
export type AiReview = typeof aiReviews.$inferSelect;
export type Simulation = typeof simulations.$inferSelect;
export type SimulationAgent = typeof simulationAgents.$inferSelect;
export type PatchProposal = typeof patchProposals.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type ScheduledSimulation = typeof scheduledSimulations.$inferSelect;
export type SnapshotDiff = typeof snapshotDiffs.$inferSelect;
export type SyncLog = typeof syncLog.$inferSelect;
export type CompetitionRule = typeof competitionRules.$inferSelect;
export type InsertCompetitionRule = typeof competitionRules.$inferInsert;
export type QuizSettingsAudit = typeof quizSettingsAudits.$inferSelect;
export type InsertQuizSettingsAudit = typeof quizSettingsAudits.$inferInsert;
export type HistoricalQuizSetting = typeof historicalQuizSettings.$inferSelect;
export type InsertHistoricalQuizSetting = typeof historicalQuizSettings.$inferInsert;
export type VideoVerification = typeof videoVerifications.$inferSelect;
export type InsertVideoVerification = typeof videoVerifications.$inferInsert;
export type TelemetrySession = typeof telemetrySessions.$inferSelect;
export type InsertTelemetrySession = typeof telemetrySessions.$inferInsert;
export type TelemetryEvent = typeof telemetryEvents.$inferSelect;
export type InsertTelemetryEvent = typeof telemetryEvents.$inferInsert;
