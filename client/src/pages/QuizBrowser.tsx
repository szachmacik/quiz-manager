import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle,
  Clock,
  Eye,
  Maximize2,
  MousePointer,
  RefreshCw,
  Shield,
  StopCircle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Telemetry Collector ──────────────────────────────────────────────────────
interface TelemetryEvent {
  eventType: string;
  timestampMs: number;
  x?: number;
  y?: number;
  targetElement?: string;
  metadata?: Record<string, unknown>;
}

function useTelemetry(sessionToken: string | null, sessionId: number | null) {
  const buffer = useRef<TelemetryEvent[]>([]);
  const sessionStart = useRef<number>(Date.now());
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pushEvents = trpc.videoVerification.telemetry.pushEvents.useMutation();

  const addEvent = useCallback((event: Omit<TelemetryEvent, "timestampMs">) => {
    if (!sessionToken) return;
    buffer.current.push({
      ...event,
      timestampMs: Date.now() - sessionStart.current,
    });
  }, [sessionToken]);

  const flush = useCallback(async () => {
    if (!sessionToken || buffer.current.length === 0) return;
    const events = [...buffer.current];
    buffer.current = [];
    try {
      await pushEvents.mutateAsync({ sessionToken, events });
    } catch {
      // Re-add events to buffer on failure
      buffer.current = [...events, ...buffer.current];
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) return;
    sessionStart.current = Date.now();
    flushTimer.current = setInterval(flush, 3000); // flush every 3s
    return () => {
      if (flushTimer.current) clearInterval(flushTimer.current);
      flush(); // final flush
    };
  }, [sessionToken, flush]);

  return { addEvent, flush, sessionStart };
}

