import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

/** Guards /manager routes independently of the main app's useAppStore auth
 * state — a manager login is a separate account/session from the
 * procurement-workspace login, so this checks Supabase's session directly
 * rather than assuming the regular app's auth store reflects it. */
export function RequireManager({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "authed" | "anon">("checking");

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStatus(data.session ? "authed" : "anon");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") return null;
  if (status === "anon") return <Navigate to="/manager/login" replace />;
  return <>{children}</>;
}
