import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { createSnapshotDiff, getSnapshotDiff } from "../db";
import { computeSnapshotDiff } from "../autoSync";

export const diffRouter = router({
  compare: protectedProcedure
    .input(z.object({
      snapshotAId: z.number(),
      snapshotBId: z.number(),
    }))
    .query(async ({ input }) => {
      // Check cache first
      const cached = await getSnapshotDiff(input.snapshotAId, input.snapshotBId);
      if (cached) return cached;

      // Compute and cache
      const diff = await computeSnapshotDiff(input.snapshotAId, input.snapshotBId);
      const id = await createSnapshotDiff(diff);
      return { id, ...diff };
    }),
});
