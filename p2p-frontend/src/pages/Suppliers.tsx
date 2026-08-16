import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { useSuppliers, useSupplierProducts } from "../hooks/useSuppliers";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { AddSupplierForm } from "../components/suppliers/AddSupplierForm";
import { cn } from "../lib/cn";
import type { Supplier } from "../types";

const statusTone: Record<Supplier["status"], BadgeTone> = {
  active: "neutral",
  preferred: "accent",
  blocked: "danger",
};

export default function Suppliers() {
  const { data: suppliers = [], isLoading } = useSuppliers();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: activeProducts = [] } = useSupplierProducts(activeId);

  const categories = useMemo(() => Array.from(new Set(suppliers.map((s) => s.category))), [suppliers]);

  const filtered = suppliers.filter((s) => {
    const matchesQuery = !query.trim() || s.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || s.category === category;
    return matchesQuery && matchesCategory;
  });

  const active = suppliers.find((s) => s.id === activeId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-[16px] font-medium tracking-tight text-text">Supplier directory</h2>
          <p className="mt-0.5 text-[12px] text-text-faint">
            {isLoading ? "Loading…" : `${suppliers.length} suppliers`}
          </p>
        </div>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add supplier
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-1.5 rounded-md border border-border bg-overlay/[0.03] px-2.5 py-1.5 sm:w-auto">
          <Search className="h-3.5 w-3.5 text-text-faint" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full bg-transparent text-[12.5px] text-text placeholder:text-text-faint focus:outline-none sm:w-56"
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

      <div className="surface-panel overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="text-[11px] text-text-faint">
              <th className="px-4 py-2.5 font-normal">Name</th>
              <th className="px-4 py-2.5 font-normal">Category</th>
              <th className="px-4 py-2.5 font-normal">Status</th>
              <th className="px-4 py-2.5 font-normal">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr
                key={s.id}
                onClick={() => setActiveId(activeId === s.id ? null : s.id)}
                className={cn(
                  "row-interactive cursor-pointer text-[13px]",
                  activeId === s.id && "bg-overlay/[0.05]",
                )}
              >
                <td className="px-4 py-2.5 text-text">{s.name}</td>
                <td className="px-4 py-2.5 text-text-dim">{s.category}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={statusTone[s.status]}>{s.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-text-dim">{s.contactEmail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="surface-panel mt-4 rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-heading text-[14px] font-medium tracking-tight text-text">
                  {active.name}
                </p>
                <p className="mt-0.5 text-[12px] text-text-faint">{active.category}</p>
              </div>
              <Badge tone={statusTone[active.status]} className="shrink-0">
                {active.status}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 text-[12px] sm:grid-cols-2">
              <div>
                <p className="text-text-faint">Contact</p>
                <p className="mt-0.5 text-text">{active.contactName || "—"}</p>
                <p className="text-text-dim">{active.contactEmail || "—"}</p>
                <p className="text-text-dim">{active.contactPhone || "—"}</p>
              </div>
              <div>
                <p className="text-text-faint">Address</p>
                <p className="mt-0.5 text-text-dim">{active.addressLine || "—"}</p>
                <p className="mt-1 text-text-faint">Tax ID</p>
                <p className="font-tabular text-text-dim">{active.taxId || "—"}</p>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">
                Products supplied
              </p>
              {activeProducts.length === 0 ? (
                <p className="text-[12px] text-text-faint">No products assigned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeProducts.map((ps) => (
                    <span
                      key={ps.productId}
                      className="rounded-sm border border-border bg-overlay/[0.02] px-2 py-1 text-[11px] text-text-dim"
                    >
                      {ps.product.name} · ${ps.unitPrice}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add supplier"
        description="Add a new supplier to the directory."
      >
        <AddSupplierForm onDone={() => setAddOpen(false)} />
      </Modal>
    </div>
  );
}
