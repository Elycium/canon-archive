import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-40 w-full rounded-[var(--radius-lg)] bg-raised px-4 py-3 text-base leading-relaxed text-fg placeholder:text-subtle",
        "shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150",
        "focus-visible:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
