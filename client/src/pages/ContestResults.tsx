import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Star, Upload, Download, RefreshCw, FileText, Users, BarChart2 } from "lucide-react";
import { toast } from "sonner";

export default function ContestResults() {
  const [selectedEdition, setSelectedEdition] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [winnersOnly, setWinnersOnly] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvEdition, setCsvEdition] = useState("");
  const [csvName, setCsvName] = useState("");
  const [reportText, setReportText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const editions = trpc.results.listEditions.useQuery();
  const results = trpc.results.getByEdition.useQuery(
    { edition: selectedEdition, ageGroup: filterCategory === "all" ? undefined : filterCategory, winnersOnly },
    { enabled: !!selectedEdition }
  );
  const shippingBatches = trpc.results.getShippingBatches.useQuery(
    { edition: selectedEdition },
    { enabled: !!selectedEdition }
  );

  const computeRankings = trpc.results.computeRankings.useMutation({
    onSuccess: (data) => {
      toast.success(`Obliczono rankingi dla ${data.categories.length} kategorii`);
      results.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const optimizeShipping = trpc.results.optimizeShipping.useMutation({
    onSuccess: (data) => {
      toast.success(`Przygotowano ${data.totalBatches} paczek dla ${data.totalRecipients} uczestników`);
      shippingBatches.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const importCsv = trpc.results.importCsv.useMutation({
    onSuccess: (data) => {
      toast.success(`Zaimportowano ${data.imported} wyników (błędy: ${data.errors})`);
      editions.refetch();
      setCsvText("");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateReport = trpc.results.generateFinalReport.useMutation({
    onSuccess: (data) => {
      setReportText(String(data.report));
      toast.success("Raport finalny wygenerowany");
    },
    onError: (e) => toast.error(e.message),
  });

  const exportShippingCsv = trpc.results.exportShippingCsv.useQuery(
    { edition: selectedEdition },
    { enabled: false }
  );

  const updateBatchStatus = trpc.results.updateBatchStatus.useMutation({
    onSuccess: () => { shippingBatches.refetch(); toast.success("Status zaktualizowany"); },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string);
    reader.readAsText(file, "UTF-8");
  };

  const categories = results.data
    ? Array.from(new Set(results.data.map(r => r.ageGroup ?? "ogólna")))
    : [];

  const winners = results.data?.filter(r => r.isWinner) ?? [];
  const laureates = results.data?.filter(r => r.isLaureate && !r.isWinner) ?? [];
  const all = results.data ?? [];

  const rankBadge = (rank: number | null | undefined) => {
    if (rank === 1) return <span className="text-yellow-400 text-xl">🥇</span>;
    if (rank === 2) return <span className="text-gray-300 text-xl">🥈</span>;
    if (rank === 3) return <span className="text-amber-600 text-xl">🥉</span>;
    return <span className="text-muted-foreground text-sm">#{rank}</span>;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="text-yellow-400" /> Wyniki Finalne Konkursu
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Ranking, laureaci, zwycięzcy i optymalizacja wysyłki nagród
            </p>
          </div>
        </div>

        {/* Wybór edycji */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Edycja konkursu</label>
                <Select value={selectedEdition} onValueChange={setSelectedEdition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz edycję..." />
                  </SelectTrigger>
                  <SelectContent>
                    {editions.data?.map(e => (
                      <SelectItem key={e.edition ?? ""} value={e.edition ?? ""}>{e.name} — {e.edition}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedEdition && (
                <>
                  <Button variant="outline" size="sm" onClick={() => computeRankings.mutate({ edition: selectedEdition })} disabled={computeRankings.isPending}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${computeRankings.isPending ? "animate-spin" : ""}`} />
                    Oblicz rankingi
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => optimizeShipping.mutate({ edition: selectedEdition })} disabled={optimizeShipping.isPending}>
                    <Users className="w-4 h-4 mr-1" />
                    Optymalizuj wysyłkę
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => generateReport.mutate({ edition: selectedEdition, contestName: editions.data?.find(e => e.edition === selectedEdition)?.name ?? "" })} disabled={generateReport.isPending}>
                    <FileText className="w-4 h-4 mr-1" />
                    Raport AI
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedEdition && (
          <Tabs defaultValue="winners">
            <TabsList>
              <TabsTrigger value="winners">
                <Trophy className="w-4 h-4 mr-1" /> Zwycięzcy ({winners.length})
              </TabsTrigger>
              <TabsTrigger value="laureates">
                <Star className="w-4 h-4 mr-1" /> Laureaci ({laureates.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                <BarChart2 className="w-4 h-4 mr-1" /> Wszyscy ({all.length})
              </TabsTrigger>
              <TabsTrigger value="shipping">
                <Medal className="w-4 h-4 mr-1" /> Wysyłka ({shippingBatches.data?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="import">
                <Upload className="w-4 h-4 mr-1" /> Import
              </TabsTrigger>
              {reportText && <TabsTrigger value="report"><FileText className="w-4 h-4 mr-1" /> Raport</TabsTrigger>}
            </TabsList>

            {/* Zwycięzcy */}
            <TabsContent value="winners">
              <div className="space-y-4">
                {categories.map(cat => {
                  const catWinners = winners.filter(r => (r.ageGroup ?? "ogólna") === cat);
                  if (!catWinners.length) return null;
                  return (
                    <Card key={cat}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Kategoria: {cat}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {catWinners.map(r => (
                            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                              <div className="w-10 text-center">{rankBadge(r.rank)}</div>
                              <div className="flex-1">
                                <div className="font-medium">{r.participantName}</div>
                                <div className="text-xs text-muted-foreground">{r.participantEmail}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-400">{r.score?.toFixed(1)}%</div>
                                {r.completionTimeMs && (
                                  <div className="text-xs text-muted-foreground">
                                    {Math.round(r.completionTimeMs / 1000)}s
                                  </div>
                                )}
                              </div>
                              <Badge variant={r.isLaureate ? "default" : "secondary"}>
                                {r.isLaureate ? "Laureat" : "Zwycięzca"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {winners.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    Brak zwycięzców — najpierw oblicz rankingi
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Laureaci */}
            <TabsContent value="laureates">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Star className="text-yellow-400 w-5 h-5" />
                    Laureaci (≥90% poprawnych odpowiedzi)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {laureates.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">Brak laureatów</div>
                  ) : (
                    <div className="space-y-2">
                      {laureates.map(r => (
                        <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                          <Star className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-medium">{r.participantName}</div>
                            <div className="text-xs text-muted-foreground">{r.participantEmail} · {r.ageGroup}</div>
                          </div>
                          <div className="font-bold text-green-400">{r.score?.toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">
                            {r.correctAnswers}/{r.totalQuestions} pyt.
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wszyscy */}
            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie kategorie</SelectItem>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={winnersOnly} onChange={e => setWinnersOnly(e.target.checked)} />
                      Tylko zwycięzcy i laureaci
                    </label>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {all.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/20 text-sm">
                        <div className="w-8 text-center">{rankBadge(r.rank)}</div>
                        <div className="flex-1 truncate">
                          <span className="font-medium">{r.participantName}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{r.ageGroup}</span>
                        </div>
                        <div className="font-mono text-green-400">{r.score?.toFixed(1)}%</div>
                        {r.isWinner && <Badge variant="default" className="text-xs">Zwycięzca</Badge>}
                        {r.isLaureate && !r.isWinner && <Badge variant="secondary" className="text-xs">Laureat</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wysyłka */}
            <TabsContent value="shipping">
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={async () => {
                    const result = await exportShippingCsv.refetch();
                    if (result.data) {
                      const blob = new Blob([result.data], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `wysylka-${selectedEdition}.csv`; a.click();
                    }
                  }}>
                    <Download className="w-4 h-4 mr-1" /> Eksportuj CSV adresów
                  </Button>
                </div>
                {shippingBatches.data?.map(batch => (
                  <Card key={batch.id} className={batch.hasNewAwardNeeded ? "border-yellow-500/50" : ""}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-semibold flex items-center gap-2">
                            {batch.schoolName}
                            {batch.hasNewAwardNeeded && (
                              <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs">
                                ⚠️ Nowa nagroda
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                            {batch.shippingAddress}
                          </div>
                          {batch.teacherEmail && (
                            <div className="text-xs text-muted-foreground">✉️ {batch.teacherEmail}</div>
                          )}
                          {batch.notes && (
                            <div className="text-xs text-yellow-400 mt-1">{batch.notes}</div>
                          )}
                        </div>
                        <div className="text-right space-y-2">
                          <div className="text-lg font-bold">{batch.recipientCount} os.</div>
                          <Select
                            value={batch.status ?? "draft"}
                            onValueChange={(v) => updateBatchStatus.mutate({ batchId: batch.id, status: v as any })}
                          >
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Szkic</SelectItem>
                              <SelectItem value="ready">Gotowa</SelectItem>
                              <SelectItem value="shipped">Wysłana</SelectItem>
                              <SelectItem value="delivered">Dostarczona</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!shippingBatches.data || shippingBatches.data.length === 0) && (
                  <div className="text-center text-muted-foreground py-12">
                    Brak paczek — kliknij "Optymalizuj wysyłkę" aby wygenerować
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Import CSV */}
            <TabsContent value="import">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Import wyników z CSV</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Nazwa konkursu</label>
                      <Input placeholder="np. Konkurs Matematyczny" value={csvName} onChange={e => setCsvName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Edycja</label>
                      <Input placeholder="np. 2026-wiosna" value={csvEdition} onChange={e => setCsvEdition(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Plik CSV (kolumny: name, email, score, age_group, correct, total, time_ms)
                    </label>
                    <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1" /> Wczytaj plik CSV
                    </Button>
                  </div>
                  {csvText && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Podgląd (pierwsze 3 linie):</div>
                      <pre className="text-xs bg-muted/30 p-2 rounded overflow-x-auto">
                        {csvText.split("\n").slice(0, 3).join("\n")}
                      </pre>
                      <Button className="mt-2" size="sm" disabled={!csvName || !csvEdition || importCsv.isPending}
                        onClick={() => importCsv.mutate({ contestName: csvName, contestEdition: csvEdition, csvData: csvText })}>
                        {importCsv.isPending ? "Importuję..." : "Importuj wyniki"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Raport AI */}
            {reportText && (
              <TabsContent value="report">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-5 h-5" /> Raport Finalny — {selectedEdition}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">{reportText}</div>
                    <Button className="mt-4" variant="outline" size="sm" onClick={() => {
                      const blob = new Blob([reportText], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `raport-${selectedEdition}.txt`; a.click();
                    }}>
                      <Download className="w-4 h-4 mr-1" /> Pobierz raport
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        )}

        {!selectedEdition && (
          <div className="text-center text-muted-foreground py-16">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Wybierz edycję konkursu lub zaimportuj wyniki z CSV</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
