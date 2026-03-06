import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Settings2, RefreshCw, Clock, Users, Globe, Database, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();

  const [agentDomain, setAgentDomain] = useState("");
  const [defaultAgentCount, setDefaultAgentCount] = useState("100");
  const [defaultConcurrency, setDefaultConcurrency] = useState("10");
  const [syncInterval, setSyncInterval] = useState("5");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setAgentDomain(settings.default_agent_domain ?? "");
      setDefaultAgentCount(settings.default_agent_count ?? "100");
      setDefaultConcurrency(settings.default_concurrency ?? "10");
      setSyncInterval(settings.sync_interval_minutes ?? "5");
    }
  }, [settings]);

  const saveMutation = trpc.settings.saveMultiple.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      toast.success("Ustawienia zapisane");
      setSaving(false);
    },
    onError: (e) => { toast.error(e.message); setSaving(false); },
  });

  const syncNowMutation = trpc.settings.triggerSync.useMutation({
    onSuccess: (data) => toast.success(`Synchronizacja zakończona: sprawdzono ${data.checked}, zmieniono ${data.changed}, błędy: ${data.errors}`),
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    setSaving(true);
    saveMutation.mutate({
      settings: {
        default_agent_domain: agentDomain,
        default_agent_count: defaultAgentCount,
        default_concurrency: defaultConcurrency,
        sync_interval_minutes: syncInterval,
      },
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-primary" /> Ustawienia
        </h1>
        <p className="text-muted-foreground mt-1">Konfiguracja domyślnych parametrów symulacji i synchronizacji.</p>
      </div>

      {/* Agent settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4 text-primary" /> Agenci testowi</CardTitle>
          <CardDescription>Domyślne parametry dla nowych symulacji</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Domena agentów (email)</Label>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="np. twojadomena.pl"
                value={agentDomain}
                onChange={e => setAgentDomain(e.target.value)}
                className="bg-background"
              />
            </div>
            <p className="text-xs text-muted-foreground">Agenci będą używać adresów: agent1@twojadomena.pl, agent2@twojadomena.pl, ...</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Domyślna liczba agentów</Label>
              <Input
                type="number"
                min={1} max={500}
                value={defaultAgentCount}
                onChange={e => setDefaultAgentCount(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Domyślna współbieżność</Label>
              <Input
                type="number"
                min={1} max={50}
                value={defaultConcurrency}
                onChange={e => setDefaultConcurrency(e.target.value)}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Ile agentów jednocześnie</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="w-4 h-4 text-primary" /> Auto-synchronizacja</CardTitle>
          <CardDescription>Automatyczne wykrywanie zmian w quizach WordPress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Interwał synchronizacji (minuty)</Label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                type="number"
                min={1} max={60}
                value={syncInterval}
                onChange={e => setSyncInterval(e.target.value)}
                className="bg-background w-32"
              />
              <span className="text-sm text-muted-foreground">minut</span>
            </div>
            <p className="text-xs text-muted-foreground">Co ile minut sprawdzać WordPress pod kątem zmian w quizach</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ręczna synchronizacja</p>
              <p className="text-xs text-muted-foreground">Sprawdź zmiany teraz, bez czekania na interwał</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncNowMutation.mutate()}
              disabled={syncNowMutation.isPending}
            >
              {syncNowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Synchronizuj teraz
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Zapisz ustawienia
        </Button>
      </div>
    </div>
  );
}
