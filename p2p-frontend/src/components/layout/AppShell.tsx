import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PageTransition } from "./PageTransition";

const titles: Record<string, string> = {
  "/": "Requisition",
  "/catalog": "Product Catalog",
  "/suppliers": "Supplier Directory",
  "/purchase-orders": "Purchase Orders",
  "/sourcing": "Sourcing & PO",
  "/receiving": "Receiving",
  "/invoicing": "Invoicing",
  "/match": "3-Way Match & Approval",
  "/anomalies": "Anomaly & Fraud Detection",
  "/analytics": "Analytics",
};

export function AppShell() {
  const location = useLocation();
  const title = titles[location.pathname] ?? "Procure to Pay";
  // Mobile-only: the sidebar is a slide-out drawer below the md breakpoint
  // (see Sidebar.tsx), closed by default and toggled from TopBar's
  // hamburger button. Unused/inert on desktop, where Sidebar always renders
  // inline regardless of this state.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full gap-0 overflow-hidden bg-canvas p-0 text-text md:gap-3 md:p-3">
      <Sidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 md:p-0">
        <TopBar title={title} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(24,26,33,0.05),0_6px_16px_-6px_rgba(24,26,33,0.1)]">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
