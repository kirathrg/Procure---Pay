import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface ReceiptResult {
  id: string;
  poNumber: string;
  scannedQuantity: number | null;
  orderedQuantity: number;
  status: "pending" | "scanning" | "received";
  damageDetected: boolean;
  imageUrl: string | null;
  timestamp: string;
  /** Set when the scan did not cleanly match the PO (bad decode, wrong PO, or quantity delta). */
  discrepancy: string | null;
}

export interface ScanReceiptInput {
  /** Raw text decoded from the QR code — decoded client-side, either from a
   * live webcam frame or an uploaded photo (see lib/qrScan.ts). Null if a
   * scan was attempted but no QR code was found. */
  decodedData: string | null;
  /** Optional photo of the scan, kept only for the record — a webcam frame
   * grabbed at the moment of a successful decode, or the uploaded file
   * itself, as a data: URL. */
  imageDataUrl?: string;
}

/** Every receipt scanned for this PO, newest first — used to resume the
 * Receiving page's display state on load instead of always starting blank,
 * and to show prior scan attempts (e.g. a mismatch followed by a fix). */
export function useReceipts(poId: string | null) {
  return useQuery({
    queryKey: ["purchaseOrders", poId, "receipts"],
    queryFn: () => api.get<ReceiptResult[]>(`/purchase-orders/${poId}/receipts`),
    enabled: !!poId,
  });
}

export function useScanReceipt(poId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScanReceiptInput) =>
      api.post<ReceiptResult>(`/purchase-orders/${poId}/receipts`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      // The backend auto-runs the 3-way match once both a receipt and an
      // invoice exist for this PO — refresh match cases so a newly created
      // one shows up without a manual reload.
      queryClient.invalidateQueries({ queryKey: ["matchCases"] });
    },
  });
}
