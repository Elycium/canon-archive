import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { RequireUser } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAiStatus, listAgentMessages, sendAgentMessage } from "@/lib/canon/fns";

export const Route = createFileRoute("/agent")({ component: AgentPage });

function AgentPage() {
  return (
    <RequireUser>
      <AgentInner />
    </RequireUser>
  );
}

function AgentInner() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const msgsQ = useQuery({ queryKey: ["agent-msgs"], queryFn: () => listAgentMessages() });
  const aiQ = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus() });

  const send = useMutation({
    mutationFn: (content: string) => sendAgentMessage({ data: content }),
    onSuccess: (msgs) => {
      setText("");
      qc.setQueryData(["agent-msgs"], msgs);
      requestAnimationFrame(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const messages = msgsQ.data ?? [];

  return (
    <AppShell title="Agent">
      <p className="max-w-xl text-sm leading-relaxed text-muted">
        Ask across your archive. It only knows what you have filed.
      </p>
      <div
        ref={scroller}
        className="mt-6 max-h-[52vh] space-y-4 overflow-y-auto rounded-[var(--radius-xl)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-6"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted">
            Try “which system prompt is closest to a code reviewer?” or “what frameworks have I built around evaluation?”
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-6 md:ml-16" : "mr-6 md:mr-16"}>
            <p className="text-[11px] uppercase tracking-wider text-subtle">
              {m.role === "user" ? "You" : "Agent"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg">{m.content}</p>
          </div>
        ))}
        {send.isPending && <p className="text-sm text-subtle">Looking through the library…</p>}
      </div>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send.mutate(text.trim());
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about your prompts…"
          className="min-h-24"
          disabled={aiQ.data?.available === false}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button type="submit" disabled={!text.trim() || send.isPending || aiQ.data?.available === false}>
            {send.isPending ? "Thinking…" : "Ask"}
          </Button>
          {aiQ.data?.available === false && (
            <p className="text-xs text-muted">AI is not available in this environment.</p>
          )}
        </div>
      </form>
    </AppShell>
  );
}
