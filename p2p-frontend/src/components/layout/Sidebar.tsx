import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  MessageSquare,
  ShoppingCart,
  PackageCheck,
  FileText,
  GitCompareArrows,
  ShieldAlert,
  BarChart3,
  Workflow,
  Package,
  Building2,
  ClipboardList,
  PackageSearch,
} from "lucide-react";
import { cn } from "../../lib/cn";

const navItems = [
  { to: "/purchase-requisitions", label: "Purchase Requisitions", icon: PackageSearch },
  { to: "/", label: "Requisition", icon: MessageSquare },
  { to: "/catalog", label: "Catalog", icon: Package },
  { to: "/suppliers", label: "Suppliers", icon: Building2 },
  { to: "/sourcing", label: "Sourcing & PO", icon: ShoppingCart },
  { to: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { to: "/receiving", label: "Receiving", icon: PackageCheck },
  { to: "/invoicing", label: "Invoicing", icon: FileText },
  { to: "/match", label: "3-Way Match", icon: GitCompareArrows },
  { to: "/anomalies", label: "Anomaly Detection", icon: ShieldAlert },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar({
  mobileOpen = false,
  onMobileOpenChange,
}: {
  /** Mobile-only: whether the slide-out drawer is open. Ignored at md+,
   * where the sidebar is always inline and visible regardless. */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const location = useLocation();

  // The desktop <aside> and the mobile drawer both mount navContent — the
  // desktop one stays mounted (just CSS-hidden via `hidden md:flex`) even
  // while the mobile drawer is open, so they can be simultaneously present
  // in the tree. Framer Motion's layoutId is matched globally across all
  // mounted instances, so each render needs a distinct id or the active-tab
  // rail would try to animate between two unrelated sidebars at once.
  function renderNavContent(layoutIdPrefix: string) {
    return (
      <>
        <div className="flex h-12 items-center gap-2 px-4">
          <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-accent text-white">
            <Workflow className="h-3 w-3" strokeWidth={2.25} />
          </div>
          <span className="truncate font-heading text-[13px] font-extrabold tracking-tight text-white">Procure to Pay</span>
        </div>
        <div className="mx-4 h-px bg-white/10" />

        <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => onMobileOpenChange?.(false)}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] font-semibold transition-colors duration-150 ease-out",
                  isActive ? "text-white" : "text-white/60 hover:text-white/90",
                )}
              >
                {/* Active surface + accent rail slide between items as one element */}
                {isActive && (
                  <motion.span
                    layoutId={`${layoutIdPrefix}-nav-active`}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-md bg-white/10"
                  >
                    <span className="absolute left-0 top-1/2 h-[14px] w-[2px] -translate-y-1/2 rounded-r-sm bg-accent" />
                  </motion.span>
                )}
                {!isActive && (
                  <span className="absolute inset-0 rounded-md bg-transparent transition-colors duration-150 ease-out group-hover:bg-white/5" />
                )}
                <Icon
                  className={cn(
                    "relative h-[15px] w-[15px] transition-colors duration-150 ease-out",
                    isActive && "text-accent",
                  )}
                  strokeWidth={1.75}
                />
                <span className="relative">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mx-4 h-px bg-white/10" />
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <span className="text-[11px] leading-tight text-white/60">
              System: <span className="text-white">Autonomous mode active</span>
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <Dialog.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
      {/* Desktop: always-visible inline sidebar, exactly as before md.
          Stays mounted (just CSS-hidden) even while the mobile drawer
          below is open, which is exactly why the two need distinct
          layoutId prefixes — see renderNavContent above. */}
      <aside className="hidden h-full w-[220px] shrink-0 flex-col overflow-hidden rounded-xl bg-[oklch(32%_0.004_90)] shadow-[0_1px_2px_rgba(24,26,33,0.12),0_8px_20px_-8px_rgba(24,26,33,0.28)] md:flex">
        {renderNavContent("desktop")}
      </aside>

      {/* Mobile: slide-out drawer, only ever opened below md (Dialog.Root
          stays controlled from AppShell but the trigger — TopBar's
          hamburger — is itself mobile-only, so this never opens at md+). */}
      <Dialog.Portal>
        <AnimatePresence>
          {mobileOpen && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-40 bg-black/50 md:hidden"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 38 }}
                  className="fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[80vw] flex-col overflow-hidden bg-[oklch(32%_0.004_90)] shadow-[0_8px_30px_rgba(0,0,0,0.4)] md:hidden"
                >
                  <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                  {renderNavContent("mobile")}
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
