import { Fragment, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Search, PackageCheck, FileCheck } from "lucide-react";
import { usePurchaseOrders, useUpdatePOType } from "../hooks/usePurchaseOrders";
import { useSuppliers } from "../hooks/useSuppliers";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { cn } from "../lib/cn";
import type { PurchaseOrder } from "../types";
import { PO_TYPE_LABEL, PO_TYPE_ORDER, hasAllocation } from "../lib/poType";

const statusTone: Record<PurchaseOrder["status"], BadgeTone> = {
  pending: "neutral",
  scanning: "info",
  received: "info",
  matched: "success",
  escalated: "warning",
  paid: "success",
};

const receivingTone: Record<PurchaseOrder["receivingStatus"], BadgeTone> = {
  not_started: "neutral",
  pending: "warning",
  scanning: "info",
  received: "success",
};

const receivingLabel: Record<PurchaseOrder["receivingStatus"], string> = {
  not_started: "Not started",
  pending: "Mismatch",
  scanning: "Scanning",
  received: "Received",
};

const invoiceTone: Record<PurchaseOrder["invoiceStatus"], BadgeTone> = {
  not_started: "neutral",
  received: "success",
};

const invoiceLabel: Record<PurchaseOrder["invoiceStatus"], string> = {
  not_started: "Not started",
  received: "Extracted",
};

const statusOptions: (PurchaseOrder["status"] | "all")[] = [
  "all",
  "pending",
  "scanning",
  "received",
  "matched",
  "escalated",
  "paid",
];

export default function PurchaseOrders() {
  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders();
  const { data: suppliers = [] } = useSuppliers();
  const updatePOType = useUpdatePOType();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrder["status"] | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = purchaseOrders.filter((po) => {
    const matchesQuery =
      !query.trim() ||
      po.poNumber.toLowerCase().includes(query.toLowerCase()) ||
      po.supplier.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Purchase orders</h2>
          <p className="mt-0.5 text-[12px] text-text-faint">
            {isLoading ? "Loading…" : `${purchaseOrders.length} orders`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-overlay/[0.03] px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-text-faint" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PO number or vendor…"
            className="w-56 bg-transparent text-[12.5px] text-text placeholder:text-text-faint focus:outline-none"
          />
        </div>
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
            {s}
          </button>
        ))}
      </div>

      <div className="surface-panel overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] text-text-faint">
              <th className="px-4 py-2.5 font-normal">PO Number</th>
              <th className="px-4 py-2.5 font-normal">Vendor</th>
              <th className="px-4 py-2.5 font-normal">Item</th>
              <th className="px-4 py-2.5 text-right font-normal">Total</th>
              <th className="px-4 py-2.5 font-normal">Status</th>
              <th className="px-4 py-2.5 font-normal">Receiving</th>
              <th className="px-4 py-2.5 font-normal">Invoice</th>
              <th className="px-4 py-2.5 font-normal">Type</th>
              <th className="px-4 py-2.5 font-normal">Issued</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((po) => {
              const vendor = suppliers.find((s) => s.id === po.supplierId);
              const isExpanded = expandedId === po.id;
              const remaining = po.allocation ? po.allocation.ceiling - po.allocation.released : 0;
              const releasedPct = po.allocation
                ? Math.min(100, Math.round((po.allocation.released / po.allocation.ceiling) * 100))
                : 0;

              return (
                <Fragment key={po.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : po.id)}
                    className={cn("row-interactive cursor-pointer text-[13px]", isExpanded && "bg-overlay/[0.05]")}
                  >
                    <td className="px-4 py-2.5 font-tabular text-text">{po.poNumber}</td>
                    <td className="px-4 py-2.5 text-text-dim">{po.supplier}</td>
                    <td className="px-4 py-2.5 text-text-dim">{po.item}</td>
                    <td className="px-4 py-2.5 text-right font-tabular text-text">${po.total.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={statusTone[po.status]}>{po.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={receivingTone[po.receivingStatus]}>
                        <PackageCheck className="h-3 w-3" strokeWidth={2} />
                        {receivingLabel[po.receivingStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={invoiceTone[po.invoiceStatus]}>
                        <FileCheck className="h-3 w-3" strokeWidth={2} />
                        {invoiceLabel[po.invoiceStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className={cn(
                              "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-medium leading-none tracking-wide transition-colors duration-150 ease-out",
                              hasAllocation(po.poType)
                                ? "border-info/30 bg-info-dim text-info"
                                : "border-border bg-overlay/[0.06] text-text-dim",
                              "hover:border-border-strong",
                            )}
                          >
                            {PO_TYPE_LABEL[po.poType]}
                            <ChevronDown className="h-2.5 w-2.5" strokeWidth={2} />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="start"
                            sideOffset={4}
                            className="surface-panel z-50 w-36 overflow-hidden rounded-md border border-border-strong bg-surface-raised p-1 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
                          >
                            {PO_TYPE_ORDER.map((t) => (
                              <DropdownMenu.Item
                                key={t}
                                onSelect={() => updatePOType.mutate({ id: po.id, poType: t })}
                                className={cn(
                                  "cursor-pointer rounded-sm px-2.5 py-1.5 text-[12px] outline-none transition-colors duration-100 data-[highlighted]:bg-overlay/[0.06] data-[highlighted]:text-text",
                                  t === po.poType ? "text-text" : "text-text-dim",
                                )}
                              >
                                {PO_TYPE_LABEL[t]}
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                    <td className="px-4 py-2.5 font-tabular text-text-faint">{po.issuedDate}</td>
                  </tr>
                  <tr>
                    <td colSpan={9} className="p-0">
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden border-t border-border bg-overlay/[0.015]"
                          >
                            <div className="grid grid-cols-3 gap-6 px-4 py-4 text-[12px]">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-text-faint">Buyer</p>
                                <p className="mt-1 text-text">{po.buyer.name}</p>
                                <p className="text-text-dim">{po.buyer.department}</p>
                                <p className="text-text-dim">{po.buyer.email}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-text-faint">Vendor</p>
                                <p className="mt-1 text-text">{vendor?.name ?? po.supplier}</p>
                                {vendor && (
                                  <>
                                    <p className="text-text-dim">{vendor.contactName}</p>
                                    <p className="text-text-dim">{vendor.contactEmail}</p>
                                  </>
                                )}
                              </div>
                              {po.allocation ? (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-text-faint">
                                    {PO_TYPE_LABEL[po.poType]} allocation
                                  </p>
                                  <div className="mt-1.5 flex items-center justify-between text-text-dim">
                                    <span>Ceiling</span>
                                    <span className="font-tabular text-text">
                                      ${po.allocation.ceiling.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center justify-between text-text-dim">
                                    <span>Released</span>
                                    <span className="font-tabular text-text">
                                      ${po.allocation.released.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center justify-between text-text-dim">
                                    <span>Remaining</span>
                                    <span className="font-tabular text-text">${remaining.toLocaleString()}</span>
                                  </div>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-overlay/[0.08]">
                                    <div className="h-full rounded-full bg-accent" style={{ width: `${releasedPct}%` }} />
                                  </div>
                                  <p className="mt-1.5 text-[11px] text-text-faint">
                                    Valid {po.allocation.validFrom} – {po.allocation.validTo}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-text-faint">Line item</p>
                                  <p className="mt-1 text-text-dim">
                                    {po.quantity} × ${po.unitPrice.toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
