import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, AlertCircle, Clock, Play, RefreshCw, ChevronDown, ChevronRight, Wrench } from "lucide-react";

const categoryLabels: Record<string, string> = {
  wordpress: "WordPress",
  quiz: "Quiz",
  settings: "Ustawienia AYS",
  simulation: "Symulacja",
  participants: "Uczestnicy",
  backup: "Backup",
};

const categoryColors: Record<string, string> = {
  wordpress: "text-blue-400",
  quiz: "text-purple-400",
  settings: "text-yellow-400",
  simulation: "text-orange-400",
  participants: "text-green-400",
  backup: "text-cyan-400",
};

export default function PreContest() {
  const [connectionId, setConnectionId] = useState("");
  const [quizId, setQuizId] = useState("");
  const [contestName, setContestName] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["wordpress", "quiz", "settings"]));
  const [lastResult, setLastResult] = useState<any>(null);

  const connections = trpc.connections.list.useQuery();
  const history = trpc.preContest.getHistory.useQuery({ quizId: quizId || undefined });

  const runChecklist = trpc.preContest.runChecklist.useMutation({
    onSuccess: (data) => {
      setLastResult(data);
      const emoji = data.overallStatus === "pass" ? "✅" : data.overallStatus === "warn" ? "⚠️" : "❌";
      toast.success(`${emoji} Checklista: ${data.passCount} OK, ${data.warnCount} ostrzeżeń, ${data.failCount} błędów`);
      history.refetch();
    },
    onError: (err) => toast.error(`Błąd: ${err.message}`),
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const groupByCategory = (checks: any[]) => {
    return checks.reduce((acc: Record<string, any[]>, check) => {
      if (!acc[check.category]) acc[check.category] = [];
      acc[check.category].push(check);
      return acc;
    }, {});
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "pass") return <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />;
    if (status === "fail") return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    if (status === "warn") return <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />;
    return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  const overallBadge = (status: string) => {
    if (status === "pass") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Gotowy do startu</Badge>;
    if (status === "warn") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">⚠️ Wymaga uwagi</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Krytyczne błędy</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <CheckCircle className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Checklista Pre-Contest</h1>
            <p className="text-muted-foreground text-sm">Automatyczna weryfikacja gotowości przed konkursem</p>
          </div>
        </div>

        {/* Formularz */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uruchom weryfikację</CardTitle>
            <CardDescription>Sprawdź wszystkie 20 punktów gotowości jednym kliknięciem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Połączenie WordPress</label>
                <select
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                >
                  <option value="">Wybierz połączenie...</option>
                  {connections.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.siteUrl})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">ID quizu (z AYS)</label>
                <Input
                  placeholder="np. 42"
                  value={quizId}
                  onChange={(e) => setQuizId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nazwa konkursu</label>
                <Input
                  placeholder="np. Konkurs Matematyczny Marzec 2025"
                  value={contestName}
                  onChange={(e) => setContestName(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={() => runChecklist.mutate({
                connectionId: parseInt(connectionId, 10),
                quizId,
                contestName,
              })}
              disabled={runChecklist.isPending || !connectionId || !quizId}
              className="bg-green-600 hover:bg-green-700"
            >
              {runChecklist.isPending
                ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Sprawdzam 20 punktów...</>
                : <><Play className="h-4 w-4 mr-2" />Uruchom checklistę</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Wyniki */}
        {lastResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Wyniki weryfikacji</h2>
              <div className="flex items-center gap-3">
                {overallBadge(lastResult.overallStatus)}
                <span className="text-sm text-muted-foreground">
                  {lastResult.passCount}/{lastResult.summary} punktów OK
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                style={{ width: `${(lastResult.passCount / lastResult.summary) * 100}%` }}
              />
            </div>

            {/* Grouped checks */}
            {Object.entries(groupByCategory(lastResult.checkResults)).map(([category, checks]: [string, any]) => (
              <Card key={category} className="border-border">
                <button
                  className="w-full text-left"
                  onClick={() => toggleCategory(category)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedCategories.has(category)
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                        <span className={`font-medium text-sm ${categoryColors[category] || "text-foreground"}`}>
                          {categoryLabels[category] || category}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {checks.filter((c: any) => c.status === "pass").length > 0 && (
                          <Badge className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                            {checks.filter((c: any) => c.status === "pass").length} OK
                          </Badge>
                        )}
                        {checks.filter((c: any) => c.status === "warn").length > 0 && (
                          <Badge className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                            {checks.filter((c: any) => c.status === "warn").length} ⚠️
                          </Badge>
                        )}
                        {checks.filter((c: any) => c.status === "fail").length > 0 && (
                          <Badge className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
                            {checks.filter((c: any) => c.status === "fail").length} ❌
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </button>
                {expandedCategories.has(category) && (
                  <CardContent className="pt-0 space-y-2">
                    {checks.map((check: any) => (
                      <div key={check.checkId} className={`p-3 rounded-lg border ${
                        check.status === "fail" ? "border-red-500/30 bg-red-500/5" :
                        check.status === "warn" ? "border-yellow-500/30 bg-yellow-500/5" :
                        check.status === "pass" ? "border-green-500/20 bg-green-500/5" :
                        "border-border bg-muted/20"
                      }`}>
                        <div className="flex items-start gap-2">
                          <StatusIcon status={check.status} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{check.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{check.message}</div>
                            {check.fixSuggestion && check.status !== "pass" && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-blue-400">
                                <Wrench className="h-3 w-3" />
                                {check.fixSuggestion}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Historia */}
        {history.data && history.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historia checklistów</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.data.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <div className="text-sm font-medium">{h.contestName || "Bez nazwy"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(h.runAt).toLocaleString("pl-PL")} · Quiz ID: {h.quizId}
                      </div>
                    </div>
                    {overallBadge(h.overallStatus)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
