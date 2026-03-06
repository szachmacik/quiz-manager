import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getAllSettings, setSetting, listSyncLog } from "../db";
import { runSync } from "../autoSync";

export const settingsRouter = router({
  getAll: protectedProcedure.query(async () => {
    return getAllSettings();
  }),

  set: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      await setSetting(input.key, input.value);
      return { success: true };
    }),

  saveMultiple: protectedProcedure
    .input(z.object({ settings: z.record(z.string(), z.string()) }))
    .mutation(async ({ input }) => {
      for (const [key, value] of Object.entries(input.settings)) {
        await setSetting(key, value);
      }
      return { success: true };
    }),

  triggerSync: protectedProcedure
    .mutation(async () => {
      const result = await runSync();
      return result;
    }),

  getSyncLog: protectedProcedure
    .input(z.object({ connectionId: z.number().optional(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return listSyncLog(input.connectionId, input.limit ?? 50);
    }),
});
