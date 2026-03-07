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
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  History,
  Play,
  Plus,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SEVERITY_CONFIG = {
  critical: { label: "Krytyczny", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  high: { label: "Wysoki", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  medium: { label: "Średni", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertTriangle },
  low: { label: "Niski", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: CheckCircle },
};

const CATEGORY_CONFIG = {
  schedule: { label: "Harmonogram", icon: Clock },
  security: { label: "Bezpieczeństwo", icon: Shield },
  certificate: { label: "Dyplomy", icon: FileText },
  access: { label: "Dostęp", icon: BookOpen },
  results: { label: "Wyniki", icon: CheckCircle },
  consistency: { label: "Spójność", icon: History },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="text-xl font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function AuditCard({ audit }: { audit: any }) {
  const [expanded, setExpanded] = useState(false);
  const findings = (audit.audit.findings as any[]) || [];
  const critical = findings.filter(f => f.severity === "critical" || f.severity === "high");
  const warnings = findings.filter(f => f.severity === "medium" || f.severity === "low");

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white truncate">{audit.snapshot?.title ?? `Quiz #${audit.audit.snapshotId}`}</span>
              {audit.audit.status === "running" && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Analizuję...
                </Badge>
              )}
              {audit.audit.status === "completed" && (
                <Badge className={audit.audit.issuesFound > 0
                  ? "bg-red-500/20 text-red-400 border-red-500/30 text-xs"
                  : "bg-green-500/20 text-green-400 border-green-500/30 text-xs"}>
                  {audit.audit.issuesFound > 0 ? `${audit.audit.issuesFound} problemów` : "OK"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400">{audit.audit.summary}</p>
          </div>
          {audit.audit.overallScore !== null && (
            <ScoreRing score={audit.audit.overallScore ?? 0} />
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
          <span>{critical.length} krytycznych/wysokich</span>
          <span>{warnings.length} ostrzeżeń</span>
          <span>{new Date(audit.audit.createdAt).toLocaleString("pl")}</span>
        </div>
      </CardHeader>

      {findings.length > 0 && (
        <CardContent className="pt-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors mb-2"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {expanded ? "Ukryj" : "Pokaż"} szczegóły ({findings.length} znalezisk)
          </button>

          {expanded && (
            <div className="space-y-2">
              {findings.map((f, i) => {
                const sev = SEVERITY_CONFIG[f.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.low;
                const cat = CATEGORY_CONFIG[f.category as keyof typeof CATEGORY_CONFIG];
                const SevIcon = sev.icon;
                const CatIcon = cat?.icon ?? Shield;
                return (
                  <div key={i} className={`rounded-lg border p-3 ${sev.color}`}>
                    <div className="flex items-start gap-2">
                      <SevIcon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={`text-xs ${sev.color}`}>{sev.label}</Badge>
                          <Badge className="bg-slate-700 text-slate-300 border-slate-600 text-xs">
                            <CatIcon className="w-3 h-3 mr-1" />{cat?.label ?? f.category}
                          </Badge>
                          <code className="text-xs opacity-70">{f.field}</code>
                          <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 text-xs">
                            {f.source === "rules" ? "Regulamin" : f.source === "history" ? "Historia" : "Best Practice"}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{f.message}</p>
                        {f.currentValue && (
                          <p className="text-xs opacity-70 mt-1">
                            Obecna wartość: <code>{f.currentValue}</code>
                            {f.expectedValue && <> → Oczekiwana: <code>{f.expectedValue}</code></>}
                          </p>
                        )}
                        <p className="text-xs mt-1 opacity-90">💡 {f.suggestion}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function NewAuditDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [snapshotId, setSnapshotId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [rulesId, setRulesId] = useState("");

  const { data: snapshots } = trpc.quizzes.listSnapshots.useQuery({ connectionId: connectionId ? Number(connectionId) : undefined });
  const { data: connections } = trpc.connections.list.useQuery();
  const { data: rules } = trpc.settingsAudit.rules.list.useQuery({ connectionId: connectionId ? Number(connectionId) : undefined });
  const startAudit = trpc.settingsAudit.start.useMutation({
    onSuccess: () => {
      toast.success("Audyt ustawień uruchomiony");
      setOpen(false);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Play className="w-4 h-4 mr-2" /> Nowy audyt
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Uruchom audyt ustawień quizu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Połączenie WordPress</Label>
            <Select value={connectionId} onValueChange={setConnectionId}>
              <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                <SelectValue placeholder="Wybierz połączenie..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {connections?.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Snapshot quizu</Label>
            <Select value={snapshotId} onValueChange={setSnapshotId}>
              <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                <SelectValue placeholder="Wybierz snapshot..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {snapshots?.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Regulamin konkursu (opcjonalnie)</Label>
            <Select value={rulesId} onValueChange={setRulesId}>
              <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                <SelectValue placeholder="Wybierz regulamin..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="none">Bez regulaminu</SelectItem>
                {rules?.map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={!snapshotId || !connectionId || startAudit.isPending}
            onClick={() => startAudit.mutate({
              snapshotId: Number(snapshotId),
              connectionId: Number(connectionId),
              rulesId: rulesId && rulesId !== "none" ? Number(rulesId) : undefined,
            })}
          >
            {startAudit.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Uruchom audyt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewRuleDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", connectionId: "", rulesText: "", intentNotes: "",
    expectedStartTime: "", expectedEndTime: "", expectedDurationMin: "",
    requireAntiCopy: true, requireCaptcha: false, requireEmailVerification: true,
    requireCertificate: true, maxAttempts: "1", targetAgeGroup: "",
  });

  const { data: connections } = trpc.connections.list.useQuery();
  const createRule = trpc.settingsAudit.rules.create.useMutation({
    onSuccess: () => { toast.success("Regulamin zapisany"); setOpen(false); onCreated(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
          <Plus className="w-4 h-4 mr-2" /> Dodaj regulamin
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nowy regulamin konkursu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nazwa regulaminu</Label>
              <Input className="bg-slate-800 border-slate-600 mt-1" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Konkurs Matematyczny 2025" />
            </div>
            <div>
              <Label>Połączenie WordPress</Label>
              <Select value={form.connectionId} onValueChange={v => setForm(f => ({ ...f, connectionId: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 mt-1">
                  <SelectValue placeholder="Wybierz..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {connections?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Treść regulaminu (wklej pełny tekst)</Label>
            <Textarea className="bg-slate-800 border-slate-600 mt-1 h-32 font-mono text-sm"
              value={form.rulesText} onChange={e => setForm(f => ({ ...f, rulesText: e.target.value }))}
              placeholder="Wklej treść regulaminu — AI automatycznie wyodrębni wymagania techniczne..." />
          </div>

          <div>
            <Label>Intencje twórcy (notatki)</Label>
            <Textarea className="bg-slate-800 border-slate-600 mt-1 h-20"
              value={form.intentNotes} onChange={e => setForm(f => ({ ...f, intentNotes: e.target.value }))}
              placeholder="Dodatkowe uwagi o zamierzeniach konkursu, specyficznych wymaganiach..." />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Czas trwania (min)</Label>
              <Input type="number" className="bg-slate-800 border-slate-600 mt-1"
                value={form.expectedDurationMin} onChange={e => setForm(f => ({ ...f, expectedDurationMin: e.target.value }))} />
            </div>
            <div>
              <Label>Max prób</Label>
              <Input type="number" className="bg-slate-800 border-slate-600 mt-1"
                value={form.maxAttempts} onChange={e => setForm(f => ({ ...f, maxAttempts: e.target.value }))} />
            </div>
            <div>
              <Label>Grupa wiekowa</Label>
              <Input className="bg-slate-800 border-slate-600 mt-1"
                value={form.targetAgeGroup} onChange={e => setForm(f => ({ ...f, targetAgeGroup: e.target.value }))}
                placeholder="np. 8-12 lat" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "requireAntiCopy", label: "Wymaga anti-copy" },
              { key: "requireCaptcha", label: "Wymaga CAPTCHA" },
              { key: "requireEmailVerification", label: "Wymaga email" },
              { key: "requireCertificate", label: "Wymaga dyplomu" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>

          <Button className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={!form.name || !form.connectionId || createRule.isPending}
            onClick={() => createRule.mutate({
              name: form.name,
              connectionId: Number(form.connectionId),
              rulesText: form.rulesText || undefined,
              intentNotes: form.intentNotes || undefined,
              expectedDurationMin: form.expectedDurationMin ? Number(form.expectedDurationMin) : undefined,
              requireAntiCopy: form.requireAntiCopy,
              requireCaptcha: form.requireCaptcha,
              requireEmailVerification: form.requireEmailVerification,
              requireCertificate: form.requireCertificate,
              maxAttempts: Number(form.maxAttempts),
              targetAgeGroup: form.targetAgeGroup || undefined,
            })}>
            {createRule.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Zapisz regulamin
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function QuizSettingsAudit() {
  const [tab, setTab] = useState<"audits" | "rules" | "history">("audits");
  const { data: audits, refetch: refetchAudits } = trpc.settingsAudit.list.useQuery({});
  const { data: rules, refetch: refetchRules } = trpc.settingsAudit.rules.list.useQuery({});
  const deleteRule = trpc.settingsAudit.rules.delete.useMutation({
    onSuccess: () => { toast.success("Regulamin usunięty"); refetchRules(); },
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Audyt Ustawień Quizu</h1>
            <p className="text-slate-400 text-sm mt-1">
              Sprawdź czy ustawienia quizu są zgodne z regulaminem, historią i najlepszymi praktykami
            </p>
          </div>
          <div className="flex gap-2">
            <NewRuleDialog onCreated={refetchRules} />
            <NewAuditDialog onCreated={refetchAudits} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
          {(["audits", "rules", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>
              {t === "audits" ? "Audyty" : t === "rules" ? "Regulaminy" : "Historia"}
            </button>
          ))}
        </div>

        {/* Audits Tab */}
        {tab === "audits" && (
          <div className="space-y-3">
            {!audits?.length ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center text-slate-500">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Brak audytów. Kliknij "Nowy audyt" aby sprawdzić ustawienia quizu.</p>
                </CardContent>
              </Card>
            ) : (
              audits.map(a => <AuditCard key={a.audit.id} audit={a} />)
            )}
          </div>
        )}

        {/* Rules Tab */}
        {tab === "rules" && (
          <div className="space-y-3">
            {!rules?.length ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center text-slate-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Brak regulaminów. Dodaj regulamin konkursu aby AI mogło porównać ustawienia quizu.</p>
                </CardContent>
              </Card>
            ) : (
              rules.map(r => (
                <Card key={r.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">{r.name}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {r.requireAntiCopy && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Anti-copy</Badge>}
                          {r.requireCertificate && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Dyplom</Badge>}
                          {r.requireEmailVerification && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Email</Badge>}
                          {r.maxAttempts && <Badge className="bg-slate-600 text-slate-300 text-xs">Max {r.maxAttempts} prób</Badge>}
                          {r.expectedDurationMin && <Badge className="bg-slate-600 text-slate-300 text-xs">{r.expectedDurationMin} min</Badge>}
                          {r.targetAgeGroup && <Badge className="bg-slate-600 text-slate-300 text-xs">{r.targetAgeGroup}</Badge>}
                        </div>
                        {r.intentNotes && <p className="text-xs text-slate-400 mt-2">{r.intentNotes}</p>}
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => deleteRule.mutate({ id: r.id })}>
                        Usuń
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="py-12 text-center text-slate-500">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Historia ustawień będzie dostępna po podłączeniu WordPressa i wykonaniu pierwszego snapshotu.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
