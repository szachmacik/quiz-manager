import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Globe, Brain, Users, FileText, Shield, ArrowRight, Loader2,
  RefreshCw, CheckCircle2, AlertCircle, MinusCircle, TrendingUp,
  Activity, Zap, AlertTriangle
} from "lucide-react";
import { getLoginUrl } from "@/const";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { data: connections } = trpc.connections.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: snapshots } = trpc.quizzes.listSnapshots.useQuery({}, { enabled: isAuthenticated });
  const { data: simulations } = trpc.simulations.list.useQuery({}, { enabled: isAuthenticated });
  const { data: patches } = trpc.patches.list.useQuery({}, { enabled: isAuthenticated });
  const { data: syncLog } = trpc.settings.getSyncLog.useQuery({ limit: 5 }, { enabled: isAuthenticated, refetchInterval: 30000 });
  const { data: trends } = trpc.export.trends.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60000 });
  const { data: pendingCount } = trpc.export.pendingPatchesCount.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 15000 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">AYS Quiz Manager</h2>
          <p className="text-muted-foreground">System QA quizów konkursowych — zaloguj się aby kontynuować</p>
        </div>
        <Button onClick={() => window.location.href = getLoginUrl()} size="lg" className="gap-2">
          <Shield className="w-4 h-4" /> Zaloguj się
        </Button>
      </div>
    );
  }

  const pendingPatches = pendingCount?.pending ?? patches?.filter(p => p.status === "pending").length ?? 0;
  const approvedPatches = pendingCount?.approved ?? patches?.filter(p => p.status === "approved").length ?? 0;
  const completedSims = simulations?.filter(s => s.status === "completed").length ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Witaj, {user?.name ?? "użytkowniku"}. System QA quizów konkursowych.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3 h-3 text-green-400" />
          <span>Auto-sync aktywny</span>
        </div>
      </div>

      {/* Alert — pending patches */}
      {(pendingPatches > 0 || approvedPatches > 0) && (
        <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-300">
              {pendingPatches > 0 && `${pendingPatches} propozycja(-e) poprawek czeka na Twoją akceptację`}
              {pendingPatches > 0 && approvedPatches > 0 && " · "}
              {approvedPatches > 0 && `${approvedPatches} zatwierdzona(-e) gotowa(-e) do wdrożenia`}
            </p>
          </div>
          <Link href="/patches">
            <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/10 gap-1">
              Przejrzyj <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Globe, label: "Połączenia WP", value: connections?.length ?? 0, color: "text-blue-400", href: "/connections" },
          { icon: FileText, label: "Snapshoty quizów", value: snapshots?.length ?? 0, color: "text-purple-400", href: "/quizzes" },
          { icon: Users, label: "Symulacje", value: simulations?.length ?? 0, sub: `${completedSims} ukończonych`, color: "text-green-400", href: "/simulations" },
          { icon: Shield, label: "Propozycje poprawek", value: patches?.length ?? 0, sub: pendingPatches > 0 ? `${pendingPatches} oczekujących` : "brak oczekujących", color: pendingPatches > 0 ? "text-yellow-400" : "text-orange-400", href: "/patches" },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <Card className="border-border/50 hover:border-primary/40 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-3xl font-bold text-foreground group-hover:text-primary transition-colors">{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                    {item.sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{item.sub}</p>}
                  </div>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Trend charts */}
      {trends && trends.weekly.some(w => w.simulations > 0 || w.snapshots > 0 || w.issues > 0) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Aktywność (8 tygodni)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={trends.weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSnap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "6px", fontSize: "12px" }}
                    labelStyle={{ color: "#f9fafb" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Area type="monotone" dataKey="simulations" name="Symulacje" stroke="#3b82f6" fill="url(#colorSim)" strokeWidth={2} />
                  <Area type="monotone" dataKey="snapshots" name="Snapshoty" stroke="#8b5cf6" fill="url(#colorSnap)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Brain className="w-4 h-4 text-red-400" /> Błędy wykryte przez AI (8 tygodni)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={trends.weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "6px", fontSize: "12px" }}
                    labelStyle={{ color: "#f9fafb" }}
                  />
                  <Bar dataKey="issues" name="Problemy AI" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="reviews" name="Analizy" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-border/50 border-dashed">
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Wykresy trendów pojawią się po przeprowadzeniu pierwszych symulacji i analiz AI.</p>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            step: "Krok 1", icon: Globe, title: "Podłącz WordPress",
            desc: "Dodaj dane dostępowe do swojej strony WordPress z pluginem AYS Quiz Maker.",
            href: "/connections", cta: "Zarządzaj połączeniami", color: "border-blue-500/30 hover:border-blue-500/60"
          },
          {
            step: "Krok 2", icon: Brain, title: "Pobierz i zweryfikuj quizy",
            desc: "Utwórz snapshoty quizów i uruchom analizę AI pod kątem błędów merytorycznych.",
            href: "/quizzes", cta: "Quizy i snapshoty", color: "border-purple-500/30 hover:border-purple-500/60"
          },
          {
            step: "Krok 3", icon: Users, title: "Symulacja obciążeniowa",
            desc: "Uruchom 100 wirtualnych agentów rozwiązujących quiz i monitoruj wydajność serwera.",
            href: "/simulations", cta: "Uruchom symulację", color: "border-green-500/30 hover:border-green-500/60"
          },
        ].map(item => (
          <Card key={item.href} className={`border transition-all ${item.color}`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">{item.step}</span>
                <item.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </div>
              <Link href={item.href}>
                <Button variant="outline" size="sm" className="w-full gap-1 mt-2">
                  {item.cta} <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sync Log */}
      {syncLog && syncLog.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" /> Ostatnia aktywność auto-sync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {syncLog.map(log => {
              const icon = log.status === "changed"
                ? <AlertCircle className="w-3 h-3 text-yellow-400 shrink-0" />
                : log.status === "error"
                ? <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                : log.status === "no_change"
                ? <MinusCircle className="w-3 h-3 text-muted-foreground shrink-0" />
                : <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />;
              return (
                <div key={log.id} className="flex items-center gap-2 text-xs">
                  {icon}
                  <span className="text-muted-foreground shrink-0">{new Date(log.createdAt).toLocaleString("pl-PL")}</span>
                  <span className="text-foreground truncate">{log.message ?? log.status}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Safety protocol */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" /> Protokół bezpiecznego wdrażania poprawek
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              "1. Snapshot quizu",
              "2. Analiza AI",
              "3. Propozycja poprawki",
              "4. Twoja akceptacja",
              "5. Symulacja testowa",
              "6. Wdrożenie na WP",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-1">{step}</span>
                {i < 5 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Żadna zmiana nie trafia na produkcję bez Twojej wyraźnej zgody. Każda poprawka jest poprzedzona ponowną symulacją.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
