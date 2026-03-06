import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Globe, Brain, Users, FileText, Shield, ArrowRight, Loader2, RefreshCw, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { data: connections } = trpc.connections.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: snapshots } = trpc.quizzes.listSnapshots.useQuery({}, { enabled: isAuthenticated });
  const { data: simulations } = trpc.simulations.list.useQuery({}, { enabled: isAuthenticated });
  const { data: patches } = trpc.patches.list.useQuery({}, { enabled: isAuthenticated });
  const { data: syncLog } = trpc.settings.getSyncLog.useQuery({ limit: 5 }, { enabled: isAuthenticated, refetchInterval: 30000 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 gap-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">AYS Quiz Manager</h1>
          <p className="text-muted-foreground max-w-md">
            System zarządzania jakością quizów konkursowych WordPress. Testuj, weryfikuj i symuluj przed startem konkursu.
          </p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <a href={getLoginUrl()}>
            Zaloguj się <ArrowRight className="w-4 h-4" />
          </a>
        </Button>
      </div>
    );
  }

  const stats = [
    { label: "Połączenia WP", value: connections?.length ?? 0, icon: Globe, href: "/connections", color: "text-blue-400" },
    { label: "Snapshoty quizów", value: snapshots?.length ?? 0, icon: FileText, href: "/quizzes", color: "text-purple-400" },
    { label: "Symulacje", value: simulations?.length ?? 0, icon: Users, href: "/simulations", color: "text-green-400" },
    { label: "Propozycje poprawek", value: patches?.length ?? 0, icon: Brain, href: "/patches", color: "text-orange-400" },
  ];

  const pendingPatches = patches?.filter(p => p.status === "pending").length ?? 0;
  const runningSimulations = simulations?.filter(s => s.status === "running").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Witaj, {user?.name ?? "Użytkowniku"}. System QA quizów konkursowych.
        </p>
      </div>

      {/* Alerts */}
      {(pendingPatches > 0 || runningSimulations > 0) && (
        <div className="space-y-2">
          {pendingPatches > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <Brain className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">
                {pendingPatches} propozycja(-e) poprawek czeka na Twoją decyzję
              </span>
              <Link href="/patches">
                <Button variant="ghost" size="sm" className="ml-auto text-orange-400 hover:text-orange-300 gap-1">
                  Przejrzyj <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          )}
          {runningSimulations > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              <span className="text-sm font-medium">
                {runningSimulations} symulacja(-e) w toku
              </span>
              <Link href="/simulations">
                <Button variant="ghost" size="sm" className="ml-auto text-blue-400 hover:text-blue-300 gap-1">
                  Monitor <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href}>
            <Card className="cursor-pointer hover:bg-card/80 transition-colors border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Globe className="w-4 h-4" /> Krok 1
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold text-foreground">Podłącz WordPress</p>
            <p className="text-xs text-muted-foreground">Dodaj dane dostępowe do swojej strony WordPress z pluginem AYS Quiz Maker.</p>
            <Link href="/connections">
              <Button size="sm" className="w-full gap-2 mt-2">
                Zarządzaj połączeniami <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="w-4 h-4" /> Krok 2
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold text-foreground">Pobierz i zweryfikuj quizy</p>
            <p className="text-xs text-muted-foreground">Utwórz snapshoty quizów i uruchom analizę AI pod kątem błędów merytorycznych.</p>
            <Link href="/quizzes">
              <Button size="sm" variant="secondary" className="w-full gap-2 mt-2">
                Quizy i snapshoty <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Krok 3
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold text-foreground">Symulacja obciążeniowa</p>
            <p className="text-xs text-muted-foreground">Uruchom 100 wirtualnych agentów rozwiązujących quiz i monitoruj wydajność serwera.</p>
            <Link href="/simulations">
              <Button size="sm" variant="secondary" className="w-full gap-2 mt-2">
                Uruchom symulację <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
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
              const icon = log.status === "changed" ? <AlertCircle className="w-3 h-3 text-yellow-400" /> :
                           log.status === "error" ? <AlertCircle className="w-3 h-3 text-red-400" /> :
                           log.status === "no_change" ? <MinusCircle className="w-3 h-3 text-muted-foreground" /> :
                           <CheckCircle2 className="w-3 h-3 text-green-400" />;
              return (
                <div key={log.id} className="flex items-center gap-2 text-xs">
                  {icon}
                  <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleString("pl-PL")}</span>
                  <span className="text-foreground">{log.message ?? log.status}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Workflow */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground">Protokół bezpiecznego wdrażania poprawek</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {["1. Snapshot quizu", "→", "2. Analiza AI", "→", "3. Propozycja poprawki", "→", "4. Twoja akceptacja", "→", "5. Symulacja testowa", "→", "6. Wdrożenie na WP"].map((step, i) => (
              <span key={i} className={step === "→" ? "text-border" : "px-2 py-1 rounded bg-muted text-muted-foreground font-medium"}>
                {step}
              </span>
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
