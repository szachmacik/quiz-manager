import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Globe, Plus, CheckCircle2, XCircle, Clock, Loader2, Wifi } from "lucide-react";

const statusConfig = {
  active: { label: "Aktywne", icon: CheckCircle2, color: "text-green-400", badge: "default" as const },
  error: { label: "Błąd", icon: XCircle, color: "text-red-400", badge: "destructive" as const },
  untested: { label: "Nie przetestowane", icon: Clock, color: "text-yellow-400", badge: "secondary" as const },
};

export default function ConnectionsPage() {
  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.connections.list.useQuery();
  const createMutation = trpc.connections.create.useMutation({
    onSuccess: () => { utils.connections.list.invalidate(); setOpen(false); toast.success("Połączenie dodane"); },
    onError: (e) => toast.error(e.message),
  });
  const testMutation = trpc.connections.test.useMutation({
    onSuccess: (data, vars) => {
      utils.connections.list.invalidate();
      if (data.success) toast.success(`Połączenie aktywne: ${(data.info as any)?.name}`);
      else toast.error(`Błąd połączenia: ${data.error}`);
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", siteUrl: "", apiUser: "", apiPassword: "",
    mysqlHost: "", mysqlDb: "", mysqlUser: "", mysqlPassword: "", tablePrefix: "wp_",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name, siteUrl: form.siteUrl, apiUser: form.apiUser, apiPassword: form.apiPassword,
      mysqlHost: form.mysqlHost || undefined, mysqlDb: form.mysqlDb || undefined,
      mysqlUser: form.mysqlUser || undefined, mysqlPassword: form.mysqlPassword || undefined,
      tablePrefix: form.tablePrefix,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Połączenia WordPress</h1>
          <p className="text-muted-foreground mt-1">Zarządzaj połączeniami z witrynami WordPress z pluginem AYS Quiz Maker.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Dodaj połączenie</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nowe połączenie WordPress</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>Nazwa połączenia</Label>
                <Input placeholder="Moja strona konkursowa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>URL strony WordPress</Label>
                <Input placeholder="https://twojadomena.pl" value={form.siteUrl} onChange={e => setForm(f => ({ ...f, siteUrl: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Login WP Admin</Label>
                  <Input placeholder="admin" value={form.apiUser} onChange={e => setForm(f => ({ ...f, apiUser: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Application Password</Label>
                  <Input type="password" placeholder="xxxx xxxx xxxx xxxx" value={form.apiPassword} onChange={e => setForm(f => ({ ...f, apiPassword: e.target.value }))} required />
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">Opcjonalne: bezpośredni dostęp MySQL</summary>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1">
                    <Label>Host MySQL</Label>
                    <Input placeholder="localhost" value={form.mysqlHost} onChange={e => setForm(f => ({ ...f, mysqlHost: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Baza danych</Label>
                    <Input placeholder="wordpress_db" value={form.mysqlDb} onChange={e => setForm(f => ({ ...f, mysqlDb: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Użytkownik MySQL</Label>
                    <Input value={form.mysqlUser} onChange={e => setForm(f => ({ ...f, mysqlUser: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Hasło MySQL</Label>
                    <Input type="password" value={form.mysqlPassword} onChange={e => setForm(f => ({ ...f, mysqlPassword: e.target.value }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Prefiks tabel</Label>
                    <Input placeholder="wp_" value={form.tablePrefix} onChange={e => setForm(f => ({ ...f, tablePrefix: e.target.value }))} />
                  </div>
                </div>
              </details>
              <div className="pt-2 text-xs text-muted-foreground bg-muted/30 rounded p-3">
                <strong>Jak uzyskać Application Password:</strong> WP Admin → Użytkownicy → Twój profil → Application Passwords → dodaj nazwę → Dodaj nowe hasło aplikacji
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Zapisz połączenie
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : connections?.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Globe className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Brak połączeń. Dodaj pierwsze połączenie WordPress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections?.map(conn => {
            const cfg = statusConfig[conn.status];
            const StatusIcon = cfg.icon;
            return (
              <Card key={conn.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{conn.name}</span>
                          <Badge variant={cfg.badge} className="text-xs gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <a href={conn.siteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                          {conn.siteUrl}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {conn.lastTestedAt && (
                        <span className="text-xs text-muted-foreground">
                          Testowano: {new Date(conn.lastTestedAt).toLocaleString("pl-PL")}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => testMutation.mutate({ id: conn.id })}
                        disabled={testMutation.isPending && testMutation.variables?.id === conn.id}
                      >
                        {testMutation.isPending && testMutation.variables?.id === conn.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Wifi className="w-3 h-3" />
                        }
                        Testuj
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span>Użytkownik: <span className="text-foreground">{conn.apiUser}</span></span>
                    <span>Prefiks: <span className="text-foreground font-mono">{conn.tablePrefix}</span></span>
                    {conn.mysqlHost && <span>MySQL: <span className="text-foreground">{conn.mysqlHost}</span></span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
