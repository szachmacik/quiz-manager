import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "wouter";
import { Users, Play, Eye, Loader2, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

const statusColors = {
  pending: "secondary",
  running: "default",
  completed: "default",
  failed: "destructive",
  cancelled: "secondary",
} as const;

export default function SimulationsPage() {
  const utils = trpc.useUtils();
  const { data: connections } = trpc.connections.list.useQuery();
  const { data: snapshots } = trpc.quizzes.listSnapshots.useQuery({});
  const { data: simulations, isLoading } = trpc.simulations.list.useQuery({});

  const startMutation = trpc.simulations.start.useMutation({
    onSuccess: (d) => { utils.simulations.list.invalidate(); setOpen(false); toast.success(`Symulacja uruchomiona (ID: ${d.simulationId})`); },
    onError: (e) => toast.error(e.message),
  });
  const cancelMutation = trpc.simulations.cancel.useMutation({
    onSuccess: () => { utils.simulations.list.invalidate(); toast.info("Symulacja anulowana"); },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    snapshotId: "", connectionId: "", agentDomain: "",
    agentCount: 100, concurrency: 10, delayMs: 500,
    strategy: "random" as "random" | "all_correct" | "all_wrong" | "mixed",
    name: "",
  });

  const activeConnections = connections?.filter(c => c.status === "active") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Symulacje obciążeniowe</h1>
          <p className="text-muted-foreground mt-1">Testuj wydajność serwera przy równoczesnym rozwiązywaniu quizów przez wielu uczestników.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Play className="w-4 h-4" /> Nowa symulacja</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Konfiguracja symulacji</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Nazwa (opcjonalna)</Label>
                <Input placeholder="Symulacja konkursowa — marzec 2026" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Quiz (snapshot)</Label>
                <Select value={form.snapshotId} onValueChange={v => setForm(f => ({ ...f, snapshotId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Wybierz snapshot quizu..." /></SelectTrigger>
                  <SelectContent>
                    {snapshots?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.title} (#{s.id})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Połączenie WordPress</Label>
                <Select value={form.connectionId} onValueChange={v => setForm(f => ({ ...f, connectionId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Wybierz połączenie..." /></SelectTrigger>
                  <SelectContent>
                    {activeConnections.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Domena agentów (np. twojadomena.pl)</Label>
                <Input placeholder="twojadomena.pl" value={form.agentDomain} onChange={e => setForm(f => ({ ...f, agentDomain: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Agenci będą używać adresów: agent1@{form.agentDomain || "domena.pl"}, agent2@...</p>
              </div>
              <div className="space-y-2">
                <Label>Liczba agentów: <span className="text-primary font-bold">{form.agentCount}</span></Label>
                <Slider min={1} max={500} step={10} value={[form.agentCount]} onValueChange={([v]) => setForm(f => ({ ...f, agentCount: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Współbieżność: <span className="text-primary font-bold">{form.concurrency}</span></Label>
                  <Slider min={1} max={50} step={1} value={[form.concurrency]} onValueChange={([v]) => setForm(f => ({ ...f, concurrency: v }))} />
                </div>
                <div className="space-y-2">
                  <Label>Opóźnienie (ms): <span className="text-primary font-bold">{form.delayMs}</span></Label>
                  <Slider min={0} max={3000} step={100} value={[form.delayMs]} onValueChange={([v]) => setForm(f => ({ ...f, delayMs: v }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Strategia odpowiedzi</Label>
                <Select value={form.strategy} onValueChange={v => setForm(f => ({ ...f, strategy: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Losowe odpowiedzi</SelectItem>
                    <SelectItem value="all_correct">Wszystkie poprawne</SelectItem>
                    <SelectItem value="all_wrong">Wszystkie błędne</SelectItem>
                    <SelectItem value="mixed">Mieszane (50/50)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Symulacja wysyła rzeczywiste żądania do Twojego serwera WordPress. Upewnij się, że testujesz na środowisku testowym lub poza godzinami szczytu.
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => startMutation.mutate({
                  snapshotId: parseInt(form.snapshotId),
                  connectionId: parseInt(form.connectionId),
                  agentDomain: form.agentDomain,
                  agentCount: form.agentCount,
                  concurrency: form.concurrency,
                  delayMs: form.delayMs,
                  strategy: form.strategy,
                  name: form.name || undefined,
                })}
                disabled={startMutation.isPending || !form.snapshotId || !form.connectionId || !form.agentDomain}
              >
                {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Uruchom symulację
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : simulations?.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Users className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Brak symulacji. Uruchom pierwszą symulację obciążeniową.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {simulations?.map(sim => (
            <Card key={sim.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      {sim.status === "running" ? <Loader2 className="w-5 h-5 text-green-400 animate-spin" /> : <Users className="w-5 h-5 text-green-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{sim.name}</span>
                        <Badge variant={statusColors[sim.status as keyof typeof statusColors] ?? "secondary"} className="text-xs">
                          {sim.status}
                        </Badge>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{sim.completedAgents}/{sim.agentCount} agentów</span>
                        {sim.avgResponseMs && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> avg {sim.avgResponseMs.toFixed(0)}ms</span>}
                        {sim.errorRate != null && <span className={sim.errorRate > 10 ? "text-red-400" : "text-green-400"}>{sim.errorRate.toFixed(1)}% błędów</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sim.status === "running" && (
                      <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate({ simulationId: sim.id })}>
                        Anuluj
                      </Button>
                    )}
                    <Link href={`/simulations/${sim.id}`}>
                      <Button size="sm" variant="outline" className="gap-2">
                        <Eye className="w-3 h-3" /> Szczegóły
                      </Button>
                    </Link>
                  </div>
                </div>
                {sim.status === "running" && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((((sim.completedAgents ?? 0) + (sim.failedAgents ?? 0)) / sim.agentCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
