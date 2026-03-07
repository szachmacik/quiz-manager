import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link, useParams } from "wouter";
import { ArrowLeft, Brain, CheckCircle2, XCircle, Loader2, HelpCircle, Copy, Download, FileJson, FileSpreadsheet } from "lucide-react";

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function SnapshotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const snapshotId = parseInt(id, 10);

  const { data, isLoading } = trpc.quizzes.getSnapshot.useQuery({ id: snapshotId });
  const { data: jsonExport } = trpc.export.snapshotJson.useQuery({ id: snapshotId }, { enabled: !!snapshotId });
  const { data: csvExport } = trpc.export.snapshotCsv.useQuery({ id: snapshotId }, { enabled: !!snapshotId });
  const reviewMutation = trpc.reviews.start.useMutation({
    onSuccess: (d) => toast.success(`Analiza AI uruchomiona (ID: ${d.reviewId})`),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!data) return <div className="text-muted-foreground">Snapshot nie znaleziony.</div>;

  const { snapshot, questions } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/quizzes">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="w-4 h-4" /> Wróć</Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{snapshot.title}</h1>
          <p className="text-muted-foreground text-sm">Snapshot #{snapshot.id} · {new Date(snapshot.createdAt).toLocaleString("pl-PL")}</p>
        </div>
        <Button onClick={() => reviewMutation.mutate({ snapshotId })} disabled={reviewMutation.isPending} className="gap-2">
          {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          Uruchom analizę AI
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <Badge variant="outline">{snapshot.questionCount} pytań</Badge>
        <Badge variant="outline">{snapshot.snapshotType}</Badge>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="font-mono text-xs">{snapshot.shortcode}</Badge>
          <Button
            size="sm" variant="ghost" className="h-6 w-6 p-0"
            onClick={() => { navigator.clipboard.writeText(snapshot.shortcode ?? ""); toast.success("Shortcode skopiowany!"); }}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
        {jsonExport && (
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
            onClick={() => downloadFile(JSON.stringify(jsonExport.data, null, 2), jsonExport.filename, "application/json")}>
            <FileJson className="w-3 h-3" /> JSON
          </Button>
        )}
        {csvExport && (
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
            onClick={() => downloadFile(csvExport.csv, csvExport.filename, "text/csv")}>
            <FileSpreadsheet className="w-3 h-3" /> CSV
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <Card key={q.id} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground shrink-0">#{idx + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm leading-relaxed">{q.question}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{q.type}</Badge>
                    <Badge variant="outline" className="text-xs font-mono">WP ID: {q.wpQuestionId}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1 ml-10">
                {q.answers.map(a => (
                  <div key={a.id} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${a.isCorrect ? "bg-green-500/10 border border-green-500/20" : "bg-muted/30"}`}>
                    {a.isCorrect
                      ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                      : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                    <span className={a.isCorrect ? "text-green-300" : "text-muted-foreground"}>{a.answer}</span>
                    {a.isCorrect && <Badge className="ml-auto text-xs bg-green-500/20 text-green-400 border-green-500/30">Poprawna</Badge>}
                  </div>
                ))}
                {q.answers.length === 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <HelpCircle className="w-3 h-3" /> Brak odpowiedzi (pytanie otwarte)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
