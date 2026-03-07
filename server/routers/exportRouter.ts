import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getReport, getSnapshotWithQA, listSimulationAgents, getSimulation, getAiReview, listSnapshots, listSimulations, listAiReviews } from "../db";

// ─── Export Router ────────────────────────────────────────────────────────────
// Handles PDF export, JSON/CSV export, and trend statistics

export const exportRouter = router({

  // Generate HTML for PDF (client renders it via print dialog or we return HTML)
  reportHtml: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const report = await getReport(input.id);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });

      const content = report.content as Record<string, any>;
      const sim = content.simulation as any;
      const agents = content.agents as any[] ?? [];
      const review = content.review as any;
      const snapshot = content.snapshot as any;

      const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<title>${report.title}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
  h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
  h2 { color: #374151; margin-top: 32px; }
  h3 { color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f3f4f6; padding: 8px 12px; text-align: left; border: 1px solid #e5e7eb; }
  td { padding: 8px 12px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f9fafb; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0; }
  .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 700; color: #2563eb; }
  .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .section { background: #f9fafb; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 4px; }
  .error-item { background: #fff; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px; margin: 8px 0; }
  .warning-item { background: #fff; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; margin: 8px 0; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>📊 ${report.title}</h1>
<p><strong>Typ raportu:</strong> ${report.type} &nbsp;|&nbsp; <strong>Wygenerowano:</strong> ${new Date(report.createdAt).toLocaleString("pl-PL")}</p>

${sim ? `
<h2>🤖 Wyniki symulacji</h2>
<div class="stat-grid">
  <div class="stat-card"><div class="stat-value">${sim.agentCount ?? 0}</div><div class="stat-label">Agentów</div></div>
  <div class="stat-card"><div class="stat-value">${sim.completedAgents ?? 0}</div><div class="stat-label">Ukończonych</div></div>
  <div class="stat-card"><div class="stat-value">${sim.avgResponseTime ? Math.round(sim.avgResponseTime) + 'ms' : 'N/A'}</div><div class="stat-label">Śr. czas odpowiedzi</div></div>
  <div class="stat-card"><div class="stat-value">${sim.errorCount ?? 0}</div><div class="stat-label">Błędów</div></div>
</div>
<div class="section">
  <strong>Strategia:</strong> ${sim.strategy ?? 'random'} &nbsp;|&nbsp;
  <strong>Concurrency:</strong> ${sim.concurrency ?? 10} &nbsp;|&nbsp;
  <strong>Status:</strong> <span class="badge ${sim.status === 'completed' ? 'badge-green' : sim.status === 'failed' ? 'badge-red' : 'badge-blue'}">${sim.status}</span>
</div>
${agents.length > 0 ? `
<h3>Szczegóły agentów (pierwsze 20)</h3>
<table>
  <tr><th>#</th><th>Email</th><th>Status</th><th>Wynik</th><th>Czas (ms)</th><th>Błąd</th></tr>
  ${agents.slice(0, 20).map((a: any, i: number) => `
  <tr>
    <td>${i + 1}</td>
    <td>${a.email}</td>
    <td><span class="badge ${a.status === 'completed' ? 'badge-green' : a.status === 'failed' ? 'badge-red' : 'badge-yellow'}">${a.status}</span></td>
    <td>${a.score ?? 'N/A'}</td>
    <td>${a.responseTime ?? 'N/A'}</td>
    <td>${a.errorMessage ?? '-'}</td>
  </tr>`).join('')}
</table>` : ''}
` : ''}

${review ? `
<h2>🧠 Analiza AI</h2>
<div class="stat-grid">
  <div class="stat-card"><div class="stat-value">${review.totalIssues ?? 0}</div><div class="stat-label">Wykrytych problemów</div></div>
  <div class="stat-card"><div class="stat-value">${review.criticalCount ?? 0}</div><div class="stat-label">Krytycznych</div></div>
  <div class="stat-card"><div class="stat-value">${review.warningCount ?? 0}</div><div class="stat-label">Ostrzeżeń</div></div>
  <div class="stat-card"><div class="stat-value">${review.infoCount ?? 0}</div><div class="stat-label">Informacyjnych</div></div>
</div>
${review.summary ? `<div class="section"><strong>Podsumowanie AI:</strong> ${review.summary}</div>` : ''}
${review.issues && Array.isArray(review.issues) ? review.issues.slice(0, 30).map((issue: any) => `
<div class="${issue.severity === 'critical' ? 'error-item' : 'warning-item'}">
  <strong>[${issue.severity?.toUpperCase()}]</strong> ${issue.questionText ?? ''}<br>
  <em>${issue.issue}</em><br>
  ${issue.suggestion ? `<span style="color:#059669">💡 ${issue.suggestion}</span>` : ''}
</div>`).join('') : ''}
` : ''}

${snapshot ? `
<h2>📋 Snapshot quizu</h2>
<div class="section">
  <strong>Tytuł:</strong> ${snapshot.snapshot?.title} &nbsp;|&nbsp;
  <strong>Shortcode:</strong> <code>${snapshot.snapshot?.shortcode}</code> &nbsp;|&nbsp;
  <strong>Pytań:</strong> ${snapshot.questions?.length ?? 0}
</div>
<h3>Lista pytań</h3>
<table>
  <tr><th>#</th><th>Pytanie</th><th>Typ</th><th>Odpowiedzi</th><th>Poprawnych</th></tr>
  ${(snapshot.questions ?? []).map((q: any, i: number) => `
  <tr>
    <td>${i + 1}</td>
    <td>${q.question}</td>
    <td>${q.type}</td>
    <td>${q.answers?.length ?? 0}</td>
    <td>${q.answers?.filter((a: any) => a.isCorrect).length ?? 0}</td>
  </tr>`).join('')}
</table>
` : ''}

<div class="footer">
  <p>Raport wygenerowany przez AYS Quiz Manager &nbsp;|&nbsp; ${new Date().toLocaleString("pl-PL")}</p>
  <p><strong>Protokół bezpieczeństwa:</strong> Żadna zmiana nie jest wdrażana bez Twojej wyraźnej zgody.</p>
</div>
</body>
</html>`;

      return { html, title: report.title };
    }),

  // Export quiz snapshot as JSON
  snapshotJson: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const data = await getSnapshotWithQA(input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND" });
      return { data, filename: `quiz-snapshot-${input.id}-${Date.now()}.json` };
    }),

  // Export quiz snapshot as CSV
  snapshotCsv: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const data = await getSnapshotWithQA(input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND" });

      const rows: string[] = [
        "question_id,question,type,answer_id,answer,is_correct"
      ];

      for (const q of data.questions ?? []) {
        for (const a of q.answers ?? []) {
          const escapedQ = `"${(q.question ?? "").replace(/"/g, '""')}"`;
          const escapedA = `"${(a.answer ?? "").replace(/"/g, '""')}"`;
          rows.push(`${q.wpQuestionId},${escapedQ},${q.type},${a.wpAnswerId},${escapedA},${a.isCorrect ? 1 : 0}`);
        }
      }

      return {
        csv: rows.join("\n"),
        filename: `quiz-${data.snapshot.wpQuizId}-${data.snapshot.title?.replace(/\s+/g, "-")}.csv`
      };
    }),

  // Trend statistics for dashboard charts
  trends: protectedProcedure.query(async () => {
    const now = new Date();
    const weeks = 8;

    const snapshots = await listSnapshots();
    const simulations = await listSimulations();
    const reviews = await listAiReviews();

    // Build weekly buckets
    const buckets = Array.from({ length: weeks }, (_, i) => {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (weeks - 1 - i) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const label = weekStart.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });

      const snapshotCount = snapshots.filter(s =>
        s.createdAt >= weekStart && s.createdAt < weekEnd
      ).length;

      const simCount = simulations.filter(s =>
        s.createdAt >= weekStart && s.createdAt < weekEnd
      ).length;

      const reviewCount = reviews.filter(r =>
        r.createdAt >= weekStart && r.createdAt < weekEnd
      ).length;

      const issueCount = reviews
        .filter(r => r.createdAt >= weekStart && r.createdAt < weekEnd)
        .reduce((sum, r) => sum + (r.errorsFound ?? 0) + (r.warningsFound ?? 0), 0);

      return { label, snapshots: snapshotCount, simulations: simCount, reviews: reviewCount, issues: issueCount };
    });

    // Summary stats
    const totalSnapshots = snapshots.length;
    const totalSimulations = simulations.length;
    const completedSims = simulations.filter(s => s.status === "completed").length;
    const avgResponseTime = simulations
      .filter(s => s.avgResponseMs != null)
      .reduce((sum, s, _, arr) => sum + (s.avgResponseMs ?? 0) / arr.length, 0);
      const totalIssues = reviews.reduce((sum, r) => sum + (r.errorsFound ?? 0) + (r.warningsFound ?? 0), 0);
      const criticalIssues = reviews.reduce((sum, r) => sum + (r.errorsFound ?? 0), 0);

    return {
      weekly: buckets,
      summary: {
        totalSnapshots,
        totalSimulations,
        completedSims,
        avgResponseTime: Math.round(avgResponseTime),
        totalIssues,
        criticalIssues,
      }
    };
  }),

  // Pending patches count for badge
  pendingPatchesCount: protectedProcedure.query(async () => {
    const { listPatchProposals } = await import("../db");
    const patches = await listPatchProposals();
    const pending = patches.filter(p => p.status === "pending").length;
    const approved = patches.filter(p => p.status === "approved").length;
    return { pending, approved, total: pending + approved };
  }),
});
