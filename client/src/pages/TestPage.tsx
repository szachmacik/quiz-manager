import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Globe, Plus, Trash2, Copy, ExternalLink, Code, CheckCircle, AlertCircle, RefreshCw, Eye } from "lucide-react";

export default function TestPage() {
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [showPhp, setShowPhp] = useState(false);

  const { data: connections } = trpc.connections.list.useQuery();
  const connId = selectedConnectionId ?? connections?.[0]?.id ?? 0;

  const { data: status, refetch: refetchStatus } = trpc.testPage.status.useQuery(
    { connectionId: connId },
    { enabled: connId > 0 }
  );
  const { data: shortcodes, isLoading: loadingShortcodes } = trpc.testPage.listShortcodes.useQuery(
    { connectionId: connId },
    { enabled: connId > 0 }
  );
  const { data: phpData } = trpc.testPage.generatePhpCode.useQuery(
    { connectionId: connId },
    { enabled: connId > 0 && showPhp }
  );

  const createMutation = trpc.testPage.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Strona testowa utworzona! ${data.quizCount} quizów dodanych.`);
      refetchStatus();
    },
    onError: (e) => toast.error(`Błąd: ${e.message}`),
  });

  const deleteMutation = trpc.testPage.delete.useMutation({
    onSuccess: () => {
      toast.success("Strona testowa usunięta.");
      refetchStatus();
    },
    onError: (e) => toast.error(`Błąd: ${e.message}`),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} skopiowany!`));
  };

  const activeConn = connections?.find(c => c.id === connId);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Strona testowa WordPress</h1>
            <p className="text-muted-foreground mt-1">
              Utwórz prywatną stronę w WP ze wszystkimi shortcode'ami quizów — widoczną tylko dla adminów.
            </p>
          </div>
          <Badge variant={status?.exists ? "default" : "secondary"} className="text-sm px-3 py-1">
            {status?.exists ? (
              <><CheckCircle className="w-3 h-3 mr-1" /> Aktywna</>
            ) : (
              <><AlertCircle className="w-3 h-3 mr-1" /> Nieaktywna</>
            )}
          </Badge>
        </div>

        {/* Connection selector */}
        {connections && connections.length > 1 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Połączenie WordPress:</span>
                <Select
                  value={String(connId)}
                  onValueChange={(v) => setSelectedConnectionId(Number(v))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {connId === 0 ? (
          <Card>
            <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
              <Globe className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Najpierw dodaj połączenie WordPress w sekcji <strong>Połączenia WP</strong>.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Status card */}
            <Card className={status?.exists ? "border-green-500/30 bg-green-500/5" : "border-border"}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Status strony testowej
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.exists ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-400">Strona testowa istnieje w WordPress</span>
                    </div>
                    {status.pageUrl && (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{status.pageUrl}</code>
                        <Button size="sm" variant="outline" onClick={() => window.open(status.pageUrl!, "_blank")}>
                          <ExternalLink className="w-3 h-3 mr-1" /> Otwórz
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(status.pageUrl!, "URL")}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => createMutation.mutate({ connectionId: connId })}
                        disabled={createMutation.isPending}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Odśwież stronę
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm("Usunąć stronę testową z WordPress?")) {
                            deleteMutation.mutate({ connectionId: connId });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Usuń stronę
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Strona testowa nie istnieje. Kliknij poniżej, aby automatycznie utworzyć prywatną stronę
                      w WordPress ze wszystkimi shortcode'ami quizów.
                    </p>
                    <Button
                      onClick={() => createMutation.mutate({ connectionId: connId })}
                      disabled={createMutation.isPending}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {createMutation.isPending ? "Tworzę stronę..." : "Utwórz stronę testową"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shortcodes list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Shortcode'y quizów
                  {shortcodes && <Badge variant="secondary">{shortcodes.length}</Badge>}
                </CardTitle>
                <CardDescription>
                  Skopiuj shortcode i wklej go na dowolnej stronie WordPress aby wyświetlić quiz.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingShortcodes ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Ładowanie quizów...</div>
                ) : !shortcodes?.length ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    Brak quizów — najpierw zsynchronizuj quizy w sekcji <strong>Quizy i Snapshoty</strong>.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shortcodes.map(q => (
                      <div key={q.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{q.title}</p>
                          <code className="text-xs text-blue-400">{q.shortcode}</code>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(q.shortcode, "Shortcode")}
                            title="Kopiuj shortcode"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(q.previewUrl, "_blank")}
                            title="Podgląd quizu"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PHP integration code */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Kod integracji PHP (functions.php)
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setShowPhp(!showPhp)}>
                    {showPhp ? "Ukryj" : "Pokaż kod"}
                  </Button>
                </div>
                <CardDescription>
                  Wklej do <code>functions.php</code> swojego motywu lub niestandardowego pluginu,
                  aby włączyć webhook i ukryć stronę testową przed uczestnikami.
                </CardDescription>
              </CardHeader>
              {showPhp && phpData && (
                <CardContent>
                  <div className="relative">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap text-green-400 font-mono leading-relaxed">
                      {phpData.phpCode}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(phpData.phpCode, "Kod PHP")}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Kopiuj
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* How it works */}
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="text-sm text-blue-400">Jak to działa?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. <strong>Strona prywatna</strong> — tworzona ze statusem <code>private</code> w WordPress. Widoczna tylko dla zalogowanych adminów WP, niewidoczna dla uczestników.</p>
                <p>2. <strong>Shortcode'y</strong> — każdy quiz AYS jest dodany jako <code>[ays_quiz id="X"]</code> z nagłówkiem i opisem.</p>
                <p>3. <strong>Testowanie</strong> — zaloguj się jako admin WP i otwórz stronę testową, aby sprawdzić jak quiz wygląda i działa dla uczestnika.</p>
                <p>4. <strong>Symulacja</strong> — agenci testowi używają bezpośrednich endpointów AJAX AYS, nie potrzebują strony testowej.</p>
                <p>5. <strong>Bezpieczeństwo</strong> — strona jest automatycznie ukrywana z wyników wyszukiwania przez kod PHP w functions.php.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
