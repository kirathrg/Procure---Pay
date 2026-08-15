import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { InvoiceRecord } from "../types";

/** Every invoice extracted for this PO, newest first — used to resume the
 * Invoicing page's display state on load instead of always starting blank. */
export function useInvoices(poId: string | null) {
  return useQuery({
    queryKey: ["purchaseOrders", poId, "invoices"],
    queryFn: () => api.get<InvoiceRecord[]>(`/purchase-orders/${poId}/invoices`),
    enabled: !!poId,
  });
}

export function useExtractInvoice(poId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.postForm<InvoiceRecord>(`/purchase-orders/${poId}/invoices`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      // The backend auto-runs the 3-way match once both a receipt and an
      // invoice exist for this PO — refresh match cases so a newly created
      // one shows up without a manual reload.
      queryClient.invalidateQueries({ queryKey: ["matchCases"] });
    },
  });
}
