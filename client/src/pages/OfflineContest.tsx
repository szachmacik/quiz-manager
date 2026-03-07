import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { FileText, Printer, Upload, Brain, Package, CheckCircle, AlertCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";

const AGE_GROUP_LABELS: Record<string, string> = {
  zerowka: "Zerówka",
  klasa_1: "Klasa 1",
  klasa_2: "Klasa 2",
  klasa_3: "Klasa 3",
  klasa_4: "Klasa 4",
  klasa_5: "Klasa 5",
  klasa_6: "Klasa 6",
};

export default function OfflineContest() {
  const [activeTab, setActiveTab] = useState("generator");

  // Generator arkuszy
  const [contestName, setContestName] = useState("");
  const [contestDate, setContestDate] = useState("");
  const [ageGroup, setAgeGroup] = useState("klasa_3");
  const [questions, setQuestions] = useState<Array<{ text: string; options: string[]; correctIndex: number }>>([]);
  const [newQuestion, setNewQuestion] = useState({ text: "", options: ["", "", "", ""], correctIndex: 0 });

  // OCR
  const [ocrImageUrl, setOcrImageUrl] = useState("");
  const [ocrContestId, setOcrContestId] = useState<number | undefined>();

  const { data: offlineContests } = trpc.offline.list.useQuery();

  const createContest = trpc.offline.create.useMutation({
    onSuccess: () => {
      toast.success("Konkurs offline utworzony");
      setContestName("");
      setQuestions([]);
    },
    onError: () => toast.error("Błąd tworzenia konkursu"),
  });

  const generatePdf = trpc.offline.generateAnswerSheet.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.onload = () => win.print();
      }
      toast.success("Arkusz gotowy do druku");
    },
    onError: () => toast.error("Błąd generowania arkusza"),
  });

  const processOcr = trpc.offline.runOcr.useMutation({
    onSuccess: (data) => {
      toast.success(`OCR zakończony — wynik: ${data.correct}/${data.total} (${data.scorePercent}%)`);
    },
    onError: () => toast.error("Błąd OCR — sprawdź czy skan został wgrany"),
  });

  const addQuestion = () => {
    if (!newQuestion.text.trim()) return;
    setQuestions(prev => [...prev, { ...newQuestion }]);
    setNewQuestion({ text: "", options: ["", "", "", ""], correctIndex: 0 });
    toast.success("Pytanie dodane");
  };

  const handleCreateContest = () => {
    if (!contestName.trim() || questions.length === 0) {
      toast.error("Podaj nazwę i dodaj pytania");
      return;
    }
    createContest.mutate({
      name: contestName,
      edition: new Date().getFullYear().toString(),
      contestDate: contestDate || new Date().toISOString(),
      questionsCount: questions.length,
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-amber-400" />
            Konkurs Offline
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Kartka + ołówek + koperta — zero technologii po stronie szkoły
          </p>
        </div>

        {/* Zasada działania */}
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300 space-y-1">
                <p className="font-semibold text-amber-400">Jak to działa?</p>
                <p>1. <strong>Ty:</strong> Generujesz arkusze PDF → drukujesz → wysyłasz do szkół pocztą</p>
                <p>2. <strong>Nauczyciel:</strong> Rozdaje kartki, dzieci zaznaczają odpowiedzi ołówkiem, nauczyciel wkłada do koperty i odsyła</p>
                <p>3. <strong>Ty:</strong> Skanujesz koperty → OCR automatycznie odczytuje odpowiedzi → system oblicza wyniki</p>
                <p className="text-slate-400 text-xs mt-2">Działa nawet dla zerówki — duże litery, proste kółka do zaznaczenia</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="generator">
              <FileText className="w-4 h-4 mr-2" />
              Generator arkuszy
            </TabsTrigger>
            <TabsTrigger value="ocr">
              <Brain className="w-4 h-4 mr-2" />
              OCR / Skanowanie
            </TabsTrigger>
            <TabsTrigger value="contests">
              <Package className="w-4 h-4 mr-2" />
              Konkursy offline ({offlineContests?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* ─── Generator arkuszy ─── */}
          <TabsContent value="generator" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-slate-300 text-sm">Nazwa konkursu</Label>
                  <Input
                    value={contestName}
                    onChange={e => setContestName(e.target.value)}
                    placeholder="np. Konkurs Wiedzy Matematycznej 2026"
                    className="mt-1 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Data konkursu</Label>
                  <Input
                    type="date"
                    value={contestDate}
                    onChange={e => setContestDate(e.target.value)}
                    className="mt-1 bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Grupa wiekowa</Label>
                  <Select value={ageGroup} onValueChange={setAgeGroup}>
                    <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {Object.entries(AGE_GROUP_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-slate-300 text-sm">Dodaj pytanie</Label>
                <Textarea
                  value={newQuestion.text}
                  onChange={e => setNewQuestion(p => ({ ...p, text: e.target.value }))}
                  placeholder="Treść pytania..."
                  className="bg-slate-800 border-slate-700 text-white resize-none"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  {["A", "B", "C", "D"].map((letter, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-5 ${newQuestion.correctIndex === i ? "text-green-400" : "text-slate-400"}`}>
                        {letter}
                      </span>
                      <Input
                        value={newQuestion.options[i]}
                        onChange={e => setNewQuestion(p => {
                          const opts = [...p.options];
                          opts[i] = e.target.value;
                          return { ...p, options: opts };
                        })}
                        placeholder={`Odpowiedź ${letter}`}
                        className="bg-slate-700 border-slate-600 text-white text-xs"
                      />
                      <button
                        onClick={() => setNewQuestion(p => ({ ...p, correctIndex: i }))}
                        className={`text-xs px-2 py-1 rounded ${newQuestion.correctIndex === i ? "bg-green-600 text-white" : "bg-slate-700 text-slate-400"}`}
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                </div>
                <Button onClick={addQuestion} variant="outline" size="sm" className="w-full">
                  + Dodaj pytanie
                </Button>
              </div>
            </div>

            {/* Lista pytań */}
            {questions.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Pytania ({questions.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 bg-slate-700/50 rounded text-sm">
                      <span className="text-slate-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                      <div className="flex-1">
                        <p className="text-white text-xs">{q.text}</p>
                        <div className="flex gap-3 mt-1">
                          {q.options.map((opt, j) => (
                            <span key={j} className={`text-xs ${j === q.correctIndex ? "text-green-400 font-semibold" : "text-slate-400"}`}>
                              {["A", "B", "C", "D"][j]}: {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setQuestions(p => p.filter((_, j) => j !== i))} className="text-red-400 text-xs">✕</button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleCreateContest}
                disabled={createContest.isPending || questions.length === 0}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                <Package className="w-4 h-4" />
                {createContest.isPending ? "Tworzę..." : "Utwórz konkurs offline"}
              </Button>
              {offlineContests && offlineContests.length > 0 && (
                <Button
                  onClick={() => generatePdf.mutate({
                    offlineContestId: offlineContests[0].id,
                    ageGroup,
                    questions: questions.map((q, i) => ({ id: i + 1, text: q.text, options: q.options })),
                  })}
                  disabled={generatePdf.isPending || questions.length === 0}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {generatePdf.isPending ? "Generuję..." : "Drukuj arkusze (30 kopii)"}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* ─── OCR / Skanowanie ─── */}
          <TabsContent value="ocr" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Automatyczne odczytywanie odpowiedzi (OCR + AI)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-400 text-sm">
                  Wgraj zdjęcie lub skan wypełnionego arkusza — AI automatycznie odczyta zaznaczone odpowiedzi,
                  dopasuje do uczestnika i obliczy wynik.
                </p>

                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-sm">URL zdjęcia/skanu (lub link do Drive/Dropbox)</Label>
                    <Input
                      value={ocrImageUrl}
                      onChange={e => setOcrImageUrl(e.target.value)}
                      placeholder="https://drive.google.com/... lub https://dropbox.com/..."
                      className="mt-1 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Konkurs offline</Label>
                    <Select value={String(ocrContestId ?? "")} onValueChange={v => setOcrContestId(Number(v))}>
                      <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Wybierz konkurs..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {offlineContests?.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => {
                      if (!ocrImageUrl || !ocrContestId) { toast.error("Podaj URL i wybierz konkurs"); return; }
                      // runOcr wymaga submissionId i sheetId — tu używamy submitScan najpierw
                      toast.info("Aby użyć OCR, najpierw wgraj skan przez 'Wgraj skan' w zakładce konkursów");
                    }}
                    disabled={processOcr.isPending}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    <Brain className="w-4 h-4" />
                    {processOcr.isPending ? "Przetwarzam OCR..." : "Odczytaj arkusz"}
                  </Button>
                </div>

                {processOcr.data && (
                  <Card className="bg-green-500/10 border-green-500/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="font-semibold text-green-400">OCR zakończony</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-white">{processOcr.data.correct}</div>
                          <div className="text-xs text-slate-400">Poprawne</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-white">{processOcr.data.total}</div>
                          <div className="text-xs text-slate-400">Pytań</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-400">{processOcr.data.scorePercent}%</div>
                          <div className="text-xs text-slate-400">Wynik</div>
                        </div>
                      </div>
                      {processOcr.data.needsManualReview && (
                        <div className="mt-3 flex items-center gap-2 text-yellow-400 text-xs">
                          <AlertCircle className="w-4 h-4" />
                          Wymagana ręczna weryfikacja — niski poziom pewności OCR
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Lista konkursów offline ─── */}
          <TabsContent value="contests" className="space-y-3">
            {!offlineContests || offlineContests.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-12 text-center">
                  <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Brak konkursów offline.</p>
                  <p className="text-slate-500 text-sm mt-2">Utwórz pierwszy konkurs w zakładce "Generator arkuszy".</p>
                </CardContent>
              </Card>
            ) : (
              offlineContests.map(contest => (
                <Card key={contest.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-white">{contest.name}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                            {contest.edition ?? "—"}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {contest.contestDate ? new Date(contest.contestDate).toLocaleDateString("pl-PL") : "Brak daty"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {contest.questionsCount ?? 0} pytań
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generatePdf.mutate({ offlineContestId: contest.id, ageGroup, questions: [] })}
                          className="gap-1 text-xs"
                        >
                          <Printer className="w-3 h-3" />
                          Drukuj
                        </Button>
                        <Badge className={
                          contest.status === "completed" ? "bg-green-500/20 text-green-400" :
                          contest.status === "active" ? "bg-blue-500/20 text-blue-400" :
                          "bg-slate-500/20 text-slate-400"
                        }>
                          {contest.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
