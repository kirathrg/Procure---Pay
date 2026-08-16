import { motion } from "framer-motion";
import { Copy, TrendingUp, GitBranch, RefreshCw } from "lucide-react";
import { useAnomalies, useRunAnomalyDetection } from "../hooks/useAnomalies";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { cn } from "../lib/cn";
import type { AnomalyRecord } from "../types";

const typeIcon: Record<AnomalyRecord["type"], typeof Copy> = {
  "duplicate-invoice": Copy,
  "price-jump": TrendingUp,
  "split-po": GitBranch,
};

const severityTone: Record<AnomalyRecord["severity"], BadgeTone> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export default function Anomalies() {
  const { data: anomalies = [], isLoading } = useAnomalies();
  const runDetection = useRunAnomalyDetection();
  const highCount = anomalies.filter((a) => a.severity === "high").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Flagged activity</h2>
          <p className="mt-0.5 text-[12px] text-text-faint">
            {isLoading ? "Loading…" : `${anomalies.length} items under review · ${highCount} high severity`}
          </p>
        </div>
        <button
          onClick={() => runDetection.mutate()}
          disabled={runDetection.isPending}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", runDetection.isPending && "animate-spin")} strokeWidth={1.75} />
          {runDetection.isPending ? "Scanning…" : "Run detection"}
        </button>
      </div>

      <div className="space-y-2.5">
        {anomalies.map((a, i) => {
          const Icon = typeIcon[a.type];
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "surface-panel card-interactive group relative overflow-hidden rounded-lg border bg-surface p-4 pl-5",
                a.severity === "high" ? "border-danger/25" : "border-border",
              )}
            >
              {/* Severity stripe — state encoded in form, not just a word */}
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-[3px]",
                  a.severity === "high"
                    ? "bg-danger"
                    : a.severity === "medium"
                      ? "bg-warning"
                      : "bg-border-strong",
                )}
              />

              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ease-out",
                      a.severity === "high"
                        ? "border-danger/25 bg-danger-dim text-danger"
                        : "border-border bg-overlay/[0.06] text-text-dim group-hover:text-text",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text">{a.title}</p>
                    <p className="mt-0.5 max-w-xl text-[12.5px] leading-relaxed text-text-dim">{a.detail}</p>
                  </div>
                </div>
                <Badge tone={severityTone[a.severity]} className="shrink-0">
                  {a.severity}
                </Badge>
              </div>

              <div className="relative mt-3 flex flex-wrap gap-2 sm:ml-10">
                {a.dataPoints.map((dp) => (
                  <span
                    key={dp}
                    className="rounded-sm border border-border bg-overlay/[0.02] px-2 py-1 font-tabular text-[11px] text-text-faint transition-colors duration-150 ease-out group-hover:border-border-strong group-hover:text-text-dim"
                  >
                    {dp}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
