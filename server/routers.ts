import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  listConnections, getConnection, createConnection, updateConnectionStatus,
  listSnapshots, getSnapshot, createSnapshot, saveSnapshotQuestions, saveSnapshotAnswers, getSnapshotWithQA,
  createAiReview, getAiReview, listAiReviews,
  createSimulation, getSimulation, listSimulations, listSimulationAgents,
  getPatchProposal, listPatchProposals, updatePatchProposal, createPatchProposal,
  listReports, getReport, createReport,
} from "./db";
import { WpApiClient, parseQuestionIds, buildSnapshotHash } from "./wpConnector";
import { runAiReview } from "./aiReviewer";
import { runSimulation, getSimulationState, cancelSimulation } from "./simulationEngine";
import { notifyOwner } from "./_core/notification";
import { settingsRouter } from "./routers/settingsRouter";
import { scheduledSimulationsRouter } from "./routers/scheduledRouter";
import { testPageRouter } from "./routers/testPageRouter";
import { diffRouter } from "./routers/diffRouter";
import { exportRouter } from "./routers/exportRouter";
import { settingsAuditRouter } from "./routers/settingsAuditRouter";
import { videoVerificationRouter } from "./routers/videoVerificationRouter";
import { riskRouter } from "./routers/riskRouter";
import { behavioralProfileRouter } from "./routers/behavioralProfileRouter";
import { resultsRouter } from "./routers/resultsRouter";
import { offlineRouter } from "./routers/offlineRouter";
import { anomalyRouter } from "./routers/anomalyRouter";
import { mailerLiteRouter } from "./routers/mailerLiteRouter";
import { webpushRouter } from "./routers/webpushRouter";
import { preContestRouter } from "./routers/preContestRouter";
import { quizHistoryRouter } from "./routers/quizHistoryRouter";
import { diplomaRouter } from "./routers/diplomaRouter";
import { verifySupabaseToken, isEmailAllowed, isEmailAdmin } from "./_core/supabaseAuth";
import { SignJWT } from "jose";
// ─── WordPress Connectionss ────────────────────────────────────────────────────
const connectionsRouter = router({
  list: protectedProcedure.query(() => listConnections()),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getConnection(input.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      siteUrl: z.string().url(),
      apiUser: z.string().min(1),
      apiPassword: z.string().min(1),
      mysqlHost: z.string().optional(),
      mysqlPort: z.number().optional(),
      mysqlDb: z.string().optional(),
      mysqlUser: z.string().optional(),
      mysqlPassword: z.string().optional(),
      tablePrefix: z.string().default("wp_"),
    }))
    .mutation(async ({ input }) => {
      const id = await createConnection({
        ...input,
        mysqlHost: input.mysqlHost ?? null,
        mysqlPort: input.mysqlPort ?? null,
        mysqlDb: input.mysqlDb ?? null,
        mysqlUser: input.mysqlUser ?? null,
        mysqlPassword: input.mysqlPassword ?? null,
        status: "untested",
        lastTestedAt: null,
      } as any);
      return { id };
    }),

  test: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const conn = await getConnection(input.id);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });
      const client = new WpApiClient({ siteUrl: conn.siteUrl, apiUser: conn.apiUser, apiPassword: conn.apiPassword });
      try {
        const info = await client.testConnection();
        await updateConnectionStatus(input.id, "active");
        return { success: true, info };
      } catch (err: any) {
        await updateConnectionStatus(input.id, "error");
        return { success: false, error: err.message };
      }
    }),
});

