import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useParams } from "wouter";
import { ArrowLeft, Loader2, TrendingUp, Users, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function SimulationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const simId = parseInt(id, 10);
  const [polling, setPolling] = useState(true);

  const { data: sim, refetch: refetchSim } = trpc.simulations.get.useQuery({ id: simId });
  const { data: agents, refetch: refetchAgents } = trpc.simulations.getAgents.useQuery({ simulationId: simId });
  const { data: liveState, refetch: refetchLive } = trpc.simulations.getLiveState.useQuery({ simulationId: simId });

  // Poll every 2s while running
  useEffect(() => {
    if (!polling) return;
    if (sim?.status === "completed" || sim?.status === "failed" || sim?.status === "cancelled") {
      setPolling(false);
      return;
    }
    const interval = setInterval(() => {
      refetchSim();
      refetchAgents();
      refetchLive();
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, sim?.status]);

  if (!sim) return <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const completedAgents = agents?.filter(a => a.status === "completed") ?? [];
  const failedAgents = agents?.filter(a => a.status === "failed") ?? [];
  const runningAgents = agents?.filter(a => a.status === "running") ?? [];

  // Build response time histogram
  const responseTimes = liveState?.responseTimes ?? [];
  const histogramData = responseTimes.length > 0 ? (() => {
    const buckets = [0, 500, 1000, 2000, 3000, 5000, Infinity];
    const labels = ["<500ms", "500ms-1s", "1-2s", "2-3s", "3-5s", ">5s"];
    return labels.map((label, i) => ({
      range: label,
      count: responseTimes.filter(t => t >= buckets[i] && t < buckets[i + 1]).length,
    }));
  })() : [];

  const progress = Math.round((((sim.completedAgents ?? 0) + (sim.failedAgents ?? 0)) / sim.agentCount) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/simulations">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="w-4 h-4" /> Wróć</Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{sim.name}</h1>
            <Badge variant={sim.status === "running" ? "default" : sim.status === "completed" ? "default" : "secondary"}>
              {sim.status === "running" && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              {sim.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {sim.agentCount} agentów · {sim.strategy} · concurrency: {sim.concurrency} · delay: {sim.delayMs}ms
          </p>
        </div>
        {sim.status === "running" && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Live monitoring</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {(sim.status === "running" || sim.status === "completed") && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Postęp: {(sim.completedAgents ?? 0) + (sim.failedAgents ?? 0)}/{sim.agentCount} agentów</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Ukończone", value: sim.completedAgents ?? 0, icon: CheckCircle2, color: "text-green-400" },
          { label: "Błędy", value: sim.failedAgents ?? 0, icon: XCircle, color: "text-red-400" },
          { label: "Avg response", value: sim.avgResponseMs ? `${sim.avgResponseMs.toFixed(0)}ms` : "—", icon: TrendingUp, color: "text-blue-400" },
          { label: "P95 response", value: sim.p95ResponseMs ? `${sim.p95ResponseMs.toFixed(0)}ms` : "—", icon: Clock, color: "text-yellow-400" },
        ].map(stat => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xl font-bold text-foreground">{stat.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error rate alert */}
      {sim.errorRate != null && sim.errorRate > 5 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            Wysoki wskaźnik błędów: {sim.errorRate.toFixed(1)}%. Serwer może być przeciążony lub quiz ma błędy konfiguracji.
          </span>
        </div>
      )}

      {/* Response time histogram */}
      {histogramData.length > 0 && histogramData.some(d => d.count > 0) && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Rozkład czasów odpowiedzi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={histogramData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "6px" }} />
                <Bar dataKey="count" name="Agenci" radius={[3, 3, 0, 0]}>
                  {histogramData.map((entry, index) => (
                    <Cell key={index} fill={entry.range.includes(">") || entry.range.includes("3-") || entry.range.includes("2-") ? "#ef4444" : entry.range.includes("1-") ? "#f59e0b" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Live logs */}
      {liveState?.logs && liveState.logs.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Logi symulacji</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black/30 rounded-lg p-3 font-mono text-xs space-y-0.5 max-h-48 overflow-y-auto">
              {liveState.logs.map((log, i) => (
                <div key={i} className={`${log.includes("FAILED") || log.includes("ERROR") ? "text-red-400" : log.includes("completed") ? "text-green-400" : "text-muted-foreground"}`}>
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agents table */}
      {agents && agents.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Agenci ({agents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">#</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Email</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Wynik</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Czas</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Błąd</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.slice(0, 50).map(agent => (
                    <tr key={agent.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-1.5 px-2 text-muted-foreground">{agent.agentIndex + 1}</td>
                      <td className="py-1.5 px-2 font-mono text-foreground">{agent.email}</td>
                      <td className="py-1.5 px-2">
                        <Badge variant={agent.status === "completed" ? "default" : agent.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                          {agent.status}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-2 text-right text-foreground">{agent.score != null ? `${agent.score.toFixed(0)}%` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-foreground">{agent.responseMs != null ? `${agent.responseMs}ms` : "—"}</td>
                      <td className="py-1.5 px-2 text-red-400 max-w-[200px] truncate">{agent.errorMessage ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {agents.length > 50 && <p className="text-xs text-muted-foreground mt-2 text-center">Pokazano 50 z {agents.length} agentów</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
