"""Wraps Razorpay's test-mode order + payment capture for the manager
payment-approval flow. Same "not configured yet" pattern as services/email.py
(Resend) — a missing key is a real, expected state before real test keys are
added, not a bug.
"""

import razorpay

from app.config import get_settings

settings = get_settings()


class RazorpayNotConfiguredError(Exception):
    """Raised when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are unset — expected
    until real test keys are added to backend/.env."""


def _client() -> razorpay.Client:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise RazorpayNotConfiguredError(
            "Payments aren't configured yet — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env "
            "(test mode keys from the Razorpay dashboard)."
        )
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def create_release_order(amount: float, po_number: str) -> dict:
    """Creates a Razorpay order for a manager-approved payment release.
    Amount is in whole currency units (e.g. dollars); Razorpay wants the
    smallest unit (paise/cents), hence the *100. Synchronous SDK — callers on
    the async request path must run this via run_in_threadpool, same pattern
    as the other sync-library calls in this app (see services/email.py)."""
    client = _client()
    return client.order.create(
        {
            "amount": int(round(amount * 100)),
            "currency": "INR",
            "receipt": po_number,
            "payment_capture": 1,
        }
    )


class PaymentVerificationError(Exception):
    """Raised when the checkout callback's signature doesn't verify — the
    payment must not be recorded as released if this fails."""


def verify_and_get_signature_params(order_id: str, payment_id: str, signature: str) -> dict:
    """Verifies the HMAC signature Razorpay Checkout returns after a
    successful test-mode payment. This is the step that actually proves the
    payment happened — never mark a Payment released without it passing."""
    client = _client()
    params = {
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "razorpay_signature": signature,
    }
    try:
        client.utility.verify_payment_signature(params)
    except razorpay.errors.SignatureVerificationError as e:
        raise PaymentVerificationError(str(e)) from e
    return params
