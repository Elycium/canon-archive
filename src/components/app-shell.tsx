import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Feather, Library, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { AuthSlot } from "@/components/auth-slot";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/library", label: "Library", icon: Library },
  { to: "/capture", label: "Capture", icon: Feather },
  { to: "/canon", label: "Canon", icon: BookOpen },
  { to: "/agent", label: "Agent", icon: MessageSquare },
] as const;

export function AppShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-border bg-bg px-4 py-6 md:flex">
        <Link to="/library" className="font-display text-xl tracking-tight text-fg">
          Canon
        </Link>
        <p className="mt-1 text-xs text-subtle">Living prompt archive</p>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-sm transition-colors",
                  active ? "bg-raised text-fg" : "text-muted hover:bg-raised/60 hover:text-fg",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <AuthSlot />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-sm md:hidden">
        <Link to="/library" className="font-display text-lg tracking-tight">
          Canon
        </Link>
        <AuthSlot />
      </header>

      <div className="md:pl-56">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h1 className="font-display text-3xl tracking-tight text-fg md:text-4xl">{title}</h1>
            {action}
          </div>
          {children}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]",
                active ? "text-fg" : "text-subtle",
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
