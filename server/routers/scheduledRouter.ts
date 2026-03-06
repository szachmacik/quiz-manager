import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { createScheduledSimulation, listScheduledSimulations, updateScheduledSimulation } from "../db";

export const scheduledSimulationsRouter = router({
  list: protectedProcedure.query(async () => {
    return listScheduledSimulations();
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      snapshotId: z.number(),
      connectionId: z.number(),
      agentDomain: z.string().min(1),
      agentCount: z.number().min(1).max(500).default(100),
      concurrency: z.number().min(1).max(50).default(10),
      delayMs: z.number().min(0).max(5000).default(500),
      strategy: z.enum(["random", "all_correct", "all_wrong", "mixed"]).default("random"),
      scheduledAt: z.string(), // ISO date string
    }))
    .mutation(async ({ input }) => {
      const id = await createScheduledSimulation({
        name: input.name,
        snapshotId: input.snapshotId,
        connectionId: input.connectionId,
        agentDomain: input.agentDomain,
        agentCount: input.agentCount,
        concurrency: input.concurrency,
        delayMs: input.delayMs,
        strategy: input.strategy,
        scheduledAt: new Date(input.scheduledAt),
        status: "pending",
        triggeredSimulationId: null,
      });
      return { id };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateScheduledSimulation(input.id, { status: "cancelled" });
      return { success: true };
    }),
});
