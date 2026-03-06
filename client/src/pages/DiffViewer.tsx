import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { GitCompare, Plus, Minus, Edit2, Loader2, CheckCircle2, XCircle } from "lucide-react";

type DiffItem = {
  type: string;
  wpQuestionId?: number;
  wpAnswerId?: number;
  oldValue?: string;
  newValue?: string;
  isCorrect?: boolean;
  oldCorrect?: boolean;
  newCorrect?: boolean;
};

export default function DiffViewerPage() {
  const { data: snapshots } = trpc.quizzes.listSnapshots.useQuery({});
  const [snapshotA, setSnapshotA] = useState("");
  const [snapshotB, setSnapshotB] = useState("");
  const [comparing, setComparing] = useState(false);

  const diffQuery = trpc.diff.compare.useQuery(
    { snapshotAId: parseInt(snapshotA), snapshotBId: parseInt(snapshotB) },
    { enabled: comparing && !!snapshotA && !!snapshotB && snapshotA !== snapshotB }
  );

  const handleCompare = () => {
    if (!snapshotA || !snapshotB || snapshotA === snapshotB) return;
    setComparing(true);
  };

  const diffData = (diffQuery.data?.diffData ?? []) as DiffItem[];

  const questionChanges = diffData.filter(d => d.type.startsWith("question_"));
  const answerChanges = diffData.filter(d => d.type.startsWith("answer_"));

  const typeIcon = (type: string) => {
    if (type.endsWith("_added")) return <Plus className="w-3 h-3 text-green-400" />;
    if (type.endsWith("_removed")) return <Minus className="w-3 h-3 text-red-400" />;
    return <Edit2 className="w-3 h-3 text-yellow-400" />;
  };

  const typeBg = (type: string) => {
    if (type.endsWith("_added")) return "bg-green-500/10 border-green-500/20";
    if (type.endsWith("_removed")) return "bg-red-500/10 border-red-500/20";
    return "bg-yellow-500/10 border-yellow-500/20";
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      question_added: "Dodano pytanie",
      question_removed: "Usunięto pytanie",
      question_modified: "Zmieniono pytanie",
      answer_added: "Dodano odpowiedź",
      answer_removed: "Usunięto odpowiedź",
      answer_modified: "Zmieniono odpowiedź",
    };
    return map[type] ?? type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-primary" /> Porównanie snapshotów
        </h1>
        <p className="text-muted-foreground mt-1">Porównaj dwie wersje quizu i zobacz co się zmieniło.</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-foreground">Snapshot A (starsza wersja)</label>
              <Select value={snapshotA} onValueChange={setSnapshotA}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Wybierz snapshot A" /></SelectTrigger>
                <SelectContent>
                  {snapshots?.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>#{s.id} — {s.title} ({new Date(s.createdAt).toLocaleDateString("pl-PL")})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pb-2 text-muted-foreground font-bold">→</div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-foreground">Snapshot B (nowsza wersja)</label>
              <Select value={snapshotB} onValueChange={setSnapshotB}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Wybierz snapshot B" /></SelectTrigger>
                <SelectContent>
                  {snapshots?.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>#{s.id} — {s.title} ({new Date(s.createdAt).toLocaleDateString("pl-PL")})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCompare} disabled={!snapshotA || !snapshotB || snapshotA === snapshotB}>
              <GitCompare className="w-4 h-4 mr-2" /> Porównaj
            </Button>
          </div>
        </CardContent>
      </Card>

      {diffQuery.isLoading && (
        <div className="flex items-center justify-center h-32 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Obliczam różnice...</span>
        </div>
      )}

      {diffQuery.data && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pytania dodane", value: diffQuery.data.addedQuestions, color: "text-green-400" },
              { label: "Pytania usunięte", value: diffQuery.data.removedQuestions, color: "text-red-400" },
              { label: "Pytania zmienione", value: diffQuery.data.modifiedQuestions, color: "text-yellow-400" },
              { label: "Odpowiedzi dodane", value: diffQuery.data.addedAnswers, color: "text-green-400" },
              { label: "Odpowiedzi usunięte", value: diffQuery.data.removedAnswers, color: "text-red-400" },
              { label: "Odpowiedzi zmienione", value: diffQuery.data.modifiedAnswers, color: "text-yellow-400" },
            ].map(stat => (
              <Card key={stat.label} className="bg-card border-border">
                <CardContent className="p-3 text-center">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {diffData.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center h-24 gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                <p className="text-muted-foreground text-sm">Snapshoty są identyczne — brak różnic</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Question changes */}
              {questionChanges.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Zmiany w pytaniach ({questionChanges.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {questionChanges.map((d, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${typeBg(d.type)}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {typeIcon(d.type)}
                          <span className="text-xs font-medium">{typeLabel(d.type)}</span>
                          <Badge variant="outline" className="text-xs ml-auto">Q#{d.wpQuestionId}</Badge>
                        </div>
                        {d.oldValue && (
                          <div className="text-xs bg-red-500/10 border border-red-500/20 rounded p-2 mb-1">
                            <span className="text-red-400 font-mono">- </span>{d.oldValue}
                          </div>
                        )}
                        {d.newValue && (
                          <div className="text-xs bg-green-500/10 border border-green-500/20 rounded p-2">
                            <span className="text-green-400 font-mono">+ </span>{d.newValue}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Answer changes */}
              {answerChanges.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Zmiany w odpowiedziach ({answerChanges.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {answerChanges.map((d, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${typeBg(d.type)}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {typeIcon(d.type)}
                          <span className="text-xs font-medium">{typeLabel(d.type)}</span>
                          <Badge variant="outline" className="text-xs">Q#{d.wpQuestionId} / A#{d.wpAnswerId}</Badge>
                          {(d.isCorrect || d.newCorrect) && <Badge variant="default" className="text-xs ml-auto">Poprawna</Badge>}
                          {d.type === "answer_modified" && d.oldCorrect !== d.newCorrect && (
                            <Badge variant={d.newCorrect ? "default" : "destructive"} className="text-xs ml-auto">
                              {d.newCorrect ? "→ Poprawna" : "→ Błędna"}
                            </Badge>
                          )}
                        </div>
                        {d.oldValue && (
                          <div className="text-xs bg-red-500/10 border border-red-500/20 rounded p-2 mb-1">
                            <span className="text-red-400 font-mono">- </span>{d.oldValue}
                          </div>
                        )}
                        {d.newValue && (
                          <div className="text-xs bg-green-500/10 border border-green-500/20 rounded p-2">
                            <span className="text-green-400 font-mono">+ </span>{d.newValue}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
