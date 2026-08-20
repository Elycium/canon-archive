import { Badge } from "@/components/ui/badge";
import type { EntryKind } from "@/lib/canon/types";

const LABEL: Record<EntryKind, string> = {
  prompt: "Prompt",
  system: "System",
  framework: "Framework",
};

export function KindBadge({ kind }: { kind: EntryKind }) {
  return <Badge tone={kind}>{LABEL[kind]}</Badge>;
}
