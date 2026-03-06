import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

const severityConfig = {
  critical: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Krytyczny" },
  high: { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "Wysoki" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Średni" },
  low: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Niski" },
};

const typeIcon = { error: XCircle, warning: AlertTriangle, suggestion: Info };

export default function ReviewsPage() {
  const { data: reviews, isLoading } = trpc.reviews.list.useQuery({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analizy AI</h1>
        <p className="text-muted-foreground mt-1">Wyniki weryfikacji merytorycznej quizów przez sztuczną inteligencję.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : reviews?.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Brain className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Brak analiz. Uruchom analizę AI ze strony Quizy.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews?.map(review => {
            const findings = (review.findings as any[]) ?? [];
            const errors = findings.filter(f => f.type === "error");
            const warnings = findings.filter(f => f.type === "warning");
            const suggestions = findings.filter(f => f.type === "suggestion");

            return (
              <Card key={review.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">Analiza #{review.id}</span>
                          <Badge variant={review.status === "completed" ? "default" : review.status === "failed" ? "destructive" : "secondary"}>
                            {review.status === "running" && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                            {review.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleString("pl-PL")}</span>
                      </div>
                    </div>
                    {review.overallScore != null && (
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${review.overallScore >= 80 ? "text-green-400" : review.overallScore >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                          {review.overallScore.toFixed(0)}/100
                        </div>
                        <span className="text-xs text-muted-foreground">Wynik jakości</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {review.summary && (
                    <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{review.summary}</p>
                  )}

                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4" /> {errors.length} błędów</span>
                    <span className="flex items-center gap-1 text-yellow-400"><AlertTriangle className="w-4 h-4" /> {warnings.length} ostrzeżeń</span>
                    <span className="flex items-center gap-1 text-blue-400"><Info className="w-4 h-4" /> {suggestions.length} sugestii</span>
                  </div>

                  {findings.length > 0 && (
                    <div className="space-y-2">
                      {findings.map((f: any, i: number) => {
                        const sev = severityConfig[f.severity as keyof typeof severityConfig] ?? severityConfig.low;
                        const Icon = typeIcon[f.type as keyof typeof typeIcon] ?? Info;
                        return (
                          <div key={i} className={`flex gap-3 p-3 rounded-lg border ${sev.bg}`}>
                            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${sev.color}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <Badge variant="outline" className={`text-xs ${sev.color} border-current`}>{sev.label}</Badge>
                                <Badge variant="outline" className="text-xs">{f.category}</Badge>
                                <span className="text-xs text-muted-foreground font-mono">WP ID: {f.wpQuestionId}</span>
                              </div>
                              <p className="text-sm text-foreground">{f.message}</p>
                              {f.suggestion && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                                  <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5 text-green-400" />
                                  <span><strong className="text-green-400">Sugestia:</strong> {f.suggestion}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
