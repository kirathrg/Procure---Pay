import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Product, ProductSupplier, Supplier } from "../types";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
}

export function useProductSuppliers(productId: string | null) {
  return useQuery({
    queryKey: ["products", productId, "suppliers"],
    queryFn: () => api.get<(ProductSupplier & { supplier: Supplier })[]>(`/products/${productId}/suppliers`),
    enabled: !!productId,
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Omit<Product, "id" | "createdAt" | "status">) => api.post<Product>("/products", product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
