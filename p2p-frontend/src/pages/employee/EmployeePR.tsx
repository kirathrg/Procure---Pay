import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock3, LogOut, PackagePlus, Workflow } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { usePurchaseRequisitions, useCreatePurchaseRequisition } from "../../hooks/usePurchaseRequisitions";
import { useProducts } from "../../hooks/useCatalog";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { cn } from "../../lib/cn";
import type { Urgency } from "../../types";

const statusTone: Record<string, BadgeTone> = {
  pending: "neutral",
  in_progress: "info",
  resolved: "success",
};

const statusLabel: Record<string, string> = {
  pending: "Pending review",
  in_progress: "In progress",
  resolved: "Resolved",
};

const statusIcon: Record<string, typeof Clock3> = {
  pending: Clock3,
  in_progress: Clock3,
  resolved: CheckCircle2,
};

export default function EmployeePR() {
  const navigate = useNavigate();
  const { user, logout } = useAppStore();
  const { data: prs = [], isLoading } = usePurchaseRequisitions();
  const { data: products = [] } = useProducts();
  const createPR = useCreatePurchaseRequisition();

  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState("");
  const [deadline, setDeadline] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!item.trim() || !quantity.trim()) {
      setError("Item and quantity are required.");
      return;
    }
    try {
      await createPR.mutateAsync({
        item: item.trim(),
        quantity: quantity.trim(),
        deadline: deadline.trim(),
        urgency,
        notes: notes.trim(),
      });
      setItem("");
      setQuantity("");
      setDeadline("");
      setUrgency("normal");
      setNotes("");
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit this request. Try again.");
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-white">
            <Workflow className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <span className="font-heading text-[14px] font-bold tracking-tight text-text">
            Warehouse Requests
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="text-[12px] text-text-faint">{user.name}</span>}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <section className="surface-panel rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <PackagePlus className="h-4 w-4 text-accent" strokeWidth={1.75} />
            <h2 className="font-heading text-[15px] font-medium tracking-tight text-text">New purchase request</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="col-span-2">
                <label className="mb-1.5 block text-[12px] text-text-faint">Item</label>
                <input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  list="pr-catalog-items"
                  placeholder="e.g. Ergonomic Office Chair"
                  className="w-full rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
                <datalist id="pr-catalog-items">
                  {products.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] text-text-faint">Quantity</label>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] text-text-faint">Needed by</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>

              <div className="col-span-2">
                <label className="mb-1.5 block text-[12px] text-text-faint">Urgency</label>
                <div className="flex gap-2">
                  {(["low", "normal", "urgent"] as Urgency[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUrgency(u)}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-1.5 text-[12.5px] capitalize transition-colors duration-150 ease-out",
                        urgency === u
                          ? "border-border-strong bg-overlay/[0.06] text-text"
                          : "border-border text-text-faint hover:text-text-dim",
                      )}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <label className="mb-1.5 block text-[12px] text-text-faint">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any context the procurement team should know…"
                  className="w-full resize-none rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>
            </div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-1.5 overflow-hidden rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createPR.isPending}
                className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 ease-out enabled:hover:bg-primary-hover disabled:opacity-60"
              >
                {createPR.isPending ? "Submitting…" : "Submit request"}
              </button>
              <AnimatePresence>
                {justSubmitted && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-[12px] text-success"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Request submitted
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="font-heading text-[15px] font-medium tracking-tight text-text">Your requests</h2>
          <div className="mt-3 space-y-2">
            {isLoading ? (
              <p className="text-[13px] text-text-faint">Loading…</p>
            ) : prs.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-[13px] text-text-faint">
                No requests submitted yet.
              </p>
            ) : (
              prs.map((pr) => {
                const Icon = statusIcon[pr.status];
                return (
                  <div
                    key={pr.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-text">{pr.item}</span>
                        <span className="font-tabular text-[12px] text-text-faint">× {pr.quantity}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-faint">
                        {pr.deadline ? `Needed ${pr.deadline} · ` : ""}
                        {pr.urgency} urgency
                        {pr.poNumber ? ` · ${pr.poNumber}` : ""}
                      </p>
                    </div>
                    <Badge tone={statusTone[pr.status]}>
                      <Icon className="h-3 w-3" strokeWidth={2} />
                      {statusLabel[pr.status]}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
