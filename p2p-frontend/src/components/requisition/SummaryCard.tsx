import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import type { RequisitionSlot } from "../../types";

const STEPS: { key: RequisitionSlot["key"]; label: string }[] = [
  { key: "item", label: "Item" },
  { key: "quantity", label: "Quantity" },
  { key: "deadline", label: "Needed by" },
  { key: "urgency", label: "Urgency" },
];

export function SummaryCard({ slots }: { slots: RequisitionSlot[] }) {
  const byKey = new Map(slots.map((s) => [s.key, s]));
  // Deadline and urgency are asked together as one step, so either one being
  // answered completes both rows — mirrors the backend's combined question.
  const timingAnswered = byKey.has("deadline") || byKey.has("urgency");

  // Only show steps up to and including the first unanswered one — later
  // steps stay hidden rather than listed as greyed-out placeholders, so the
  // card reads as "what's been asked" not "every field that could exist."
  let activeKey: RequisitionSlot["key"] | null = null;
  const visibleSteps = STEPS.filter((step) => {
    const answered = step.key === "urgency" ? timingAnswered : byKey.has(step.key);
    if (answered) return true;
    if (activeKey === null) {
      activeKey = step.key;
      return true;
    }
    return false;
  });

  return (
    <div className="w-full max-w-sm rounded-lg border border-border-strong bg-surface-raised">
      <div className="border-b border-border px-3.5 py-2.5">
        <span className="font-heading text-[12px] font-medium tracking-tight text-text-dim">
          Requisition summary
        </span>
      </div>
      <div className="space-y-2.5 px-3.5 py-3">
        <AnimatePresence initial={false}>
          {visibleSteps.map((step, i) => {
            // "Needed by" and "Urgency" are one combined backend question —
            // whichever of deadline/urgency actually got filled should show
            // on BOTH rows, not just the one whose key happens to match.
            // Previously the urgency row looked up only byKey.get("urgency"),
            // so an answer the model stored under "deadline" (a normal,
            // valid outcome — either key is accepted for this question) left
            // urgency stuck on "Asking…" forever even though the step was
            // actually done.
            const slot =
              step.key === "urgency" ? byKey.get("urgency") ?? byKey.get("deadline") : byKey.get(step.key);
            const isActive = step.key === activeKey;
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: i * 0.06, ease: "easeOut" }}
                className="flex items-center justify-between gap-3 text-[13px]"
              >
                <span className={isActive ? "font-medium text-text" : "text-text-faint"}>{step.label}</span>
                {slot ? (
                  <span className="flex items-center gap-1.5 font-medium text-text">
                    {slot.value}
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.06 + 0.15, duration: 0.2, ease: "easeOut" }}
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success-dim text-success"
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                    </motion.span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <motion.span
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      className="h-1.5 w-1.5 rounded-full bg-accent"
                    />
                    <span className="text-[11px] text-text-faint">Asking…</span>
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
