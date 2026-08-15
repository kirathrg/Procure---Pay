import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { CountUp } from "../components/ui/CountUp";
import { useAnalyticsSummary, useCycleTimeTrend, useExceptionReasons, useSupplierPerformance } from "../hooks/useAnalytics";
import { cn } from "../lib/cn";

const ACCENT = "oklch(52% 0.11 75)"; // --color-accent
const MUTED_BAR = "oklch(88% 0.008 80)"; // neutral bar for non-highlighted series

export default function Analytics() {
  const { data: summary } = useAnalyticsSummary();
  const { data: cycleTimeTrend = [] } = useCycleTimeTrend();
  const { data: exceptionReasons = [] } = useExceptionReasons();
  const { data: supplierPerformance = [] } = useSupplierPerformance();

  const metrics = summary
    ? [
        { label: "Touchless rate", value: summary.touchlessRate, suffix: "%" },
        { label: "Avg. cycle time", value: summary.avgCycleDays, suffix: " days", decimals: 1 },
        { label: "Cost saved (MTD)", value: summary.costSaved, prefix: "$" },
        { label: "Exceptions this week", value: summary.exceptionsThisWeek },
      ]
    : [];

  const lastPoint = cycleTimeTrend[cycleTimeTrend.length - 1];

  const axis = "oklch(58% 0.012 80)"; // --color-text-faint
  const grid = "oklch(91% 0.005 80)"; // --color-border
  const tooltipStyle = {
    background: "#ffffff",
    border: "1px solid oklch(85% 0.008 80)", // --color-border-strong
    borderRadius: 8,
    fontSize: 12,
    fontFamily: "IBM Plex Mono, monospace",
    color: "oklch(18% 0.02 250)", // --color-text
    boxShadow: "0 6px 16px -6px rgba(24,26,33,0.14)",
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="surface-panel card-interactive overflow-hidden rounded-lg border border-border bg-surface px-4 py-3.5"
          >
            <p className="relative text-[11px] text-text-faint">{m.label}</p>
            <p className="relative mt-1.5 font-heading text-[24px] font-medium leading-none tracking-tight text-text">
              <CountUp value={m.value} prefix={m.prefix} suffix={m.suffix} decimals={m.decimals} />
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        {/* Trend */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="surface-panel col-span-2 rounded-lg border border-border bg-surface p-4"
        >
          <div className="relative mb-1 flex items-baseline justify-between">
            <p className="text-[12px] text-text-faint">Cycle time trend</p>
            <p className="font-tabular text-[11px] text-text-faint">avg days, PO → payment</p>
          </div>
          <div className="relative mb-3 h-px w-full overflow-hidden bg-border">
            <span className="rule-draw block h-full w-16 bg-accent" />
          </div>
          {cycleTimeTrend.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={cycleTimeTrend} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cycleFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="week" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: axis }} cursor={{ stroke: grid }} />
                  <Area
                    type="monotone"
                    dataKey="avgDays"
                    stroke={ACCENT}
                    strokeWidth={2}
                    fill="url(#cycleFill)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
              {lastPoint && (
                <p className="relative mt-1 text-[11px] text-text-faint">
                  Now at <span className="font-tabular text-text">{lastPoint.avgDays} days</span>
                  {cycleTimeTrend.length > 1 && (
                    <>
                      {" "}
                      — from <span className="font-tabular">{cycleTimeTrend[0].avgDays}</span> {cycleTimeTrend.length}{" "}
                      weeks ago
                    </>
                  )}
                </p>
              )}
            </>
          ) : (
            <div className="flex h-[210px] items-center justify-center text-[12px] text-text-faint">
              Not enough matched/paid orders yet to chart a trend
            </div>
          )}
        </motion.div>

        {/* Exceptions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="surface-panel rounded-lg border border-border bg-surface p-4"
        >
          <p className="relative mb-1 text-[12px] text-text-faint">Exceptions by reason</p>
          <div className="relative mb-3 h-px w-full overflow-hidden bg-border">
            <span className="rule-draw block h-full w-10 bg-accent" />
          </div>
          {exceptionReasons.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={exceptionReasons} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="reason"
                  stroke={axis}
                  fontSize={10.5}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(24,26,33,0.03)" }}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={14} animationDuration={700}>
                  {exceptionReasons.map((entry, i) => (
                    <Cell key={entry.reason} fill={i === 0 ? ACCENT : MUTED_BAR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[210px] items-center justify-center text-center text-[12px] text-text-faint">
              No mismatched fields recorded
            </div>
          )}
        </motion.div>
      </div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
        className="surface-panel mt-4 overflow-hidden rounded-lg border border-border bg-surface"
      >
        <div className="relative border-b border-border px-4 py-3">
          <p className="text-[12px] text-text-faint">Supplier performance</p>
        </div>
        <table className="relative w-full text-left">
          <thead>
            <tr className="text-[11px] text-text-faint">
              <th className="w-8 px-4 py-2 font-normal">#</th>
              <th className="px-4 py-2 font-normal">Supplier</th>
              <th className="px-4 py-2 font-normal">Orders</th>
              <th className="px-4 py-2 font-normal">On-time rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...supplierPerformance]
              .sort((a, b) => b.onTimeRate - a.onTimeRate)
              .map((s, i) => (
                <tr key={s.name} className="row-interactive text-[13px]">
                  <td className="px-4 py-2.5 font-tabular text-text-faint">{i + 1}</td>
                  <td className="px-4 py-2.5 text-text">{s.name}</td>
                  <td className="px-4 py-2.5 font-tabular text-text-dim">{s.orders}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-overlay/[0.08]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${s.onTimeRate}%` }}
                          transition={{ duration: 0.7, delay: 0.4 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                          className={cn(
                            "h-full rounded-full",
                            s.onTimeRate >= 90 ? "bg-success" : s.onTimeRate >= 80 ? "bg-warning" : "bg-danger",
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "font-tabular",
                          s.onTimeRate >= 90 ? "text-success" : s.onTimeRate >= 80 ? "text-warning" : "text-danger",
                        )}
                      >
                        {s.onTimeRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
