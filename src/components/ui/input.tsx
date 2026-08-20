import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-[var(--radius-md)] bg-raised px-3.5 text-base text-fg placeholder:text-subtle",
          "shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150",
          "focus-visible:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
        {...props}
      />
    );
  },
);
