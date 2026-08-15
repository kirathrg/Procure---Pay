import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowRight, Workflow } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { cn } from "../lib/cn";

type Mode = "signin" | "signup";

export default function Login() {
  const { login, signup } = useAppStore();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) return;
    if (mode === "signup" && !name.trim()) return;

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signup(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_CONFIRMATION_REQUIRED") {
        setError("Check your inbox to confirm your email before signing in.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      {/* Left — brand panel */}
      <div className="relative hidden w-[42%] shrink-0 flex-col overflow-hidden border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center gap-2 px-8 pt-6">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-white">
            <Workflow className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <span className="font-heading text-[14px] font-bold tracking-tight text-text">Procure to Pay</span>
        </div>

        <div className="flex flex-1 flex-col items-start justify-center px-8">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-sm font-heading text-[26px] font-medium leading-tight tracking-tight text-text"
          >
            Requisition to payment, without the paperwork.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 max-w-sm text-[14px] leading-relaxed text-text-faint"
          >
            Describe what you need in plain language — sourcing, matching, and
            approval happen on their own.
          </motion.p>
        </div>

        <div className="flex items-center gap-2 px-8 pb-6">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          <span className="text-[11px] text-text-faint">System: Autonomous mode active</span>
        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-[340px]">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-white">
              <Workflow className="h-3.5 w-3.5" strokeWidth={2.25} />
            </div>
            <span className="font-heading text-[14px] font-bold tracking-tight text-text">Procure to Pay</span>
          </div>

          <h1 className="font-heading text-[20px] font-medium tracking-tight text-text">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-[13px] text-text-faint">
            {mode === "signin"
              ? "Sign in to continue to your workspace."
              : "Set up your workspace in under a minute."}
          </p>

          <div className="mt-6 flex rounded-md border border-border bg-overlay/[0.03] p-0.5">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="relative flex-1 rounded-[5px] py-1.5 text-[12.5px] font-medium transition-colors duration-150 ease-out"
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-mode"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-[5px] border border-border-strong bg-surface"
                  />
                )}
                <span className={cn("relative", mode === m ? "text-text" : "text-text-faint")}>
                  {m === "signin" ? "Sign in" : "Sign up"}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {mode === "signup" && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <label className="mb-1.5 block text-[12px] text-text-faint">Full name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Ramanathan"
                    className="w-full rounded-md border border-border bg-overlay/[0.03] px-3 py-2 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="mb-1.5 block text-[12px] text-text-faint">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
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
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              {!submitting && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          </form>

          <p className="mt-5 text-center text-[12px] text-text-faint">
            {mode === "signin" ? "Don't have a workspace? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-text-dim underline decoration-border underline-offset-2 transition-colors duration-150 ease-out hover:text-accent"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
