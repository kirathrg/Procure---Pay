import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
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

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col overflow-hidden rounded-xl bg-[oklch(32%_0.004_90)] shadow-[0_1px_2px_rgba(24,26,33,0.12),0_8px_20px_-8px_rgba(24,26,33,0.28)]">
      <div className="flex h-12 items-center gap-2 px-4">
        <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-accent text-white">
          <Workflow className="h-3 w-3" strokeWidth={2.25} />
        </div>
        <span className="truncate font-heading text-[13px] font-extrabold tracking-tight text-white">Procure to Pay</span>
      </div>
      <div className="mx-4 h-px bg-white/10" />

      <nav className="relative flex-1 space-y-0.5 px-2 py-3">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] font-semibold transition-colors duration-150 ease-out",
                isActive ? "text-white" : "text-white/60 hover:text-white/90",
              )}
            >
              {/* Active surface + accent rail slide between items as one element */}
              {isActive && (
                <motion.span
                  layoutId="nav-active"
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
    </aside>
  );
}
