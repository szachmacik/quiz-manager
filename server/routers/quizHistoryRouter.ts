import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { quizHistoryTimeline } from "../../drizzle/schema";
import { desc, eq, and } from "drizzle-orm";

export const quizHistoryRouter = router({
  // Pobierz timeline dla quizu
  getTimeline: protectedProcedure
    .input(z.object({
      connectionId: z.number(),
      quizId: z.string(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(quizHistoryTimeline)
        .where(and(
          eq(quizHistoryTimeline.connectionId, input.connectionId),
          eq(quizHistoryTimeline.quizId, input.quizId)
        ))
        .orderBy(desc(quizHistoryTimeline.occurredAt))
        .limit(input.limit);
    }),

  // Dodaj zdarzenie do timeline (używane przez inne moduły)
  addEvent: protectedProcedure
    .input(z.object({
      connectionId: z.number(),
      quizId: z.string(),
      quizTitle: z.string().optional(),
      eventType: z.enum([
        "snapshot_created", "ai_review_started", "ai_review_completed",
        "simulation_started", "simulation_completed", "patch_proposed",
        "patch_approved", "patch_rejected", "patch_applied", "patch_rolled_back",
        "settings_audited", "video_verified", "anomaly_detected",
        "test_page_created", "sync_detected_change",
      ]),
      eventData: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.insert(quizHistoryTimeline).values({
        connectionId: input.connectionId,
        quizId: input.quizId,
        quizTitle: input.quizTitle,
        eventType: input.eventType,
        eventData: input.eventData,
        userId: ctx.user?.id,
      });
      return { success: true };
    }),

  // Podsumowanie aktywności quizu
  getSummary: protectedProcedure
    .input(z.object({
      connectionId: z.number(),
      quizId: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const events = await db.select().from(quizHistoryTimeline)
        .where(and(
          eq(quizHistoryTimeline.connectionId, input.connectionId),
          eq(quizHistoryTimeline.quizId, input.quizId)
        ))
        .orderBy(desc(quizHistoryTimeline.occurredAt));

      const counts = events.reduce((acc, e) => {
        acc[e.eventType] = (acc[e.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const lastEvent = events[0];
      const firstEvent = events[events.length - 1];

      return {
        totalEvents: events.length,
        counts,
        lastActivity: lastEvent?.occurredAt || null,
        firstActivity: firstEvent?.occurredAt || null,
        snapshots: counts["snapshot_created"] || 0,
        simulations: counts["simulation_completed"] || 0,
        patches: (counts["patch_applied"] || 0),
        aiReviews: counts["ai_review_completed"] || 0,
        anomalies: counts["anomaly_detected"] || 0,
      };
    }),
});
