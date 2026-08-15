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

  return (
    <div className="flex h-screen w-full gap-3 overflow-hidden bg-canvas p-3 text-text">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <TopBar title={title} />
        <main className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(24,26,33,0.05),0_6px_16px_-6px_rgba(24,26,33,0.1)]">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
