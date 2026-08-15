import { Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";

export function ExplainNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-1.5 text-[12px] text-text-dim", className)}>
      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent/70" strokeWidth={1.75} />
      <span>{children}</span>
    </div>
  );
}
