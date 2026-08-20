import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Copy, Play, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { KindBadge } from "@/components/kind-badge";
import { RequireUser } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { deleteEntry, getEntry, getEntryVersions, toggleStar, updateEntry } from "@/lib/canon/fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library_/$id")({
  component: EntryPage,
});

function EntryPage() {
  return (
    <RequireUser>
      <EntryInner />
    </RequireUser>
  );
}

function EntryInner() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const entryQ = useQuery({
    queryKey: ["entry", id],
    queryFn: () => getEntry({ data: id }),
  });
  const versionsQ = useQuery({
    queryKey: ["entry-versions", id],
    queryFn: () => getEntryVersions({ data: id }),
  });

  const starM = useMutation({
    mutationFn: () => toggleStar({ data: id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["entry", id] });
      void qc.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const saveM = useMutation({
    mutationFn: () => updateEntry({ data: { id, body: draft } }),
    onSuccess: () => {
      setEditing(false);
      toast.success("Saved as a new version");
      void qc.invalidateQueries({ queryKey: ["entry", id] });
      void qc.invalidateQueries({ queryKey: ["entry-versions", id] });
      void qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const delM = useMutation({
    mutationFn: () => deleteEntry({ data: id }),
    onSuccess: () => {
      toast.success("Removed from the library");
      void navigate({ to: "/library" });
      void qc.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const entry = entryQ.data;

  return (
    <AppShell
      title={entry?.title ?? "Entry"}
      action={
        entry ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => starM.mutate()}>
              <Star className={cn("size-4", entry.starred && "fill-accent text-accent")} />
              {entry.starred ? "Starred" : "Star"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(entry.body);
                toast.success("Copied");
              }}
            >
              <Copy className="size-4" />
              Copy
            </Button>
            <Button asChild size="sm">
              <Link to="/library/$id/run" params={{ id: entry.id }}>
                <Play className="size-4" />
                Run with Grok
              </Link>
            </Button>
          </div>
        ) : undefined
      }
    >
      <Link to="/library" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        Library
      </Link>
      {entryQ.isLoading || !entry ? (
        <Skeleton className="h-80" />
      ) : (
        <article>
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={entry.kind} />
            <span className="text-xs text-subtle">v{entry.version}</span>
            {entry.isStarter && <span className="text-xs text-subtle">Starter</span>}
          </div>
          {entry.summary && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{entry.summary}</p>
          )}
          {entry.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {entry.tags.map((tag) => (
                <li key={tag} className="rounded-full bg-raised px-2.5 py-0.5 text-xs text-muted">{tag}</li>
              ))}
            </ul>
          )}
          {entry.semanticPhrases.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-subtle">Indexed for meaning</p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                {entry.semanticPhrases.slice(0, 12).join(" · ")}
              </p>
            </div>
          )}
          <div className="mt-8 rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)] md:p-6">
            {editing ? (
              <>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-72 font-mono text-sm leading-relaxed"
                />
                <div className="mt-4 flex gap-2">
                  <Button type="button" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
                    {saveM.isPending ? "Filing…" : "Save version"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-fg">{entry.body}</pre>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/library/$id/run" params={{ id: entry.id }}>
                      <Play className="size-4" />
                      Run with Grok
                    </Link>
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => { setDraft(entry.body); setEditing(true); }}>
                    Revise
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { if (window.confirm("Remove this piece from the library?")) delM.mutate(); }}>
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
          {entry.variables.length > 0 && (
            <p className="mt-4 font-mono text-xs text-subtle">Variables: {entry.variables.join(", ")}</p>
          )}
          {versionsQ.data && versionsQ.data.length > 1 && (
            <section className="mt-10">
              <h2 className="text-xs uppercase tracking-wider text-subtle">Versions</h2>
              <ol className="mt-3 space-y-2">
                {versionsQ.data.map((v) => (
                  <li key={v.version} className="text-sm text-muted">v{v.version} — {v.title}</li>
                ))}
              </ol>
            </section>
          )}
        </article>
      )}
    </AppShell>
  );
}
