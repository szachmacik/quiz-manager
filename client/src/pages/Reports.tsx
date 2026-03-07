import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, FileText, Download, TrendingUp, Users, Brain, AlertTriangle, Printer } from "lucide-react";
import { useState, useEffect } from "react";

function exportReportAsPdf(html: string, title: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export default function ReportsPage() {
  const utils = trpc.useUtils();
  const [exportingId, setExportingId] = useState<number | null>(null);
  const exportHtmlQuery = trpc.export.reportHtml.useQuery(
    { id: exportingId ?? 0 },
    { enabled: exportingId !== null }
  );
  useEffect(() => {
    if (exportHtmlQuery.data && exportingId !== null) {
      exportReportAsPdf(exportHtmlQuery.data.html, exportHtmlQuery.data.title);
      setExportingId(null);
    }
  }, [exportHtmlQuery.data]);
  const { data: reports, isLoading } = trpc.reports.list.useQuery();
  const { data: simulations } = trpc.simulations.list.useQuery({});
  const { data: reviews } = trpc.reviews.list.useQuery({});
  const { data: snapshots } = trpc.quizzes.listSnapshots.useQuery({});

  const generateMutation = trpc.reports.generate.useMutation({
    onSuccess: (d) => { utils.reports.list.invalidate(); toast.success(`Raport wygenerowany (ID: ${d.id})`); },
    onError: (e) => toast.error(e.message),
  });

  const typeIcons = { simulation: Users, ai_review: Brain, combined: TrendingUp, patch_summary: AlertTriangle };
  const typeLabels = { simulation: "Symulacja", ai_review: "Analiza AI", combined: "Kompleksowy", patch_summary: "Podsumowanie poprawek" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Raporty</h1>
        <p className="text-muted-foreground mt-1">Generuj i przeglądaj szczegółowe raporty z symulacji, analiz AI i wdrożonych poprawek.</p>
      </div>

      {/* Quick generate buttons */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Szybkie generowanie raportów</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {simulations?.filter(s => s.status === "completed").slice(0, 3).map(sim => (
            <Button
              key={sim.id}
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => generateMutation.mutate({ simulationId: sim.id, type: "simulation" })}
              disabled={generateMutation.isPending}
            >
              <Users className="w-3 h-3" /> Raport: {(sim.name ?? `Symulacja #${sim.id}`).slice(0, 30)}
            </Button>
          ))}
          {reviews?.filter(r => r.status === "completed").slice(0, 3).map(rev => (
            <Button
              key={rev.id}
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => generateMutation.mutate({ aiReviewId: rev.id, type: "ai_review" })}
              disabled={generateMutation.isPending}
            >
              <Brain className="w-3 h-3" /> Raport AI #{rev.id}
            </Button>
          ))}
          {simulations?.length && reviews?.length ? (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => generateMutation.mutate({
                simulationId: simulations.find(s => s.status === "completed")?.id,
                aiReviewId: reviews.find(r => r.status === "completed")?.id,
                type: "combined",
              })}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              Raport kompleksowy
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : reports?.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <FileText className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Brak raportów. Wygeneruj raport po zakończeniu symulacji lub analizy AI.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports?.map(report => {
            const Icon = typeIcons[report.type as keyof typeof typeIcons] ?? FileText;
            const typeLabel = typeLabels[report.type as keyof typeof typeLabels] ?? report.type;
            const content = report.content as any;

            return (
              <Card key={report.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{report.title}</span>
                          <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString("pl-PL")}</p>
                      </div>
                    </div>
                  </div>

                  {/* Report summary */}
                  {content?.simulation && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-muted-foreground">Agenci</p>
                        <p className="font-bold text-foreground">{content.simulation.completedAgents}/{content.simulation.agentCount}</p>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-muted-foreground">Avg response</p>
                        <p className="font-bold text-foreground">{content.simulation.avgResponseMs?.toFixed(0) ?? "—"}ms</p>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-muted-foreground">P95 response</p>
                        <p className="font-bold text-foreground">{content.simulation.p95ResponseMs?.toFixed(0) ?? "—"}ms</p>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-muted-foreground">Wskaźnik błędów</p>
                        <p className={`font-bold ${(content.simulation.errorRate ?? 0) > 5 ? "text-red-400" : "text-green-400"}`}>
                          {content.simulation.errorRate?.toFixed(1) ?? "0"}%
                        </p>
                      </div>
                    </div>
                  )}

                  {content?.review && (
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-muted-foreground">Wynik jakości</p>
                        <p className={`font-bold ${(content.review.overallScore ?? 0) >= 80 ? "text-green-400" : "text-red-400"}`}>
                          {content.review.overallScore?.toFixed(0) ?? "—"}/100
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-muted-foreground">Błędy</p>
                        <p className="font-bold text-red-400">{content.review.errorsFound ?? 0}</p>
                      </div>
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-muted-foreground">Ostrzeżenia</p>
                        <p className="font-bold text-yellow-400">{content.review.warningsFound ?? 0}</p>
                      </div>
                    </div>
                  )}

                  {report.summary && (
                    <p className="text-xs text-muted-foreground mt-3">{report.summary}</p>
                  )}

                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-xs"
                      onClick={() => setExportingId(report.id)}
                      disabled={exportingId === report.id}
                    >
                      {exportingId === report.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Printer className="w-3 h-3" />}
                      Eksportuj PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