// ─── Live Stats Display ───────────────────────────────────────────────────────
function LiveStats({ stats }: {
  stats: {
    clicks: number; keystrokes: number; tabSwitches: number;
    pastes: number; duration: number; pauses: number;
  }
}) {
  const items = [
    { icon: MousePointer, label: "Kliknięcia", value: stats.clicks, warn: false },
    { icon: Activity, label: "Klawiatura", value: stats.keystrokes, warn: false },
    { icon: Eye, label: "Zakładki", value: stats.tabSwitches, warn: stats.tabSwitches > 2 },
    { icon: AlertTriangle, label: "Copy-paste", value: stats.pastes, warn: stats.pastes > 0 },
    { icon: Clock, label: "Przerwy", value: stats.pauses, warn: stats.pauses > 1 },
  ];

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="col-span-3 bg-slate-800/50 rounded-lg p-2 text-center">
        <Clock className="w-4 h-4 inline mr-1 text-slate-400" />
        <span className="font-mono text-white font-bold">{formatDuration(stats.duration)}</span>
      </div>
      {items.map(({ icon: Icon, label, value, warn }) => (
        <div key={label} className={`rounded-lg p-2 text-center ${warn && value > 0 ? "bg-red-500/20 border border-red-500/30" : "bg-slate-800/50"}`}>
          <Icon className={`w-3 h-3 mx-auto mb-1 ${warn && value > 0 ? "text-red-400" : "text-slate-400"}`} />
          <p className={`text-sm font-bold ${warn && value > 0 ? "text-red-400" : "text-white"}`}>{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuizBrowser() {
  const [connectionId, setConnectionId] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quizUrl, setQuizUrl] = useState("");
  const [completed, setCompleted] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const pauseCountRef = useRef(0);

  // Live stats
  const [stats, setStats] = useState({
    clicks: 0, keystrokes: 0, tabSwitches: 0,
    pastes: 0, duration: 0, pauses: 0,
  });

  const { data: connections } = trpc.connections.list.useQuery();
  const { data: snapshots } = trpc.quizzes.listSnapshots.useQuery(
    { connectionId: connectionId ? Number(connectionId) : undefined },
    { enabled: !!connectionId }
  );

  const createSession = trpc.videoVerification.telemetry.createSession.useMutation();
  const completeSession = trpc.videoVerification.telemetry.completeSession.useMutation();
  const { addEvent, flush, sessionStart } = useTelemetry(sessionToken, sessionId);

  // Duration ticker
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      setStats(s => ({ ...s, duration: Date.now() - sessionStart.current }));
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive, sessionStart]);

  // Pause detector
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      const inactiveMs = Date.now() - lastActivityRef.current;
      if (inactiveMs > 30000) {
        pauseCountRef.current++;
        setStats(s => ({ ...s, pauses: pauseCountRef.current }));
        addEvent({ eventType: "pause", metadata: { durationMs: inactiveMs } });
        lastActivityRef.current = Date.now(); // reset to avoid counting same pause
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [isActive, addEvent]);

  // Tab visibility
  useEffect(() => {
    if (!isActive) return;
    const handler = () => {
      const hidden = document.hidden;
      addEvent({ eventType: "visibility", metadata: { hidden } });
      if (hidden) {
        setStats(s => ({ ...s, tabSwitches: s.tabSwitches + 1 }));
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [isActive, addEvent]);

  // Mouse tracking on iframe overlay
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isActive) return;
    lastActivityRef.current = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    addEvent({
      eventType: "mousemove",
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, [isActive, addEvent]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isActive) return;
    lastActivityRef.current = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    addEvent({
      eventType: "click",
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
    setStats(s => ({ ...s, clicks: s.clicks + 1 }));
  }, [isActive, addEvent]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return;
    lastActivityRef.current = Date.now();
    // Don't record key content — only timing and modifier keys
    addEvent({
      eventType: "keydown",
      metadata: {
        key: e.key.length > 1 ? e.key : "char", // only special keys by name
        ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey,
      },
    });
    setStats(s => ({ ...s, keystrokes: s.keystrokes + 1 }));

    // Detect Ctrl+C / Ctrl+V
    if (e.ctrlKey && (e.key === "c" || e.key === "v")) {
      addEvent({ eventType: "paste", metadata: { type: e.key === "v" ? "paste" : "copy" } });
      setStats(s => ({ ...s, pastes: s.pastes + 1 }));
    }
  }, [isActive, addEvent]);

  useEffect(() => {
    if (!isActive) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, handleKeyDown]);

  // Get quiz URL from snapshot
  useEffect(() => {
    if (!snapshotId || !snapshots) return;
    const snap = snapshots.find(s => s.id === Number(snapshotId));
    if (snap && connections) {
      const conn = connections.find(c => c.id === Number(connectionId));
      if (conn) {
        setQuizUrl(`${conn.siteUrl}/?ays_quiz_id=${snap.wpQuizId}`);
      }
    }
  }, [snapshotId, snapshots, connections, connectionId]);

  const startSession = async () => {
    if (!participantName) { toast.error("Podaj imię uczestnika"); return; }
    if (!quizUrl) { toast.error("Wybierz quiz"); return; }

    try {
      const result = await createSession.mutateAsync({
        connectionId: connectionId ? Number(connectionId) : undefined,
        snapshotId: snapshotId ? Number(snapshotId) : undefined,
        participantName,
        participantEmail: participantEmail || undefined,
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      });
      setSessionToken(result.token);
      setSessionId(result.sessionId);
      setIsActive(true);
      setStats({ clicks: 0, keystrokes: 0, tabSwitches: 0, pastes: 0, duration: 0, pauses: 0 });
      toast.success("Sesja telemetryczna uruchomiona");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const stopSession = async () => {
    if (!sessionToken) return;
    await flush();
    try {
      await completeSession.mutateAsync({
        sessionToken,
        totalDurationMs: Date.now() - sessionStart.current,
      });
      setIsActive(false);
      setCompleted(true);
      toast.success("Sesja zakończona — AI analizuje dane behawioralne");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Natywna Przeglądarka Quizu</h1>
            <p className="text-slate-400 text-sm mt-1">
              Rozwiązuj quizy z pełną telemetrią behawioralną — każde kliknięcie, ruch myszy i przerwa są rejestrowane
            </p>
          </div>
          {isActive && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 animate-pulse">
              <Activity className="w-3 h-3 mr-1" /> Telemetria aktywna
            </Badge>
          )}
        </div>

        {!isActive && !completed ? (
          /* Setup form */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-6 space-y-4">
                <h2 className="font-semibold text-white">Konfiguracja sesji</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Imię uczestnika *</Label>
                    <Input className="bg-slate-700 border-slate-600 mt-1"
                      value={participantName} onChange={e => setParticipantName(e.target.value)}
                      placeholder="Jan Kowalski" />
                  </div>
                  <div>
                    <Label>Email uczestnika</Label>
                    <Input type="email" className="bg-slate-700 border-slate-600 mt-1"
                      value={participantEmail} onChange={e => setParticipantEmail(e.target.value)}
                      placeholder="jan@example.pl" />
                  </div>
                </div>
                <div>
                  <Label>Połączenie WordPress</Label>
                  <Select value={connectionId} onValueChange={setConnectionId}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 mt-1">
                      <SelectValue placeholder="Wybierz..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {connections?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quiz</Label>
                  <Select value={snapshotId} onValueChange={setSnapshotId}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 mt-1">
                      <SelectValue placeholder="Wybierz quiz..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {snapshots?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>URL quizu (opcjonalnie — nadpisuje powyższe)</Label>
                  <Input className="bg-slate-700 border-slate-600 mt-1 font-mono text-sm"
                    value={quizUrl} onChange={e => setQuizUrl(e.target.value)}
                    placeholder="https://twojadomena.pl/quiz" />
                </div>
                <Button className="w-full bg-violet-600 hover:bg-violet-700"
                  disabled={!participantName || !quizUrl || createSession.isPending}
                  onClick={startSession}>
                  {createSession.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                  Uruchom sesję z telemetrią
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/30 border-slate-700">
              <CardContent className="py-6 space-y-3">
                <h2 className="font-semibold text-white">Co jest monitorowane?</h2>
                {[
                  { icon: MousePointer, label: "Ruchy myszy", desc: "Pozycja co 100ms, prędkość, wzorce" },
                  { icon: Activity, label: "Klawiatura", desc: "Timing naciśnięć (bez treści), skróty Ctrl+C/V" },
                  { icon: Eye, label: "Przełączenia zakładek", desc: "Kiedy uczestnik opuszcza stronę quizu" },
                  { icon: AlertTriangle, label: "Copy-paste", desc: "Wykrywanie wklejania treści" },
                  { icon: Clock, label: "Przerwy", desc: "Brak aktywności > 30 sekund" },
                  { icon: Shield, label: "Analiza AI", desc: "Automatyczna ocena behawioralna po zakończeniu" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : completed ? (
          /* Completed state */
          <Card className="bg-green-900/20 border-green-700/50">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <h2 className="text-xl font-bold text-white mb-2">Sesja zakończona</h2>
              <p className="text-slate-300 mb-4">
                Dane behawioralne zostały zapisane. AI analizuje sesję — wyniki pojawią się w zakładce Telemetria.
              </p>
              <div className="flex gap-3 justify-center">
                <Button className="bg-violet-600 hover:bg-violet-700"
                  onClick={() => { setCompleted(false); setSessionToken(null); setSessionId(null); setParticipantName(""); setParticipantEmail(""); }}>
                  Nowa sesja
                </Button>
                <Button variant="outline" className="border-slate-600 text-slate-300"
                  onClick={() => window.location.href = "/video-verifier"}>
                  Zobacz wyniki telemetrii
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Active session */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Sidebar stats */}
            <div className="space-y-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Live Stats</h3>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs animate-pulse">LIVE</Badge>
                  </div>
                  <LiveStats stats={stats} />
                </CardContent>
              </Card>

              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={toggleFullscreen}>
                  <Maximize2 className="w-4 h-4 mr-2" /> Pełny ekran
                </Button>
                <Button variant="destructive" size="sm" onClick={stopSession}
                  disabled={completeSession.isPending}>
                  {completeSession.isPending
                    ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    : <StopCircle className="w-4 h-4 mr-2" />}
                  Zakończ sesję
                </Button>
              </div>

              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-3">
                  <p className="text-xs text-slate-400 font-medium mb-1">Uczestnik</p>
                  <p className="text-sm text-white">{participantName}</p>
                  {participantEmail && <p className="text-xs text-slate-400">{participantEmail}</p>}
                </CardContent>
              </Card>
            </div>

            {/* Quiz iframe */}
            <div ref={containerRef} className="lg:col-span-3 relative">
              <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden"
                style={{ height: "calc(100vh - 200px)", minHeight: "500px" }}>
                {/* Transparent overlay for event capture */}
                <div
                  className="absolute inset-0 z-10 cursor-default"
                  style={{ pointerEvents: "none" }}
                  onMouseMove={handleMouseMove}
                  onClick={handleClick}
                />
                <iframe
                  ref={iframeRef}
                  src={quizUrl}
                  className="w-full h-full border-0"
                  title="Quiz"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
