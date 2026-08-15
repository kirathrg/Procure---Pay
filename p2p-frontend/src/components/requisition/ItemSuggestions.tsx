import { motion, AnimatePresence } from "framer-motion";
import { Package } from "lucide-react";
import { cn } from "../../lib/cn";

export function ItemSuggestions({
  suggestions,
  activeIndex,
  onSelect,
}: {
  suggestions: string[];
  activeIndex: number;
  onSelect: (name: string) => void;
}) {
  return (
    <AnimatePresence>
      {suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="surface-panel absolute bottom-full left-0 mb-1.5 w-64 overflow-hidden rounded-lg border border-border-strong bg-surface-raised shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          {suggestions.map((name, i) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => {
                // mousedown fires before the textarea's blur, so the
                // suggestion click registers before focus (and the list)
                // would otherwise disappear.
                e.preventDefault();
                onSelect(name);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors duration-100",
                i === activeIndex ? "bg-overlay/[0.07] text-text" : "text-text-dim",
              )}
            >
              <Package className="h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={1.75} />
              {name}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
