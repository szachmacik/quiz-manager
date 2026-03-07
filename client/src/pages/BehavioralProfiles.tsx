import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Brain, User, Users, GraduationCap, AlertTriangle, Eye, TrendingUp, Filter } from "lucide-react";
import { toast } from "sonner";

const AGE_GROUP_LABELS: Record<string, string> = {
  zerowka: "Zerówka",
  klasa_1: "Klasa 1",
  klasa_2: "Klasa 2",
  klasa_3: "Klasa 3",
  klasa_4: "Klasa 4",
  klasa_5: "Klasa 5",
  klasa_6: "Klasa 6",
};

const EVENT_LABELS: Record<string, string> = {
  unusual_speed: "Podejrzane tempo",
  unusual_slowness: "Zbyt wolne tempo",
  copy_paste_detected: "Copy-paste",
  tab_switch: "Przełączanie zakładek",
  long_pause: "Długa przerwa",
  answer_changed_many: "Wielokrotna zmiana odpowiedzi",
  perfect_score_fast: "Idealny wynik za szybko",
  parent_intervention: "Ingerencja rodzica",
  complaint_submitted: "Złożona skarga",
  dispute_raised: "Spór o wyniki",
  late_submission: "Spóźnione nagranie",
  late_registration: "Spóźniona rejestracja",
  bulk_registration: "Masowa rejestracja",
  missing_consent: "Brak zgód RODO",
  wrong_category: "Błędna kategoria",
  technical_failure_org: "Błąd organizacyjny",
};

function RiskBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : score >= 40 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className={score >= 60 ? "text-red-400" : "text-slate-300"}>{score}/100</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function BehavioralProfiles() {
  const [roleFilter, setRoleFilter] = useState<"child" | "parent" | "teacher" | "all">("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  const { data: listData, isLoading } = trpc.behavioral.list.useQuery({
    role: roleFilter !== "all" ? roleFilter as any : undefined,
    isHighRisk: highRiskOnly ? true : undefined,
    search: search || undefined,
  });

  const { data: stats } = trpc.behavioral.stats.useQuery();

  const { data: detail } = trpc.behavioral.getDetail.useQuery(
    { profileId: selectedProfile! },
    { enabled: !!selectedProfile }
  );

  const analyzeAI = trpc.behavioral.analyzeWithAI.useMutation({
    onSuccess: () => toast.success("Analiza AI zakończona"),
    onError: () => toast.error("Błąd analizy AI"),
  });

  const profiles = listData?.profiles ?? [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Brain className="w-7 h-7 text-purple-400" />
              Profile Behawioralne
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Predykcja ryzyk i analiza potrzeb uczestników kl. 0-6
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <User className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-white">{stats.children}</div>
                <div className="text-xs text-slate-400">Dzieci</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <Users className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-white">{stats.parents}</div>
                <div className="text-xs text-slate-400">Rodzice</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <GraduationCap className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-white">{stats.teachers}</div>
                <div className="text-xs text-slate-400">Nauczyciele</div>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-red-400">{stats.highRisk}</div>
                <div className="text-xs text-slate-400">Wysokie ryzyko</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rozkład po grupach wiekowych */}
        {stats && stats.byAgeGroup.some(g => g.count > 0) && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Rozkład ryzyka po grupach wiekowych
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 md:grid-cols-7 gap-3">
              {stats.byAgeGroup.map(g => (
                <div key={g.ageGroup} className="text-center">
                  <div className="text-xs text-slate-400 mb-1">{AGE_GROUP_LABELS[g.ageGroup]}</div>
                  <div className="text-lg font-bold text-white">{g.count}</div>
                  <div className={`text-xs ${g.avgRisk >= 60 ? "text-red-400" : g.avgRisk >= 40 ? "text-yellow-400" : "text-green-400"}`}>
                    {g.avgRisk}% ryzyko
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="list">Lista profili ({profiles.length})</TabsTrigger>
            {selectedProfile && <TabsTrigger value="detail">Szczegóły profilu</TabsTrigger>}
          </TabsList>

          {/* ─── Lista profili ─── */}
          <TabsContent value="list" className="space-y-4">
            {/* Filtry */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Szukaj po emailu lub nazwie..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <Select value={roleFilter} onValueChange={v => setRoleFilter(v as any)}>
                <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Wszyscy</SelectItem>
                  <SelectItem value="child">Dzieci</SelectItem>
                  <SelectItem value="parent">Rodzice</SelectItem>
                  <SelectItem value="teacher">Nauczyciele</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={highRiskOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setHighRiskOnly(!highRiskOnly)}
                className="gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Tylko wysokie ryzyko
              </Button>
            </div>

            {isLoading ? (
              <div className="text-slate-400 text-center py-12">Ładowanie profili...</div>
            ) : profiles.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-12 text-center">
                  <Brain className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Brak profili behawioralnych.</p>
                  <p className="text-slate-500 text-sm mt-2">Profile tworzone są automatycznie po sesjach quizów z telemetrią.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {profiles.map(profile => (
                  <Card
                    key={profile.id}
                    className={`border cursor-pointer transition-colors hover:border-slate-500 ${
                      profile.isHighRisk ? "bg-red-500/5 border-red-500/30" : "bg-slate-800/50 border-slate-700"
                    }`}
                    onClick={() => { setSelectedProfile(profile.id); setActiveTab("detail"); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {profile.role === "child" ? <User className="w-5 h-5 text-blue-400" /> :
                           profile.role === "parent" ? <Users className="w-5 h-5 text-green-400" /> :
                           <GraduationCap className="w-5 h-5 text-yellow-400" />}
                          <div>
                            <div className="font-medium text-white text-sm">{profile.participantName ?? profile.participantEmail}</div>
                            <div className="text-xs text-slate-400">{profile.participantEmail}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {profile.ageGroup && (
                                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                  {AGE_GROUP_LABELS[profile.ageGroup]}
                                </Badge>
                              )}
                              <span className="text-xs text-slate-500">{profile.participationCount ?? 0} edycji</span>
                              {profile.averageScore !== null && (
                                <span className="text-xs text-slate-500">Avg: {profile.averageScore}%</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {profile.isHighRisk && (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Wysokie ryzyko</Badge>
                          )}
                          {profile.requiresSpecialAttention && (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Wymaga uwagi</Badge>
                          )}
                          <div className="text-right">
                            <div className={`text-lg font-bold ${(profile.cheatingRiskScore ?? 0) >= 60 ? "text-red-400" : "text-slate-300"}`}>
                              {profile.cheatingRiskScore ?? 0}
                            </div>
                            <div className="text-xs text-slate-500">ryzyko</div>
                          </div>
                          <Eye className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Szczegóły profilu ─── */}
          <TabsContent value="detail" className="space-y-4">
            {detail ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{detail.profile.participantName ?? detail.profile.participantEmail}</h2>
                    <p className="text-slate-400 text-sm">{detail.profile.participantEmail}</p>
                  </div>
                  <Button
                    onClick={() => analyzeAI.mutate({ profileId: detail.profile.id })}
                    disabled={analyzeAI.isPending}
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    <Brain className="w-4 h-4" />
                    {analyzeAI.isPending ? "Analizuję..." : "Analiza AI"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Wskaźniki ryzyka */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-300">Wskaźniki ryzyka</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <RiskBar score={detail.profile.cheatingRiskScore ?? 0} label="Ryzyko niesamodzielności" />
                      <RiskBar score={detail.profile.interventionRiskScore ?? 0} label="Ryzyko ingerencji rodzica" />
                      <RiskBar score={detail.profile.complaintRiskScore ?? 0} label="Ryzyko pretensji" />
                      <RiskBar score={detail.profile.organizationalRiskScore ?? 0} label="Ryzyko błędów org." />
                    </CardContent>
                  </Card>

                  {/* Progi wiekowe */}
                  {detail.thresholds && (
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-300">
                          Progi dla {detail.profile.ageGroup ? AGE_GROUP_LABELS[detail.profile.ageGroup] : "grupy"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Obecność rodzica</span>
                          <Badge className={detail.thresholds.parentPresenceNormal
                            ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                            {detail.thresholds.parentPresenceNormal ? "Normalna" : "Podejrzana"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Min. czas</span>
                          <span className="text-white">{Math.round(detail.thresholds.minCompletionTimeMs / 60000)} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Podejrzany czas (100%)</span>
                          <span className="text-yellow-400">&lt; {Math.round(detail.thresholds.perfectScoreSuspiciousMs / 60000)} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ryzyko copy-paste</span>
                          <span className={detail.thresholds.copyPasteRisk === "high" ? "text-red-400" : "text-yellow-400"}>
                            {detail.thresholds.copyPasteRisk}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-2">{detail.thresholds.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Analiza AI */}
                {detail.profile.aiNeedsAnalysis && (
                  <Card className="bg-purple-500/10 border-purple-500/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-purple-400 flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        Analiza AI — Potrzeby uczestnika
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-slate-300 text-sm">{String(detail.profile.aiNeedsAnalysis ?? "")}</p>
                      {Boolean(detail.profile.predictedRisks) && (
                        <div>
                          <div className="text-xs font-semibold text-slate-400 mb-2">Przewidywane ryzyka:</div>
                          <ul className="space-y-1">
                            {(JSON.parse(String(detail.profile.predictedRisks)) as unknown[]).map((r, i) => (
                              <li key={i} className="text-xs text-slate-300 flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                                {String(r)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Boolean(detail.profile.aiRecommendations) && (
                        <div>
                          <div className="text-xs font-semibold text-slate-400 mb-2">Rekomendacje:</div>
                          <ul className="space-y-1">
                            {(JSON.parse(String(detail.profile.aiRecommendations)) as unknown[]).map((r, i) => (
                              <li key={i} className="text-xs text-slate-300 flex items-center gap-2">
                                <span className="text-green-400">→</span>
                                {String(r)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Boolean(detail.profile.requiresSpecialAttention) && Boolean(detail.profile.specialAttentionNote) && (
                        <div className="bg-orange-500/10 rounded p-3">
                          <div className="text-xs font-semibold text-orange-400 mb-1">⚠️ Wymaga uwagi</div>
                          <p className="text-slate-300 text-xs">{detail.profile.specialAttentionNote}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Zdarzenia behawioralne */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300">Zdarzenia behawioralne ({detail.events.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.events.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-4">Brak zdarzeń</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.events.map(event => (
                          <div key={event.id} className={`flex items-start gap-3 p-3 rounded border text-sm ${
                            event.severity === "critical" ? "bg-red-500/10 border-red-500/30" :
                            event.severity === "warning" ? "bg-yellow-500/10 border-yellow-500/30" :
                            "bg-slate-700/50 border-slate-600"
                          }`}>
                            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                              event.severity === "critical" ? "text-red-400" :
                              event.severity === "warning" ? "text-yellow-400" : "text-slate-400"
                            }`} />
                            <div className="flex-1">
                              <div className="font-medium text-white text-xs">
                                {EVENT_LABELS[event.eventType] ?? event.eventType}
                              </div>
                              <p className="text-slate-300 text-xs mt-0.5">{event.description}</p>
                              <div className="text-slate-500 text-xs mt-1">
                                {new Date(event.occurredAt).toLocaleString("pl-PL")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-slate-400 text-center py-12">Ładowanie szczegółów...</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
