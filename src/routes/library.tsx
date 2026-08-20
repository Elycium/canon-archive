import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EntryCard } from "@/components/entry-card";
import { RequireUser } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchLibrary } from "@/lib/canon/fns";
import { isEntryKind, isSearchMode, type EntryKind, type SearchMode } from "@/lib/canon/types";
import { cn } from "@/lib/utils";

type LibrarySearch = {
  q?: string;
  kind?: "all" | EntryKind;
  mode?: SearchMode;
};

export const Route = createFileRoute("/library")({
  validateSearch: (raw: Record<string, unknown>): LibrarySearch => {
    const next: LibrarySearch = {};
    if (typeof raw.q === "string" && raw.q) next.q = raw.q;
    if (typeof raw.kind === "string" && (raw.kind === "all" || isEntryKind(raw.kind))) {
      if (raw.kind !== "all") next.kind = raw.kind;
    }
    if (typeof raw.mode === "string" && isSearchMode(raw.mode) && raw.mode !== "semantic") {
      next.mode = raw.mode;
    }
    return next;
  },
  component: LibraryPage,
});

function LibraryPage() {
  return (
    <RequireUser>
      <LibraryInner />
    </RequireUser>
  );
}

function LibraryInner() {
  const search = Route.useSearch();
  const q = search.q ?? "";
  const kind = search.kind ?? "all";
  const mode = search.mode ?? "semantic";
  const navigate = useNavigate({ from: "/library" });
  const [draft, setDraft] = useState(q);
  const [deepen, setDeepen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(q);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft === q) return;
      setDeepen(false);
      void navigate({
        search: (prev) => ({ ...prev, q: draft || undefined }),
        replace: true,
      });
    }, 320);
    return () => window.clearTimeout(handle);
  }, [draft, navigate, q]);

  const query = useQuery({
    queryKey: ["library", q, kind, mode, deepen],
    queryFn: () =>
      searchLibrary({
        data: {
          query: q,
          kind: kind === "all" ? undefined : kind,
          mode,
          deepen: deepen && mode === "semantic",
        },
      }),
  });

  const hits = query.data?.hits ?? [];
  const showScore = Boolean(q.trim());
  const kinds: Array<"all" | EntryKind> = ["all", "prompt", "system", "framework"];

  function setSearch(patch: LibrarySearch) {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });
  }

  return (
    <AppShell title="Library">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setDeepen(true);
          void navigate({ search: (prev) => ({ ...prev, q: draft || undefined }) });
        }}
      >
        <label className="block">
          <span className="sr-only">Search the library</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search by meaning — try “agent that writes tests”"
              className="pl-10 pr-24"
              autoComplete="off"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-[11px] text-subtle sm:inline">
              ⌘K
            </kbd>
          </div>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSearch({ kind: k === "all" ? undefined : k })}
              className={cn(
                "h-9 rounded-full px-3 text-sm capitalize",
                kind === k ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg",
              )}
            >
              {k === "all" ? "All" : k}
            </button>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
          {(["semantic", "exact"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setDeepen(false);
                setSearch({ mode: m === "semantic" ? undefined : m });
              }}
              className={cn(
                "h-9 rounded-full px-3 text-sm capitalize",
                mode === m ? "bg-raised text-fg shadow-[var(--shadow-border)]" : "text-subtle hover:text-fg",
              )}
            >
              {m}
            </button>
          ))}
          {mode === "semantic" && q.trim().length >= 3 && (
            <Button type="submit" variant="secondary" size="sm" className="ml-auto">
              Deepen
            </Button>
          )}
        </div>
      </form>
      {query.data?.intent && (
        <p className="mt-4 text-sm text-muted">
          Intent: {query.data.intent}
          {query.data.expanded.length > 0 && (
            <span className="text-subtle"> — {query.data.expanded.slice(0, 8).join(", ")}</span>
          )}
        </p>
      )}
      {query.isLoading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : query.isError ? (
        <p className="mt-10 text-sm text-muted">Could not load the library. Sign in again if this persists.</p>
      ) : hits.length === 0 ? (
        <div className="mt-16 max-w-md">
          <p className="font-display text-2xl tracking-tight">Nothing matched.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {mode === "semantic"
              ? "Try a job to be done — “review a pull request”, “don’t invent citations” — or switch to exact."
              : "Exact looks for literal text. Switch to semantic to search by meaning."}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {hits.map((hit) => (
            <EntryCard key={hit.id} hit={hit} showScore={showScore} />
          ))}
        </div>
      )}
      {!q && hits.length > 0 && (
        <p className="mt-8 flex items-center gap-2 text-xs text-subtle">
          <Star className="size-3" /> Star pieces you reuse. Semantic search ranks meaning over title.
        </p>
      )}
    </AppShell>
  );
}
