import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { RequireUser } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAiStatus, getCanon, rebuildCanon } from "@/lib/canon/fns";

export const Route = createFileRoute("/canon")({ component: CanonPage });

function CanonPage() {
  return (
    <RequireUser>
      <CanonInner />
    </RequireUser>
  );
}

function CanonInner() {
  const qc = useQueryClient();
  const docQ = useQuery({ queryKey: ["canon-doc"], queryFn: () => getCanon() });
  const aiQ = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus() });

  const rebuild = useMutation({
    mutationFn: () => rebuildCanon(),
    onSuccess: () => {
      toast.success("Canon rebuilt from the library");
      void qc.invalidateQueries({ queryKey: ["canon-doc"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const doc = docQ.data;

  return (
    <AppShell
      title="Canon"
      action={
        <Button
          type="button"
          variant="secondary"
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending || aiQ.data?.available === false}
        >
          {rebuild.isPending ? "Rebuilding…" : "Rebuild from library"}
        </Button>
      }
    >
      <p className="max-w-xl text-sm leading-relaxed text-muted">
        A living house style distilled from everything you have filed. Rebuild
        after a batch of captures.
      </p>
      {aiQ.data?.available === false && (
        <p className="mt-4 text-sm text-muted">AI is not available in this environment.</p>
      )}
      {docQ.isLoading ? (
        <Skeleton className="mt-8 h-80" />
      ) : !doc ? (
        <div className="mt-16 max-w-md">
          <p className="font-display text-2xl tracking-tight">Not written yet.</p>
          <p className="mt-2 text-sm text-muted">
            Capture a few pieces, then rebuild. The agent will extract the rules you keep repeating.
          </p>
        </div>
      ) : (
        <article className="mt-8 max-w-2xl rounded-[var(--radius-xl)] bg-surface p-6 shadow-[var(--shadow-border)]">
          <p className="text-xs text-subtle">Version {doc.version}</p>
          <div className="mt-4 space-y-4 whitespace-pre-wrap font-display text-lg leading-relaxed text-fg">
            {doc.body}
          </div>
        </article>
      )}
    </AppShell>
  );
}
