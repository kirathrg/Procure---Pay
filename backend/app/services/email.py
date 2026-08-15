"""Sends the PO PDF to the supplier's contact email via Resend. Separate
from po_pdf.py (which only renders bytes) so the PDF builder stays reusable
for the plain download endpoint without pulling in email concerns.
"""

import resend

from app.config import get_settings
from app.models import PurchaseOrder
from app.services.po_pdf import render_po_pdf

settings = get_settings()


class EmailNotConfiguredError(Exception):
    """Raised when RESEND_API_KEY is unset — a real, expected state before
    the user has added their Resend key, not a bug."""


class EmailSendError(Exception):
    """Raised when Resend accepted our request shape but rejected the send
    itself (e.g. sandbox sender restricted to the account's own address)."""


def send_po_email(po: PurchaseOrder) -> tuple[str, str]:
    """Emails the PO as a PDF attachment to the supplier's contact email (or,
    while RESEND_TEST_REDIRECT_EMAIL is set, to that address instead — see
    its docstring in config.py for why). Returns (message_id, sent_to).
    Synchronous (the resend SDK has no async client) — callers on the async
    request path must run this via run_in_threadpool, same pattern as the
    other sync-library calls in this app (see routers/invoicing.py,
    routers/receiving.py)."""
    if not settings.resend_api_key:
        raise EmailNotConfiguredError(
            "Email sending isn't configured yet — add RESEND_API_KEY to backend/.env."
        )
    if not po.supplier.contact_email:
        raise EmailSendError(f"{po.supplier.name} has no contact email on file.")

    resend.api_key = settings.resend_api_key
    pdf_bytes = render_po_pdf(po)

    redirect = settings.resend_test_redirect_email
    recipient = redirect or po.supplier.contact_email
    redirect_note = (
        f"<p style=\"color:#888;font-size:12px\">(Test mode: redirected from "
        f"{po.supplier.contact_email} to this address.)</p>"
        if redirect
        else ""
    )

    try:
        result = resend.Emails.send(
            {
                "from": settings.resend_from_email,
                "to": recipient,
                "subject": f"Purchase Order {po.po_number}",
                "html": (
                    f"<p>Hi {po.supplier.contact_name or po.supplier.name},</p>"
                    f"<p>Please find attached Purchase Order <strong>{po.po_number}</strong> "
                    f"for {po.quantity} × {po.item}, total ${float(po.total):,.2f}.</p>"
                    f"<p>— {po.buyer.name}, {po.buyer.department}</p>"
                    f"{redirect_note}"
                ),
                "attachments": [
                    {
                        "filename": f"{po.po_number}.pdf",
                        "content": list(pdf_bytes),
                    }
                ],
            }
        )
    except Exception as e:  # resend raises its own HTTP error types on rejection
        raise EmailSendError(str(e)) from e

    return result["id"], recipient
