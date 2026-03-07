import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getConnection, getAllSettings, setSetting } from "../db";
import { WpApiClient } from "../wpConnector";
import { notifyOwner } from "../_core/notification";

// ─── Test Page Router ─────────────────────────────────────────────────────────
// Creates / removes a private WordPress page with all quiz shortcodes for testing.
// The page is set to "private" status so only logged-in WP admins can see it.

export const testPageRouter = router({

  // Get current test page status
  status: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .query(async ({ input }) => {
      const pageIdKey = `test_page_id_${input.connectionId}`;
      const pageUrlKey = `test_page_url_${input.connectionId}`;
      const settings = await getAllSettings();
      const pageId = settings[pageIdKey] ? parseInt(settings[pageIdKey]) : null;
      const pageUrl = settings[pageUrlKey] ?? null;
      return { pageId, pageUrl, exists: pageId !== null };
    }),

  // Create private test page in WordPress
  create: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input }) => {
      const conn = await getConnection(input.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Połączenie nie znalezione" });

      const client = new WpApiClient({
        siteUrl: conn.siteUrl,
        apiUser: conn.apiUser,
        apiPassword: conn.apiPassword,
      });

      // Fetch all quizzes to build shortcode list
      const quizzes = await client.fetchQuizzes();
      if (!quizzes.length) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Brak quizów do wyświetlenia na stronie testowej" });
      }

      // Build page content with all quiz shortcodes
      const shortcodes = quizzes.map(q => {
        const shortcode = `[ays_quiz id="${q.id}"]`;
        return `<h2 style="margin-top:40px;border-bottom:2px solid #0073aa;padding-bottom:8px;">📝 ${q.title || `Quiz #${q.id}`}</h2>\n<p><em>Shortcode: <code>${shortcode}</code></em></p>\n${shortcode}\n<hr style="margin:40px 0;">`;
      }).join("\n\n");

      const pageContent = `<!-- AYS Quiz Manager — Prywatna strona testowa -->
<!-- Wygenerowano: ${new Date().toLocaleString("pl-PL")} -->
<!-- UWAGA: Ta strona jest prywatna i widoczna tylko dla zalogowanych adminów WP -->

<div style="background:#fff3cd;border:1px solid #ffc107;padding:16px;border-radius:6px;margin-bottom:32px;">
  <strong>⚠️ Strona testowa AYS Quiz Manager</strong><br>
  Ta strona jest <strong>prywatna</strong> i służy wyłącznie do testowania quizów przed konkursem.<br>
  Nie jest widoczna dla uczestników. Wygenerowano: ${new Date().toLocaleString("pl-PL")}
</div>

${shortcodes}

<div style="background:#d4edda;border:1px solid #28a745;padding:16px;border-radius:6px;margin-top:32px;">
  <strong>✅ Koniec listy quizów</strong> — łącznie ${quizzes.length} quiz(ów) na tej stronie.
</div>`;

      // Create the page via WP REST API directly
      const createUrl = `${conn.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/pages`;
      const authHeader = 'Basic ' + Buffer.from(`${conn.apiUser}:${conn.apiPassword}`).toString('base64');
      const createResp = await fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          title: '🧪 [TESTOWA] AYS Quiz Manager — Strona testowa',
          content: pageContent,
          status: 'private',
          slug: 'ays-quiz-manager-test-page',
        }),
      });
      if (!createResp.ok) {
        const err = await createResp.text();
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `WP API error ${createResp.status}: ${err.slice(0, 200)}` });
      }
      const result = await createResp.json() as { id?: number; link?: string };

      if (!result.id) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Nie udało się utworzyć strony w WordPress" });
      }

      // Save page ID and URL to settings
      await setSetting(`test_page_id_${input.connectionId}`, String(result.id));
      await setSetting(`test_page_url_${input.connectionId}`, result.link ?? "");

      // Notify owner
      await notifyOwner({
        title: "🧪 Strona testowa WP utworzona",
        content: `Prywatna strona testowa ze ${quizzes.length} quizami została utworzona w WordPress.\nURL: ${result.link}\nID strony: ${result.id}`,
      }).catch(() => {});

      return {
        pageId: result.id,
        pageUrl: result.link ?? "",
        quizCount: quizzes.length,
        shortcodes: quizzes.map(q => ({ id: q.id, title: q.title, shortcode: `[ays_quiz id="${q.id}"]` })),
      };
    }),

  // Delete test page from WordPress
  delete: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .mutation(async ({ input }) => {
      const conn = await getConnection(input.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Połączenie nie znalezione" });

      const pageIdKey = `test_page_id_${input.connectionId}`;
      const settings = await getAllSettings();
      const pageId = settings[pageIdKey] ? parseInt(settings[pageIdKey]) : null;

      if (!pageId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Strona testowa nie istnieje lub już została usunięta" });
      }

      const client = new WpApiClient({
        siteUrl: conn.siteUrl,
        apiUser: conn.apiUser,
        apiPassword: conn.apiPassword,
      });

      // Delete via WP REST API directly
      const deleteUrl = `${conn.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/pages/${pageId}?force=true`;
      const authHeader = 'Basic ' + Buffer.from(`${conn.apiUser}:${conn.apiPassword}`).toString('base64');
      const delResp = await fetch(deleteUrl, { method: 'DELETE', headers: { Authorization: authHeader } });
      if (!delResp.ok && delResp.status !== 404) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `WP API error: ${delResp.status}` });
      }

      // Remove from settings
      await setSetting(`test_page_id_${input.connectionId}`, "");
      await setSetting(`test_page_url_${input.connectionId}`, "");

      return { success: true };
    }),

  // Get list of shortcodes for all quizzes (without creating page)
  listShortcodes: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .query(async ({ input }) => {
      const conn = await getConnection(input.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Połączenie nie znalezione" });

      const client = new WpApiClient({
        siteUrl: conn.siteUrl,
        apiUser: conn.apiUser,
        apiPassword: conn.apiPassword,
      });

      const quizzes = await client.fetchQuizzes();
      return quizzes.map(q => ({
        id: q.id,
        title: q.title ?? `Quiz #${q.id}`,
        shortcode: `[ays_quiz id="${q.id}"]`,
        previewUrl: `${conn.siteUrl}/?ays_quiz_id=${q.id}`,
      }));
    }),

  // Generate WordPress functions.php code snippet for test page
  generatePhpCode: protectedProcedure
    .input(z.object({ connectionId: z.number() }))
    .query(async ({ input }) => {
      const conn = await getConnection(input.connectionId);
      if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Połączenie nie znalezione" });

      const settings = await getAllSettings();
      const pageUrl = settings[`test_page_url_${input.connectionId}`] ?? "(utwórz stronę testową najpierw)";
      const webhookSecret = settings["webhook_secret"] ?? "(wygeneruj w Ustawieniach)";
      const appUrl = process.env.VITE_APP_URL ?? "https://YOUR_APP_URL";

      const phpCode = `<?php
// ============================================================
// AYS Quiz Manager — Integracja z WordPress
// Wklej do functions.php lub niestandardowego pluginu
// ============================================================

// 1. Webhook — powiadamia Quiz Manager o zmianach quizów
add_action('save_post', function($post_id) {
    if (wp_is_post_revision($post_id)) return;
    
    // Obsługa quizów AYS (custom post type lub opcje)
    wp_remote_post('${appUrl}/api/webhook/wp-quiz', [
        'body'    => json_encode([
            'event'    => 'quiz_updated',
            'quiz_id'  => $post_id,
            'secret'   => '${webhookSecret}',
        ]),
        'headers' => ['Content-Type' => 'application/json'],
        'timeout' => 5,
        'blocking' => false, // Asynchronicznie — nie blokuje zapisu
    ]);
});

// 2. Ukryj stronę testową w menu i wynikach wyszukiwania
add_action('pre_get_posts', function($query) {
    if (is_admin()) return;
    $test_page_id = get_option('ays_quiz_manager_test_page_id');
    if ($test_page_id && $query->is_main_query()) {
        $query->set('post__not_in', array_merge(
            (array) $query->get('post__not_in'),
            [$test_page_id]
        ));
    }
});

// 3. Strona testowa URL: ${pageUrl}
// ============================================================`;

      return { phpCode, pageUrl, appUrl };
    }),
});
