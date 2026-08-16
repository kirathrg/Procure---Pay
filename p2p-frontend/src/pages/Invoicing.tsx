import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Camera, FileText, Check, ChevronDown } from "lucide-react";
import { useActivePurchaseOrder, usePurchaseOrders } from "../hooks/usePurchaseOrders";
import { useInvoices, useExtractInvoice } from "../hooks/useInvoicing";
import { Badge } from "../components/ui/Badge";
import { ExplainNote } from "../components/ui/ExplainNote";
import { cn } from "../lib/cn";
import type { InvoiceRecord } from "../types";

// A PO still needs invoicing if it hasn't reached a terminal outcome — an
// escalated PO is deliberately included (see the backend's active_po_id
// clearing rule) since it still needs a corrected invoice re-uploaded.
const OPEN_STATUSES = new Set(["pending", "scanning", "received", "escalated"]);

const MANUAL_PO_STORAGE_KEY = "p2p-invoicing-manual-po";

export default function Invoicing() {
  const [searchParams] = useSearchParams();
  const requestedPoId = searchParams.get("po");

  const { data: serverActivePO, isLoading: activeLoading } = useActivePurchaseOrder();
  const { data: allPOs = [], isLoading: allLoading } = usePurchaseOrders();
  // Persisted (not plain useState) so a manually-picked PO survives
  // navigating to another page and back — this component fully unmounts on
  // route change, which was silently dropping back to the picker mid-upload.
  // sessionStorage (not localStorage) since this is "what I'm working on
  // this browser session," not something that should persist indefinitely.
  const [manualPoId, setManualPoId] = useState<string | null>(() => sessionStorage.getItem(MANUAL_PO_STORAGE_KEY));

  function pickManualPo(id: string | null) {
    setManualPoId(id);
    if (id) sessionStorage.setItem(MANUAL_PO_STORAGE_KEY, id);
    else sessionStorage.removeItem(MANUAL_PO_STORAGE_KEY);
  }

  // Once the server-tracked active PO resolves to a real id, freeze it here.
  // Real bug this fixes: uploading an invoice can itself cause that PO's
  // active_po_id to clear server-side (a clean auto-approved match ends the
  // cycle) — the resulting query invalidation was making serverActivePO
  // flip to null WHILE the extraction was still in flight or had just
  // finished, which fell through to the "no active PO" picker screen and
  // discarded the freshly-extracted result from view (even though it had
  // already saved correctly — see 3-Way Match, which showed it fine). Once
  // frozen, this page keeps working the same PO for the rest of the session
  // regardless of what the active-PO query does afterward.
  const [lockedActivePoId, setLockedActivePoId] = useState<string | null>(null);
  useEffect(() => {
    if (serverActivePO && !lockedActivePoId) setLockedActivePoId(serverActivePO.id);
  }, [serverActivePO, lockedActivePoId]);

  // Priority: an explicit ?po= (e.g. clicked from the Purchase Orders table)
  // > a PO the user explicitly picked from the switcher > the frozen active
  // PO as a default. manualPoId outranks lockedActivePoId (not the reverse,
  // as it was before) specifically so "Switch PO" actually works —
  // otherwise the locked active PO always won and picking a different one
  // from the switcher had no visible effect. Never a dead end just because
  // nothing is "active" — there's almost always a real PO still waiting on
  // an invoice.
  const openPOs = allPOs.filter((po) => OPEN_STATUSES.has(po.status));
  const selectedPoId = requestedPoId ?? manualPoId ?? lockedActivePoId;
  const activePO =
    selectedPoId && selectedPoId === serverActivePO?.id
      ? serverActivePO
      : allPOs.find((po) => po.id === selectedPoId);
  const poLoading = activeLoading || allLoading;

  const { data: pastInvoices = [] } = useInvoices(activePO?.id ?? null);
  // Most recently extracted invoice for this PO, so reloading the page
  // resumes showing what's already there instead of starting blank.
  const latestInvoice = pastInvoices[0];

  const extractInvoice = useExtractInvoice(activePO?.id ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invoice: InvoiceRecord | undefined = extractInvoice.data ?? latestInvoice;
  const fields = invoice?.fields ?? [];
  // A resumed invoice (loaded from history, not just extracted this
  // session) has nothing to stagger-reveal — show it fully settled instead
  // of replaying the reveal animation on every page load.
  const isResumed = !extractInvoice.data && !!latestInvoice;

  // Once a real extraction result arrives this session, stagger-reveal the
  // already-known fields (real OCR is one call, not incremental) so the
  // scan-line/reveal choreography still reads as a live process.
  useEffect(() => {
    if (!extractInvoice.data) return;
    setActiveIndex(-1);
    setConfirmedCount(0);
    const timers: number[] = [];
    extractInvoice.data.fields.forEach((_, i) => {
      timers.push(window.setTimeout(() => setActiveIndex(i), i * 500));
      timers.push(window.setTimeout(() => setConfirmedCount((c) => c + 1), i * 500 + 350));
    });
    return () => timers.forEach(clearTimeout);
  }, [extractInvoice.data]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activePO) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
    extractInvoice.mutate(file);
  }

  const revealCount = isResumed ? fields.length : confirmedCount;
  const isExtracting = extractInvoice.isPending || (fields.length > 0 && confirmedCount < fields.length && !isResumed);
  const avgConfidence =
    fields.length > 0 ? Math.round((fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length) * 1000) / 10 : 0;

  if (poLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <p className="text-[12px] text-text-faint">Loading…</p>
      </div>
    );
  }

  if (!activePO) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Invoicing</h2>
        {openPOs.length === 0 ? (
          <p className="mt-2 text-[13px] text-text-faint">
            No purchase order needs invoicing right now — submit a requisition to start a new cycle.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[13px] text-text-faint">
              Pick a purchase order to upload an invoice for.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {openPOs.map((po) => (
                <button
                  key={po.id}
                  onClick={() => pickManualPo(po.id)}
                  className="row-interactive flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors duration-150 ease-out hover:border-border-strong"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" strokeWidth={1.75} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-text">{po.poNumber}</p>
                      <p className="truncate text-[11.5px] text-text-faint">
                        {po.item} · {po.supplier}
                      </p>
                    </div>
                  </div>
                  <Badge tone={po.invoiceStatus === "received" ? "success" : "neutral"} className="shrink-0">
                    {po.invoiceStatus === "received" ? "Has invoice" : "Needs invoice"}
                  </Badge>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">
            {invoice?.invoiceNumber ?? `Invoicing · ${activePO.poNumber}`}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-faint">
            {invoice ? `${invoice.vendor} · Ref ${invoice.poNumber}` : "Upload an invoice to extract fields"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PoSwitcher
            openPOs={openPOs}
            activePoId={activePO.id}
            onPick={(id) => {
              pickManualPo(id);
              setSelectedFile(null);
              setPreviewUrl(null);
              setActiveIndex(-1);
              setConfirmedCount(0);
              extractInvoice.reset();
            }}
          />
          {fields.length > 0 && (
            <Badge
              tone={revealCount === fields.length ? "success" : "info"}
              pulseKey={revealCount === fields.length ? "done" : "extracting"}
            >
              {revealCount === fields.length ? "Extraction complete" : "Extracting fields…"}
            </Badge>
          )}
          {extractInvoice.isPending && <Badge tone="info">Reading document…</Badge>}
        </div>
      </div>

      {extractInvoice.isError && (
        <p className="mb-4 text-[12px] text-danger">
          {extractInvoice.error instanceof Error
            ? extractInvoice.error.message
            : "Couldn't extract this invoice. Try a clearer image."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* Document preview with bbox overlay */}
        <div className="surface-panel relative overflow-hidden rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-[12px] text-text-faint">Source document</p>
          </div>
          <div className="relative aspect-[3/4] overflow-hidden bg-overlay/[0.02] p-6">
            <div className="relative h-full w-full overflow-hidden rounded-sm border border-black/10 bg-[#fcfcfa] text-[#1a1a18] shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
              {previewUrl ? (
                <img src={previewUrl} alt="Uploaded invoice" className="h-full w-full object-cover" />
              ) : invoice ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
                  <Camera className="h-6 w-6 text-black/25" strokeWidth={1.5} />
                  <p className="text-[11px] text-black/40">
                    Showing previously extracted data for {invoice.invoiceNumber} — upload a new image to re-extract.
                  </p>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
                  <Camera className="h-6 w-6 text-black/25" strokeWidth={1.5} />
                  <p className="text-[11px] text-black/40">Upload an invoice image to extract fields</p>
                </div>
              )}

              <AnimatePresence>
                {isExtracting && (
                  <motion.div
                    initial={{ top: "0%", opacity: 0 }}
                    animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{
                      top: { duration: Math.max(fields.length, 1) * 0.5, ease: "linear" },
                      opacity: { duration: Math.max(fields.length, 1) * 0.5, times: [0, 0.03, 0.94, 1] },
                    }}
                    className="absolute inset-x-0 h-[2px] bg-accent shadow-[0_0_12px_2px_rgba(151,113,21,0.55)]"
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!activePO || extractInvoice.isPending}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text disabled:pointer-events-none disabled:opacity-40"
            >
              <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
              {invoice ? "Upload new invoice" : "Upload image"}
            </button>
          </div>
        </div>

        {/* Extracted fields */}
        <div className="surface-panel overflow-hidden rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-[12px] text-text-faint">Extracted fields</p>
          </div>
          {selectedFile && !extractInvoice.data && extractInvoice.isPending ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="h-3 w-16 animate-pulse rounded-sm bg-overlay/[0.06]" />
                  <span className="h-3 w-20 animate-pulse rounded-sm bg-overlay/[0.06]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {fields.map((f, i) => {
                const isRevealed = isResumed || i <= activeIndex;
                const isActive = !isResumed && i === activeIndex;
                return (
                  <div
                    key={f.key}
                    className={cn(
                      "relative flex items-center justify-between px-4 py-3 transition-colors duration-200",
                      isActive ? "bg-accent-dim/40" : isRevealed ? "row-interactive" : "",
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="ocr-active-row"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-y-0 left-0 w-[2px] bg-accent"
                      />
                    )}
                    <span className="text-[12px] text-text-faint">{f.label}</span>
                    <AnimatePresence mode="wait">
                      {isRevealed ? (
                        <motion.div
                          key="value"
                          initial={isResumed ? false : { opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-2"
                        >
                          <span className="font-tabular text-[13px] font-medium text-text">{f.value}</span>
                          <span className="font-tabular text-[10px] text-text-faint">
                            {Math.round(f.confidence * 100)}%
                          </span>
                        </motion.div>
                      ) : (
                        <span className="h-3 w-20 animate-pulse rounded-sm bg-overlay/[0.06]" />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              {fields.length === 0 && !extractInvoice.isPending && (
                <p className="px-4 py-6 text-center text-[12px] text-text-faint">
                  No fields yet — upload an invoice image to begin.
                </p>
              )}
            </div>
          )}

          {revealCount === fields.length && fields.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <ExplainNote>
                All {fields.length} fields extracted with average confidence {avgConfidence}%.
              </ExplainNote>
            </div>
          )}
        </div>
      </div>

      {pastInvoices.length > 1 && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-text-faint">Prior invoices for this PO</p>
          <div className="space-y-1.5">
            {pastInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-[12px]">
                <span className="text-text-dim">{inv.invoiceNumber}</span>
                <span className="text-text-faint">{inv.vendor}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Always-available "switch to a different open PO" control — lets a user
 * move off whatever PO happened to be selected (their server-tracked active
 * PO, a ?po= link, or a prior manual pick) to work through Invoicing on any
 * other open PO instead, without being stuck on just one. */
function PoSwitcher({
  openPOs,
  activePoId,
  onPick,
}: {
  openPOs: { id: string; poNumber: string; item: string; supplier: string; invoiceStatus: string }[];
  activePoId: string;
  onPick: (id: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text">
          Switch PO
          <ChevronDown className="h-3 w-3" strokeWidth={2} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="surface-panel z-50 max-h-80 w-72 overflow-y-auto rounded-md border border-border-strong bg-surface-raised p-1 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
        >
          {openPOs.length === 0 ? (
            <p className="px-2.5 py-3 text-[12px] text-text-faint">No other open purchase orders.</p>
          ) : (
            openPOs.map((po) => (
              <DropdownMenu.Item
                key={po.id}
                onSelect={() => onPick(po.id)}
                className={cn(
                  "flex cursor-pointer items-start justify-between gap-2 rounded-sm px-2.5 py-2 text-left outline-none transition-colors duration-100 data-[highlighted]:bg-overlay/[0.06]",
                  po.id === activePoId && "bg-overlay/[0.04]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-text">{po.poNumber}</p>
                  <p className="truncate text-[11px] text-text-faint">
                    {po.item} · {po.supplier}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={po.invoiceStatus === "received" ? "success" : "warning"}>
                    {po.invoiceStatus === "received" ? "Completed" : "Pending"}
                  </Badge>
                  {po.id === activePoId && <Check className="h-3 w-3 shrink-0 text-accent" strokeWidth={2} />}
                </div>
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
