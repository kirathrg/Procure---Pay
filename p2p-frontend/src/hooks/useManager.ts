import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Payment } from "../types";

export function useManagerPayments() {
  return useQuery({
    queryKey: ["manager", "payments"],
    queryFn: () => api.get<Payment[]>("/manager/payments"),
  });
}

interface CreateOrderResult {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export function useCreatePaymentOrder() {
  return useMutation({
    mutationFn: (paymentId: string) => api.post<CreateOrderResult>(`/manager/payments/${paymentId}/create-order`, {}),
  });
}

interface CapturePayload {
  paymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export function useCapturePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, ...body }: CapturePayload) => api.post<Payment>(`/manager/payments/${paymentId}/capture`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager", "payments"] });
    },
  });
}
