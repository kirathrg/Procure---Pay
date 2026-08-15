import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Package,
  Building2,
  ClipboardList,
  FileText,
  GitCompareArrows,
  ShieldAlert,
  MessageSquare,
  ShoppingCart,
  PackageCheck,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useSearch, type SearchResult } from "../../hooks/useSearch";
import { cn } from "../../lib/cn";

const GROUP_ICON: Record<string, LucideIcon> = {
  Pages: Search,
  Products: Package,
  Suppliers: Building2,
  "Purchase orders": ClipboardList,
  Invoices: FileText,
  "3-Way matches": GitCompareArrows,
  Anomalies: ShieldAlert,
};

// Static — mirrors Sidebar.tsx's navItems. Pages aren't backend data, so
// they're matched client-side rather than round-tripping through /search.
const PAGES: SearchResult[] = [
  { id: "page-requisition", title: "Requisition", subtitle: "Conversational NLP intake", group: "Pages", path: "/" },
  { id: "page-catalog", title: "Catalog", subtitle: "Product catalog & supplier pricing", group: "Pages", path: "/catalog" },
  { id: "page-suppliers", title: "Suppliers", subtitle: "Supplier directory", group: "Pages", path: "/suppliers" },
  { id: "page-sourcing", title: "Sourcing & PO", subtitle: "Supplier comparison & purchase orders", group: "Pages", path: "/sourcing" },
  { id: "page-purchase-orders", title: "Purchase Orders", subtitle: "All orders, status & type", group: "Pages", path: "/purchase-orders" },
  { id: "page-receiving", title: "Receiving", subtitle: "Goods receipt verification", group: "Pages", path: "/receiving" },
  { id: "page-invoicing", title: "Invoicing", subtitle: "OCR extraction", group: "Pages", path: "/invoicing" },
  { id: "page-match", title: "3-Way Match & Approval", subtitle: "PO / receipt / invoice reconciliation", group: "Pages", path: "/match" },
  { id: "page-anomalies", title: "Anomaly Detection", subtitle: "Fraud & exception feed", group: "Pages", path: "/anomalies" },
  { id: "page-analytics", title: "Analytics", subtitle: "Cycle time, cost, exceptions", group: "Pages", path: "/analytics" },
];

const PAGE_ICONS: Record<string, LucideIcon> = {
  "page-requisition": MessageSquare,
  "page-catalog": Package,
  "page-suppliers": Building2,
  "page-sourcing": ShoppingCart,
  "page-purchase-orders": ClipboardList,
  "page-receiving": PackageCheck,
  "page-invoicing": FileText,
  "page-match": GitCompareArrows,
  "page-anomalies": ShieldAlert,
  "page-analytics": BarChart3,
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const debouncedQuery = useDebouncedValue(query, 250);
  const { data: liveResults = [], isFetching } = useSearch(debouncedQuery);

  const matchingPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES;
    return PAGES.filter((p) => p.title.toLowerCase().includes(q) || p.subtitle?.toLowerCase().includes(q));
  }, [query]);

  const results = useMemo(
    () => (query.trim() ? [...matchingPages, ...liveResults] : matchingPages),
    [query, matchingPages, liveResults],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  function select(path: string) {
    navigate(path);
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) select(item.path);
    }
  }

  const groupedList = useMemo(() => results, [results]);
  let lastGroup = "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-[18%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border-strong bg-surface-raised shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search products, suppliers, purchase orders, invoices, and flagged items
          </Dialog.Description>

          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-text-faint" strokeWidth={1.75} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search products, suppliers, POs, invoices…"
              className="flex-1 bg-transparent text-[14px] text-text placeholder:text-text-faint focus:outline-none"
            />
            <kbd className="rounded-sm border border-border px-1.5 py-0.5 font-tabular text-[10px] text-text-faint">
              Esc
            </kbd>
          </div>

          <div className="max-h-80 overflow-y-auto py-1.5">
            {query.trim() && isFetching && groupedList.length === 0 && (
              <p className="px-3.5 py-6 text-center text-[13px] text-text-faint">Searching…</p>
            )}

            {query.trim() && !isFetching && groupedList.length === 0 && (
              <p className="px-3.5 py-6 text-center text-[13px] text-text-faint">No results for "{query}"</p>
            )}

            {groupedList.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.group === "Pages" ? PAGE_ICONS[item.id] ?? Search : GROUP_ICON[item.group] ?? Search;
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="px-3.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wide text-text-faint">
                      {item.group}
                    </p>
                  )}
                  <button
                    onClick={() => select(item.path)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors duration-100",
                      i === activeIndex ? "bg-overlay/[0.07]" : "",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={1.75} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-text">{item.title}</p>
                      {item.subtitle && (
                        <p className="truncate text-[11px] text-text-faint">{item.subtitle}</p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
