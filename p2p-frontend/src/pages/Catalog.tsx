import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Star } from "lucide-react";
import { useProducts, useProductSuppliers } from "../hooks/useCatalog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { AddProductForm } from "../components/catalog/AddProductForm";
import { cn } from "../lib/cn";

export default function Catalog() {
  const { data: products = [], isLoading } = useProducts();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: eligibleSuppliers = [] } = useProductSuppliers(expandedId);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);

  const filtered = products.filter((p) => {
    const matchesQuery =
      !query.trim() ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || p.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Product catalog</h2>
          <p className="mt-0.5 text-[12px] text-text-faint">
            {isLoading ? "Loading…" : `${products.length} products`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add product
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-overlay/[0.03] px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-text-faint" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-56 bg-transparent text-[12.5px] text-text placeholder:text-text-faint focus:outline-none"
          />
        </div>
        <button
          onClick={() => setCategory(null)}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-[12px] transition-colors duration-150 ease-out",
            category === null
              ? "border-border-strong bg-overlay/[0.06] text-text"
              : "border-border text-text-faint hover:text-text-dim",
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-[12px] transition-colors duration-150 ease-out",
              category === c
                ? "border-border-strong bg-overlay/[0.06] text-text"
                : "border-border text-text-faint hover:text-text-dim",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {filtered.map((product, i) => {
          const isExpanded = expandedId === product.id;
          const eligible = isExpanded ? eligibleSuppliers : [];

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "surface-panel card-interactive col-span-1 overflow-hidden rounded-lg border border-border bg-surface",
                isExpanded && "col-span-3",
              )}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : product.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-[13px] font-medium tracking-tight text-text">
                      {product.name}
                    </p>
                    <p className="mt-0.5 font-tabular text-[11px] text-text-faint">{product.sku}</p>
                  </div>
                  <Badge tone="neutral">{product.category}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-[12px]">
                  <span className="text-text-faint">Reference price</span>
                  <span className="font-tabular text-text">${product.referencePrice.toLocaleString()}</span>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden border-t border-border"
                  >
                    <p className="px-4 pt-3 text-[11px] text-text-faint">{product.description}</p>
                    <table className="mt-3 w-full text-left">
                      <thead>
                        <tr className="text-[11px] text-text-faint">
                          <th className="px-4 py-2 font-normal">Supplier</th>
                          <th className="px-4 py-2 text-right font-normal">Unit price</th>
                          <th className="px-4 py-2 text-right font-normal">Lead time</th>
                          <th className="px-4 py-2 text-right font-normal"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {eligible.map((ps) => (
                          <tr key={ps.supplierId} className="row-interactive text-[12.5px]">
                            <td className="px-4 py-2.5 text-text">{ps.supplier.name}</td>
                            <td className="px-4 py-2.5 text-right font-tabular text-text-dim">${ps.unitPrice}</td>
                            <td className="px-4 py-2.5 text-right font-tabular text-text-dim">
                              {ps.leadTimeDays}d
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {ps.preferred && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-accent">
                                  <Star className="h-3 w-3" strokeWidth={2} fill="currentColor" />
                                  Preferred
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {eligible.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-[12px] text-text-faint">
                              No suppliers assigned yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="h-3" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add product" description="Add a new item to the catalog.">
        <AddProductForm onDone={() => setAddOpen(false)} />
      </Modal>
    </div>
  );
}
