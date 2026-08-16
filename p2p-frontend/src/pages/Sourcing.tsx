import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, Mail, Printer, Workflow } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  usePurchaseOrder,
  useActivePurchaseOrder,
  useCandidateSuppliers,
  useDownloadPoPdf,
  useEmailPoToSupplier,
} from "../hooks/usePurchaseOrders";
import { useSuppliers } from "../hooks/useSuppliers";
import { ExplainNote } from "../components/ui/ExplainNote";
import { cn } from "../lib/cn";
import { PO_TYPE_LABEL } from "../lib/poType";
import { api } from "../lib/api";

const TAX_RATE = 0.08;

export default function Sourcing() {
  const [searchParams] = useSearchParams();
  const requestedPoId = searchParams.get("po");

  // A requested PO (e.g. clicked from the Purchase Orders table) is fetched
  // directly by id; otherwise fall back to the PO the user is actively
  // walking through — the same one Receiving/Invoicing follow — so all three
  // pages agree without a query param.
  const { data: requestedPo, isLoading: requestedLoading } = usePurchaseOrder(requestedPoId);
  const { data: activePo, isLoading: activeLoading } = useActivePurchaseOrder();
  const { data: suppliers = [] } = useSuppliers();

  const po = requestedPoId ? requestedPo : activePo;
  const posLoading = requestedPoId ? requestedLoading : activeLoading;
  const { data: candidateResult, isLoading: candidatesLoading } = useCandidateSuppliers(po?.id ?? null);

  const downloadPdf = useDownloadPoPdf();
  const emailPo = useEmailPoToSupplier();
  const [printing, setPrinting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function handlePrint(poId: string) {
    setPrinting(true);
    try {
      const blob = await api.getBlob(`/purchase-orders/${poId}/pdf`);
      const url = URL.createObjectURL(blob);
      // Open in a new tab so the browser's native PDF viewer (with its own
      // print button/shortcut) handles it — no client-side print-CSS to
      // maintain, and it's guaranteed to match the downloaded file exactly.
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setPrinting(false);
    }
  }

  async function handleEmail(poId: string) {
    setEmailStatus(null);
    try {
      const result = await emailPo.mutateAsync(poId);
      setEmailStatus({ kind: "success", message: `Sent to ${result.sentTo}` });
    } catch (err) {
      setEmailStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to send email.",
      });
    }
  }

  if (posLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-[12px] text-text-faint">Loading…</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Candidate suppliers</h2>
        <p className="mt-2 text-[13px] text-text-faint">
          No purchase order is currently active — submit a requisition to start a new cycle.
        </p>
      </div>
    );
  }

  const vendor = suppliers.find((s) => s.id === po.supplierId);
  const subtotal = po.total;
  const tax = Math.round(subtotal * TAX_RATE);
  const grandTotal = subtotal + tax;
  const remaining = po.allocation ? po.allocation.ceiling - po.allocation.released : 0;
  const releasedPct = po.allocation ? Math.min(100, Math.round((po.allocation.released / po.allocation.ceiling) * 100)) : 0;

  const candidates = candidateResult?.candidates ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Candidate suppliers</h2>
      <p className="mt-0.5 text-[12px] text-text-faint">
        {po.item} · Qty {po.quantity} · {po.poNumber}
      </p>

      {candidatesLoading && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      )}

      {!candidatesLoading && candidateResult?.unmatched && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-[13px] text-text-faint">
          No catalog product matches "{po.item}" by name, so no eligible suppliers could be looked up.
        </div>
      )}

      {!candidatesLoading && !candidateResult?.unmatched && candidates.length === 0 && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-[13px] text-text-faint">
          No suppliers are linked to this product yet.
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((s, i) => (
            <motion.div
              key={s.supplierId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "surface-panel card-interactive relative overflow-hidden rounded-lg border bg-surface p-4",
                s.selected ? "border-accent-border" : "border-border",
              )}
            >
              {s.selected && <span className="absolute inset-x-0 top-0 h-[2px] bg-accent" />}
              <div className="relative flex items-start justify-between">
                <p className="font-heading text-[13px] font-medium tracking-tight text-text">{s.name}</p>
                {s.selected && (
                  <span className="flex items-center gap-1 rounded-sm border border-accent-border bg-accent-dim px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    <span className="relative flex h-1 w-1">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                      <span className="relative inline-flex h-1 w-1 rounded-full bg-accent" />
                    </span>
                    AI-selected
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-y-2 text-[12px]">
                <span className="text-text-faint">Total price</span>
                <span className="text-right font-tabular text-text">${s.totalPrice.toLocaleString()}</span>
                <span className="text-text-faint">Unit price</span>
                <span className="text-right font-tabular text-text">${s.unitPrice}</span>
                <span className="text-text-faint">Lead time</span>
                <span className="text-right font-tabular text-text">{s.leadTimeDays} days</span>
                <span className="text-text-faint">On-time rate</span>
                <span className="text-right font-tabular text-text">
                  {s.orderCount > 0 ? `${s.onTimeRate}%` : "No history"}
                </span>
                {s.preferred && (
                  <>
                    <span className="text-text-faint">Preferred</span>
                    <span className="text-right text-text">Yes</span>
                  </>
                )}
              </div>

              {s.explain && (
                <div className="mt-3 border-t border-border pt-3">
                  <ExplainNote>{s.explain}</ExplainNote>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-heading text-[14px] font-medium tracking-tight text-text">Purchase order</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handlePrint(po.id)}
              disabled={printing}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text disabled:pointer-events-none disabled:opacity-50"
            >
              {printing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              Print
            </button>
            <button
              onClick={() => downloadPdf.mutate({ poId: po.id, poNumber: po.poNumber })}
              disabled={downloadPdf.isPending}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text disabled:pointer-events-none disabled:opacity-50"
            >
              {downloadPdf.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              Download PDF
            </button>
            <button
              onClick={() => handleEmail(po.id)}
              disabled={emailPo.isPending}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text disabled:pointer-events-none disabled:opacity-50"
            >
              {emailPo.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              Email supplier
            </button>
          </div>
        </div>

        {emailStatus && (
          <p
            className={cn(
              "mb-3 text-[12px]",
              emailStatus.kind === "success" ? "text-success" : "text-danger",
            )}
          >
            {emailStatus.message}
          </p>
        )}

        {/* Document surface — deliberately a real paper-white page, even in dark mode */}
        <div className="max-w-2xl overflow-hidden rounded-lg border border-black/10 bg-[#fcfcfa] text-[#1a1a18] shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col gap-4 border-b border-black/10 px-4 pb-6 pt-8 sm:flex-row sm:items-start sm:justify-between sm:px-8">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-white">
                  <Workflow className="h-3.5 w-3.5" strokeWidth={2.25} />
                </div>
                <span className="font-heading text-[14px] font-semibold tracking-tight">P2P Inc.</span>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-black/50">
                4th Floor, Anna Salai
                <br />
                Chennai, TN 600002, IN
                <br />
                billing@procurepay.example
              </p>
            </div>
            <div className="sm:text-right">
              <p className="font-heading text-[20px] font-semibold tracking-tight">Purchase Order</p>
              <p className="mt-1 font-tabular text-[13px] text-black/60">{po.poNumber}</p>
              <div className="mt-2 flex items-center gap-1.5 sm:justify-end">
                <span className="inline-block rounded-sm border border-accent/30 bg-accent/10 px-2 py-0.5 font-tabular text-[10px] font-medium uppercase tracking-wide text-accent">
                  Issued
                </span>
                <span
                  className={cn(
                    "inline-block rounded-sm border px-2 py-0.5 font-tabular text-[10px] font-medium uppercase tracking-wide",
                    po.poType !== "standard"
                      ? "border-[#5b8fd9]/30 bg-[#5b8fd9]/10 text-[#3f6fb0]"
                      : "border-black/15 bg-black/[0.03] text-black/50",
                  )}
                >
                  {PO_TYPE_LABEL[po.poType]}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-black/10 px-4 py-5 text-[12px] sm:grid-cols-4 sm:px-8">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-black/40">Vendor</p>
              <p className="mt-1 font-medium">{vendor?.name ?? po.supplier}</p>
              <p className="mt-0.5 text-black/50">{vendor?.contactEmail}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-black/40">Buyer</p>
              <p className="mt-1 font-medium">{po.buyer.name}</p>
              <p className="mt-0.5 text-black/50">{po.buyer.department}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-black/40">Ship to</p>
              <p className="mt-1 font-medium">Chennai Regional Office</p>
              <p className="mt-0.5 text-black/50">Chennai, TN, IN</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-black/40">Issued</p>
              <p className="mt-1 font-tabular font-medium">{po.issuedDate}</p>
              <p className="mt-0.5 text-black/50">Due on receipt</p>
            </div>
          </div>

          {po.allocation && (
            <div className="border-b border-black/10 px-4 py-5 sm:px-8">
              <p className="text-[10px] uppercase tracking-wide text-black/40">{PO_TYPE_LABEL[po.poType]} allocation</p>
              <div className="mt-2 grid grid-cols-1 gap-4 text-[12px] sm:grid-cols-3">
                <div>
                  <p className="text-black/50">Ceiling</p>
                  <p className="font-tabular font-medium">${po.allocation.ceiling.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-black/50">Released</p>
                  <p className="font-tabular font-medium">${po.allocation.released.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-black/50">Remaining</p>
                  <p className="font-tabular font-medium">${remaining.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full bg-accent" style={{ width: `${releasedPct}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-black/50">
                Valid {po.allocation.validFrom} through {po.allocation.validTo}
              </p>
            </div>
          )}

          <div className="px-4 py-5 sm:px-8">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-black/10 text-[10px] uppercase tracking-wide text-black/40">
                    <th className="pb-2 font-normal">Description</th>
                    <th className="pb-2 text-right font-normal">Qty</th>
                    <th className="pb-2 text-right font-normal">Unit price</th>
                    <th className="pb-2 text-right font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black/5">
                    <td className="py-3">{po.item}</td>
                    <td className="py-3 text-right font-tabular">{po.quantity}</td>
                    <td className="py-3 text-right font-tabular">${po.unitPrice.toFixed(2)}</td>
                    <td className="py-3 text-right font-tabular">${subtotal.toLocaleString()}.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex justify-end">
              <div className="w-full space-y-1.5 text-[12px] sm:w-56">
                <div className="flex justify-between text-black/60">
                  <span>Subtotal</span>
                  <span className="font-tabular">${subtotal.toLocaleString()}.00</span>
                </div>
                <div className="flex justify-between text-black/60">
                  <span>Tax (8%)</span>
                  <span className="font-tabular">${tax.toLocaleString()}.00</span>
                </div>
                <div className="flex justify-between border-t border-black/10 pt-1.5 text-[14px] font-semibold">
                  <span>Total due</span>
                  <span className="font-tabular">${grandTotal.toLocaleString()}.00</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-black/10 bg-black/[0.02] px-4 py-4 sm:px-8">
            <ExplainNote className="text-black/50">
              Auto-generated from requisition · approved without manual line-item entry
            </ExplainNote>
          </div>
        </div>
      </div>
    </div>
  );
}
