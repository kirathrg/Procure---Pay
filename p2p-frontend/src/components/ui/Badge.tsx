import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "danger" | "warning" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-overlay/[0.06] text-text-dim border-border",
  accent: "bg-accent-dim text-accent border-accent-border",
  success: "bg-success-dim text-success border-success/30",
  danger: "bg-danger-dim text-danger border-danger/30",
  warning: "bg-warning-dim text-warning border-warning/30",
  info: "bg-info-dim text-info border-info/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  pulseKey,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  pulseKey?: string | number;
}) {
  return (
    <motion.span
      key={pulseKey}
      initial={pulseKey !== undefined ? { scale: 0.92 } : false}
      animate={{ scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-medium leading-none tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </motion.span>
  );
}
