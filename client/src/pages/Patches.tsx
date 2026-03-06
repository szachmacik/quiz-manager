import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RotateCcw, AlertTriangle, Brain, Shield } from "lucide-react";

const statusConfig = {
  pending: { label: "Oczekuje", color: "text-yellow-400", badge: "secondary" as const },
  approved: { label: "Zatwierdzona", color: "text-blue-400", badge: "default" as const },
  rejected: { label: "Odrzucona", color: "text-red-400", badge: "destructive" as const },
  applied: { label: "Wdrożona", color: "text-green-400", badge: "default" as const },
  rolled_back: { label: "Cofnięta", color: "text-orange-400", badge: "secondary" as const },
};

export default function PatchesPage() {
  const utils = trpc.useUtils();
  const { data: patches, isLoading } = trpc.patches.list.useQuery({});

  const approveMutation = trpc.patches.approve.useMutation({
    onSuccess: () => { utils.patches.list.invalidate(); toast.success("Poprawka zatwierdzona — gotowa do wdrożenia"); },
    onError: (e) => toast.error(e.message),
  });
  const rejectMutation = trpc.patches.reject.useMutation({
    onSuccess: () => { utils.patches.list.invalidate(); toast.info("Poprawka odrzucona"); },
    onError: (e) => toast.error(e.message),
  });
  const applyMutation = trpc.patches.applyPatch.useMutation({
    onSuccess: () => { utils.patches.list.invalidate(); toast.success("Poprawka wdrożona na WordPress!"); },
    onError: (e) => toast.error(`Błąd wdrożenia: ${e.message}`),
  });
  const rollbackMutation = trpc.patches.rollback.useMutation({
    onSuccess: () => { utils.patches.list.invalidate(); toast.success("Poprawka cofnięta — przywrócono oryginalną wartość"); },
    onError: (e) => toast.error(e.message),
  });

  const pendingPatches = patches?.filter(p => p.status === "pending") ?? [];
  const otherPatches = patches?.filter(p => p.status !== "pending") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Propozycje poprawek</h1>
        <p className="text-muted-foreground mt-1">Przeglądaj i zatwierdzaj poprawki zaproponowane przez AI. Żadna zmiana nie trafia na produkcję bez Twojej zgody.</p>
      </div>

      {/* Safety protocol banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-blue-300 mb-1">Protokół bezpiecznego wdrażania</p>
          <p className="text-blue-200/70">
            Każda poprawka przechodzi przez: <strong>Analiza AI</strong> → <strong>Twoja akceptacja</strong> → <strong>Wdrożenie na WordPress</strong>. 
            Możesz cofnąć każdą wdrożoną zmianę jednym kliknięciem.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : patches?.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Brain className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Brak propozycji poprawek. Uruchom analizę AI quizu, aby wygenerować sugestie.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pending patches — require action */}
          {pendingPatches.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Wymagają Twojej decyzji ({pendingPatches.length})
              </h2>
              {pendingPatches.map(patch => (
                <PatchCard
                  key={patch.id}
                  patch={patch}
                  onApprove={() => approveMutation.mutate({ id: patch.id })}
                  onReject={() => rejectMutation.mutate({ id: patch.id })}
                  isApproving={approveMutation.isPending && approveMutation.variables?.id === patch.id}
                  isRejecting={rejectMutation.isPending && rejectMutation.variables?.id === patch.id}
                />
              ))}
            </div>
          )}

          {/* Approved — ready to apply */}
          {otherPatches.filter(p => p.status === "approved").length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Zatwierdzone — gotowe do wdrożenia</h2>
              {otherPatches.filter(p => p.status === "approved").map(patch => (
                <PatchCard
                  key={patch.id}
                  patch={patch}
                  onApply={() => applyMutation.mutate({ id: patch.id })}
                  isApplying={applyMutation.isPending && applyMutation.variables?.id === patch.id}
                />
              ))}
            </div>
          )}

          {/* Applied — can rollback */}
          {otherPatches.filter(p => p.status === "applied").length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wider">Wdrożone na WordPress</h2>
              {otherPatches.filter(p => p.status === "applied").map(patch => (
                <PatchCard
                  key={patch.id}
                  patch={patch}
                  onRollback={() => rollbackMutation.mutate({ id: patch.id })}
                  isRollingBack={rollbackMutation.isPending && rollbackMutation.variables?.id === patch.id}
                />
              ))}
            </div>
          )}

          {/* Other statuses */}
          {otherPatches.filter(p => p.status === "rejected" || p.status === "rolled_back").length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Historia</h2>
              {otherPatches.filter(p => p.status === "rejected" || p.status === "rolled_back").map(patch => (
                <PatchCard key={patch.id} patch={patch} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PatchCard({ patch, onApprove, onReject, onApply, onRollback, isApproving, isRejecting, isApplying, isRollingBack }: {
  patch: any;
  onApprove?: () => void;
  onReject?: () => void;
  onApply?: () => void;
  onRollback?: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isApplying?: boolean;
  isRollingBack?: boolean;
}) {
  const cfg = statusConfig[patch.status as keyof typeof statusConfig] ?? statusConfig.pending;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant={cfg.badge} className="text-xs">{cfg.label}</Badge>
              <Badge variant="outline" className="text-xs">{patch.patchType}</Badge>
              {patch.targetWpId && <span className="text-xs text-muted-foreground font-mono">WP ID: {patch.targetWpId}</span>}
            </div>
            <p className="font-semibold text-foreground text-sm">{patch.title}</p>
            {patch.description && <p className="text-xs text-muted-foreground mt-1">{patch.description}</p>}
          </div>
        </div>

        {/* Before/After comparison */}
        {(patch.originalValue || patch.proposedValue) && (
          <div className="grid grid-cols-2 gap-3">
            {patch.originalValue && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Oryginał:</p>
                <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs text-red-300 font-mono break-all">{patch.originalValue}</div>
              </div>
            )}
            {patch.proposedValue && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Propozycja:</p>
                <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-xs text-green-300 font-mono break-all">{patch.proposedValue}</div>
              </div>
            )}
          </div>
        )}

        {/* Reasoning */}
        {patch.reasoning && (
          <div className="bg-muted/30 rounded p-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Uzasadnienie AI: </span>{patch.reasoning}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {patch.status === "pending" && (
            <>
              <Button size="sm" className="gap-2" onClick={onApprove} disabled={isApproving}>
                {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Zatwierdź
              </Button>
              <Button size="sm" variant="destructive" className="gap-2" onClick={onReject} disabled={isRejecting}>
                {isRejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Odrzuć
              </Button>
            </>
          )}
          {patch.status === "approved" && (
            <Button size="sm" variant="default" className="gap-2 bg-green-600 hover:bg-green-700" onClick={onApply} disabled={isApplying}>
              {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Wdróż na WordPress
            </Button>
          )}
          {patch.status === "applied" && (
            <Button size="sm" variant="outline" className="gap-2 text-orange-400 border-orange-400/30 hover:bg-orange-400/10" onClick={onRollback} disabled={isRollingBack}>
              {isRollingBack ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Cofnij zmianę
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
