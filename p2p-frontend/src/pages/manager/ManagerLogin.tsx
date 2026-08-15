import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { api, ApiError } from "../../lib/api";

export default function ManagerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) return;

    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      // Confirm this account actually has manager access before landing on
      // the dashboard — role is enforced server-side on every /manager/*
      // call regardless, but checking here avoids a confusing flash of an
      // empty/forbidden dashboard for a valid employee login.
      try {
        await api.get("/manager/payments");
      } catch (err) {
        await supabase.auth.signOut();
        if (err instanceof ApiError && err.status === 403) {
          throw new Error("This account doesn't have manager access.");
        }
        throw err;
      }

      navigate("/manager", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[340px]">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-white">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <span className="font-heading text-[14px] font-bold tracking-tight text-text">Manager Approvals</span>
        </div>

        <h1 className="font-heading text-[20px] font-medium tracking-tight text-text">Manager sign in</h1>
        <p className="mt-1.5 text-[13px] text-text-faint">
          Review and approve payment releases. Separate access from the procurement workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
          <div>
            <label className="mb-1.5 block text-[12px] text-text-faint">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@company.com"
              autoFocus
              className="w-full rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] text-text-faint">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
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

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(24,26,33,0.2)] transition-all duration-150 ease-out hover:bg-primary-hover hover:shadow-[0_2px_8px_-2px_rgba(24,26,33,0.35)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
            {!submitting && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
          </button>
        </form>
      </div>
    </div>
  );
}
