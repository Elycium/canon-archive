import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { KindBadge } from "@/components/kind-badge";
import { RequireUser } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  clearRun,
  fileRunReply,
  getAiStatus,
  getEntry,
  listRunMessages,
  sendRunMessage,
} from "@/lib/canon/fns";
import type { EntryKind } from "@/lib/canon/types";

export const Route = createFileRoute("/library_/$id_/run")({
  component: RunPage,
});

const HINT: Record<EntryKind, string> = {
  system: "Talk to this agent…",
  prompt: "Give it the input this prompt expects…",
  framework: "Give it a job to run through this framework…",
};

function RunPage() {
  return (
    <RequireUser>
      <RunInner />
    </RequireUser>
  );
}

function varKey(raw: string): string {
  return raw.replace(/^\{\{?/, "").replace(/\}\}?$/, "").trim();
}

function RunInner() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});

  const entryQ = useQuery({
    queryKey: ["entry", id],
    queryFn: () => getEntry({ data: id }),
  });
  const msgsQ = useQuery({
    queryKey: ["run-msgs", id],
    queryFn: () => listRunMessages({ data: id }),
  });
  const aiQ = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus() });

  const entry = entryQ.data;
  const keys = useMemo(
    () => [...new Set((entry?.variables ?? []).map(varKey).filter(Boolean))],
    [entry?.variables],
  );
  const messages = msgsQ.data ?? [];
  const hasReply = messages.some((m) => m.role === "assistant");
  const aiOff = aiQ.data?.available === false;

  const send = useMutation({
    mutationFn: (content: string) =>
      sendRunMessage({ data: { entryId: id, content, variables: vars } }),
    onSuccess: (msgs) => {
      setText("");
      qc.setQueryData(["run-msgs", id], msgs);
      requestAnimationFrame(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const file = useMutation({
    mutationFn: (as: "version" | "new") => fileRunReply({ data: { entryId: id, as } }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["entry"] });
      if (result.as === "new") {
        toast.success("Filed as a new library piece");
        void navigate({ to: "/library/$id", params: { id: result.entry.id } });
      } else {
        toast.success(`Saved as v${result.entry.version} of this piece`);
        void qc.invalidateQueries({ queryKey: ["entry", id] });
        void qc.invalidateQueries({ queryKey: ["entry-versions", id] });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reset = useMutation({
    mutationFn: () => clearRun({ data: id }),
    onSuccess: () => {
      qc.setQueryData(["run-msgs", id], []);
      toast.success("Run cleared");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppShell
      title={entry ? `Run · ${entry.title}` : "Run"}
      action={
        entry ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={!hasReply || file.isPending} onClick={() => file.mutate("version")}>
              Save reply as version
            </Button>
            <Button type="button" size="sm" disabled={!hasReply || file.isPending} onClick={() => file.mutate("new")}>
              File as new piece
            </Button>
          </div>
        ) : undefined
      }
    >
      <Link to="/library/$id" params={{ id }} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        Back to piece
      </Link>
      {entryQ.isLoading || !entry ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={entry.kind} />
            <span className="text-xs text-subtle">Live Grok session</span>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Grok is running this {entry.kind} as the session. Replies can be saved as a
            new version of this piece, or filed as a separate library item.
          </p>
          {keys.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {keys.map((key) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block font-mono text-xs text-subtle">{key}</span>
                  <Input
                    value={vars[key] ?? ""}
                    onChange={(e) => setVars((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={key}
                  />
                </label>
              ))}
            </div>
          )}
          <div ref={scroller} className="mt-6 max-h-[48vh] space-y-4 overflow-y-auto rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-6">
            {messages.length === 0 && (
              <p className="text-sm text-muted">
                First message starts the run. The piece itself stays in the system turn — it is not pasted into the thread.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "ml-6 md:ml-16" : "mr-6 md:mr-16"}>
                <p className="text-[11px] uppercase tracking-wider text-subtle">{m.role === "user" ? "You" : "Grok"}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">{m.content}</p>
              </div>
            ))}
            {send.isPending && <p className="text-sm text-subtle">Grok is running the piece…</p>}
          </div>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; send.mutate(text.trim()); }}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={HINT[entry.kind]} className="min-h-24" disabled={aiOff} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!text.trim() || send.isPending || aiOff}>
                {send.isPending ? "Running…" : "Send"}
              </Button>
              {messages.length > 0 && (
                <Button type="button" variant="ghost" disabled={reset.isPending} onClick={() => reset.mutate()}>
                  Clear run
                </Button>
              )}
              {aiOff && <p className="text-xs text-muted">AI is not available in this environment.</p>}
            </div>
          </form>
        </>
      )}
    </AppShell>
  );
}
