import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AuthSlot } from "@/components/auth-slot";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (!isPending && user) return <Navigate to="/library" />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="font-display text-xl tracking-tight">Canon</span>
        <AuthSlot />
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10 md:pt-20">
        <p className="text-xs uppercase tracking-[0.2em] text-subtle">Personal archive</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.1] tracking-tight md:text-6xl">
          Every prompt you write, filed by meaning.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Capture prompts, system prompts, and frameworks. The agent classifies them.
          The library finds them when you search for the job, not the filename.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/login">
              Sign in to open the library
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/login">See how search works</Link>
          </Button>
        </div>
        <section className="mt-16 rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-wider text-subtle">Library search</p>
          <p className="mt-3 font-display text-2xl tracking-tight">“agent that writes tests”</p>
          <p className="mt-1 text-sm text-muted">Semantic match — not a keyword hit on the title.</p>
          <ul className="mt-6 space-y-3">
            <DemoHit kind="System" title="Coding agent constitution" score={94} why="similar meaning · agent that writes tests" />
            <DemoHit kind="Framework" title="Prompt evaluation rubric" score={41} why="how to test a prompt" />
          </ul>
        </section>
      </main>
    </div>
  );
}

function DemoHit({
  kind, title, score, why,
}: { kind: string; title: string; score: number; why: string }) {
  return (
    <li className="rounded-[var(--radius-lg)] bg-raised p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{kind}</span>
        <span className="tabular-nums text-xs text-muted">{score}%</span>
      </div>
      <p className="mt-1 font-display text-lg">{title}</p>
      <p className="mt-1 text-xs text-subtle">Matched on {why}</p>
    </li>
  );
}
