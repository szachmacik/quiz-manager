import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Download, Eye, CheckCircle, AlertCircle, RefreshCw, Mail, Building2 } from "lucide-react";

export default function MailerLiteImport() {
  const [apiKey, setApiKey] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>();
  const [contestEdition, setContestEdition] = useState("");
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"key" | "groups" | "preview" | "import">("key");
  const [isLoading, setIsLoading] = useState(false);

  const getGroups = trpc.mailerLite.getGroups.useQuery(
    { apiKey },
    { enabled: false }
  );
  const previewFields = trpc.mailerLite.previewFields.useQuery(
    { apiKey, groupId: selectedGroupId },
    { enabled: false }
  );
  const importHistory = trpc.mailerLite.getImportHistory.useQuery();
  const importMutation = trpc.mailerLite.importParticipants.useMutation({
    onSuccess: (data) => {
      toast.success(`Import zakończony: ${data.totalImported} nowych, ${data.totalUpdated} zaktualizowanych`);
      importHistory.refetch();
      setStep("key");
    },
    onError: (err) => toast.error(`Błąd importu: ${err.message}`),
  });

  const handleLoadGroups = async () => {
    if (!apiKey.trim()) { toast.error("Podaj klucz API MailerLite"); return; }
    setIsLoading(true);
    try {
      await getGroups.refetch();
      setStep("groups");
    } catch (e) {
      toast.error("Błąd połączenia z MailerLite");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    setIsLoading(true);
    try {
      const result = await previewFields.refetch();
      if (result.data?.suggestedMapping) {
        setFieldMapping(result.data.suggestedMapping);
      }
      setStep("preview");
    } catch (e) {
      toast.error("Błąd pobierania pól");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = () => {
    importMutation.mutate({ apiKey, groupId: selectedGroupId, fieldMapping, contestEdition });
  };

  const fieldLabels: Record<string, string> = {
    firstName: "Imię", lastName: "Nazwisko", schoolName: "Szkoła",
    teacherName: "Nauczyciel", teacherEmail: "Email nauczyciela",
    address: "Adres", city: "Miasto", postalCode: "Kod pocztowy",
    ageGroup: "Kategoria wiekowa", contestEdition: "Edycja konkursu",
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Mail className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Import MailerLite</h1>
            <p className="text-muted-foreground text-sm">Automatyczny import uczestników z bazy MailerLite</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Krok 1: Klucz API */}
          <Card className={`border ${step === "key" ? "border-blue-500/50" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                Klucz API
              </CardTitle>
              <CardDescription>Podaj klucz API MailerLite v3</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="password"
                placeholder="eyJ0eXAiOiJKV1Qi..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
              />
              <Input
                placeholder="Edycja konkursu (np. 2025-03)"
                value={contestEdition}
                onChange={(e) => setContestEdition(e.target.value)}
              />
              <Button onClick={handleLoadGroups} disabled={isLoading || !apiKey} className="w-full">
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                Załaduj grupy
              </Button>
              <p className="text-xs text-muted-foreground">
                Klucz API znajdziesz w MailerLite → Integracje → API → Wygeneruj token
              </p>
            </CardContent>
          </Card>

          {/* Krok 2: Wybór grupy */}
          <Card className={`border ${step === "groups" ? "border-blue-500/50" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                Wybór grupy
              </CardTitle>
              <CardDescription>Wybierz grupę subskrybentów</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {getGroups.data && getGroups.data.length > 0 ? (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <div
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${!selectedGroupId ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50"}`}
                      onClick={() => setSelectedGroupId(undefined)}
                    >
                      <div className="font-medium text-sm">Wszyscy subskrybenci</div>
                      <div className="text-xs text-muted-foreground">Importuj całą bazę</div>
                    </div>
                    {getGroups.data.map((g) => (
                      <div
                        key={g.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedGroupId === g.id ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50"}`}
                        onClick={() => setSelectedGroupId(g.id)}
                      >
                        <div className="font-medium text-sm">{g.name}</div>
                        <div className="text-xs text-muted-foreground">{g.subscriberCount} subskrybentów</div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handlePreview} disabled={isLoading} className="w-full">
                    {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                    Podgląd pól
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {step === "key" ? "Najpierw załaduj grupy" : "Brak grup — zaimportuj wszystkich"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Krok 3: Mapowanie pól */}
          <Card className={`border ${step === "preview" ? "border-blue-500/50" : "border-border"}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">3</span>
                Mapowanie pól
              </CardTitle>
              <CardDescription>AI automatycznie dopasowuje pola</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {previewFields.data ? (
                <>
                  <div className="text-sm font-medium text-green-400">
                    {previewFields.data.totalSubscribers} subskrybentów do importu
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {Object.entries(fieldLabels).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28 shrink-0">{label}:</span>
                        <select
                          className="flex-1 text-xs bg-background border border-border rounded px-2 py-1"
                          value={fieldMapping[key] || ""}
                          onChange={(e) => setFieldMapping(prev => ({ ...prev, [key]: e.target.value }))}
                        >
                          <option value="">— pomiń —</option>
                          {previewFields.data?.availableFields.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                        {fieldMapping[key] && <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />}
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={importMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {importMutation.isPending
                      ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Importuję...</>
                      : <><Download className="h-4 w-4 mr-2" />Importuj uczestników</>
                    }
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Najpierw załaduj podgląd pól
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Historia importów */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Historia importów
            </CardTitle>
          </CardHeader>
          <CardContent>
            {importHistory.data && importHistory.data.length > 0 ? (
              <div className="space-y-2">
                {importHistory.data.map((imp) => (
                  <div key={imp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      {imp.status === "completed"
                        ? <CheckCircle className="h-4 w-4 text-green-400" />
                        : imp.status === "failed"
                        ? <AlertCircle className="h-4 w-4 text-red-400" />
                        : <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />
                      }
                      <div>
                        <div className="text-sm font-medium">
                          Import {new Date(imp.importedAt).toLocaleString("pl-PL")}
                        </div>
                        {imp.status === "failed" && (
                          <div className="text-xs text-red-400">{imp.errorMessage}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline" className="text-green-400">+{imp.totalImported} nowych</Badge>
                      <Badge variant="outline" className="text-blue-400">~{imp.totalUpdated} zaktualizowanych</Badge>
                      {imp.totalSkipped > 0 && (
                        <Badge variant="outline" className="text-muted-foreground">{imp.totalSkipped} pominięto</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Brak historii importów</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
