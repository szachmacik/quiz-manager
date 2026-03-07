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

// ─── Schools (baza szkół) ─────────────────────────────────────────────────────
export const schools = mysqlTable("schools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 255 }),
  postalCode: varchar("postalCode", { length: 16 }),
  country: varchar("country", { length: 64 }).default("PL"),
  teacherName: varchar("teacherName", { length: 255 }),
  teacherEmail: varchar("teacherEmail", { length: 320 }),
  teacherPhone: varchar("teacherPhone", { length: 32 }),
  mailerLiteGroupId: varchar("mailerLiteGroupId", { length: 128 }), // ID grupy w MailerLite
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Participants (uczestnicy) ────────────────────────────────────────────────
export const participants = mysqlTable("participants", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  schoolId: int("schoolId"), // powiązana szkoła
  grade: varchar("grade", { length: 32 }), // klasa np. "5B"
  ageGroup: varchar("ageGroup", { length: 64 }), // kategoria wiekowa np. "8-10 lat"
  mailerLiteId: varchar("mailerLiteId", { length: 128 }), // ID subskrybenta w MailerLite
  mailerLiteData: json("mailerLiteData"), // pełne dane z MailerLite
  totalPackagesReceived: int("totalPackagesReceived").default(0), // ile razy dostał paczkę
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Contest Results (wyniki konkursów) ──────────────────────────────────────
export const contestResults = mysqlTable("contest_results", {
  id: int("id").autoincrement().primaryKey(),
  contestName: varchar("contestName", { length: 512 }).notNull(), // nazwa edycji konkursu
  contestEdition: varchar("contestEdition", { length: 128 }), // np. "2025-03"
  snapshotId: int("snapshotId"), // powiązany snapshot quizu
  participantId: int("participantId"), // powiązany uczestnik
  participantName: varchar("participantName", { length: 255 }), // denormalizacja dla szybkości
  participantEmail: varchar("participantEmail", { length: 320 }),
  schoolId: int("schoolId"),
  ageGroup: varchar("ageGroup", { length: 64 }),
  score: float("score").notNull(), // wynik procentowy 0-100
  correctAnswers: int("correctAnswers").default(0),
  totalQuestions: int("totalQuestions").default(0),
  completionTimeMs: bigint("completionTimeMs", { mode: "number" }), // czas rozwiązania w ms
  rank: int("rank"), // miejsce w kategorii (obliczane)
  isWinner: boolean("isWinner").default(false), // miejsca 1-3
  isLaureate: boolean("isLaureate").default(false), // ≥90% poprawnych
  videoVerificationId: int("videoVerificationId"),
  telemetrySessionId: int("telemetrySessionId"),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected", "manual_review"]).default("pending"),
  source: mysqlEnum("source", ["wp_quiz", "manual", "import_csv", "import_mailerlite", "import_facebook"]).default("wp_quiz"),
  rawData: json("rawData"), // oryginalne dane z WP lub importu
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Awards (nagrody) ─────────────────────────────────────────────────────────
export const awards = mysqlTable("awards", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(), // np. "Zestaw kredę artystycznych"
  description: text("description"),
  category: varchar("category", { length: 128 }), // np. "plastyczne", "książki", "gry"
  ageGroup: varchar("ageGroup", { length: 64 }), // dla jakiej grupy wiekowej
  imageUrl: text("imageUrl"),
  stockCount: int("stockCount").default(0), // ile mamy na stanie
  isActive: boolean("isActive").default(true),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Award History (historia nagród) ─────────────────────────────────────────
export const awardHistory = mysqlTable("award_history", {
  id: int("id").autoincrement().primaryKey(),
  participantId: int("participantId").notNull(),
  awardId: int("awardId"),
  awardName: varchar("awardName", { length: 512 }).notNull(), // denormalizacja
  contestEdition: varchar("contestEdition", { length: 128 }).notNull(),
  contestName: varchar("contestName", { length: 512 }),
  shippedAt: timestamp("shippedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Shipping Batches (paczki zbiorcze do szkół) ──────────────────────────────
export const shippingBatches = mysqlTable("shipping_batches", {
  id: int("id").autoincrement().primaryKey(),
  contestEdition: varchar("contestEdition", { length: 128 }).notNull(),
  schoolId: int("schoolId").notNull(),
  schoolName: varchar("schoolName", { length: 512 }), // denormalizacja
  recipientCount: int("recipientCount").default(0), // liczba uczestników w paczce
  recipientIds: json("recipientIds"), // array of contestResult IDs
  awardIds: json("awardIds"), // array of award IDs do wysłania
  shippingAddress: text("shippingAddress"),
  teacherName: varchar("teacherName", { length: 255 }),
  teacherEmail: varchar("teacherEmail", { length: 320 }),
  status: mysqlEnum("status", ["draft", "ready", "shipped", "delivered"]).default("draft").notNull(),
  trackingNumber: varchar("trackingNumber", { length: 128 }),
  hasNewAwardNeeded: boolean("hasNewAwardNeeded").default(false), // flaga: ktoś już dostał nagrodę
  notes: text("notes"),
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
export type School = typeof schools.$inferSelect;
export type InsertSchool = typeof schools.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = typeof participants.$inferInsert;
export type ContestResult = typeof contestResults.$inferSelect;
export type InsertContestResult = typeof contestResults.$inferInsert;
export type Award = typeof awards.$inferSelect;
export type InsertAward = typeof awards.$inferInsert;
export type AwardHistory = typeof awardHistory.$inferSelect;
export type InsertAwardHistory = typeof awardHistory.$inferInsert;
export type ShippingBatch = typeof shippingBatches.$inferSelect;
export type InsertShippingBatch = typeof shippingBatches.$inferInsert;

// ─── Offline Contests (konkursy offline) ──────────────────────────────────────────
export const offlineContests = mysqlTable("offline_contests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  edition: varchar("edition", { length: 128 }),
  description: text("description"),
  // Logistyka
  targetSchoolCount: int("targetSchoolCount").default(0),
  targetParticipantCount: int("targetParticipantCount").default(0),
  registrationDeadline: timestamp("registrationDeadline"),
  contestDate: timestamp("contestDate"),
  resultsDate: timestamp("resultsDate"),
  shippingDeadline: timestamp("shippingDeadline"),
  // Format testu
  testFormat: mysqlEnum("testFormat", ["paper_scan", "paper_manual", "hybrid"]).default("paper_scan"),
  questionsCount: int("questionsCount").default(0),
  passingScore: float("passingScore").default(90), // % do bycia laureatem
  // Weryfikacja
  requireVideoProof: boolean("requireVideoProof").default(false),
  requireTeacherSignature: boolean("requireTeacherSignature").default(true),
  requireParentConsent: boolean("requireParentConsent").default(true),
  // Status
  status: mysqlEnum("status", ["draft", "registration", "active", "scoring", "results", "shipping", "completed"]).default("draft").notNull(),
  // Powiązanie z online
  linkedSnapshotId: int("linkedSnapshotId"), // opcjonalne powiązanie z quizem online
  rulesText: text("rulesText"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Offline Submissions (zgłoszenia offline) ───────────────────────────────────
export const offlineSubmissions = mysqlTable("offline_submissions", {
  id: int("id").autoincrement().primaryKey(),
  offlineContestId: int("offlineContestId").notNull(),
  participantId: int("participantId"),
  schoolId: int("schoolId"),
  // Dane uczestnika (denormalizacja dla szybkości)
  participantName: varchar("participantName", { length: 255 }),
  participantEmail: varchar("participantEmail", { length: 320 }),
  ageGroup: varchar("ageGroup", { length: 64 }),
  grade: varchar("grade", { length: 32 }),
  // Wyniki
  rawScore: float("rawScore"), // surowy wynik
  maxScore: float("maxScore"), // maksymalny możliwy wynik
  scorePercent: float("scorePercent"), // wynik procentowy
  correctAnswers: int("correctAnswers").default(0),
  totalQuestions: int("totalQuestions").default(0),
  rank: int("rank"),
  isWinner: boolean("isWinner").default(false),
  isLaureate: boolean("isLaureate").default(false),
  // Skanowanie
  scanStatus: mysqlEnum("scanStatus", ["pending", "scanned", "ocr_done", "verified", "error"]).default("pending"),
  scanImageUrl: text("scanImageUrl"), // URL skanu arkusza
  ocrRawText: text("ocrRawText"), // surowy tekst OCR
  ocrAnswers: json("ocrAnswers"), // odpowiedzi wyciągnięte przez OCR
  ocrConfidence: float("ocrConfidence"), // pewność OCR 0-100
  manualCorrections: json("manualCorrections"), // ręczne korekty OCR
  // Weryfikacja
  teacherSignatureVerified: boolean("teacherSignatureVerified").default(false),
  parentConsentReceived: boolean("parentConsentReceived").default(false),
  videoUrl: text("videoUrl"),
  videoVerificationId: int("videoVerificationId"),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected", "manual_review"]).default("pending"),
  // Nagrody
  awardAssigned: boolean("awardAssigned").default(false),
  awardId: int("awardId"),
  shippingBatchId: int("shippingBatchId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Offline Answer Sheets (szablony arkuszy) ─────────────────────────────────
export const offlineAnswerSheets = mysqlTable("offline_answer_sheets", {
  id: int("id").autoincrement().primaryKey(),
  offlineContestId: int("offlineContestId").notNull(),
  version: varchar("version", { length: 32 }).default("v1"),
  questions: json("questions").notNull(), // tablica pytań z opcjami A/B/C/D
  answerKey: json("answerKey").notNull(), // klucz odpowiedzi
  pdfUrl: text("pdfUrl"), // URL wygenerowanego PDF arkusza
  printInstructions: text("printInstructions"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── School Registrations (rejestracje szkół do konkursu) ───────────────────────
export const schoolRegistrations = mysqlTable("school_registrations", {
  id: int("id").autoincrement().primaryKey(),
  offlineContestId: int("offlineContestId").notNull(),
  schoolId: int("schoolId").notNull(),
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  expectedParticipants: int("expectedParticipants").default(0),
  actualParticipants: int("actualParticipants").default(0),
  answerSheetsRequested: int("answerSheetsRequested").default(0),
  answerSheetsSent: boolean("answerSheetsSent").default(false),
  answerSheetsSentAt: timestamp("answerSheetsSentAt"),
  submissionsReceived: int("submissionsReceived").default(0),
  status: mysqlEnum("status", ["registered", "sheets_sent", "submitted", "scored", "awarded"]).default("registered").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OfflineContest = typeof offlineContests.$inferSelect;
export type InsertOfflineContest = typeof offlineContests.$inferInsert;
export type OfflineSubmission = typeof offlineSubmissions.$inferSelect;
export type InsertOfflineSubmission = typeof offlineSubmissions.$inferInsert;
export type OfflineAnswerSheet = typeof offlineAnswerSheets.$inferSelect;
export type InsertOfflineAnswerSheet = typeof offlineAnswerSheets.$inferInsert;
export type SchoolRegistration = typeof schoolRegistrations.$inferSelect;
export type InsertSchoolRegistration = typeof schoolRegistrations.$inferInsert;

// ─── Anomaly Cases (detektor anomalii technicznych) ──────────────────────────
export const anomalyCases = mysqlTable("anomaly_cases", {
  id: int("id").autoincrement().primaryKey(),
  // Uczestnik
  participantEmail: varchar("participantEmail", { length: 320 }).notNull(),
  participantName: varchar("participantName", { length: 255 }),
  contestEdition: varchar("contestEdition", { length: 128 }),
  quizId: int("quizId"),
  snapshotId: int("snapshotId"),
  // Typ anomalii
  anomalyType: mysqlEnum("anomalyType", [
    "recording_interrupted",   // nagranie przerwane w trakcie
    "server_timeout",          // timeout serwera podczas quizu
    "ajax_error",              // błąd AJAX pluginu AYS
    "connection_lost",         // utrata połączenia w trakcie
    "quiz_not_saved",          // wyniki nie zapisały się w WP
    "session_expired",         // sesja wygasła podczas quizu
    "plugin_crash",            // crash pluginu AYS
    "black_swan",              // czarny łabędź — nieznana anomalia
    "other",                   // inne
  ]).notNull(),
  // Dowody techniczne
  serverLogEvidence: text("serverLogEvidence"),   // wyciąg z logów serwera
  telemetryEvidence: json("telemetryEvidence"),   // dane telemetrii (jeśli dostępne)
  simulationReference: text("simulationReference"), // odniesienie do symulacji która przewidziała ten błąd
  errorCode: varchar("errorCode", { length: 64 }),
  errorMessage: text("errorMessage"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  // Ocena wiarygodności (AI)
  credibilityScore: float("credibilityScore"),    // 0-100: jak wiarygodne jest że to błąd techniczny
  credibilityReason: text("credibilityReason"),   // uzasadnienie AI
  isSuspiciousBehavior: boolean("isSuspiciousBehavior").default(false), // flaga podejrzanego zachowania
  suspicionReason: text("suspicionReason"),
  // Protokół drugiej szansy
  status: mysqlEnum("status", [
    "detected",      // wykryto anomalię
    "under_review",  // w trakcie przeglądu przez admina
    "approved",      // zatwierdzona — uczestnik dostaje drugą szansę
    "rejected",      // odrzucona — brak podstaw do drugiej szansy
    "retry_used",    // uczestnik skorzystał z drugiej szansy
  ]).default("detected").notNull(),
  adminDecision: text("adminDecision"),           // uzasadnienie decyzji admina
  adminId: int("adminId"),
  decidedAt: timestamp("decidedAt"),
  retryToken: varchar("retryToken", { length: 128 }), // jednorazowy token do ponownego quizu
  retryTokenExpiresAt: timestamp("retryTokenExpiresAt"),
  retryUsedAt: timestamp("retryUsedAt"),
  notificationSentAt: timestamp("notificationSentAt"), // kiedy wysłano email do uczestnika
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Known Anomaly Patterns (znane wzorce anomalii z symulacji) ──────────────
export const anomalyPatterns = mysqlTable("anomaly_patterns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  anomalyType: varchar("anomalyType", { length: 64 }).notNull(),
  detectionSignals: json("detectionSignals").notNull(), // sygnały do wykrycia
  isBlackSwan: boolean("isBlackSwan").default(false),
  discoveredInSimulation: varchar("discoveredInSimulation", { length: 128 }),
  occurrenceCount: int("occurrenceCount").default(0),
  lastSeenAt: timestamp("lastSeenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnomalyCase = typeof anomalyCases.$inferSelect;
export type InsertAnomalyCase = typeof anomalyCases.$inferInsert;
export type AnomalyPattern = typeof anomalyPatterns.$inferSelect;
export type InsertAnomalyPattern = typeof anomalyPatterns.$inferInsert;

// ─── Risk Knowledge Base (baza wiedzy o ryzykach) ────────────────────────────
export const riskItems = mysqlTable("risk_items", {
  id: int("id").autoincrement().primaryKey(),
  // Klasyfikacja
  category: mysqlEnum("category", [
    "wordpress_core",     // WordPress sam w sobie
    "ays_plugin",         // Plugin AYS Quiz Maker
    "server_infra",       // Infrastruktura serwera (hosting, baza danych)
    "network",            // Sieć, CDN, Cloudflare
    "user_behavior",      // Zachowanie uczestników (DDoS, spam)
    "competition_setup",  // Ustawienia samego konkursu
    "recording",          // Nagrywanie wideo
    "native_migration",   // Migracja do wersji natywnej
    "offline_contest",    // Konkurs offline (papier)
  ]).notNull(),
  platform: mysqlEnum("platform", ["wordpress", "native", "both", "offline"]).default("wordpress").notNull(),
  // Opis ryzyka
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  scenario: text("scenario"), // Konkretny scenariusz jak to może się wydarzyć
  // Ocena ryzyka
  probability: mysqlEnum("probability", ["low", "medium", "high", "certain"]).notNull(),
  impact: mysqlEnum("impact", ["low", "medium", "high", "critical"]).notNull(),
  riskScore: int("riskScore").notNull(), // probability * impact (1-16)
  isWordPressSpecific: boolean("isWordPressSpecific").default(false), // nieuchronne w WP, zniknie w wersji natywnej
  isUnavoidable: boolean("isUnavoidable").default(false), // nieuchronne nawet w wersji natywnej
  // Naprawa i prewencja
  immediateAction: text("immediateAction").notNull(),  // Co robić TERAZ gdy się wydarzy
  prevention: text("prevention").notNull(),            // Jak zapobiec
  nativeSolution: text("nativeSolution"),              // Jak to rozwiązuje wersja natywna
  checklistItems: json("checklistItems"),              // Lista rzeczy do sprawdzenia przed konkursem
  // Status i historia
  status: mysqlEnum("status", ["active", "mitigated", "resolved", "monitoring"]).default("active").notNull(),
  lastOccurredAt: timestamp("lastOccurredAt"),
  occurrenceCount: int("occurrenceCount").default(0),
  isBuiltIn: boolean("isBuiltIn").default(false), // wbudowane przez system (nie edytowalne)
  tags: json("tags"), // ["ajax", "timeout", "database", ...]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Risk Incidents (historia zdarzeń) ───────────────────────────────────────
export const riskIncidents = mysqlTable("risk_incidents", {
  id: int("id").autoincrement().primaryKey(),
  riskItemId: int("riskItemId").notNull(),
  anomalyCaseId: int("anomalyCaseId"), // powiązanie z anomaly_cases
  simulationId: int("simulationId"),   // powiązanie z symulacją
  description: text("description").notNull(),
  resolvedBy: text("resolvedBy"),
  resolutionTimeMinutes: int("resolutionTimeMinutes"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type RiskItem = typeof riskItems.$inferSelect;
export type InsertRiskItem = typeof riskItems.$inferInsert;
export type RiskIncident = typeof riskIncidents.$inferSelect;

// ─── Behavioral Profiles (profile behawioralne) ───────────────────────────────
export const behavioralProfiles = mysqlTable("behavioral_profiles", {
  id: int("id").autoincrement().primaryKey(),
  // Dane uczestnika
  participantEmail: varchar("participantEmail", { length: 320 }).notNull(),
  participantName: varchar("participantName", { length: 255 }),
  schoolId: int("schoolId"),
  contestEditions: json("contestEditions"), // lista edycji w których brał udział
  // Typ profilu
  role: mysqlEnum("role", ["child", "parent", "teacher"]).notNull(),
  // Profil dziecka
  ageGroup: mysqlEnum("ageGroup", ["zerowka", "klasa_1", "klasa_2", "klasa_3", "klasa_4", "klasa_5", "klasa_6"]),
  stressIndicators: json("stressIndicators"),      // sygnały stresu z telemetrii
  cheatingRiskScore: int("cheatingRiskScore"),     // 0-100 ryzyko ściągania
  technicalSkillLevel: mysqlEnum("technicalSkillLevel", ["low", "medium", "high"]),
  averageCompletionTimeMs: int("averageCompletionTimeMs"),
  averageScore: int("averageScore"),               // 0-100
  participationCount: int("participationCount").default(0),
  // Profil rodzica/opiekuna
  interventionRiskScore: int("interventionRiskScore"), // 0-100 ryzyko ingerencji
  complaintRiskScore: int("complaintRiskScore"),       // 0-100 ryzyko pretensji
  previousComplaints: int("previousComplaints").default(0),
  previousInterventions: int("previousInterventions").default(0),
  // Profil nauczyciela
  organizationalRiskScore: int("organizationalRiskScore"), // 0-100 ryzyko błędów org.
  previousIncidents: int("previousIncidents").default(0),
  schoolsManaged: int("schoolsManaged").default(1),
  // Predykcja AI
  predictedRisks: json("predictedRisks"),          // lista przewidywanych ryzyk
  aiNeedsAnalysis: text("aiNeedsAnalysis"),         // analiza potrzeb przez AI
  aiRecommendations: text("aiRecommendations"),     // rekomendacje dla organizatora
  predictionConfidence: int("predictionConfidence"), // 0-100
  // Flagi
  isHighRisk: boolean("isHighRisk").default(false),
  requiresSpecialAttention: boolean("requiresSpecialAttention").default(false),
  specialAttentionNote: text("specialAttentionNote"),
  // Dane historyczne
  telemetrySessions: json("telemetrySessions"),    // lista ID sesji telemetrii
  videoVerifications: json("videoVerifications"),  // lista ID weryfikacji wideo
  anomalyCases: json("anomalyCases"),              // lista ID anomalii
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Behavioral Events (zdarzenia behawioralne) ───────────────────────────────
export const behavioralEvents = mysqlTable("behavioral_events", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  eventType: mysqlEnum("eventType", [
    // Dziecko
    "unusual_speed",          // rozwiązał za szybko
    "unusual_slowness",       // rozwiązał za wolno
    "copy_paste_detected",    // wykryto copy-paste
    "tab_switch",             // przełączał zakładki
    "long_pause",             // długa przerwa w trakcie
    "answer_changed_many",    // wielokrotna zmiana odpowiedzi
    "perfect_score_fast",     // idealny wynik w krótkim czasie (podejrzane)
    // Rodzic
    "parent_intervention",    // ingerencja rodzica (z weryfikacji wideo)
    "complaint_submitted",    // złożona skarga
    "dispute_raised",         // spór o wyniki
    "late_submission",        // spóźnione zgłoszenie nagrania
    // Nauczyciel
    "late_registration",      // spóźniona rejestracja uczniów
    "bulk_registration",      // masowa rejestracja w ostatniej chwili
    "missing_consent",        // brak zgód RODO
    "wrong_category",         // zgłoszenie do złej kategorii wiekowej
    "technical_failure_org",  // błąd organizacyjny (nie techniczny)
  ]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  description: text("description").notNull(),
  evidence: json("evidence"),     // dowody (logi, screenshoty, fragmenty telemetrii)
  contestEdition: varchar("contestEdition", { length: 100 }),
  resolvedAt: timestamp("resolvedAt"),
  resolution: text("resolution"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
});

export type BehavioralProfile = typeof behavioralProfiles.$inferSelect;
export type InsertBehavioralProfile = typeof behavioralProfiles.$inferInsert;
export type BehavioralEvent = typeof behavioralEvents.$inferSelect;
