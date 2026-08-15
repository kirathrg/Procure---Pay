import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { PurchaseRequisition, Urgency } from "../types";

export function usePurchaseRequisitions() {
  return useQuery({
    queryKey: ["purchaseRequisitions"],
    queryFn: () => api.get<PurchaseRequisition[]>("/purchase-requisitions"),
  });
}

interface CreatePurchaseRequisitionInput {
  item: string;
  quantity: string;
  deadline?: string;
  urgency?: Urgency;
  notes?: string;
}

export function useCreatePurchaseRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePurchaseRequisitionInput) =>
      api.post<PurchaseRequisition>("/purchase-requisitions", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseRequisitions"] });
    },
  });
}

interface ApprovePurchaseRequisitionResult {
  purchaseRequisition: PurchaseRequisition;
  poNumber: string | null;
  routingFailureReason: string | null;
}

export function useApprovePurchaseRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prId: string) =>
      api.post<ApprovePurchaseRequisitionResult>(`/purchase-requisitions/${prId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseRequisitions"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    },
  });
}
