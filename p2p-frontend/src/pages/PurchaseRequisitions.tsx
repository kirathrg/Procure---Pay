import { useState } from "react";
import { CheckCircle2, Clock3, PackageSearch } from "lucide-react";
import { usePurchaseRequisitions } from "../hooks/usePurchaseRequisitions";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { cn } from "../lib/cn";
import type { PurchaseRequisition } from "../types";

const statusTone: Record<PurchaseRequisition["status"], BadgeTone> = {
  pending: "neutral",
  in_progress: "info",
  resolved: "success",
};

const statusLabel: Record<PurchaseRequisition["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  resolved: "Resolved",
};

const urgencyTone: Record<PurchaseRequisition["urgency"], BadgeTone> = {
  low: "neutral",
  normal: "info",
  urgent: "warning",
};

const statusOptions: (PurchaseRequisition["status"] | "all")[] = ["all", "pending", "in_progress", "resolved"];

export default function PurchaseRequisitions() {
  const { data: prs = [], isLoading } = usePurchaseRequisitions();
  const [statusFilter, setStatusFilter] = useState<PurchaseRequisition["status"] | "all">("all");

  const filtered = prs.filter((pr) => statusFilter === "all" || pr.status === statusFilter);
  const pendingCount = prs.filter((pr) => pr.status === "pending").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Purchase requisitions</h2>
          <p className="mt-0.5 text-[12px] text-text-faint">
            {isLoading
              ? "Loading…"
              : `${prs.length} requests from warehouse staff${pendingCount > 0 ? ` · ${pendingCount} pending` : ""}`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[12px] capitalize transition-colors duration-150 ease-out",
              statusFilter === s
                ? "border-border-strong bg-overlay/[0.06] text-text"
                : "border-border text-text-faint hover:text-text-dim",
            )}
          >
            {s === "all" ? "All" : statusLabel[s]}
          </button>
        ))}
      </div>

      <div className="surface-panel overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] text-text-faint">
              <th className="px-4 py-2.5 font-normal">Item</th>
              <th className="px-4 py-2.5 font-normal">Qty</th>
              <th className="px-4 py-2.5 font-normal">Requested by</th>
              <th className="px-4 py-2.5 font-normal">Needed by</th>
              <th className="px-4 py-2.5 font-normal">Urgency</th>
              <th className="px-4 py-2.5 font-normal">Status</th>
              <th className="px-4 py-2.5 font-normal">PO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((pr) => (
              <tr key={pr.id} className="text-[13px]">
                <td className="px-4 py-2.5 text-text">
                  {pr.item}
                  {pr.notes && <p className="mt-0.5 text-[11px] text-text-faint">{pr.notes}</p>}
                </td>
                <td className="px-4 py-2.5 font-tabular text-text-dim">{pr.quantity}</td>
                <td className="px-4 py-2.5 text-text-dim">{pr.createdByName}</td>
                <td className="px-4 py-2.5 text-text-faint">{pr.deadline || "—"}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={urgencyTone[pr.urgency]}>{pr.urgency}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={statusTone[pr.status]}>
                    {pr.status === "resolved" ? (
                      <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                    ) : (
                      <Clock3 className="h-3 w-3" strokeWidth={2} />
                    )}
                    {statusLabel[pr.status]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 font-tabular text-text-dim">{pr.poNumber ?? "—"}</td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-text-faint">
                  <PackageSearch className="mx-auto mb-2 h-5 w-5 text-text-faint" strokeWidth={1.5} />
                  No purchase requisitions{statusFilter !== "all" ? ` with status "${statusLabel[statusFilter as PurchaseRequisition["status"]]}"` : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
