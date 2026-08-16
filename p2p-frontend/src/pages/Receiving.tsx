import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import {
  Check,
  PackageCheck,
  ScanLine,
  Clock3,
  Camera,
  Video,
  X,
  RotateCcw,
  Hash,
  Building2,
  Boxes,
  AlertTriangle,
  Package,
  ChevronDown,
} from "lucide-react";
import { useActivePurchaseOrder, usePurchaseOrders } from "../hooks/usePurchaseOrders";
import { useReceipts, useScanReceipt, type ReceiptResult } from "../hooks/useReceiving";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { PackageBox } from "../components/receiving/PackageBox";
import { decodeQrFromImage, fileToDataUrl } from "../lib/qrScan";
import { cn } from "../lib/cn";

type Status = "pending" | "scanning" | "received";

const statusMeta: Record<Status, { label: string; tone: BadgeTone; icon: typeof Clock3 }> = {
  pending: { label: "Pending", tone: "neutral", icon: Clock3 },
  scanning: { label: "Scanning", tone: "info", icon: ScanLine },
  received: { label: "Received", tone: "success", icon: PackageCheck },
};

// A PO still needs receiving if its most recent receipt hasn't matched yet —
// "pending" here covers both "never scanned" and "scanned but mismatched."
const OPEN_RECEIVING_STATUSES = new Set(["not_started", "pending", "scanning"]);

const MANUAL_PO_STORAGE_KEY = "p2p-receiving-manual-po";

