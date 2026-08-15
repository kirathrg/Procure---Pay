import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3, LogOut, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useManagerPayments, useCreatePaymentOrder, useCapturePayment } from "../../hooks/useManager";
import { loadRazorpayScript } from "../../lib/razorpay";
import { Badge } from "../../components/ui/Badge";
import type { Payment } from "../../types";

function PaymentRow({ payment }: { payment: Payment }) {
  const createOrder = useCreatePaymentOrder();
  const capturePayment = useCapturePayment();
  const [error, setError] = useState<string | null>(null);
  const isMismatch = payment.matchOutcome === "escalated";
  const busy = createOrder.isPending || capturePayment.isPending;

  async function handleApprove() {
    setError(null);
    try {
      const order = await createOrder.mutateAsync(payment.id);
      await loadRazorpayScript();

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Procure to Pay",
        description: `Release payment for ${payment.poNumber}`,
        theme: { color: "#8a6d1f" },
        handler: (response) => {
          capturePayment.mutate({
            paymentId: payment.id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
      });
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the payment. Try again.");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-tabular text-[13px] font-medium text-text">{payment.poNumber}</span>
            <Badge tone={isMismatch ? "warning" : "success"}>
              {isMismatch ? "Mismatch — needs review" : "Auto-matched"}
            </Badge>
          </div>
          <p className="mt-0.5 text-[12px] text-text-faint">{payment.vendor}</p>
        </div>
        <div className="text-right">
          <p className="font-tabular text-[15px] font-medium text-text">${payment.amount.toLocaleString()}</p>
        </div>
      </div>

      {isMismatch && (
        <div className="mt-3 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-dim px-2.5 py-2 text-[12px] text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          This PO was escalated by 3-way match — field mismatch between PO, receipt, and invoice. Review before
          approving.
        </div>
      )}

      {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}

      <div className="mt-3">
        <button
          onClick={handleApprove}
          disabled={busy}
          className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors duration-150 ease-out enabled:hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Processing…" : "Approve & pay (Razorpay test)"}
        </button>
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { data: payments = [], isLoading } = useManagerPayments();

  const pending = payments.filter((p) => p.status === "pending");
  const released = payments.filter((p) => p.status === "released");

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/manager/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-white">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <span className="font-heading text-[14px] font-bold tracking-tight text-text">Manager Approvals</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-dim transition-colors duration-150 ease-out hover:border-border-strong hover:text-text"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          Sign out
        </button>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {isLoading ? (
          <p className="text-[13px] text-text-faint">Loading…</p>
        ) : (
          <>
            <section>
              <h2 className="font-heading text-[15px] font-medium tracking-tight text-text">
                Pending approval
                {pending.length > 0 && (
                  <span className="ml-2 font-tabular text-[12px] font-normal text-text-faint">{pending.length}</span>
                )}
              </h2>
              <div className="mt-3 space-y-3">
                <AnimatePresence>
                  {pending.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <PaymentRow payment={p} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {pending.length === 0 && (
                  <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-[13px] text-text-faint">
                    No payments awaiting approval.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-10">
              <h2 className="font-heading text-[15px] font-medium tracking-tight text-text">Released payments</h2>
              <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] text-text-faint">
                      <th className="px-4 py-2.5 font-normal">PO Number</th>
                      <th className="px-4 py-2.5 font-normal">Vendor</th>
                      <th className="px-4 py-2.5 text-right font-normal">Amount</th>
                      <th className="px-4 py-2.5 font-normal">Razorpay payment ID</th>
                      <th className="px-4 py-2.5 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {released.map((p) => (
                      <tr key={p.id} className="text-[13px]">
                        <td className="px-4 py-2.5 font-tabular text-text">{p.poNumber}</td>
                        <td className="px-4 py-2.5 text-text-dim">{p.vendor}</td>
                        <td className="px-4 py-2.5 text-right font-tabular text-text">
                          ${p.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-tabular text-[12px] text-text-dim">
                          {p.razorpayPaymentId ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                            Released
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {released.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-text-faint">
                          <Clock3 className="mx-auto mb-1.5 h-4 w-4 text-text-faint" strokeWidth={1.5} />
                          No payments released yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
