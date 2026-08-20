import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { RequireUser } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { captureEntry } from "@/lib/canon/fns";
import { ENTRY_KINDS, type EntryKind } from "@/lib/canon/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/capture")({ component: CapturePage });

function CapturePage() {
  return (
    <RequireUser>
      <CaptureInner />
    </RequireUser>
  );
}

function CaptureInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<EntryKind | "auto">("auto");

  const capture = useMutation({
    mutationFn: () =>
      captureEntry({
        data: { body, kind: kind === "auto" ? undefined : kind },
      }),
    onSuccess: (result) => {
      toast.success(result.filedByAi ? "Filed and indexed for meaning" : "Saved — indexed locally");
      void qc.invalidateQueries({ queryKey: ["library"] });
      void navigate({ to: "/library/$id", params: { id: result.entry.id } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppShell title="Capture">
      <p className="max-w-xl text-sm leading-relaxed text-muted">
        Paste a prompt, a system prompt, or a framework. The agent classifies it,
        extracts search phrases, and files it in the library.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(["auto", ...ENTRY_KINDS] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "h-9 rounded-full px-3 text-sm capitalize",
              kind === k ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg",
            )}
          >
            {k === "auto" ? "Detect kind" : k}
          </button>
        ))}
      </div>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          capture.mutate();
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste the thing you built…"
          className="min-h-72 font-mono text-sm"
          required
        />
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={!body.trim() || capture.isPending}>
            {capture.isPending ? "Filing…" : "File in library"}
          </Button>
          <p className="text-xs text-subtle">Creates a meaning index. Nothing is overwritten.</p>
        </div>
      </form>
    </AppShell>
  );
}
