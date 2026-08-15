import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  path: string;
}

export function useSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search", trimmed],
    queryFn: () => api.get<SearchResult[]>(`/search?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length > 0,
  });
}
