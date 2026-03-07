/**
 * WordPress Webhook Handler
 * 
 * Rejestruje endpoint POST /api/webhook/wp-quiz
 * WordPress wysyła powiadomienie gdy quiz zostanie zmieniony.
 * 
 * Instalacja w WordPress (functions.php lub plugin):
 * 
 * add_action('save_post', function($post_id) {
 *   if (get_post_type($post_id) !== 'ays_quiz') return;
 *   wp_remote_post('https://YOUR_APP_URL/api/webhook/wp-quiz', [
 *     'body' => json_encode([
 *       'event' => 'quiz_updated',
 *       'quiz_id' => $post_id,
 *       'secret' => 'YOUR_WEBHOOK_SECRET'
 *     ]),
 *     'headers' => ['Content-Type' => 'application/json'],
 *   ]);
 * });
 */

import type { Express, Request, Response } from "express";
import { runSync } from "./autoSync";
import { notifyOwner } from "./_core/notification";
import { getAllSettings } from "./db";

export function registerWebhookRoutes(app: Express) {
  // POST /api/webhook/wp-quiz
  app.post("/api/webhook/wp-quiz", async (req: Request, res: Response) => {
    try {
      const body = req.body as { event?: string; quiz_id?: number; secret?: string; site_url?: string };

      // Validate secret
      const settings = await getAllSettings();
      const expectedSecret = settings["webhook_secret"] ?? "";

      if (expectedSecret && body.secret !== expectedSecret) {
        console.warn("[Webhook] Invalid secret received");
        return res.status(401).json({ error: "Invalid webhook secret" });
      }

      console.log(`[Webhook] Received event: ${body.event} for quiz_id: ${body.quiz_id}`);

      // Trigger immediate sync
      const result = await runSync();

      // Notify owner if changes detected
      if (result.changed > 0) {
        await notifyOwner({
          title: "🔄 Quiz zmieniony w WordPress",
          content: `Webhook wykrył zmiany w quizie #${body.quiz_id}. Auto-sync zaktualizował ${result.changed} snapshot(ów). Sprawdź panel Quizy i Snapshoty.`,
        }).catch(() => {});
      }

      return res.json({
        success: true,
        event: body.event,
        quizId: body.quiz_id,
        syncResult: result,
      });
    } catch (err: any) {
      console.error("[Webhook] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/webhook/info — returns webhook URL and setup instructions
  app.get("/api/webhook/info", async (_req: Request, res: Response) => {
    const settings = await getAllSettings().catch(() => ({} as Record<string, string>));
    const secret = settings["webhook_secret"] ?? "(nie ustawiono — wygeneruj w Ustawieniach)";

    const baseUrl = process.env.VITE_APP_URL ?? "https://YOUR_APP_URL";

    return res.json({
      webhookUrl: `${baseUrl}/api/webhook/wp-quiz`,
      secret,
      wpCode: `// Dodaj do functions.php lub niestandardowego pluginu WordPress:
add_action('ays_after_quiz_save', function($quiz_id) {
  wp_remote_post('${baseUrl}/api/webhook/wp-quiz', [
    'body'    => json_encode([
      'event'    => 'quiz_updated',
      'quiz_id'  => $quiz_id,
      'secret'   => '${secret}',
    ]),
    'headers' => ['Content-Type' => 'application/json'],
    'timeout' => 5,
  ]);
});

// Alternatywnie dla standardowego save_post:
add_action('save_post', function($post_id) {
  if (get_post_type($post_id) !== 'ays_quiz') return;
  if (wp_is_post_revision($post_id)) return;
  wp_remote_post('${baseUrl}/api/webhook/wp-quiz', [
    'body'    => json_encode([
      'event'    => 'quiz_updated',
      'quiz_id'  => $post_id,
      'secret'   => '${secret}',
    ]),
    'headers' => ['Content-Type' => 'application/json'],
    'timeout' => 5,
  ]);
});`,
    });
  });
}
