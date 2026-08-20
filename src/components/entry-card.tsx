import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { KindBadge } from "@/components/kind-badge";
import type { LibraryHit } from "@/lib/canon/types";
import { cn } from "@/lib/utils";

export function EntryCard({ hit, showScore }: { hit: LibraryHit; showScore: boolean }) {
  return (
    <Link
      to="/library/$id"
      params={{ id: hit.id }}
      className="group block rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)] md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <KindBadge kind={hit.kind} />
          {hit.isStarter && <span className="text-[11px] uppercase tracking-wider text-subtle">Starter</span>}
        </div>
        <div className="flex items-center gap-2">
          {showScore && (
            <span className="tabular-nums text-xs text-muted">
              {Math.round(hit.score * 100)}%
            </span>
          )}
          <Star
            className={cn("size-4", hit.starred ? "fill-accent text-accent" : "text-subtle")}
            strokeWidth={1.75}
          />
        </div>
      </div>
      <h2 className="mt-3 font-display text-xl tracking-tight text-fg group-hover:text-accent">
        {hit.title}
      </h2>
      {hit.summary && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{hit.summary}</p>}
      {hit.reasons.length > 0 && (
        <p className="mt-3 text-xs text-subtle">
          Matched on {hit.reasons.slice(0, 3).join(" · ")}
        </p>
      )}
    </Link>
  );
}
