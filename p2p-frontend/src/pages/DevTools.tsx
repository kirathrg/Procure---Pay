import { useState } from "react";
import { QrCode, FileText, Download } from "lucide-react";
import { usePurchaseOrders } from "../hooks/usePurchaseOrders";
import { api } from "../lib/api";

const STORAGE_KEY = "p2p-dev-tools-state";

interface PersistedState {
  selectedPoId: string;
  qrQty: string;
  invoiceQty: string;
  invoiceNumber: string;
  qrPreview: string | null;
  invoicePreview: string | null;
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    // corrupt/old shape — fall through to defaults
  }
  return {
    selectedPoId: "",
    qrQty: "",
    invoiceQty: "",
    invoiceNumber: "INV-TEST-0001",
    qrPreview: null,
    invoicePreview: null,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Not part of the real P2P flow — a demo/test-prep tool for generating a
 * scannable QR (Receiving) or a synthetic invoice image (Invoicing) for any
 * real PO, so testing a newly created product's downstream flows doesn't
 * require re-running a script by hand each time. No auth required (matches
 * the read-only GET endpoints it calls) since this never mutates data —
 * it only renders images from what's already in the database.
 *
 * State (selected PO, generated previews) is persisted to localStorage, not
 * sessionStorage — this page's local useState alone resets on every unmount,
 * and sessionStorage is scoped to a single tab (a fresh/different tab starts
 * with none of it), so either one alone wasn't enough to survive downloading
 * an image (which can open in a new tab depending on browser settings) and
 * coming back to generate the other one. Images are kept as data: URLs (not
 * blob: URLs) because a blob: URL is only valid for the document that
 * created it — it wouldn't survive a different tab or this component
 * unmounting either. */
export default function DevTools() {
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const [state, setState] = useState<PersistedState>(loadPersisted);
  const [qrLoading, setQrLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  function update(patch: Partial<PersistedState>) {
    setState((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const { selectedPoId, qrQty, invoiceQty, invoiceNumber, qrPreview, invoicePreview } = state;
  const selectedPo = purchaseOrders.find((po) => po.id === selectedPoId);

  function buildQrPath() {
    if (!selectedPoId) return null;
    const params = qrQty.trim() ? `?quantity=${encodeURIComponent(qrQty.trim())}` : "";
    return `/dev-tools/receiving-qr/${selectedPoId}${params}`;
  }

  function buildInvoicePath() {
    if (!selectedPoId) return null;
    const params = new URLSearchParams();
    if (invoiceQty.trim()) params.set("quantity", invoiceQty.trim());
    if (invoiceNumber.trim()) params.set("invoice_number", invoiceNumber.trim());
    const qs = params.toString();
    return `/dev-tools/invoice-image/${selectedPoId}${qs ? `?${qs}` : ""}`;
  }

  async function generateQr() {
    const path = buildQrPath();
    if (!path) return;
    setQrError(null);
    setQrLoading(true);
    try {
      const blob = await api.getBlob(path);
      update({ qrPreview: await blobToDataUrl(blob) });
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "Couldn't generate the QR code.");
    } finally {
      setQrLoading(false);
    }
  }

  async function generateInvoice() {
    const path = buildInvoicePath();
    if (!path) return;
    setInvoiceError(null);
    setInvoiceLoading(true);
    try {
      const blob = await api.getBlob(path);
      update({ invoicePreview: await blobToDataUrl(blob) });
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : "Couldn't generate the invoice image.");
    } finally {
      setInvoiceLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Dev tools</h2>
      <p className="mt-0.5 text-[12px] text-text-faint">
        Generate a receiving QR or a synthetic invoice image for any real PO — for testing Receiving/Invoicing
        without a physical package or scanner. Not part of the real product flow.
      </p>

      <div className="mt-5 rounded-lg border border-border bg-surface p-4">
        <label className="text-[11px] uppercase tracking-wide text-text-faint">Purchase order</label>
        <select
          value={selectedPoId}
          onChange={(e) => update({ selectedPoId: e.target.value, qrPreview: null, invoicePreview: null })}
          className="mt-1.5 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-[13px] text-text"
        >
          <option value="">Select a PO…</option>
          {purchaseOrders.map((po) => (
            <option key={po.id} value={po.id}>
              {po.poNumber} · {po.item} · qty {po.quantity} · {po.supplier}
            </option>
          ))}
        </select>
        {selectedPo && (
          <p className="mt-1.5 text-[12px] text-text-faint">
            Real ordered quantity: <span className="font-tabular text-text">{selectedPo.quantity}</span> · Unit
            price: <span className="font-tabular text-text">${selectedPo.unitPrice.toFixed(2)}</span>
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-text-faint" strokeWidth={1.75} />
            <h3 className="font-heading text-[13px] font-medium text-text">Receiving QR</h3>
          </div>
          <p className="mt-1 text-[11px] text-text-faint">
            Leave quantity blank to match the real order (Received). Enter a different number to test a
            discrepancy (Pending).
          </p>
          <label className="mt-3 block text-[11px] uppercase tracking-wide text-text-faint">
            Quantity override
          </label>
          <input
            type="number"
            value={qrQty}
            onChange={(e) => update({ qrQty: e.target.value })}
            placeholder={selectedPo ? `${selectedPo.quantity} (match)` : "e.g. 45"}
            className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-[13px] text-text placeholder:text-text-faint"
          />
          <button
            onClick={generateQr}
            disabled={!selectedPoId || qrLoading}
            className="mt-3 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 ease-out enabled:hover:bg-primary-hover disabled:opacity-40"
          >
            <QrCode className="h-3.5 w-3.5" strokeWidth={1.75} />
            {qrLoading ? "Generating…" : "Generate QR"}
          </button>
          {qrError && <p className="mt-2 text-[12px] text-danger">{qrError}</p>}

          {qrPreview && (
            <div className="mt-4 flex flex-col items-center gap-2 border-t border-border pt-4">
              <img src={qrPreview} alt="Receiving QR" className="h-40 w-40 rounded-md border border-border bg-white p-2" />
              <a
                href={qrPreview}
                download={`${selectedPo?.poNumber ?? "receiving"}-qr.png`}
                className="flex items-center gap-1.5 text-[11px] text-text-faint transition-colors duration-150 ease-out hover:text-text-dim"
              >
                <Download className="h-3 w-3" strokeWidth={1.75} />
                Save image, then upload it on the Receiving page
              </a>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-text-faint" strokeWidth={1.75} />
            <h3 className="font-heading text-[13px] font-medium text-text">Invoice image</h3>
          </div>
          <p className="mt-1 text-[11px] text-text-faint">
            A synthetic invoice PaddleOCR can read — real vendor/PO/price from this PO, quantity/invoice # overridable.
          </p>
          <label className="mt-3 block text-[11px] uppercase tracking-wide text-text-faint">
            Invoice number
          </label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => update({ invoiceNumber: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-[13px] text-text"
          />
          <label className="mt-2.5 block text-[11px] uppercase tracking-wide text-text-faint">
            Quantity override
          </label>
          <input
            type="number"
            value={invoiceQty}
            onChange={(e) => update({ invoiceQty: e.target.value })}
            placeholder={selectedPo ? `${selectedPo.quantity} (match)` : "e.g. 45"}
            className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-[13px] text-text placeholder:text-text-faint"
          />
          <button
            onClick={generateInvoice}
            disabled={!selectedPoId || invoiceLoading}
            className="mt-3 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 ease-out enabled:hover:bg-primary-hover disabled:opacity-40"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
            {invoiceLoading ? "Generating…" : "Generate invoice"}
          </button>
          {invoiceError && <p className="mt-2 text-[12px] text-danger">{invoiceError}</p>}

          {invoicePreview && (
            <div className="mt-4 flex flex-col items-center gap-2 border-t border-border pt-4">
              <img
                src={invoicePreview}
                alt="Test invoice"
                className="max-h-64 w-full rounded-md border border-border bg-white object-contain"
              />
              <a
                href={invoicePreview}
                download={`${selectedPo?.poNumber ?? "invoice"}-test.png`}
                className="flex items-center gap-1.5 text-[11px] text-text-faint transition-colors duration-150 ease-out hover:text-text-dim"
              >
                <Download className="h-3 w-3" strokeWidth={1.75} />
                Save image, then upload it on the Invoicing page
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
