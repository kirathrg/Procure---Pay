import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AnomalyRecord } from "../types";

export function useAnomalies() {
  return useQuery({
    queryKey: ["anomalies"],
    queryFn: () => api.get<AnomalyRecord[]>("/anomalies"),
  });
}

export function useRunAnomalyDetection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<AnomalyRecord[]>("/anomalies/detect", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
    },
  });
}
