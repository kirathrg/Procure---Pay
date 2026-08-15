import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AnalyticsSummary, CycleTimePoint, ExceptionReason, SupplierPerformance } from "../types";

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => api.get<AnalyticsSummary>("/analytics/summary"),
  });
}

export function useCycleTimeTrend() {
  return useQuery({
    queryKey: ["analytics", "cycle-time"],
    queryFn: () => api.get<CycleTimePoint[]>("/analytics/cycle-time"),
  });
}

export function useSupplierPerformance() {
  return useQuery({
    queryKey: ["analytics", "supplier-performance"],
    queryFn: () => api.get<SupplierPerformance[]>("/analytics/supplier-performance"),
  });
}

export function useExceptionReasons() {
  return useQuery({
    queryKey: ["analytics", "exceptions"],
    queryFn: () => api.get<ExceptionReason[]>("/analytics/exceptions"),
  });
}
