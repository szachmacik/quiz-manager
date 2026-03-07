import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, Shield, CheckCircle, Search, BookOpen, ClipboardList, Zap, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  wordpress_core: "WordPress Core",
  ays_plugin: "AYS Plugin",
  server_infra: "Infrastruktura",
  network: "Sieć / CDN",
  user_behavior: "Zachowanie uczestników",
  competition_setup: "Ustawienia konkursu",
  recording: "Nagrywanie wideo",
  native_migration: "Migracja natywna",
  offline_contest: "Konkurs offline",
};

const IMPACT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Krytyczny", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  high: { label: "Wysoki", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  medium: { label: "Średni", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  low: { label: "Niski", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
};

const PROB_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: "Wysokie", color: "text-red-400" },
  medium: { label: "Średnie", color: "text-yellow-400" },
  low: { label: "Niskie", color: "text-green-400" },
};

export default function RiskKnowledgeBase() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [impact, setImpact] = useState("all");
  const [activeTab, setActiveTab] = useState("risks");

  const { data: risksData, isLoading } = trpc.risks.list.useQuery({
    search: search || undefined,
    category: category !== "all" ? category : undefined,
    platform: platform !== "all" ? platform : undefined,
    impact: impact !== "all" ? impact : undefined,
    showBuiltIn: true,
  });

  const { data: checklist } = trpc.risks.getPreContestChecklist.useQuery();
  const { data: stats } = trpc.risks.stats.useQuery();

  const allRisks = [...(risksData?.builtIn ?? []), ...(risksData?.custom ?? [])];

  const copyChecklist = () => {
    if (!checklist) return;
    const text = checklist.map(item =>
      `## ${item.riskTitle} [${item.priority.toUpperCase()}]\n${item.items.map(i => `- [ ] ${i}`).join("\n")}`
    ).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Checklista skopiowana do schowka");
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-7 h-7 text-blue-400" />
              Baza Wiedzy o Ryzykach
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {stats?.total ?? 0} ryzyk zidentyfikowanych dla konkursu online kl. 0-6 na WordPress + AYS
            </p>
          </div>
          <Button onClick={copyChecklist} variant="outline" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Kopiuj checklistę
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{stats?.critical ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">Krytyczne</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{stats?.highRiskScore ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">Wysoki wynik ryzyka</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{stats?.wordpressOnly ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">Tylko WordPress</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{stats?.total ?? 0}</div>
              <div className="text-xs text-slate-400 mt-1">Łącznie</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="risks" className="data-[state=active]:bg-slate-700">
              <BookOpen className="w-4 h-4 mr-2" />
              Baza ryzyk ({allRisks.length})
            </TabsTrigger>
            <TabsTrigger value="checklist" className="data-[state=active]:bg-slate-700">
              <ClipboardList className="w-4 h-4 mr-2" />
              Checklista przed konkursem
            </TabsTrigger>
          </TabsList>

          {/* ─── Baza ryzyk ─── */}
          <TabsContent value="risks" className="space-y-4">
            {/* Filtry */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Szukaj ryzyk..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Kategoria" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Wszystkie kategorie</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Platforma" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="wordpress">WordPress</SelectItem>
                  <SelectItem value="native">Natywna</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
              <Select value={impact} onValueChange={setImpact}>
                <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Wpływ" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="critical">Krytyczny</SelectItem>
                  <SelectItem value="high">Wysoki</SelectItem>
                  <SelectItem value="medium">Średni</SelectItem>
                  <SelectItem value="low">Niski</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="text-slate-400 text-center py-12">Ładowanie bazy ryzyk...</div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {allRisks.map((risk, idx) => {
                  const impactCfg = IMPACT_CONFIG[risk.impact] ?? IMPACT_CONFIG.medium;
                  const probCfg = PROB_CONFIG[risk.probability] ?? PROB_CONFIG.medium;
                  return (
                    <AccordionItem
                      key={idx}
                      value={`risk-${idx}`}
                      className={`border rounded-lg px-4 ${impactCfg.bg}`}
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 text-left w-full">
                          <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${impactCfg.color}`} />
                          <div className="flex-1">
                            <div className="font-medium text-white text-sm">{risk.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                {CATEGORY_LABELS[risk.category] ?? risk.category}
                              </Badge>
                              <span className={`text-xs ${impactCfg.color}`}>Wpływ: {impactCfg.label}</span>
                              <span className={`text-xs ${probCfg.color}`}>Prawdopodobieństwo: {probCfg.label}</span>
                              <span className="text-xs text-slate-500">Wynik: {risk.riskScore}/20</span>
                              {risk.isWordPressSpecific && (
                                <Badge className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">WordPress</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-3">
                        <p className="text-slate-300 text-sm">{risk.description}</p>

                        <div className="bg-slate-900/50 rounded p-3">
                          <div className="text-xs font-semibold text-yellow-400 mb-1">📋 Scenariusz</div>
                          <p className="text-slate-300 text-xs">{risk.scenario}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-red-500/10 rounded p-3">
                            <div className="text-xs font-semibold text-red-400 mb-1">⚡ Natychmiastowe działanie</div>
                            <p className="text-slate-300 text-xs">{risk.immediateAction}</p>
                          </div>
                          <div className="bg-green-500/10 rounded p-3">
                            <div className="text-xs font-semibold text-green-400 mb-1">🛡️ Zapobieganie</div>
                            <p className="text-slate-300 text-xs">{risk.prevention}</p>
                          </div>
                        </div>

                        {risk.nativeSolution && (
                          <div className="bg-blue-500/10 rounded p-3">
                            <div className="text-xs font-semibold text-blue-400 mb-1">🚀 Wersja natywna</div>
                            <p className="text-slate-300 text-xs">{risk.nativeSolution}</p>
                          </div>
                        )}

                        {risk.checklistItems && risk.checklistItems.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-400 mb-2">✅ Checklista</div>
                            <ul className="space-y-1">
                              {risk.checklistItems.map((item: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                                  <ChevronRight className="w-3 h-3 text-slate-500" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {risk.tags?.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs border-slate-700 text-slate-500">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </TabsContent>

          {/* ─── Checklista ─── */}
          <TabsContent value="checklist" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">
                Kompletna checklista przed konkursem — posortowana według priorytetu
              </p>
              <Button onClick={copyChecklist} size="sm" className="gap-2">
                <ClipboardList className="w-4 h-4" />
                Kopiuj wszystko
              </Button>
            </div>

            {checklist?.map((section, idx) => {
              const priorityColor = section.priority === "critical" ? "text-red-400 border-red-500/30 bg-red-500/10"
                : section.priority === "high" ? "text-orange-400 border-orange-500/30 bg-orange-500/10"
                : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";

              return (
                <Card key={idx} className={`border ${priorityColor}`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      {section.riskTitle}
                      <Badge variant="outline" className={`text-xs ml-auto ${priorityColor}`}>
                        {section.priority.toUpperCase()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-2">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <CheckCircle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
