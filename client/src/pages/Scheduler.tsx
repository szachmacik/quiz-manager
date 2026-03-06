import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Calendar, Clock, Loader2, Plus, XCircle, CheckCircle2, PlayCircle } from "lucide-react";

const statusConfig = {
  pending: { label: "Zaplanowana", color: "text-yellow-400", badge: "secondary" as const },
  triggered: { label: "Uruchomiona", color: "text-green-400", badge: "default" as const },
  cancelled: { label: "Anulowana", color: "text-red-400", badge: "destructive" as const },
};

export default function SchedulerPage() {
  const utils = trpc.useUtils();
  const { data: scheduled, isLoading } = trpc.scheduled.list.useQuery();
  const { data: snapshots } = trpc.quizzes.listSnapshots.useQuery({});
  const { data: connections } = trpc.connections.list.useQuery();

  const [name, setName] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [agentDomain, setAgentDomain] = useState("");
  const [agentCount, setAgentCount] = useState("100");
  const [scheduledAt, setScheduledAt] = useState("");
  const [strategy, setStrategy] = useState<"random" | "all_correct" | "all_wrong" | "mixed">("random");
  const [showForm, setShowForm] = useState(false);

  const createMutation = trpc.scheduled.create.useMutation({
    onSuccess: () => {
      utils.scheduled.list.invalidate();
      toast.success("Symulacja zaplanowana");
      setShowForm(false);
      setName(""); setSnapshotId(""); setScheduledAt("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelMutation = trpc.scheduled.cancel.useMutation({
    onSuccess: () => { utils.scheduled.list.invalidate(); toast.info("Symulacja anulowana"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!name || !snapshotId || !connectionId || !agentDomain || !scheduledAt) {
      toast.error("Wypełnij wszystkie wymagane pola");
      return;
    }
    createMutation.mutate({
      name,
      snapshotId: parseInt(snapshotId),
      connectionId: parseInt(connectionId),
      agentDomain,
      agentCount: parseInt(agentCount),
      strategy,
      scheduledAt,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" /> Harmonogram symulacji
          </h1>
          <p className="text-muted-foreground mt-1">Zaplanuj symulacje obciążeniowe na konkretną datę i godzinę.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" /> Zaplanuj symulację
        </Button>
      </div>

      {showForm && (
        <Card className="bg-card border-border border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Nowa zaplanowana symulacja</CardTitle>
            <CardDescription>Symulacja uruchomi się automatycznie o wybranej godzinie</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nazwa symulacji *</Label>
                <Input placeholder="np. Test przed konkursem" value={name} onChange={e => setName(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Data i godzina *</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="bg-background" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Snapshot quizu *</Label>
                <Select value={snapshotId} onValueChange={setSnapshotId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Wybierz snapshot" /></SelectTrigger>
                  <SelectContent>
                    {snapshots?.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>#{s.id} — {s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Połączenie WordPress *</Label>
                <Select value={connectionId} onValueChange={setConnectionId}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Wybierz połączenie" /></SelectTrigger>
                  <SelectContent>
                    {connections?.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Domena agentów *</Label>
                <Input placeholder="twojadomena.pl" value={agentDomain} onChange={e => setAgentDomain(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Liczba agentów</Label>
                <Input type="number" min={1} max={500} value={agentCount} onChange={e => setAgentCount(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Strategia</Label>
                <Select value={strategy} onValueChange={(v: any) => setStrategy(v)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Losowe</SelectItem>
                    <SelectItem value="all_correct">Wszystkie poprawne</SelectItem>
                    <SelectItem value="all_wrong">Wszystkie błędne</SelectItem>
                    <SelectItem value="mixed">Mieszane</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Anuluj</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
                Zaplanuj
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : scheduled?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center h-32 gap-2">
            <Calendar className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Brak zaplanowanych symulacji</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scheduled?.map(s => {
            const cfg = statusConfig[s.status] ?? statusConfig.pending;
            return (
              <Card key={s.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PlayCircle className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{s.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.scheduledAt).toLocaleString("pl-PL")}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{s.agentCount} agentów · {s.strategy}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={cfg.badge}>{cfg.label}</Badge>
                      {s.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate({ id: s.id })}>
                          <XCircle className="w-4 h-4 text-red-400" />
                        </Button>
                      )}
                      {s.status === "triggered" && s.triggeredSimulationId && (
                        <Badge variant="outline" className="text-xs">Symulacja #{s.triggeredSimulationId}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
