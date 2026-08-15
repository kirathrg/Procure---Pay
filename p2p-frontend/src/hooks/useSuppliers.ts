import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Product, ProductSupplier, Supplier, SupplierCreateInput } from "../types";

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>("/suppliers"),
  });
}

export function useSupplierProducts(supplierId: string | null) {
  return useQuery({
    queryKey: ["suppliers", supplierId, "products"],
    queryFn: () => api.get<(ProductSupplier & { product: Product })[]>(`/suppliers/${supplierId}/products`),
    enabled: !!supplierId,
  });
}

export function useAddSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (supplier: SupplierCreateInput) => api.post<Supplier>("/suppliers", supplier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
