import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "wouter";
import { FileText, Download, Brain, Eye, Loader2, RefreshCw, Copy, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function QuizzesPage() {
  const utils = trpc.useUtils();
  const { data: connections } = trpc.connections.list.useQuery();
  const [selectedConn, setSelectedConn] = useState<number | null>(null);
  const [quizSearch, setQuizSearch] = useState("");
  const [snapshotSearch, setSnapshotSearch] = useState("");
  const [snapshotTypeFilter, setSnapshotTypeFilter] = useState("all");

  const { data: wpQuizzes, isLoading: loadingWp, refetch: refetchWp } = trpc.quizzes.listFromWp.useQuery(
    { connectionId: selectedConn! },
    { enabled: !!selectedConn }
  );
  const { data: snapshots, isLoading: loadingSnaps } = trpc.quizzes.listSnapshots.useQuery(
    { connectionId: selectedConn ?? undefined }
  );

  const snapshotMutation = trpc.quizzes.createSnapshot.useMutation({
    onSuccess: () => { utils.quizzes.listSnapshots.invalidate(); toast.success("Snapshot utworzony pomyślnie"); },
    onError: (e) => toast.error(`Błąd: ${e.message}`),
  });

  const reviewMutation = trpc.reviews.start.useMutation({
    onSuccess: (data) => toast.success(`Analiza AI uruchomiona (ID: ${data.reviewId})`),
    onError: (e) => toast.error(`Błąd: ${e.message}`),
  });

  const activeConnections = connections?.filter(c => c.status === "active") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Quizy i Snapshoty</h1>
        <p className="text-muted-foreground mt-1">Pobieraj quizy z WordPress, twórz kopie zapasowe i uruchamiaj weryfikację AI.</p>
      </div>

      {/* Connection selector */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedConn?.toString() ?? ""} onValueChange={v => setSelectedConn(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz połączenie WordPress..." />
                </SelectTrigger>
                <SelectContent>
                  {activeConnections.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name} — {c.siteUrl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedConn && (
              <Button variant="outline" size="sm" onClick={() => refetchWp()} className="gap-2">
                <RefreshCw className="w-3 h-3" /> Odśwież
              </Button>
            )}
          </div>
          {activeConnections.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Brak aktywnych połączeń. <Link href="/connections" className="text-primary hover:underline">Dodaj i przetestuj połączenie.</Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quizzes from WP */}
      {selectedConn && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quizy w WordPress</h2>
            <div className="relative w-56">
              <Search className="absolute left-2 top-2.5 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Szukaj quizu..."
                value={quizSearch}
                onChange={e => setQuizSearch(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
          </div>
          {loadingWp ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Pobieranie quizów z WordPress...
            </div>
          ) : wpQuizzes?.error ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              Błąd połączenia: {wpQuizzes.error}
            </div>
          ) : wpQuizzes?.quizzes.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Nie znaleziono quizów. Upewnij się, że plugin AYS Quiz Maker jest aktywny i ma quizy.</p>
          ) : (
            <div className="grid gap-3">
              {wpQuizzes?.quizzes.filter(q =>
                !quizSearch || q.title?.toLowerCase().includes(quizSearch.toLowerCase()) || String(q.id).includes(quizSearch)
              ).map(quiz => {
                const hasSnapshot = snapshots?.some(s => s.wpQuizId === quiz.id && s.connectionId === selectedConn);
                return (
                  <Card key={quiz.id} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{quiz.title}</span>
                              <Badge variant="outline" className="text-xs font-mono">ID: {quiz.id}</Badge>
                              {hasSnapshot && <Badge variant="secondary" className="text-xs">Snapshot istnieje</Badge>}
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">{quiz.shortcode || `[ays_quiz id="${quiz.id}"]`}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={hasSnapshot ? "outline" : "default"}
                          className="gap-2"
                          onClick={() => snapshotMutation.mutate({ connectionId: selectedConn, wpQuizId: quiz.id, snapshotType: "manual" })}
                          disabled={snapshotMutation.isPending && snapshotMutation.variables?.wpQuizId === quiz.id}
                        >
                          {snapshotMutation.isPending && snapshotMutation.variables?.wpQuizId === quiz.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Copy className="w-3 h-3" />
                          }
                          {hasSnapshot ? "Aktualizuj snapshot" : "Utwórz snapshot"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Snapshots */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Snapshoty {selectedConn ? "tego połączenia" : "wszystkie"}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-2 top-2.5 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Szukaj snapshotu..."
                value={snapshotSearch}
                onChange={e => setSnapshotSearch(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
            <Select value={snapshotTypeFilter} onValueChange={setSnapshotTypeFilter}>
              <SelectTrigger className="h-8 w-36 text-sm">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie typy</SelectItem>
                <SelectItem value="manual">Ręczne</SelectItem>
                <SelectItem value="auto">Auto-sync</SelectItem>
                <SelectItem value="pre_simulation">Przed symulacją</SelectItem>
                <SelectItem value="pre_patch">Przed poprawką</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {loadingSnaps ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Ładowanie...
          </div>
        ) : snapshots?.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">Brak snapshotów. Utwórz snapshot quizu powyżej.</p>
        ) : (
          <div className="grid gap-3">
            {snapshots?.filter(s =>
              (snapshotTypeFilter === "all" || s.snapshotType === snapshotTypeFilter) &&
              (!snapshotSearch || s.title?.toLowerCase().includes(snapshotSearch.toLowerCase()))
            ).map(snap => (
              <Card key={snap.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Download className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{snap.title}</span>
                          <Badge variant="outline" className="text-xs">{snap.snapshotType}</Badge>
                          <Badge variant="secondary" className="text-xs">{snap.questionCount} pytań</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(snap.createdAt).toLocaleString("pl-PL")} · ID: {snap.id}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => reviewMutation.mutate({ snapshotId: snap.id })}
                        disabled={reviewMutation.isPending}
                      >
                        <Brain className="w-3 h-3" /> Analiza AI
                      </Button>
                      <Link href={`/snapshots/${snap.id}`}>
                        <Button size="sm" variant="ghost" className="gap-2">
                          <Eye className="w-3 h-3" /> Podgląd
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
