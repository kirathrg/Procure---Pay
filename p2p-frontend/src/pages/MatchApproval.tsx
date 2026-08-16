import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock3, ArrowRight } from "lucide-react";
import { useMatchCases, useResolveMatch } from "../hooks/useMatching";
import { MatchColumn, MatchIndicatorRail } from "../components/match/MatchNode";
import { ExplainNote } from "../components/ui/ExplainNote";
import { Badge } from "../components/ui/Badge";
import { cn } from "../lib/cn";

export default function MatchApproval() {
  const { data: matchCases = [], isLoading } = useMatchCases();
  const resolveMatch = useResolveMatch();
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = matchCases.find((c) => c.id === activeId) ?? matchCases[0];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-[13px] text-text-faint">Loading match cases…</p>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">3-Way Match</h2>
        <p className="mt-2 text-[13px] text-text-faint">
          No match cases yet — run a match from a purchase order once it has a receipt or invoice.
        </p>
      </div>
    );
  }

  const status = active.resolvedStatus;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-2 overflow-x-auto">
        {matchCases.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={cn(
              "relative shrink-0 rounded-md border px-3 py-1.5 font-tabular text-[12px] transition-colors duration-150 ease-out",
              c.id === active.id
                ? "border-border-strong text-text"
                : "border-border text-text-faint hover:border-border-strong hover:text-text-dim",
            )}
          >
            {c.id === active.id && (
              <motion.span
                layoutId="match-tab"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-md bg-overlay/[0.06]"
              />
            )}
            <span className="relative">{c.poNumber}</span>
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate font-heading text-[16px] font-medium tracking-tight text-text">
            {active.poNumber} — {active.vendor}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-faint">Three-way match: purchase order, receipt, invoice</p>
        </div>
        <Badge tone={active.outcome === "auto-approved" ? "success" : "warning"} pulseKey={active.id} className="shrink-0">
          {active.outcome === "auto-approved" ? "Auto-match eligible" : "Exception detected"}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:gap-0">
        <MatchColumn title="Purchase Order" subtitle={active.poNumber} fields={active.fields} valueKey="poValue" />
        <MatchIndicatorRail fields={active.fields} />
        <MatchColumn title="Receipt" subtitle="Goods receipt scan" fields={active.fields} valueKey="receiptValue" />
        <MatchIndicatorRail fields={active.fields} />
        <MatchColumn title="Invoice" subtitle="OCR-extracted" fields={active.fields} valueKey="invoiceValue" />
      </div>

      {active.fields.some((f) => !f.match) && (
        <div className="mt-3 space-y-1.5">
          {active.fields
            .filter((f) => !f.match)
            .map((f) => (
              <p key={f.label} className="text-[12px] text-danger">
                {f.deltaNote}
              </p>
            ))}
        </div>
      )}

      <div className="surface-panel mt-6 rounded-lg border border-border bg-surface p-4">
        <ExplainNote>{active.reason}</ExplainNote>

        {active.outcome === "escalated" && active.routedTo && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-text-dim">
            <ArrowRight className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
            Routed to: <span className="font-medium text-text">{active.routedTo}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <AnimatePresence mode="wait">
            {!status && (
              <motion.button
                key="action"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                disabled={resolveMatch.isPending}
                onClick={() =>
                  resolveMatch.mutate({
                    caseId: active.id,
                    action: active.outcome === "auto-approved" ? "release" : "review",
                  })
                }
                className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(24,26,33,0.2)] transition-all duration-150 ease-out hover:bg-accent-hover hover:shadow-[0_2px_8px_-2px_rgba(151,113,21,0.4)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
              >
                {resolveMatch.isPending
                  ? "Working…"
                  : active.outcome === "auto-approved"
                    ? "Release payment"
                    : "Confirm routing"}
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium",
                  status === "released" ? "bg-success-dim text-success" : "bg-warning-dim text-warning",
                )}
              >
                {status === "released" ? (
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Clock3 className="h-4 w-4" strokeWidth={1.75} />
                )}
                {status === "released" ? "Payment released" : "Sent to manager for approval"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