// ─── Quizzes & Snapshots ──────────────────────────────────────────────────────
const quizzesRouter = router({
  listFromWp: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .query(async ({ input }) => {
      const conn = await getConnection(input.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });
      const client = new WpApiClient({ siteUrl: conn.siteUrl, apiUser: conn.apiUser, apiPassword: conn.apiPassword });
      try {
        const quizzes = await client.fetchQuizzes();
        return { quizzes, error: null };
      } catch (err: any) {
        return { quizzes: [], error: err.message };
      }
    }),

  listSnapshots: protectedProcedure
    .input(z.object({ connectionId: z.number().optional() }))
    .query(({ input }) => listSnapshots(input.connectionId)),

  getSnapshot: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getSnapshotWithQA(input.id)),

  createSnapshot: protectedProcedure
    .input(z.object({
      connectionId: z.number(),
      wpQuizId: z.number(),
      snapshotType: z.enum(["auto", "manual", "pre_test", "pre_patch"]).default("manual"),
    }))
    .mutation(async ({ input }) => {
      const conn = await getConnection(input.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      const client = new WpApiClient({ siteUrl: conn.siteUrl, apiUser: conn.apiUser, apiPassword: conn.apiPassword });

      // Fetch quiz
      const quiz = await client.fetchQuiz(input.wpQuizId);
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found in WordPress" });

      const questionIds = parseQuestionIds(quiz.question_ids);

      // Fetch questions
      const wpQuestions = await client.fetchQuestions(questionIds);

      // Fetch answers for each question
      const allAnswers: Array<{ question_id: number; id: number; answer: string; correct: string }> = [];
      for (const q of wpQuestions) {
        const answers = await client.fetchAnswers(q.id);
        allAnswers.push(...answers.map(a => ({ ...a, question_id: q.id })));
      }

      const hash = buildSnapshotHash(quiz, wpQuestions, allAnswers as any);

      // Create snapshot
      const snapshotId = await createSnapshot({
        connectionId: input.connectionId,
        wpQuizId: input.wpQuizId,
        title: quiz.title,
        slug: null,
        shortcode: `[ays_quiz id="${input.wpQuizId}"]`,
        settings: quiz.settings ?? null,
        questionIds: quiz.question_ids,
        questionCount: questionIds.length,
        snapshotType: input.snapshotType,
        snapshotHash: hash,
        rawData: quiz as any,
      });

      // Save questions
      const questionRecords = wpQuestions.map((q, idx) => ({
        snapshotId,
        wpQuestionId: q.id,
        question: q.question,
        type: q.type,
        position: idx,
        rawData: q as any,
      }));
      await saveSnapshotQuestions(snapshotId, questionRecords);

      // Save answers — we need question DB IDs
      const savedData = await getSnapshotWithQA(snapshotId);
      if (savedData) {
        const answerRecords = allAnswers.map((a, idx) => {
          const dbQuestion = savedData.questions.find(q => q.wpQuestionId === a.question_id);
          return {
            questionId: dbQuestion?.id ?? 0,
            snapshotId,
            wpAnswerId: a.id,
            answer: a.answer,
            isCorrect: a.correct === "1",
            position: idx,
          };
        });
        await saveSnapshotAnswers(snapshotId, answerRecords);
      }

      return { snapshotId };
    }),

  createTestPage: protectedProcedure
    .input(z.object({
      connectionId: z.number(),
      snapshotIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const conn = await getConnection(input.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      const snapshots = await Promise.all(input.snapshotIds.map(id => getSnapshot(id)));
      const shortcodes = snapshots.filter(Boolean).map(s => s!.shortcode || `[ays_quiz id="${s!.wpQuizId}"]`);

      const client = new WpApiClient({ siteUrl: conn.siteUrl, apiUser: conn.apiUser, apiPassword: conn.apiPassword });
      const page = await client.createTestPage(`AYS Quiz Test Page — ${new Date().toLocaleDateString("pl-PL")}`, shortcodes);

      return page;
    }),
});

// ─── AI Reviews ───────────────────────────────────────────────────────────────
const reviewsRouter = router({
  list: protectedProcedure
    .input(z.object({ snapshotId: z.number().optional() }))
    .query(({ input }) => listAiReviews(input.snapshotId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getAiReview(input.id)),

  start: protectedProcedure
    .input(z.object({ snapshotId: z.number() }))
    .mutation(async ({ input }) => {
      const snapshot = await getSnapshot(input.snapshotId);
      if (!snapshot) throw new TRPCError({ code: "NOT_FOUND" });

      const reviewId = await createAiReview(input.snapshotId);

      // Run async (non-blocking)
      runAiReview(reviewId, input.snapshotId).then(async () => {
        const review = await getAiReview(reviewId);
        if (review) {
          await notifyOwner({
            title: `AI Review zakończony — "${snapshot.title}"`,
            content: `Wynik: ${review.overallScore?.toFixed(0)}/100 | Błędy: ${review.errorsFound} | Ostrzeżenia: ${review.warningsFound}\n${review.summary || ""}`,
          });
        }
      }).catch(console.error);

      return { reviewId };
    }),
});

// ─── Simulations ──────────────────────────────────────────────────────────────
const simulationsRouter = router({
  list: protectedProcedure
    .input(z.object({ snapshotId: z.number().optional() }))
    .query(({ input }) => listSimulations(input.snapshotId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getSimulation(input.id)),

  getAgents: protectedProcedure
    .input(z.object({ simulationId: z.number() }))
    .query(({ input }) => listSimulationAgents(input.simulationId)),

  getLiveState: protectedProcedure
    .input(z.object({ simulationId: z.number() }))
    .query(({ input }) => {
      const state = getSimulationState(input.simulationId);
      return state ? {
        status: state.status,
        progress: state.progress,
        logs: state.logs.slice(-50), // last 50 log lines
        responseTimes: state.responseTimes.slice(-100), // last 100 response times
      } : null;
    }),

  start: protectedProcedure
    .input(z.object({
      snapshotId: z.number(),
      connectionId: z.number(),
      name: z.string().optional(),
      agentCount: z.number().min(1).max(500).default(100),
      agentDomain: z.string().min(1),
      strategy: z.enum(["random", "all_correct", "all_wrong", "mixed"]).default("random"),
      concurrency: z.number().min(1).max(50).default(10),
      delayMs: z.number().min(0).max(5000).default(500),
    }))
    .mutation(async ({ input }) => {
      const snapshot = await getSnapshot(input.snapshotId);
      if (!snapshot) throw new TRPCError({ code: "NOT_FOUND" });

      const simulationId = await createSimulation({
        snapshotId: input.snapshotId,
        connectionId: input.connectionId,
        name: input.name ?? `Symulacja ${new Date().toLocaleString("pl-PL")}`,
        agentCount: input.agentCount,
        agentDomain: input.agentDomain,
        strategy: input.strategy,
        concurrency: input.concurrency,
        delayMs: input.delayMs,
        status: "pending",
        totalAgents: input.agentCount,
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

      // Run async
      runSimulation({
        simulationId,
        snapshotId: input.snapshotId,
        connectionId: input.connectionId,
        agentCount: input.agentCount,
        agentDomain: input.agentDomain,
        strategy: input.strategy,
        concurrency: input.concurrency,
        delayMs: input.delayMs,
      }).then(async () => {
        const sim = await getSimulation(simulationId);
        if (sim) {
          await notifyOwner({
            title: `Symulacja zakończona — "${snapshot.title}"`,
            content: `Agenci: ${sim.completedAgents}/${sim.agentCount} | Błędy: ${sim.failedAgents} | Avg: ${sim.avgResponseMs?.toFixed(0)}ms | P95: ${sim.p95ResponseMs?.toFixed(0)}ms | Error rate: ${sim.errorRate?.toFixed(1)}%`,
          });
        }
      }).catch(console.error);

      return { simulationId };
    }),

  cancel: protectedProcedure
    .input(z.object({ simulationId: z.number() }))
    .mutation(({ input }) => {
      cancelSimulation(input.simulationId);
      return { success: true };
    }),
});

// ─── Patch Proposals ──────────────────────────────────────────────────────────
const patchesRouter = router({
  list: protectedProcedure
    .input(z.object({ snapshotId: z.number().optional() }))
    .query(({ input }) => listPatchProposals(input.snapshotId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getPatchProposal(input.id)),

  create: protectedProcedure
    .input(z.object({
      snapshotId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      patchType: z.enum(["question_text", "answer_text", "correct_answer", "settings", "other"]),
      targetWpId: z.number().optional(),
      targetType: z.enum(["question", "answer", "quiz"]).optional(),
      fieldName: z.string().optional(),
      originalValue: z.string().optional(),
      proposedValue: z.string().min(1),
      reasoning: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createPatchProposal({
        ...input,
        aiReviewId: null,
        targetWpId: input.targetWpId ?? null,
        targetType: input.targetType ?? null,
        fieldName: input.fieldName ?? null,
        originalValue: input.originalValue ?? null,
        description: input.description ?? null,
        reasoning: input.reasoning ?? null,
        status: "pending",
        preApplySnapshotId: null,
        postSimulationId: null,
        approvedBy: null,
        approvedAt: null,
        appliedAt: null,
        rolledBackAt: null,
      });
      return { id };
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const patch = await getPatchProposal(input.id);
      if (!patch) throw new TRPCError({ code: "NOT_FOUND" });
      if (patch.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Patch is not in pending state" });

      await updatePatchProposal(input.id, {
        status: "approved",
        approvedBy: ctx.user?.openId ?? "unknown",
        approvedAt: new Date(),
      });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updatePatchProposal(input.id, { status: "rejected" });
      return { success: true };
    }),

  executePatch: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const patch = await getPatchProposal(input.id);
      if (!patch) throw new TRPCError({ code: "NOT_FOUND" });
      if (patch.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Patch must be approved first" });

      const snapshot = await getSnapshot(patch.snapshotId);
      if (!snapshot) throw new TRPCError({ code: "NOT_FOUND" });

      const conn = await getConnection(snapshot.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      if (!patch.targetWpId || !patch.targetType || !patch.fieldName || !patch.proposedValue) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Patch is missing required fields for application" });
      }

      const client = new WpApiClient({ siteUrl: conn.siteUrl, apiUser: conn.apiUser, apiPassword: conn.apiPassword });

      const success = await client.applyPatch({
        targetType: patch.targetType,
        targetWpId: patch.targetWpId,
        fieldName: patch.fieldName,
        proposedValue: patch.proposedValue,
      });

      if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to apply patch to WordPress" });

      await updatePatchProposal(input.id, { status: "applied", appliedAt: new Date() });
      return { success: true };
    }),

  rollback: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const patch = await getPatchProposal(input.id);
      if (!patch) throw new TRPCError({ code: "NOT_FOUND" });
      if (patch.status !== "applied") throw new TRPCError({ code: "BAD_REQUEST", message: "Only applied patches can be rolled back" });

      const snapshot = await getSnapshot(patch.snapshotId);
      if (!snapshot) throw new TRPCError({ code: "NOT_FOUND" });

      const conn = await getConnection(snapshot.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      if (!patch.targetWpId || !patch.targetType || !patch.fieldName || !patch.originalValue) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot rollback — original value missing" });
      }

      const client = new WpApiClient({ siteUrl: conn.siteUrl, apiUser: conn.apiUser, apiPassword: conn.apiPassword });

      const success = await client.applyPatch({
        targetType: patch.targetType,
        targetWpId: patch.targetWpId,
        fieldName: patch.fieldName,
        proposedValue: patch.originalValue,
      });

      if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to rollback patch in WordPress" });

      await updatePatchProposal(input.id, { status: "rolled_back", rolledBackAt: new Date() });
      return { success: true };
    }),
});

// ─── Reports ──────────────────────────────────────────────────────────────────
const reportsRouter = router({
  list: protectedProcedure.query(() => listReports()),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getReport(input.id)),

  generate: protectedProcedure
    .input(z.object({
      snapshotId: z.number().optional(),
      simulationId: z.number().optional(),
      aiReviewId: z.number().optional(),
      type: z.enum(["simulation", "ai_review", "combined", "patch_summary"]),
    }))
    .mutation(async ({ input }) => {
      const content: Record<string, unknown> = {};
      let title = "";

      if (input.simulationId) {
        const sim = await getSimulation(input.simulationId);
        const agents = await listSimulationAgents(input.simulationId);
        content.simulation = sim;
        content.agents = agents;
        title = `Raport symulacji #${input.simulationId}`;
      }

      if (input.aiReviewId) {
        const review = await getAiReview(input.aiReviewId);
        content.review = review;
        title = title || `Raport AI Review #${input.aiReviewId}`;
      }

      if (input.snapshotId) {
        const snapshot = await getSnapshotWithQA(input.snapshotId);
        content.snapshot = snapshot;
        title = title || `Raport quizu "${snapshot?.snapshot.title}"`;
      }

      if (input.type === "combined") {
        title = `Raport kompleksowy — ${new Date().toLocaleDateString("pl-PL")}`;
      }

      const id = await createReport({
        snapshotId: input.snapshotId ?? null,
        simulationId: input.simulationId ?? null,
        aiReviewId: input.aiReviewId ?? null,
        title,
        type: input.type,
        content,
        summary: `Wygenerowano ${new Date().toLocaleString("pl-PL")}`,
      });

      return { id };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  
  exchangeSupabaseToken: publicProcedure
    .input(z.object({ accessToken: z.string(), refreshToken: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const payload = await verifySupabaseToken(input.accessToken);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "Nieprawidłowy token Supabase" });
      const email = payload.email ?? "";
      if (!isEmailAllowed(email)) throw new TRPCError({ code: "FORBIDDEN", message: "Brak dostępu — email nie jest na liście dozwolonych" });
      const isAdmin = isEmailAdmin(email);
      const openId = `supabase:${payload.sub}`;
      await db.upsertUser({
        openId,
        name: payload.user_metadata?.full_name ?? payload.user_metadata?.name ?? email.split("@")[0] ?? null,
        email,
        loginMethod: "supabase_otp",
        lastSignedIn: new Date(),
        ...(isAdmin ? { role: "admin" } : {}),
      });
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "ofshore-secret-2026");
      const sessionToken = await new SignJWT({ openId, email, role: isAdmin ? "admin" : "user" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("365d")
        .sign(secret);
      ctx.res.cookie(COOKIE_NAME, sessionToken, getSessionCookieOptions());
      return { success: true, role: isAdmin ? "admin" : "user" };
    }),
}),
  connections: connectionsRouter,
  quizzes: quizzesRouter,
  reviews: reviewsRouter,
  simulations: simulationsRouter,
  patches: patchesRouter,
  reports: reportsRouter,
  settings: settingsRouter,
  scheduled: scheduledSimulationsRouter,
  diff: diffRouter,
  export: exportRouter,
   testPage: testPageRouter,
  settingsAudit: settingsAuditRouter,
  videoVerification: videoVerificationRouter,
  results: resultsRouter,
  offline: offlineRouter,
  anomaly: anomalyRouter,
  risks: riskRouter,
  behavioral: behavioralProfileRouter,
  mailerLite: mailerLiteRouter,
  webpush: webpushRouter,
  preContest: preContestRouter,
  quizHistory: quizHistoryRouter,
  diploma: diplomaRouter,
});
export type AppRouter = typeof appRouter;
