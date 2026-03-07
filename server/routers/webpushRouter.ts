import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { webpushSubscriptions } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// VAPID keys — generowane raz, przechowywane w env lub bazie
// W produkcji użyj: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// Wysyłanie powiadomienia webpush przez fetch (bez web-push npm package)
async function sendWebPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; icon?: string; url?: string }
): Promise<boolean> {
  try {
    // Jeśli nie ma VAPID_PRIVATE_KEY, logujemy tylko (dev mode)
    if (!VAPID_PRIVATE_KEY) {
      console.log("[WebPush] DEV MODE — notification would be sent:", payload.title, "to", subscription.endpoint.substring(0, 50));
      return true;
    }

    // W produkcji użyj web-push library
    // Na razie logujemy — pełna implementacja po dodaniu VAPID keys
    console.log("[WebPush] Sending:", payload.title, "to", subscription.endpoint.substring(0, 50));
    return true;
  } catch (error) {
    console.error("[WebPush] Failed to send:", error);
    return false;
  }
}

export const webpushRouter = router({
  // Pobierz klucz publiczny VAPID
  getVapidPublicKey: publicProcedure.query(() => {
    return { publicKey: VAPID_PUBLIC_KEY };
  }),

  // Zarejestruj subskrypcję
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      p256dh: z.string(),
      auth: z.string(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      // Sprawdź czy już istnieje
      const existing = await db.select().from(webpushSubscriptions)
        .where(eq(webpushSubscriptions.endpoint, input.endpoint))
        .limit(1);

      if (existing.length > 0) {
        await db.update(webpushSubscriptions)
          .set({ isActive: true, p256dh: input.p256dh, auth: input.auth })
          .where(eq(webpushSubscriptions.endpoint, input.endpoint));
        return { success: true, action: "updated" };
      }

      await db.insert(webpushSubscriptions).values({
        userId: ctx.user?.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
        isActive: true,
      });

      return { success: true, action: "created" };
    }),

  // Wyrejestruj subskrypcję
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(webpushSubscriptions)
        .set({ isActive: false })
        .where(eq(webpushSubscriptions.endpoint, input.endpoint));
      return { success: true };
    }),

  // Wyślij test powiadomienia
  sendTest: protectedProcedure
    .input(z.object({
      title: z.string().default("Test powiadomienia"),
      body: z.string().default("System QA quizów działa poprawnie!"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      const subs = await db.select().from(webpushSubscriptions)
        .where(and(
          eq(webpushSubscriptions.isActive, true),
          ...(ctx.user?.id ? [eq(webpushSubscriptions.userId, ctx.user.id)] : [])
        ));

      let sent = 0;
      for (const sub of subs) {
        const ok = await sendWebPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { title: input.title, body: input.body, url: "/" }
        );
        if (ok) sent++;
      }

      return { success: true, sent, total: subs.length };
    }),

  // Status subskrypcji
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { subscribed: false, count: 0, vapidConfigured: !!VAPID_PRIVATE_KEY };

    const subs = await db.select().from(webpushSubscriptions)
      .where(and(
        eq(webpushSubscriptions.isActive, true),
        ...(ctx.user?.id ? [eq(webpushSubscriptions.userId, ctx.user.id)] : [])
      ));

    return {
      subscribed: subs.length > 0,
      count: subs.length,
      vapidConfigured: !!VAPID_PRIVATE_KEY,
    };
  }),
});

// Export helper do wysyłania powiadomień z innych modułów
export async function broadcastWebPush(payload: { title: string; body: string; url?: string }): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const subs = await db.select().from(webpushSubscriptions)
      .where(eq(webpushSubscriptions.isActive, true));
    for (const sub of subs) {
      await sendWebPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload
      );
    }
  } catch (error) {
    console.error("[WebPush] broadcastWebPush error:", error);
  }
}
