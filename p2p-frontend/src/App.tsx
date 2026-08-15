import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { useAppStore } from "./store/useAppStore";
import { LaunchTransition } from "./components/auth/LaunchTransition";
import Login from "./pages/Login";
import Requisition from "./pages/Requisition";
import PurchaseRequisitions from "./pages/PurchaseRequisitions";
import Catalog from "./pages/Catalog";
import Suppliers from "./pages/Suppliers";
import PurchaseOrders from "./pages/PurchaseOrders";
import Sourcing from "./pages/Sourcing";
import Receiving from "./pages/Receiving";
import Invoicing from "./pages/Invoicing";
import MatchApproval from "./pages/MatchApproval";
import Anomalies from "./pages/Anomalies";
import Analytics from "./pages/Analytics";
import DevTools from "./pages/DevTools";
import ManagerLogin from "./pages/manager/ManagerLogin";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import { RequireManager } from "./pages/manager/RequireManager";
import EmployeePR from "./pages/employee/EmployeePR";

/** True only for the genuine first-ever role fetch of a session. A *re*-check
 * (Supabase re-emitting an auth event on tab refocus, a token refresh, a slow
 * /users/me) must never blank an already-rendered app: returning null from a
 * guard unmounts the whole route subtree, which is exactly what was wiping
 * every page's state on tab switch. Once a role is known, keep rendering it
 * and let the refreshed value arrive in place. */
function useBlocksOnRoleCheck() {
  const roleReady = useAppStore((s) => s.roleReady);
  const role = useAppStore((s) => s.user?.role);
  return !roleReady && !role;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const authReady = useAppStore((s) => s.authReady);
  const role = useAppStore((s) => s.user?.role);
  const waitingForRole = useBlocksOnRoleCheck();
  // Wait for Supabase's real session state before trusting a persisted
  // isAuthenticated — otherwise a stale value (e.g. token expired while the
  // tab was closed) could briefly render protected routes before being
  // corrected. A blank frame here is preferable to that flash.
  if (!authReady) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Also wait for the real DB-backed role before deciding whether this is a
  // warehouse employee — the placeholder role from userFromSession() would
  // otherwise let a normal employee flash the procurement dashboard first.
  if (waitingForRole) return null;
  if (role === "Warehouse Employee") return <Navigate to="/employee" replace />;
  return <>{children}</>;
}

function RequireEmployee({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const authReady = useAppStore((s) => s.authReady);
  const role = useAppStore((s) => s.user?.role);
  const waitingForRole = useBlocksOnRoleCheck();
  if (!authReady) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (waitingForRole) return null;
  // A non-employee account landing on /employee falls back to the main app
  // rather than staying on a page meant for a different role.
  if (role !== "Warehouse Employee") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isLaunching = useAppStore((s) => s.isLaunching);
  const authReady = useAppStore((s) => s.authReady);
  const roleReady = useAppStore((s) => s.roleReady);
  const role = useAppStore((s) => s.user?.role);
  if (!authReady) return null;
  // Stay on /login while the launch transition plays, even though auth
  // already succeeded — otherwise the redirect unmounts the page (and the
  // overlay inside it) before the animation ever gets to run.
  if (isAuthenticated && !isLaunching) {
    if (!roleReady) return null;
    return <Navigate to={role === "Warehouse Employee" ? "/employee" : "/"} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const isLaunching = useAppStore((s) => s.isLaunching);
  const finishLaunch = useAppStore((s) => s.finishLaunch);
  const initAuthListener = useAppStore((s) => s.initAuthListener);

  useEffect(() => {
    initAuthListener();
  }, [initAuthListener]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Manager routes are entirely separate from the main app's auth
            (a different Supabase account, its own login page) and are never
            wrapped in AppShell/RequireAuth. */}
        <Route path="/manager/login" element={<ManagerLogin />} />
        <Route
          path="/manager"
          element={
            <RequireManager>
              <ManagerDashboard />
            </RequireManager>
          }
        />

        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        {/* Employee PR page is authenticated but deliberately outside
            AppShell — a warehouse employee only needs the PR form, not the
            full procurement sidebar/navigation. */}
        <Route
          path="/employee"
          element={
            <RequireEmployee>
              <EmployeePR />
            </RequireEmployee>
          }
        />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Requisition />} />
          <Route path="/purchase-requisitions" element={<PurchaseRequisitions />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/sourcing" element={<Sourcing />} />
          <Route path="/receiving" element={<Receiving />} />
          <Route path="/invoicing" element={<Invoicing />} />
          <Route path="/match" element={<MatchApproval />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/dev-tools" element={<DevTools />} />
        </Route>
      </Routes>

      {/* Rendered above the route switch so it survives the /login → / redirect */}
      <LaunchTransition active={isLaunching} onComplete={finishLaunch} />
    </BrowserRouter>
  );
}
