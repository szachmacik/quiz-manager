import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  Clock,
  Eye,
  FileVideo,
  Link,
  Plus,
  RefreshCw,
  Search,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const VERDICT_CONFIG = {
  independent: {
    label: "Samodzielnie",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle,
    bg: "border-l-4 border-l-green-500",
  },
  suspicious: {
    label: "Wątpliwe",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: AlertTriangle,
    bg: "border-l-4 border-l-yellow-500",
  },
  intervention: {
    label: "Interwencja",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: XCircle,
    bg: "border-l-4 border-l-red-500",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  dropbox: "Dropbox",
  google_drive: "Google Drive",
  direct_url: "Link bezpośredni",
  email_attachment: "Załącznik email",
};

const ANOMALY_LABELS: Record<string, string> = {
  technical_help: "Pomoc techniczna",
  verbal_hint: "Podpowiedź słowna",
  pointing: "Wskazywanie na ekran",
  external_person: "Obca osoba",
  pause: "Długa przerwa",
  looking_away: "Patrzenie w bok",
  reading_notes: "Czytanie notatek",
  copy_paste: "Copy-paste",
  tab_switch: "Przełączenie zakładki",
  fast_answers: "Zbyt szybkie odpowiedzi",
  unnatural_mouse: "Nienaturalne ruchy myszy",
  long_pause: "Długa przerwa",
  other: "Inne",
};

function VerificationCard({ v, onRefetch }: { v: any; onRefetch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(v.reviewerNotes ?? "");
  const [overrideVerdict, setOverrideVerdict] = useState<string>("");

  const verdict = v.verdict ? VERDICT_CONFIG[v.verdict as keyof typeof VERDICT_CONFIG] : null;
  const VerdictIcon = verdict?.icon ?? Clock;
  const anomalies = (v.anomalies as any[]) || [];

  const addNotes = trpc.videoVerification.addNotes.useMutation({
    onSuccess: () => { toast.success("Notatki zapisane"); onRefetch(); },
  });
  const override = trpc.videoVerification.overrideVerdict.useMutation({
    onSuccess: () => { toast.success("Werdykt zmieniony"); onRefetch(); },
  });
  const reanalyze = trpc.videoVerification.reanalyze.useMutation({
    onSuccess: () => { toast.success("Ponowna analiza uruchomiona"); onRefetch(); },
  });

  return (
    <Card className={`bg-slate-800/50 border-slate-700 ${verdict?.bg ?? ""}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <User className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-white">{v.participantName ?? "Nieznany"}</span>
              {v.participantEmail && <span className="text-xs text-slate-400">{v.participantEmail}</span>}
              {verdict && (
                <Badge className={`${verdict.color} text-xs`}>
                  <VerdictIcon className="w-3 h-3 mr-1" />{verdict.label}
                </Badge>
              )}
              {(v.status === "pending" || v.status === "processing") && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Analizuję...
                </Badge>
              )}
              <Badge className="bg-slate-700 text-slate-300 text-xs">{SOURCE_LABELS[v.videoSource] ?? v.videoSource}</Badge>
            </div>

            {v.summary && <p className="text-sm text-slate-300 mt-1">{v.summary}</p>}

            <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
              {v.confidenceScore !== null && <span>Pewność: {v.confidenceScore}%</span>}
              {v.overallScore !== null && <span>Wynik: {v.overallScore}/100</span>}
              {anomalies.length > 0 && <span>{anomalies.length} anomalii</span>}
              <span>{new Date(v.createdAt).toLocaleString("pl")}</span>
            </div>
          </div>

          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white"
              onClick={() => setExpanded(!expanded)}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white"
              onClick={() => reanalyze.mutate({ id: v.id })}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <a href={v.videoUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <Link className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-4 border-t border-slate-700 pt-4">
            {/* Anomalies */}
            {anomalies.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Wykryte anomalie</h4>
                <div className="space-y-2">
                  {anomalies.map((a: any, i: number) => (
                    <div key={i} className={`rounded-lg p-2 text-sm flex items-start gap-2 ${
                      a.severity === "high" ? "bg-red-500/10 text-red-300" :
                      a.severity === "medium" ? "bg-yellow-500/10 text-yellow-300" :
                      "bg-slate-700/50 text-slate-300"
                    }`}>
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">{ANOMALY_LABELS[a.type] ?? a.type}</span>
                        {a.timestampSec > 0 && <span className="text-xs opacity-70 ml-2">@{a.timestampSec}s</span>}
                        {a.isMeritIntervention !== undefined && (
                          <Badge className={`ml-2 text-xs ${a.isMeritIntervention ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-slate-400"}`}>
                            {a.isMeritIntervention ? "Merytoryczna" : "Techniczna"}
                          </Badge>
                        )}
                        <p className="text-xs opacity-80 mt-0.5">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Positive indicators */}
            {v.aiAnalysis?.positiveIndicators?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Pozytywne wskaźniki</h4>
                <div className="space-y-1">
                  {v.aiAnalysis.positiveIndicators.map((p: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-green-300">
                      <CheckCircle className="w-3 h-3 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual override */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase">Ręczna korekta werdyktu</h4>
              <div className="flex gap-2">
                <Select value={overrideVerdict} onValueChange={setOverrideVerdict}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 flex-1">
                    <SelectValue placeholder="Zmień werdykt..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="independent">✅ Samodzielnie</SelectItem>
                    <SelectItem value="suspicious">⚠️ Wątpliwe</SelectItem>
                    <SelectItem value="intervention">🚨 Interwencja</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700"
                  disabled={!overrideVerdict || !notes || override.isPending}
                  onClick={() => override.mutate({ id: v.id, verdict: overrideVerdict as any, notes })}>
                  Zatwierdź
                </Button>
              </div>
              <Textarea className="bg-slate-700 border-slate-600 text-sm h-16"
                placeholder="Uzasadnienie korekty (wymagane)..."
                value={notes} onChange={e => setNotes(e.target.value)} />
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300"
                onClick={() => addNotes.mutate({ id: v.id, notes })}>
                Zapisz notatki
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubmitVideoDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    participantName: "", participantEmail: "", videoUrl: "",
    videoSource: "direct_url" as const, connectionId: "", snapshotId: "",
  });

  const { data: connections } = trpc.connections.list.useQuery();
  const submit = trpc.videoVerification.submit.useMutation({
    onSuccess: () => { toast.success("Nagranie przyjęte do weryfikacji"); setOpen(false); onCreated(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Upload className="w-4 h-4 mr-2" /> Dodaj nagranie
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Dodaj nagranie do weryfikacji</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Imię i nazwisko uczestnika</Label>
              <Input className="bg-slate-800 border-slate-600 mt-1"
                value={form.participantName} onChange={e => setForm(f => ({ ...f, participantName: e.target.value }))} />
            </div>
            <div>
              <Label>Email uczestnika</Label>
              <Input type="email" className="bg-slate-800 border-slate-600 mt-1"
                value={form.participantEmail} onChange={e => setForm(f => ({ ...f, participantEmail: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Link do nagrania</Label>
            <Input className="bg-slate-800 border-slate-600 mt-1 font-mono text-sm"
              placeholder="https://dropbox.com/... lub https://drive.google.com/..."
              value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} />
          </div>
          <div>
            <Label>Źródło nagrania</Label>
            <Select value={form.videoSource} onValueChange={v => setForm(f => ({ ...f, videoSource: v as any }))}>
              <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="dropbox">Dropbox</SelectItem>
                <SelectItem value="google_drive">Google Drive</SelectItem>
                <SelectItem value="direct_url">Link bezpośredni</SelectItem>
                <SelectItem value="email_attachment">Załącznik email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Połączenie WP (opcjonalnie)</Label>
              <Select value={form.connectionId} onValueChange={v => setForm(f => ({ ...f, connectionId: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                  <SelectValue placeholder="Wybierz..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="none">Brak</SelectItem>
                  {connections?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={!form.participantName || !form.videoUrl || submit.isPending}
            onClick={() => submit.mutate({
              participantName: form.participantName,
              participantEmail: form.participantEmail || undefined,
              videoUrl: form.videoUrl,
              videoSource: form.videoSource,
              connectionId: form.connectionId && form.connectionId !== "none" ? Number(form.connectionId) : undefined,
            })}>
            {submit.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Wyślij do analizy AI
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function VideoVerifier() {
  const [tab, setTab] = useState<"videos" | "telemetry">("videos");
  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] = useState("all");

  const { data: verifications, refetch } = trpc.videoVerification.list.useQuery({});
  const { data: stats } = trpc.videoVerification.stats.useQuery();
  const { data: telemetrySessions } = trpc.videoVerification.telemetry.listSessions.useQuery({ limit: 50 });
  const { data: telemetryStats } = trpc.videoVerification.telemetry.stats.useQuery();

  const filtered = (verifications ?? []).filter(v => {
    const matchSearch = !search || v.participantName?.toLowerCase().includes(search.toLowerCase()) ||
      v.participantEmail?.toLowerCase().includes(search.toLowerCase());
    const matchVerdict = verdictFilter === "all" || v.verdict === verdictFilter;
    return matchSearch && matchVerdict;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Weryfikator Nagrań</h1>
            <p className="text-slate-400 text-sm mt-1">
              Weryfikacja samodzielności uczestników — nagrania wideo i telemetria behawioralna
            </p>
          </div>
          <SubmitVideoDialog onCreated={refetch} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Łącznie nagrań", value: stats?.total ?? 0, color: "text-white" },
            { label: "Samodzielnie", value: stats?.independent ?? 0, color: "text-green-400" },
            { label: "Wątpliwe", value: stats?.suspicious ?? 0, color: "text-yellow-400" },
            { label: "Interwencja", value: stats?.intervention ?? 0, color: "text-red-400" },
          ].map(s => (
            <Card key={s.label} className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
          <button onClick={() => setTab("videos")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "videos" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>
            <FileVideo className="w-4 h-4 inline mr-2" />Nagrania ({stats?.total ?? 0})
          </button>
          <button onClick={() => setTab("telemetry")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "telemetry" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>
            <Camera className="w-4 h-4 inline mr-2" />Telemetria ({telemetryStats?.total ?? 0})
          </button>
        </div>

        {/* Videos Tab */}
        {tab === "videos" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input className="bg-slate-800 border-slate-600 pl-9"
                  placeholder="Szukaj uczestnika..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={verdictFilter} onValueChange={setVerdictFilter}>
                <SelectTrigger className="bg-slate-800 border-slate-600 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all">Wszystkie werdykty</SelectItem>
                  <SelectItem value="independent">✅ Samodzielnie</SelectItem>
                  <SelectItem value="suspicious">⚠️ Wątpliwe</SelectItem>
                  <SelectItem value="intervention">🚨 Interwencja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Public submission link */}
            <Card className="bg-violet-900/20 border-violet-700/50">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <Link className="w-4 h-4 text-violet-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-violet-300 font-medium">Link dla uczestników do przesyłania nagrań</p>
                    <code className="text-xs text-violet-400 break-all">{window.location.origin}/submit-video</code>
                  </div>
                  <Button size="sm" variant="outline" className="border-violet-600 text-violet-300 shrink-0"
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/submit-video`); toast.success("Skopiowano!"); }}>
                    Kopiuj
                  </Button>
                </div>
              </CardContent>
            </Card>

            {!filtered.length ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center text-slate-500">
                  <FileVideo className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Brak nagrań. Dodaj nagranie lub udostępnij link uczestnikom.</p>
                </CardContent>
              </Card>
            ) : (
              filtered.map(v => <VerificationCard key={v.id} v={v} onRefetch={refetch} />)
            )}
          </div>
        )}

        {/* Telemetry Tab */}
        {tab === "telemetry" && (
          <div className="space-y-4">
            {/* Telemetry stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Normalne", value: telemetryStats?.normal ?? 0, color: "text-green-400" },
                { label: "Podejrzane", value: telemetryStats?.suspicious ?? 0, color: "text-yellow-400" },
                { label: "Anomalie", value: telemetryStats?.anomaly ?? 0, color: "text-red-400" },
                { label: "Aktywne", value: telemetryStats?.active ?? 0, color: "text-blue-400" },
              ].map(s => (
                <Card key={s.label} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-3 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-400">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!telemetrySessions?.length ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center text-slate-500">
                  <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Brak sesji telemetrycznych. Uruchom Natywną Przeglądarkę Quizu aby zbierać dane behawioralne.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {telemetrySessions.map(s => {
                  const verdictCfg = s.behaviorVerdict ? {
                    normal: { label: "Normalne", color: "bg-green-500/20 text-green-400 border-green-500/30" },
                    suspicious: { label: "Podejrzane", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                    anomaly: { label: "Anomalia", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                  }[s.behaviorVerdict] : null;

                  return (
                    <Card key={s.id} className="bg-slate-800/50 border-slate-700">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white">{s.participantName ?? "Anonimowy"}</span>
                              {s.participantEmail && <span className="text-xs text-slate-400">{s.participantEmail}</span>}
                              {verdictCfg && <Badge className={`${verdictCfg.color} text-xs`}>{verdictCfg.label}</Badge>}
                              {s.behaviorScore !== null && (
                                <Badge className="bg-slate-700 text-slate-300 text-xs">
                                  Wynik: {Math.round(s.behaviorScore ?? 0)}/100
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-4 text-xs text-slate-500 mt-1">
                              {s.totalDurationMs && <span>Czas: {Math.round(s.totalDurationMs / 1000)}s</span>}
                              {s.totalClicks !== null && <span>Kliknięcia: {s.totalClicks}</span>}
                              {s.tabSwitchCount !== null && s.tabSwitchCount > 0 && (
                                <span className="text-yellow-400">Zakładki: {s.tabSwitchCount}x</span>
                              )}
                              {s.copyPasteCount !== null && s.copyPasteCount > 0 && (
                                <span className="text-red-400">Copy-paste: {s.copyPasteCount}x</span>
                              )}
                              <span>{new Date(s.createdAt).toLocaleString("pl")}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
