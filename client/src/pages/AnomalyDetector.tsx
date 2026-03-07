import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, XCircle, Shield, Eye, Clock, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  recording_interrupted: "Przerwanie nagrania",
  server_timeout: "Timeout serwera",
  ajax_error: "Błąd AJAX",
  connection_lost: "Utrata połączenia",
  quiz_not_saved: "Wyniki niezapisane",
  session_expired: "Wygaśnięcie sesji",
  plugin_crash: "Crash pluginu AYS",
  black_swan: "Czarny łabędź",
  other: "Inne",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  detected: { label: "Wykryto", color: "text-yellow-400", icon: <AlertTriangle className="w-4 h-4" /> },
  under_review: { label: "W przeglądzie", color: "text-blue-400", icon: <Eye className="w-4 h-4" /> },
  approved: { label: "Zatwierdzona", color: "text-green-400", icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: "Odrzucona", color: "text-red-400", icon: <XCircle className="w-4 h-4" /> },
  retry_used: { label: "Retry użyty", color: "text-purple-400", icon: <RefreshCw className="w-4 h-4" /> },
};

export default function AnomalyDetector() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [decisionDialog, setDecisionDialog] = useState<{ open: boolean; caseId: number; decision: "approved" | "rejected" } | null>(null);
  const [adminDecision, setAdminDecision] = useState("");
  const [reportForm, setReportForm] = useState({ open: false, email: "", name: "", type: "ajax_error", error: "", logs: "" });

  const cases = trpc.anomaly.list.useQuery({ status: statusFilter as any, search: search || undefined });
  const stats = trpc.anomaly.stats.useQuery();
  const patterns = trpc.anomaly.listPatterns.useQuery();
  const caseDetail = trpc.anomaly.get.useQuery({ id: selectedCase?.id ?? 0 }, { enabled: !!selectedCase });

  const decide = trpc.anomaly.decide.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDecisionDialog(null);
      setAdminDecision("");
      cases.refetch();
      stats.refetch();
      if (data.retryToken) {
        navigator.clipboard.writeText(data.retryToken);
        toast.info("Token skopiowany do schowka");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const reportAnomaly = trpc.anomaly.report.useMutation({
    onSuccess: (data) => {
      toast.success(`Anomalia zgłoszona. Wiarygodność: ${data.credibilityScore}/100${data.isSuspicious ? " ⚠️ PODEJRZANE" : ""}`);
      setReportForm({ open: false, email: "", name: "", type: "ajax_error", error: "", logs: "" });
      cases.refetch();
      stats.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const credibilityColor = (score: number | null | undefined) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-blue-400" /> Detektor Anomalii Technicznych
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Protokół drugiej szansy — tylko dla naprawdę pokrzywdzonych uczestników
            </p>
          </div>
          <Button size="sm" onClick={() => setReportForm({ ...reportForm, open: true })}>
            <AlertTriangle className="w-4 h-4 mr-1" /> Zgłoś anomalię
          </Button>
        </div>

        {/* Statystyki */}
        {stats.data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Wszystkie", value: stats.data.total, icon: <Zap className="w-4 h-4" />, color: "text-foreground" },
              { label: "Oczekujące", value: stats.data.pending, icon: <Clock className="w-4 h-4" />, color: "text-yellow-400" },
              { label: "Zatwierdzone", value: stats.data.approved, icon: <CheckCircle className="w-4 h-4" />, color: "text-green-400" },
              { label: "Odrzucone", value: stats.data.rejected, icon: <XCircle className="w-4 h-4" />, color: "text-red-400" },
              { label: "Podejrzane", value: stats.data.suspicious, icon: <AlertTriangle className="w-4 h-4" />, color: "text-orange-400" },
            ].map(s => (
              <Card key={s.label} className="text-center">
                <CardContent className="pt-4 pb-3">
                  <div className={`flex items-center justify-center gap-1 ${s.color} mb-1`}>{s.icon}</div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs defaultValue="cases">
          <TabsList>
            <TabsTrigger value="cases">Przypadki</TabsTrigger>
            <TabsTrigger value="patterns">Wzorce anomalii</TabsTrigger>
          </TabsList>

          <TabsContent value="cases">
            {/* Filtry */}
            <div className="flex gap-3 mb-4">
              <Input
                placeholder="Szukaj po emailu lub nazwie..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie statusy</SelectItem>
                  <SelectItem value="detected">Wykryte</SelectItem>
                  <SelectItem value="under_review">W przeglądzie</SelectItem>
                  <SelectItem value="approved">Zatwierdzone</SelectItem>
                  <SelectItem value="rejected">Odrzucone</SelectItem>
                  <SelectItem value="retry_used">Retry użyty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {cases.data?.map(c => {
                const statusCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.detected;
                return (
                  <Card
                    key={c.id}
                    className={`cursor-pointer hover:border-primary/50 transition-colors ${c.isSuspiciousBehavior ? "border-orange-500/50" : ""}`}
                    onClick={() => setSelectedCase(c)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <div className={`mt-0.5 ${statusCfg.color}`}>{statusCfg.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{c.participantEmail}</span>
                            {c.participantName && <span className="text-muted-foreground text-sm">({c.participantName})</span>}
                            {c.isSuspiciousBehavior && (
                              <Badge variant="outline" className="text-orange-400 border-orange-400 text-xs">⚠️ Podejrzane</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                            <span>{ANOMALY_TYPE_LABELS[c.anomalyType] ?? c.anomalyType}</span>
                            {c.contestEdition && <span>· Edycja: {c.contestEdition}</span>}
                            <span>· {new Date(c.createdAt).toLocaleString("pl-PL")}</span>
                          </div>
                          {c.credibilityReason && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.credibilityReason}</div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-lg font-bold ${credibilityColor(c.credibilityScore)}`}>
                            {c.credibilityScore?.toFixed(0) ?? "?"}%
                          </div>
                          <div className="text-xs text-muted-foreground">wiarygodność</div>
                          <div className={`text-xs mt-1 ${statusCfg.color}`}>{statusCfg.label}</div>
                        </div>
                      </div>

                      {/* Przyciski akcji dla oczekujących */}
                      {(c.status === "detected" || c.status === "under_review") && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" className="text-green-400 border-green-400/50 hover:bg-green-400/10"
                            onClick={() => setDecisionDialog({ open: true, caseId: c.id, decision: "approved" })}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Zatwierdź drugą szansę
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                            onClick={() => setDecisionDialog({ open: true, caseId: c.id, decision: "rejected" })}>
                            <XCircle className="w-3 h-3 mr-1" /> Odrzuć
                          </Button>
                        </div>
                      )}

                      {/* Token retry */}
                      {c.status === "approved" && c.retryToken && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="text-xs text-muted-foreground mb-1">Token drugiej szansy:</div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted/30 px-2 py-1 rounded font-mono">{c.retryToken}</code>
                            <Button size="sm" variant="ghost" className="h-6 text-xs"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.retryToken!); toast.success("Skopiowano"); }}>
                              Kopiuj
                            </Button>
                            {c.retryTokenExpiresAt && (
                              <span className="text-xs text-muted-foreground">
                                Ważny do: {new Date(c.retryTokenExpiresAt).toLocaleString("pl-PL")}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {cases.data?.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Brak wykrytych anomalii</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Wzorce anomalii */}
          <TabsContent value="patterns">
            <div className="space-y-3">
              {patterns.data?.map((p: any, i: number) => (
                <Card key={i} className={p.isBlackSwan ? "border-purple-500/50" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className={p.isBlackSwan ? "text-purple-400" : "text-blue-400"}>
                        {p.isBlackSwan ? <Zap className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          {p.name}
                          {p.isBlackSwan && <Badge variant="outline" className="text-purple-400 border-purple-400 text-xs">Czarny łabędź</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{p.description}</div>
                        {p.signals && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {p.signals.map((s: string, j: number) => (
                              <code key={j} className="text-xs bg-muted/30 px-1.5 py-0.5 rounded">{s}</code>
                            ))}
                          </div>
                        )}
                        {p.discoveredInSimulation && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Odkryto w: {p.discoveredInSimulation}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary">{ANOMALY_TYPE_LABELS[p.anomalyType] ?? p.anomalyType}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog decyzji */}
        {decisionDialog && (
          <Dialog open={decisionDialog.open} onOpenChange={() => setDecisionDialog(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className={decisionDialog.decision === "approved" ? "text-green-400" : "text-red-400"}>
                  {decisionDialog.decision === "approved" ? "✅ Zatwierdź drugą szansę" : "❌ Odrzuć wniosek"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {decisionDialog.decision === "approved"
                    ? "Uczestnik otrzyma jednorazowy token do ponownego rozwiązania quizu (ważny 48h). Ta decyzja jest nieodwracalna."
                    : "Wniosek zostanie odrzucony. Uczestnik nie otrzyma drugiej szansy."}
                </p>
                <div>
                  <label className="text-sm font-medium mb-1 block">Uzasadnienie decyzji *</label>
                  <Textarea
                    placeholder="Opisz podstawę decyzji (minimum 10 znaków)..."
                    value={adminDecision}
                    onChange={e => setAdminDecision(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDecisionDialog(null)}>Anuluj</Button>
                <Button
                  variant={decisionDialog.decision === "approved" ? "default" : "destructive"}
                  disabled={adminDecision.length < 10 || decide.isPending}
                  onClick={() => decide.mutate({ caseId: decisionDialog.caseId, decision: decisionDialog.decision, adminDecision })}
                >
                  {decide.isPending ? "Zapisuję..." : decisionDialog.decision === "approved" ? "Zatwierdź i wyślij token" : "Odrzuć"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Dialog zgłoszenia anomalii */}
        <Dialog open={reportForm.open} onOpenChange={(o) => setReportForm({ ...reportForm, open: o })}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Zgłoś anomalię techniczną</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email uczestnika *</label>
                  <Input value={reportForm.email} onChange={e => setReportForm({ ...reportForm, email: e.target.value })} placeholder="uczestnik@email.pl" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Imię i nazwisko</label>
                  <Input value={reportForm.name} onChange={e => setReportForm({ ...reportForm, name: e.target.value })} placeholder="Jan Kowalski" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Typ anomalii *</label>
                <Select value={reportForm.type} onValueChange={v => setReportForm({ ...reportForm, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANOMALY_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Komunikat błędu</label>
                <Input value={reportForm.error} onChange={e => setReportForm({ ...reportForm, error: e.target.value })} placeholder="np. 504 Gateway Timeout" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Logi serwera (opcjonalnie)</label>
                <Textarea value={reportForm.logs} onChange={e => setReportForm({ ...reportForm, logs: e.target.value })} rows={3} placeholder="Wklej fragmenty logów..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportForm({ ...reportForm, open: false })}>Anuluj</Button>
              <Button
                disabled={!reportForm.email || reportAnomaly.isPending}
                onClick={() => reportAnomaly.mutate({
                  participantEmail: reportForm.email,
                  participantName: reportForm.name || undefined,
                  anomalyType: reportForm.type as any,
                  errorMessage: reportForm.error || undefined,
                  serverLogEvidence: reportForm.logs || undefined,
                })}
              >
                {reportAnomaly.isPending ? "Analizuję..." : "Zgłoś i oceń AI"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
