import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CandidateSuppliersResult, PurchaseOrder } from "../types";

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => api.get<PurchaseOrder[]>("/purchase-orders"),
  });
}

export function usePurchaseOrder(id: string | null) {
  return useQuery({
    queryKey: ["purchaseOrders", id],
    queryFn: () => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
    enabled: !!id,
  });
}

/** The PO the current user is actively walking through Requisition -> Sourcing
 * -> Receiving -> Invoicing for. Set when a requisition routes to a new PO;
 * cleared once that PO's 3-way match completes. Every module that needs "the
 * PO I'm currently working on" reads this instead of guessing from the full
 * list, so they all agree and each can resume where the last one left off.
 * `null` (not undefined) once loaded with no active PO — distinguish "still
 * loading" from "genuinely none" via isLoading. */
export function useActivePurchaseOrder() {
  return useQuery({
    queryKey: ["purchaseOrders", "active"],
    queryFn: () => api.get<PurchaseOrder | null>("/purchase-orders/active"),
  });
}

export function useCandidateSuppliers(poId: string | null) {
  return useQuery({
    queryKey: ["purchaseOrders", poId, "candidateSuppliers"],
    queryFn: () => api.get<CandidateSuppliersResult>(`/purchase-orders/${poId}/candidate-suppliers`),
    enabled: !!poId,
  });
}

export function useDownloadPoPdf() {
  return useMutation({
    mutationFn: async ({ poId, poNumber }: { poId: string; poNumber: string }) => {
      const blob = await api.getBlob(`/purchase-orders/${poId}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${poNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useEmailPoToSupplier() {
  return useMutation({
    mutationFn: (poId: string) => api.post<{ sentTo: string; messageId: string }>(`/purchase-orders/${poId}/email`, {}),
  });
}

export function useUpdatePOType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, poType }: { id: string; poType: PurchaseOrder["poType"] }) =>
      api.patch<PurchaseOrder>(`/purchase-orders/${id}/type`, { poType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    },
  });
}

export function useUpdatePOStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PurchaseOrder["status"] }) =>
      api.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    },
  });
}
