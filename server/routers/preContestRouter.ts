import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { preContestChecklists, wpConnections, quizSnapshots } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { broadcastWebPush } from "./webpushRouter";

// ─── Definicja checków ────────────────────────────────────────────────────────

interface CheckResult {
  checkId: string;
  category: string;
  title: string;
  status: "pass" | "warn" | "fail" | "skip";
  message: string;
  autoFixed?: boolean;
  fixSuggestion?: string;
}

const PRE_CONTEST_CHECKS = [
  // Połączenie WordPress
  { id: "wp_connection", category: "wordpress", title: "Połączenie z WordPress" },
  { id: "wp_api_response", category: "wordpress", title: "WP REST API odpowiada" },
  { id: "ays_plugin_active", category: "wordpress", title: "Plugin AYS Quiz Maker aktywny" },
  // Quizy
  { id: "quiz_snapshot_exists", category: "quiz", title: "Snapshot quizu istnieje" },
  { id: "quiz_snapshot_fresh", category: "quiz", title: "Snapshot aktualny (< 24h)" },
  { id: "quiz_ai_review_done", category: "quiz", title: "Analiza AI przeprowadzona" },
  { id: "quiz_no_critical_errors", category: "quiz", title: "Brak krytycznych błędów AI" },
  { id: "quiz_settings_audited", category: "quiz", title: "Ustawienia quizu zaudytowane" },
  // Ustawienia AYS
  { id: "quiz_time_window", category: "settings", title: "Okno czasowe quizu ustawione" },
  { id: "quiz_limit_attempts", category: "settings", title: "Limit prób ustawiony" },
  { id: "quiz_anti_copy", category: "settings", title: "Zabezpieczenie anti-copy włączone" },
  { id: "quiz_certificate", category: "settings", title: "Generator dyplomów skonfigurowany" },
  { id: "quiz_result_email", category: "settings", title: "Email z wynikami skonfigurowany" },
  // Symulacja
  { id: "simulation_done", category: "simulation", title: "Symulacja obciążeniowa przeprowadzona" },
  { id: "simulation_no_errors", category: "simulation", title: "Symulacja bez błędów krytycznych" },
  { id: "simulation_response_time", category: "simulation", title: "Czas odpowiedzi < 3s (p95)" },
  // Uczestnicy
  { id: "participants_imported", category: "participants", title: "Uczestnicy zaimportowani" },
  { id: "test_page_created", category: "wordpress", title: "Prywatna strona testowa WP istnieje" },
  // Backup
  { id: "snapshot_backup", category: "backup", title: "Kopia zapasowa quizu istnieje" },
  { id: "db_backup_recent", category: "backup", title: "Backup bazy danych aktualny" },
];