export default function Receiving() {
  const [searchParams] = useSearchParams();
  const requestedPoId = searchParams.get("po");

  const { data: serverActivePO, isLoading: activeLoading } = useActivePurchaseOrder();
  const { data: allPOs = [], isLoading: allLoading } = usePurchaseOrders();
  // Persisted (not plain useState) so a manually-picked PO survives
  // navigating to another page and back — this component fully unmounts on
  // route change, which was silently dropping back to the picker mid-scan.
  const [manualPoId, setManualPoId] = useState<string | null>(() => sessionStorage.getItem(MANUAL_PO_STORAGE_KEY));

  function pickManualPo(id: string | null) {
    setManualPoId(id);
    if (id) sessionStorage.setItem(MANUAL_PO_STORAGE_KEY, id);
    else sessionStorage.removeItem(MANUAL_PO_STORAGE_KEY);
  }

  // Once the server-tracked active PO resolves to a real id, freeze it here.
  // Real bug this fixes: scanning a receipt can itself cause that PO's
  // active_po_id to clear server-side (a clean auto-approved match ends the
  // cycle) — the resulting query invalidation was making serverActivePO
  // flip to null WHILE the scan was still in flight or had just finished,
  // which fell through to the "no active PO" picker screen and discarded
  // the freshly-scanned result from view (even though it had already saved
  // correctly). Once frozen, this page keeps working the same PO for the
  // rest of the session regardless of what the active-PO query does after.
  const [lockedActivePoId, setLockedActivePoId] = useState<string | null>(null);
  useEffect(() => {
    if (serverActivePO && !lockedActivePoId) setLockedActivePoId(serverActivePO.id);
  }, [serverActivePO, lockedActivePoId]);

  // Same priority order as Invoicing: explicit ?po= (e.g. clicked from the
  // Purchase Orders table) > a PO the user explicitly picked from the
  // switcher > the frozen active PO as a default. manualPoId outranks
  // lockedActivePoId (not the reverse, as it was before) specifically so
  // "Switch PO" actually works — otherwise the locked active PO always won
  // and picking a different one from the switcher had no visible effect.
  const openPOs = allPOs.filter((po) => OPEN_RECEIVING_STATUSES.has(po.receivingStatus));
  const selectedPoId = requestedPoId ?? manualPoId ?? lockedActivePoId;
  const activePO =
    selectedPoId && selectedPoId === serverActivePO?.id
      ? serverActivePO
      : allPOs.find((po) => po.id === selectedPoId);
  const poLoading = activeLoading || allLoading;
  const { data: pastReceipts = [] } = useReceipts(activePO?.id ?? null);
  // The most recent attempt for this PO — resuming means picking up from
  // whatever it says (match, mismatch, or nothing yet) instead of always
  // starting blank on page load/reload.
  const latestReceipt = pastReceipts[0];

  const scanReceipt = useScanReceipt(activePO?.id ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Live webcam scanning is opt-in (rather than always-on) so the page
  // doesn't request camera permission just for someone browsing to it, and
  // so "Upload image" stays available as a real alternative, not just a
  // fallback shown after a live scan already failed.
  const [liveScanning, setLiveScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A fresh mutation result takes priority once one exists this session;
  // otherwise fall back to whatever the server already knows for this PO.
  const receipt: ReceiptResult | undefined = scanReceipt.data ?? latestReceipt;
  const status: Status = scanReceipt.isPending
    ? "scanning"
    : receipt?.status === "received"
      ? "received"
      : "pending";

  // Shared by both the live-camera path and the upload-a-photo path — the
  // decode already happened client-side (see lib/qrScan.ts / <Scanner>'s
  // onScan), this just sends the result to the backend to validate against
  // the real PO and record the receipt.
  function submitScan(decodedData: string | null, imageDataUrl?: string) {
    if (!activePO || scanReceipt.isPending) return;
    setError(null);
    setLiveScanning(false);
    scanReceipt.mutate(
      { decodedData, imageDataUrl },
      { onError: (err) => setError(err instanceof Error ? err.message : "Scan failed. Try again.") },
    );
  }

  function handleLiveDetect(detected: IDetectedBarcode[]) {
    const rawValue = detected[0]?.rawValue ?? null;
    if (!rawValue) return;
    submitScan(rawValue);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    try {
      const [decodedData, imageDataUrl] = await Promise.all([decodeQrFromImage(file), fileToDataUrl(file)]);
      if (!decodedData) {
        setError("No QR code found in that image. Try a clearer photo, or use live scan instead.");
        return;
      }
      submitScan(decodedData, imageDataUrl);
    } catch {
      setError("Couldn't read that image. Try a different photo, or use live scan instead.");
    }
  }

  function reset() {
    scanReceipt.reset();
    setPreviewUrl(null);
    setError(null);
    setLiveScanning(false);
  }

  const meta = statusMeta[status];
  const Icon = meta.icon;

  if (poLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-6">
        <p className="text-[12px] text-text-faint">Loading…</p>
      </div>
    );
  }

  if (!activePO) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-6">
        <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Goods receipt</h2>
        {openPOs.length === 0 ? (
          <p className="mt-2 text-[13px] text-text-faint">
            No purchase order needs receiving right now — submit a requisition to start a new cycle.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[13px] text-text-faint">Pick a purchase order to scan a receipt for.</p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {openPOs.map((po) => (
                <button
                  key={po.id}
                  onClick={() => pickManualPo(po.id)}
                  className="row-interactive flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors duration-150 ease-out hover:border-border-strong"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" strokeWidth={1.75} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-text">{po.poNumber}</p>
                      <p className="truncate text-[11.5px] text-text-faint">
                        {po.item} · {po.supplier}
                      </p>
                    </div>
                  </div>
                  <Badge tone={po.receivingStatus === "pending" ? "warning" : "neutral"} className="shrink-0">
                    {po.receivingStatus === "pending" ? "Mismatch" : "Needs receiving"}
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
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">
            Goods receipt · {activePO.poNumber}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-faint">Barcode-verified receipt matching</p>
        </div>
        <div className="flex items-center gap-3">
          <PoSwitcher
            openPOs={openPOs}
            activePoId={activePO.id}
            onPick={(id) => {
              pickManualPo(id);
              setPreviewUrl(null);
              setError(null);
              setLiveScanning(false);
              scanReceipt.reset();
            }}
          />
          <Badge tone={meta.tone} pulseKey={status}>
            <Icon className="h-3 w-3" strokeWidth={2} />
            {meta.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-5">
        <div className="flex flex-col gap-4">
          <div className="surface-panel relative overflow-hidden rounded-lg border border-border bg-surface">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-overlay/[0.02]">
              {liveScanning ? (
                <Scanner
                  onScan={handleLiveDetect}
                  onError={() => setError("Couldn't access the camera. Check permissions, or upload a photo instead.")}
                  formats={["qr_code"]}
                  paused={scanReceipt.isPending}
                  styles={{ container: { width: "100%", height: "100%" }, video: { objectFit: "cover" } }}
                  components={{ finder: true, torch: true }}
                />
              ) : previewUrl ? (
                <img src={previewUrl} alt="Receipt package" className="h-full w-full object-cover" />
              ) : (
                <PackageBox scanning={status === "scanning"} />
              )}

              <AnimatePresence>
                {status === "scanning" && (
                  <motion.div
                    initial={{ y: "0%", opacity: 0 }}
                    animate={{ y: "420%", opacity: [0, 1, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="absolute left-[10%] top-[8%] h-[2px] w-[80%] bg-info shadow-[0_0_12px_2px_rgba(91,143,217,0.6)]"
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {liveScanning ? (
                  <button
                    onClick={() => setLiveScanning(false)}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Stop scan
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setError(null);
                      setPreviewUrl(null);
                      setLiveScanning(true);
                    }}
                    disabled={status === "scanning" || status === "received"}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(24,26,33,0.2)] transition-all duration-150 ease-out hover:bg-primary-hover hover:shadow-[0_2px_8px_-2px_rgba(24,26,33,0.35)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Video className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {status === "received" ? "Scan again" : "Scan with camera"}
                  </button>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={status === "scanning"}
                  className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text disabled:pointer-events-none disabled:opacity-40"
                >
                  <Camera className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Upload image
                </button>

                {status === "received" && !liveScanning && (
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-text-faint transition-colors duration-150 ease-out hover:text-text-dim"
                    title="Reset to pending"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>

            {liveScanning && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-[13px] text-text-dim">Hold the QR code steady in frame — it scans automatically.</p>
              </div>
            )}
            {status === "scanning" && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-[13px] text-text-dim">Resolving PO match…</p>
              </div>
            )}
            {error && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-[13px] text-danger">{error}</p>
              </div>
            )}
          </div>

          {/* Real summary card — replaces the old one-line match/no-match
              text with the actual scanned data, laid out like a receipt. */}
          {receipt && status !== "scanning" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "surface-panel overflow-hidden rounded-lg border bg-surface",
                receipt.discrepancy ? "border-warning/40" : "border-success/30",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 border-b px-4 py-2.5",
                  receipt.discrepancy ? "border-warning/20 bg-warning-dim" : "border-success/20 bg-success-dim",
                )}
              >
                {receipt.discrepancy ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} />
                ) : (
                  <PackageCheck className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />
                )}
                <p className={cn("text-[12.5px] font-medium", receipt.discrepancy ? "text-warning" : "text-success")}>
                  {receipt.discrepancy ? "Discrepancy found" : "Receipt verified"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-[12.5px]">
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={1.75} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-text-faint">PO Number</p>
                    <p className="font-tabular text-text">{receipt.poNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={1.75} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-text-faint">Vendor</p>
                    <p className="text-text">{activePO.supplier}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Boxes className="h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={1.75} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-text-faint">Scanned qty</p>
                    <p className={cn("font-tabular", receipt.discrepancy ? "text-warning" : "text-text")}>
                      {receipt.scannedQuantity ?? "—"}
                      <span className="ml-1 text-text-faint">/ {receipt.orderedQuantity} ordered</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={1.75} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-text-faint">Scanned</p>
                    <p className="text-text">{new Date(receipt.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {receipt.discrepancy && (
                <div className="border-t border-warning/20 bg-warning-dim/40 px-4 py-3">
                  <p className="text-[12px] text-warning">{receipt.discrepancy}</p>
                  <p className="mt-1 text-[11.5px] text-text-faint">
                    Receipt logged as pending — resolve the discrepancy before matching.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Past attempts for this PO — useful once a mismatch has been
              rescanned, so the history of what happened is still visible. */}
          {pastReceipts.length > 1 && (
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-text-faint">Scan history</p>
              <div className="space-y-1.5">
                {pastReceipts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-text-faint">{new Date(r.timestamp).toLocaleString()}</span>
                    <span className={cn("font-tabular", r.discrepancy ? "text-warning" : "text-success")}>
                      {r.scannedQuantity ?? "—"} scanned {r.discrepancy ? "· mismatch" : "· matched"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {(["pending", "scanning", "received"] as Status[]).map((s) => {
            const order: Status[] = ["pending", "scanning", "received"];
            const isActive = s === status;
            const isPast = order.indexOf(s) < order.indexOf(status);
            return (
              <motion.div
                key={s}
                animate={
                  isActive
                    ? { scale: [1, 1.03, 1], borderColor: "var(--color-border-strong)" }
                    : { scale: 1 }
                }
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-[12.5px] transition-colors duration-300",
                  isActive ? "border-border-strong bg-overlay/[0.04] text-text" : "border-border text-text-faint",
                  isPast && "text-text-dim",
                )}
              >
                <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    {isPast ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success-dim text-success"
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                      </motion.span>
                    ) : isActive ? (
                      <motion.span key="active" className="relative flex h-1.5 w-1.5">
                        <motion.span
                          animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                          className="absolute inset-0 rounded-full bg-info"
                        />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-info" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="h-1.5 w-1.5 rounded-full bg-text-faint/40"
                      />
                    )}
                  </AnimatePresence>
                </span>
                {statusMeta[s].label}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Always-available "switch to a different open PO" control — lets a user
 * move off whatever PO happened to be selected (their server-tracked active
 * PO, a ?po= link, or a prior manual pick) to work through Receiving on any
 * other open PO instead, without being stuck on just one. */
function PoSwitcher({
  openPOs,
  activePoId,
  onPick,
}: {
  openPOs: { id: string; poNumber: string; item: string; supplier: string; receivingStatus: string }[];
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
                  <Badge tone={po.receivingStatus === "received" ? "success" : "warning"}>
                    {po.receivingStatus === "received" ? "Completed" : "Pending"}
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
