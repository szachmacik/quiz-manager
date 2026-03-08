import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Award, Download, Eye, Sparkles, Printer, Users, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Contestant = {
  id: string;
  participantName: string;
  score: number;
  maxScore: number;
  timeTaken?: number;
  place?: number;
  ageGroup?: string;
  diplomaType: "winner_1st" | "winner_2nd" | "winner_3rd" | "laureate" | "participant";
};

export default function Diplomas() {
  const [quizTitle, setQuizTitle] = useState("");
  const [contestDate, setContestDate] = useState(new Date().toLocaleDateString("pl-PL"));
  const [contestEdition, setContestEdition] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [contestants, setContestants] = useState<Contestant[]>([
    { id: "1", participantName: "", score: 0, maxScore: 10, diplomaType: "laureate", ageGroup: "klasa_3" },
  ]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<Record<string, string>>({});
  const [batchHtmls, setBatchHtmls] = useState<{ participantName: string; html: string }[]>([]);

  const { data: types } = trpc.diploma.getTypes.useQuery();
  const { data: ageGroups } = trpc.diploma.getAgeGroups.useQuery();

  const generateSingle = trpc.diploma.generate.useMutation();
  const generateMessage = trpc.diploma.generateMessage.useMutation();
  const batchGenerate = trpc.diploma.batchGenerate.useMutation();

  const addContestant = () => {
    setContestants(prev => [...prev, {
      id: Date.now().toString(),
      participantName: "",
      score: 0,
      maxScore: 10,
      diplomaType: "participant",
      ageGroup: "klasa_3",
    }]);
  };

  const removeContestant = (id: string) => {
    setContestants(prev => prev.filter(c => c.id !== id));
  };

  const updateContestant = (id: string, field: keyof Contestant, value: string | number) => {
    setContestants(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handlePreview = async (contestant: Contestant) => {
    if (!contestant.participantName) { toast.error("Podaj imię uczestnika"); return; }
    if (!quizTitle) { toast.error("Podaj tytuł quizu"); return; }
    try {
      const result = await generateSingle.mutateAsync({
        ...contestant,
        quizTitle,
        contestDate,
        contestEdition: contestEdition || undefined,
        organizerName: organizerName || undefined,
        customMessage: aiMessages[contestant.id] || undefined,
      });
      setPreviewHtml(result.html);
      setPreviewName(contestant.participantName);
    } catch {
      toast.error("Błąd generowania dyplomu");
    }
  };

  const handleGenerateAIMessage = async (contestant: Contestant) => {
    if (!contestant.participantName) { toast.error("Podaj imię uczestnika"); return; }
    setGeneratingAI(contestant.id);
    try {
      const result = await generateMessage.mutateAsync({
        participantName: contestant.participantName,
        ageGroup: contestant.ageGroup ?? "klasa_3",
        score: contestant.score,
        maxScore: contestant.maxScore,
        place: contestant.place,
        quizTitle: quizTitle || "Konkurs",
      });
      setAiMessages(prev => ({ ...prev, [contestant.id]: result.message }));
      toast.success("Wiadomość AI wygenerowana");
    } catch {
      toast.error("Błąd generowania wiadomości AI");
    } finally {
      setGeneratingAI(null);
    }
  };

  const handleBatchGenerate = async () => {
    if (!quizTitle) { toast.error("Podaj tytuł quizu"); return; }
    const valid = contestants.filter(c => c.participantName.trim());
    if (!valid.length) { toast.error("Dodaj przynajmniej jednego uczestnika"); return; }
    try {
      const result = await batchGenerate.mutateAsync({
        contestants: valid.map(c => ({
          ...c,
          timeTaken: c.timeTaken,
          place: c.place,
          ageGroup: c.ageGroup,
        })),
        quizTitle,
        contestDate,
        contestEdition: contestEdition || undefined,
        organizerName: organizerName || undefined,
      });
      setBatchHtmls(result.diplomas);
      toast.success(`Wygenerowano ${result.count} dyplomów`);
    } catch {
      toast.error("Błąd generowania dyplomów");
    }
  };

  const handlePrint = (html: string) => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  const handlePrintAll = () => {
    if (!batchHtmls.length) return;
    const combined = batchHtmls.map(d => d.html.replace(/<html[^>]*>|<\/html>|<head>[\s\S]*?<\/head>|<body[^>]*>|<\/body>/g, "")).join('<div style="page-break-after:always;"></div>');
    const fullHtml = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><style>@media print { .page-break { page-break-after: always; } }</style></head><body>${combined}</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(fullHtml);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  const typeColors: Record<string, string> = {
    winner_1st: "bg-yellow-100 text-yellow-800 border-yellow-300",
    winner_2nd: "bg-gray-100 text-gray-700 border-gray-300",
    winner_3rd: "bg-orange-100 text-orange-800 border-orange-300",
    laureate: "bg-blue-100 text-blue-800 border-blue-300",
    participant: "bg-green-100 text-green-800 border-green-300",
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-500" />
              Generator Dyplomów
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Twórz spersonalizowane dyplomy dla zwycięzców i laureatów konkursu
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintAll} disabled={!batchHtmls.length}>
              <Printer className="h-4 w-4 mr-2" />
              Drukuj wszystkie ({batchHtmls.length})
            </Button>
            <Button onClick={handleBatchGenerate} disabled={batchGenerate.isPending}>
              <Users className="h-4 w-4 mr-2" />
              {batchGenerate.isPending ? "Generuję..." : "Generuj wszystkie"}
            </Button>
          </div>
        </div>

        {/* Contest Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informacje o konkursie</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tytuł quizu / konkursu *</Label>
              <Input
                value={quizTitle}
                onChange={e => setQuizTitle(e.target.value)}
                placeholder="np. Mistrz Matematyki 2025"
              />
            </div>
            <div className="space-y-2">
              <Label>Data konkursu</Label>
              <Input
                value={contestDate}
                onChange={e => setContestDate(e.target.value)}
                placeholder="np. 15.03.2025"
              />
            </div>
            <div className="space-y-2">
              <Label>Edycja (opcjonalnie)</Label>
              <Input
                value={contestEdition}
                onChange={e => setContestEdition(e.target.value)}
                placeholder="np. III, 2025/2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Organizator</Label>
              <Input
                value={organizerName}
                onChange={e => setOrganizerName(e.target.value)}
                placeholder="np. Fundacja XYZ"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contestants */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Uczestnicy ({contestants.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={addContestant}>
                <Plus className="h-4 w-4 mr-1" />
                Dodaj uczestnika
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {contestants.map((c, idx) => (
              <div key={c.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Uczestnik #{idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs border ${typeColors[c.diplomaType] ?? ""}`}>
                      {types?.find(t => t.key === c.diplomaType)?.label ?? c.diplomaType}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeContestant(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Imię i nazwisko *</Label>
                    <Input
                      value={c.participantName}
                      onChange={e => updateContestant(c.id, "participantName", e.target.value)}
                      placeholder="Jan Kowalski"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Typ dyplomu</Label>
                    <Select value={c.diplomaType} onValueChange={v => updateContestant(c.id, "diplomaType", v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {types?.map(t => (
                          <SelectItem key={t.key} value={t.key}>{t.ribbon} {t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Grupa wiekowa</Label>
                    <Select value={c.ageGroup ?? "klasa_3"} onValueChange={v => updateContestant(c.id, "ageGroup", v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ageGroups?.map(ag => (
                          <SelectItem key={ag.key} value={ag.key}>{ag.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Wynik (pkt)</Label>
                    <Input
                      type="number"
                      value={c.score}
                      onChange={e => updateContestant(c.id, "score", Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Maks. punktów</Label>
                    <Input
                      type="number"
                      value={c.maxScore}
                      onChange={e => updateContestant(c.id, "maxScore", Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Miejsce (opcjonalnie)</Label>
                    <Input
                      type="number"
                      value={c.place ?? ""}
                      onChange={e => updateContestant(c.id, "place", e.target.value ? Number(e.target.value) : "")}
                      placeholder="1, 2, 3..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {/* AI Message */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Wiadomość na dyplomie</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => handleGenerateAIMessage(c)}
                      disabled={generatingAI === c.id}
                    >
                      <Sparkles className="h-3 w-3" />
                      {generatingAI === c.id ? "Generuję..." : "Generuj AI"}
                    </Button>
                  </div>
                  <Textarea
                    value={aiMessages[c.id] ?? ""}
                    onChange={e => setAiMessages(prev => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder="Zostaw puste aby użyć domyślnej wiadomości dla grupy wiekowej..."
                    className="text-sm min-h-[50px] resize-none"
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(c)}
                    disabled={generateSingle.isPending}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Podgląd
                  </Button>
                  {batchHtmls.find(b => b.participantName === c.participantName) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const found = batchHtmls.find(b => b.participantName === c.participantName);
                        if (found) handlePrint(found.html);
                      }}
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      Drukuj
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Batch results */}
        {batchHtmls.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4 text-green-500" />
                  Wygenerowane dyplomy ({batchHtmls.length})
                </CardTitle>
                <Button onClick={handlePrintAll} size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Drukuj wszystkie
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {batchHtmls.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
                    <span className="text-sm font-medium">{d.participantName}</span>
                    <Button variant="ghost" size="sm" onClick={() => handlePrint(d.html)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Modal */}
        {previewHtml && (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Podgląd dyplomu — {previewName}</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handlePrint(previewHtml)}>
                    <Printer className="h-4 w-4 mr-2" />
                    Drukuj / Zapisz PDF
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>
                    Zamknij
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-4" />
              <div className="border rounded-lg overflow-hidden bg-white" style={{ height: "420px" }}>
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full"
                  title={`Dyplom — ${previewName}`}
                  style={{ border: "none", transform: "scale(0.75)", transformOrigin: "top left", width: "133%", height: "133%" }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Kliknij "Drukuj / Zapisz PDF" aby wydrukować lub zapisać jako PDF (Ctrl+P → Zapisz jako PDF)
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