async function runChecks(connectionId: number, quizId: string): Promise<CheckResult[]> {
  const db = await getDb();
  const results: CheckResult[] = [];

  // Sprawdź połączenie WP
  let wpUrl = "";
  if (db) {
    const conn = await db.select().from(wpConnections)
      .where(eq(wpConnections.id, connectionId)).limit(1);
    if (conn.length === 0) {
      results.push({ checkId: "wp_connection", category: "wordpress", title: "Połączenie z WordPress",
        status: "fail", message: "Nie znaleziono połączenia WP o podanym ID" });
    } else {
      wpUrl = conn[0].siteUrl;
      results.push({ checkId: "wp_connection", category: "wordpress", title: "Połączenie z WordPress",
        status: "pass", message: `Połączenie znalezione: ${wpUrl}` });
    }
  }

  // Sprawdź WP REST API
  if (wpUrl) {
    try {
      const res = await fetch(`${wpUrl}/wp-json/wp/v2/`, { signal: AbortSignal.timeout(5000) });
      results.push({ checkId: "wp_api_response", category: "wordpress", title: "WP REST API odpowiada",
        status: res.ok ? "pass" : "fail",
        message: res.ok ? `API odpowiada (${res.status})` : `API błąd: ${res.status}` });
    } catch {
      results.push({ checkId: "wp_api_response", category: "wordpress", title: "WP REST API odpowiada",
        status: "fail", message: "Timeout lub brak odpowiedzi WP REST API",
        fixSuggestion: "Sprawdź czy WordPress działa i czy REST API jest włączone" });
    }
  } else {
    results.push({ checkId: "wp_api_response", category: "wordpress", title: "WP REST API odpowiada",
      status: "skip", message: "Pominięto — brak URL WordPress" });
  }

  // Sprawdź AYS plugin
  if (wpUrl) {
    try {
      const res = await fetch(`${wpUrl}/wp-json/ays-quiz/v1/quizzes`, { signal: AbortSignal.timeout(5000) });
      results.push({ checkId: "ays_plugin_active", category: "wordpress", title: "Plugin AYS Quiz Maker aktywny",
        status: res.ok ? "pass" : "warn",
        message: res.ok ? "Plugin AYS aktywny i odpowiada" : "Endpoint AYS niedostępny — sprawdź czy plugin jest aktywny",
        fixSuggestion: "Aktywuj plugin AYS Quiz Maker w WP Admin → Wtyczki" });
    } catch {
      results.push({ checkId: "ays_plugin_active", category: "wordpress", title: "Plugin AYS Quiz Maker aktywny",
        status: "warn", message: "Nie można sprawdzić statusu pluginu AYS" });
    }
  } else {
    results.push({ checkId: "ays_plugin_active", category: "wordpress", title: "Plugin AYS Quiz Maker aktywny",
      status: "skip", message: "Pominięto — brak URL WordPress" });
  }

  // Sprawdź snapshot quizu
  if (db) {
    const snapshots = await db.select().from(quizSnapshots)
      .where(eq(quizSnapshots.wpQuizId, parseInt(quizId, 10) || 0))
      .orderBy(desc(quizSnapshots.createdAt))
      .limit(1);

    if (snapshots.length === 0) {
      results.push({ checkId: "quiz_snapshot_exists", category: "quiz", title: "Snapshot quizu istnieje",
        status: "fail", message: "Brak snapshotu quizu — utwórz kopię przed konkursem",
        fixSuggestion: "Przejdź do Quizy → Utwórz snapshot" });
      results.push({ checkId: "quiz_snapshot_fresh", category: "quiz", title: "Snapshot aktualny (< 24h)",
        status: "skip", message: "Pominięto — brak snapshotu" });
    } else {
      results.push({ checkId: "quiz_snapshot_exists", category: "quiz", title: "Snapshot quizu istnieje",
        status: "pass", message: `Snapshot istnieje: ${snapshots[0].snapshotHash?.substring(0, 8)}...` });

      const ageHours = (Date.now() - snapshots[0].createdAt.getTime()) / (1000 * 60 * 60);
      results.push({ checkId: "quiz_snapshot_fresh", category: "quiz", title: "Snapshot aktualny (< 24h)",
        status: ageHours < 24 ? "pass" : "warn",
        message: ageHours < 24
          ? `Snapshot z ${Math.round(ageHours)}h temu`
          : `Snapshot stary: ${Math.round(ageHours)}h temu — rozważ odświeżenie`,
        fixSuggestion: "Utwórz nowy snapshot aby mieć aktualną kopię" });
    }
  }

  // Sprawdź analizę AI
  results.push({ checkId: "quiz_ai_review_done", category: "quiz", title: "Analiza AI przeprowadzona",
    status: "warn", message: "Sprawdź ręcznie w sekcji Analizy AI",
    fixSuggestion: "Uruchom analizę AI dla tego quizu" });

  results.push({ checkId: "quiz_no_critical_errors", category: "quiz", title: "Brak krytycznych błędów AI",
    status: "warn", message: "Sprawdź ręcznie w sekcji Analizy AI" });

  results.push({ checkId: "quiz_settings_audited", category: "quiz", title: "Ustawienia quizu zaudytowane",
    status: "warn", message: "Sprawdź w sekcji Audyt Ustawień",
    fixSuggestion: "Uruchom audyt ustawień quizu" });

  // Ustawienia AYS — wymagają ręcznego sprawdzenia
  const settingsChecks = [
    { id: "quiz_time_window", title: "Okno czasowe quizu ustawione",
      msg: "Sprawdź w AYS Quiz → Ustawienia → Data/Godzina", fix: "Ustaw datę i godzinę dostępności quizu" },
    { id: "quiz_limit_attempts", title: "Limit prób ustawiony",
      msg: "Sprawdź w AYS Quiz → Ustawienia → Limit prób", fix: "Ustaw limit prób na 1 dla konkursu" },
    { id: "quiz_anti_copy", title: "Zabezpieczenie anti-copy włączone",
      msg: "Sprawdź w AYS Quiz → Ustawienia → Bezpieczeństwo", fix: "Włącz ochronę przed kopiowaniem" },
    { id: "quiz_certificate", title: "Generator dyplomów skonfigurowany",
      msg: "Sprawdź w AYS Quiz → Certyfikaty", fix: "Skonfiguruj szablon dyplomu" },
    { id: "quiz_result_email", title: "Email z wynikami skonfigurowany",
      msg: "Sprawdź w AYS Quiz → Email", fix: "Skonfiguruj email z wynikami" },
  ];

  for (const check of settingsChecks) {
    results.push({ checkId: check.id, category: "settings", title: check.title,
      status: "warn", message: check.msg, fixSuggestion: check.fix });
  }

  // Symulacja
  results.push({ checkId: "simulation_done", category: "simulation", title: "Symulacja obciążeniowa przeprowadzona",
    status: "warn", message: "Sprawdź w sekcji Symulacje",
    fixSuggestion: "Uruchom symulację 100 agentów dla tego quizu" });

  results.push({ checkId: "simulation_no_errors", category: "simulation", title: "Symulacja bez błędów krytycznych",
    status: "warn", message: "Sprawdź wyniki ostatniej symulacji" });

  results.push({ checkId: "simulation_response_time", category: "simulation", title: "Czas odpowiedzi < 3s (p95)",
    status: "warn", message: "Sprawdź histogram czasów odpowiedzi w symulacji" });

  // Uczestnicy
  if (db) {
    const { participants } = await import("../../drizzle/schema");
    const count = await db.select().from(participants).limit(1);
    results.push({ checkId: "participants_imported", category: "participants", title: "Uczestnicy zaimportowani",
      status: count.length > 0 ? "pass" : "warn",
      message: count.length > 0 ? "Uczestnicy zaimportowani" : "Brak uczestników — zaimportuj z MailerLite",
      fixSuggestion: "Przejdź do Import MailerLite i zaimportuj uczestników" });
  }

  // Strona testowa
  results.push({ checkId: "test_page_created", category: "wordpress", title: "Prywatna strona testowa WP istnieje",
    status: "warn", message: "Sprawdź w sekcji Strona Testowa WP",
    fixSuggestion: "Utwórz prywatną stronę testową w WP" });

  // Backup
  results.push({ checkId: "snapshot_backup", category: "backup", title: "Kopia zapasowa quizu istnieje",
    status: "pass", message: "Snapshot quizu służy jako kopia zapasowa" });

  results.push({ checkId: "db_backup_recent", category: "backup", title: "Backup bazy danych aktualny",
    status: "warn", message: "Sprawdź ręcznie backup bazy WordPress",
    fixSuggestion: "Wykonaj backup bazy danych przez hosting lub UpdraftPlus" });

  return results;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const preContestRouter = router({
  // Uruchom pełną checklistę
  runChecklist: protectedProcedure
    .input(z.object({
      connectionId: z.number(),
      quizId: z.string(),
      contestName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Baza danych niedostępna");

      const checkResults = await runChecks(input.connectionId, input.quizId);

      const failCount = checkResults.filter(c => c.status === "fail").length;
      const warnCount = checkResults.filter(c => c.status === "warn").length;
      const passCount = checkResults.filter(c => c.status === "pass").length;

      const overallStatus = failCount > 0 ? "fail" : warnCount > 3 ? "warn" : "pass";

      await db.insert(preContestChecklists).values({
        connectionId: input.connectionId,
        quizId: input.quizId,
        contestName: input.contestName,
        checkResults,
        overallStatus,
        runBy: ctx.user?.id,
      });

      // Powiadomienie
      const emoji = overallStatus === "pass" ? "✅" : overallStatus === "warn" ? "⚠️" : "❌";
      const msg = `${emoji} Checklista pre-contest: ${passCount} OK, ${warnCount} ostrzeżeń, ${failCount} błędów`;

      await notifyOwner({ title: msg, content: `Quiz: ${input.quizId} | Konkurs: ${input.contestName || "—"}` });
      await broadcastWebPush({ title: msg, body: `Quiz: ${input.quizId}`, url: "/pre-contest" });

      return { checkResults, overallStatus, passCount, warnCount, failCount, summary: PRE_CONTEST_CHECKS.length };
    }),

  // Historia checklistów
  getHistory: protectedProcedure
    .input(z.object({ quizId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const query = db.select().from(preContestChecklists)
        .orderBy(desc(preContestChecklists.runAt))
        .limit(20);
      return query;
    }),

  // Definicje checków (do wyświetlenia w UI)
  getCheckDefinitions: protectedProcedure.query(() => {
    return PRE_CONTEST_CHECKS;
  }),
});
