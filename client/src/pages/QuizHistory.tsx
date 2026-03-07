import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { History, Camera, Brain, Zap, Wrench, CheckCircle, XCircle, AlertTriangle, Globe, Video, RefreshCw } from "lucide-react";

const eventConfig: Record<string, { label: string; icon: any; color: string }> = {
  snapshot_created:       { label: "Snapshot utworzony",     icon: Camera,       color: "text-blue-400" },
  ai_review_started:      { label: "Analiza AI — start",     icon: Brain,        color: "text-purple-400" },
  ai_review_completed:    { label: "Analiza AI — koniec",    icon: Brain,        color: "text-purple-400" },
  simulation_started:     { label: "Symulacja — start",      icon: Zap,          color: "text-yellow-400" },
  simulation_completed:   { label: "Symulacja — koniec",     icon: Zap,          color: "text-yellow-400" },
  patch_proposed:         { label: "Poprawka zaproponowana", icon: Wrench,       color: "text-orange-400" },
  patch_approved:         { label: "Poprawka zatwierdzona",  icon: CheckCircle,  color: "text-green-400" },
  patch_rejected:         { label: "Poprawka odrzucona",     icon: XCircle,      color: "text-red-400" },
  patch_applied:          { label: "Poprawka wdrożona",      icon: CheckCircle,  color: "text-green-400" },
  patch_rolled_back:      { label: "Rollback poprawki",      icon: RefreshCw,    color: "text-red-400" },
  settings_audited:       { label: "Audyt ustawień",         icon: CheckCircle,  color: "text-cyan-400" },
  video_verified:         { label: "Nagranie zweryfikowane", icon: Video,        color: "text-pink-400" },
  anomaly_detected:       { label: "Anomalia wykryta",       icon: AlertTriangle,color: "text-red-400" },
  test_page_created:      { label: "Strona testowa WP",      icon: Globe,        color: "text-blue-400" },
  sync_detected_change:   { label: "Zmiana wykryta (sync)",  icon: RefreshCw,    color: "text-yellow-400" },
};

export default function QuizHistory() {
  const [connectionId, setConnectionId] = useState("");
  const [quizId, setQuizId] = useState("");

  const connections = trpc.connections.list.useQuery();
  const timeline = trpc.quizHistory.getTimeline.useQuery(
    { connectionId: parseInt(connectionId, 10) || 0, quizId, limit: 100 },
    { enabled: !!connectionId && !!quizId }
  );
  const summary = trpc.quizHistory.getSummary.useQuery(
    { connectionId: parseInt(connectionId, 10) || 0, quizId },
    { enabled: !!connectionId && !!quizId }
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <History className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Historia Quizu</h1>
            <p className="text-muted-foreground text-sm">Timeline wszystkich operacji — od snapshotu do wdrożenia</p>
          </div>
        </div>

        {/* Filtry */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Połączenie WordPress</label>
                <select
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                >
                  <option value="">Wybierz połączenie...</option>
                  {connections.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">ID quizu</label>
                <Input
                  placeholder="np. 42"
                  value={quizId}
                  onChange={(e) => setQuizId(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Podsumowanie */}
        {summary.data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Snapshoty", value: summary.data.snapshots, color: "text-blue-400" },
              { label: "Symulacje", value: summary.data.simulations, color: "text-yellow-400" },
              { label: "Analizy AI", value: summary.data.aiReviews, color: "text-purple-400" },
              { label: "Poprawki", value: summary.data.patches, color: "text-green-400" },
              { label: "Anomalie", value: summary.data.anomalies, color: "text-red-400" },
            ].map((stat) => (
              <Card key={stat.label} className="border-border">
                <CardContent className="pt-4 text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Timeline */}
        {timeline.data && timeline.data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Timeline ({timeline.data.length} zdarzeń)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Linia pionowa */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-4">
                  {timeline.data.map((event, idx) => {
                    const config = eventConfig[event.eventType] || {
                      label: event.eventType, icon: History, color: "text-muted-foreground"
                    };
                    const Icon = config.icon;
                    const eventData = event.eventData as any;

                    return (
                      <div key={event.id} className="flex gap-4 relative">
                        {/* Ikona na osi */}
                        <div className={`w-10 h-10 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 z-10 ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* Treść */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium text-sm ${config.color}`}>{config.label}</span>
                            {eventData?.status && (
                              <Badge variant="outline" className="text-xs">
                                {eventData.status}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(event.occurredAt).toLocaleString("pl-PL")}
                          </div>
                          {eventData && Object.keys(eventData).length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground bg-muted/30 rounded p-2 font-mono">
                              {Object.entries(eventData).slice(0, 3).map(([k, v]) => (
                                <div key={k}>{k}: {String(v).substring(0, 60)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : connectionId && quizId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">Brak historii dla tego quizu</p>
              <p className="text-xs text-muted-foreground mt-1">Historia będzie budowana automatycznie podczas pracy z quizem</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">Wybierz połączenie i ID quizu</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
