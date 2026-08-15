import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { MatchCase } from "../types";

export function useMatchCases() {
  return useQuery({
    queryKey: ["matchCases"],
    queryFn: () => api.get<MatchCase[]>("/match-cases"),
  });
}

export function useResolveMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, action }: { caseId: string; action: "release" | "review" }) =>
      api.post<{ resolvedStatus: "pending_approval" }>(`/match-cases/${caseId}/resolve`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matchCases"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
    },
  });
}
