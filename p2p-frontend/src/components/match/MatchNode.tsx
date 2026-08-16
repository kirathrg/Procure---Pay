import { Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import type { MatchField } from "../../types";

export function MatchColumn({
  title,
  subtitle,
  fields,
  valueKey,
}: {
  title: string;
  subtitle: string;
  fields: MatchField[];
  valueKey: "poValue" | "receiptValue" | "invoiceValue";
}) {
  return (
    <div className="surface-panel min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative border-b border-border px-4 py-3">
        <p className="font-heading text-[13px] font-medium tracking-tight text-text">{title}</p>
        <p className="text-[11px] text-text-faint">{subtitle}</p>
      </div>
      <div className="relative divide-y divide-border">
        {fields.map((f) => (
          <div key={f.label} className="row-interactive flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] text-text-faint">{f.label}</p>
              <p
                className={cn(
                  "mt-0.5 truncate font-tabular text-[13px] font-medium",
                  !f.match && valueKey === "invoiceValue" ? "text-danger" : "text-text",
                  f[valueKey] === "—" && "text-text-faint",
                )}
              >
                {f[valueKey]}
              </p>
            </div>
            {/* Mobile-only: the vertical MatchIndicatorRail only makes sense
                when columns sit side-by-side (desktop). Once MatchApproval
                stacks the three columns on mobile, each row shows its own
                match/mismatch indicator inline instead. */}
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full lg:hidden",
                f.match ? "bg-success-dim text-success" : "bg-danger-dim text-danger",
              )}
            >
              {f.match ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchIndicatorRail({ fields }: { fields: MatchField[] }) {
  return (
    <div className="hidden w-10 shrink-0 flex-col lg:flex">
      <div className="h-[52px]" />
      {fields.map((f, i) => (
        <div key={f.label} className="flex h-[60px] items-center justify-center border-b border-transparent px-1">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.25, ease: "easeOut" }}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              f.match ? "bg-success-dim text-success" : "bg-danger-dim text-danger",
            )}
          >
            {f.match ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
