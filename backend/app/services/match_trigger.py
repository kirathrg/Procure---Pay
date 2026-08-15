"""Runs the 3-way match the moment a PO has both a receipt and an invoice —
called from receiving.py and invoicing.py right after each upload commits,
so a match case is never left missing simply because nothing happened to
call POST /purchase-orders/{id}/match (that endpoint remains for manual
re-runs, e.g. after resolving a discrepancy and re-scanning).

Deliberately requires BOTH documents, not "whenever either lands": the
comparison logic in services/matching.py treats a missing document's fields
as having nothing to compare against, which resolves to a false
"auto-approved" match if run with only one side present.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Invoice, MatchCase, MatchField, PurchaseOrder, PurchaseRequisition, Receipt, User
from app.services.gemini import get_gemini_service
from app.services.matching import compare_po_receipt_invoice, determine_outcome


async def maybe_run_match(db: AsyncSession, po_id) -> None:
    receipt = (
        await db.execute(
            select(Receipt).where(Receipt.po_id == po_id).order_by(Receipt.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if receipt is None:
        return

    invoice = (
        await db.execute(
            select(Invoice)
            .where(Invoice.po_id == po_id)
            .options(selectinload(Invoice.fields))
            .order_by(Invoice.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if invoice is None:
        return

    po = (
        await db.execute(
            select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(selectinload(PurchaseOrder.supplier))
        )
    ).scalar_one()

    comparisons = compare_po_receipt_invoice(po, receipt, invoice)
    outcome = determine_outcome(comparisons)

    gemini = get_gemini_service()
    mismatches = [
        {"label": c.label, "delta_note": c.delta_note} for c in comparisons if not c.is_match and c.delta_note
    ]
    narrative = await gemini.generate_match_reason(
        po_number=po.po_number, mismatches=mismatches, auto_approved=(outcome == "auto-approved")
    )

    case = MatchCase(
        po_id=po.id,
        outcome=outcome,
        reason=narrative["reason"],
        routed_to=narrative.get("routed_to") if outcome == "escalated" else None,
    )
    db.add(case)
    await db.flush()

    for c in comparisons:
        db.add(
            MatchField(
                match_case_id=case.id,
                label=c.label,
                po_value=c.po_value,
                receipt_value=c.receipt_value,
                invoice_value=c.invoice_value,
                is_match=c.is_match,
                delta_note=c.delta_note,
            )
        )

    po.status = "matched" if outcome == "auto-approved" else "escalated"

    # Only a clean auto-approved match is actually a completed cycle. An
    # escalated PO still needs attention (e.g. re-uploading a corrected
    # invoice), so it stays "active" rather than falling off Receiving/
    # Invoicing — otherwise those pages have no way back to it short of the
    # Purchase Orders table. Scoped to the user who created it, and only if
    # they haven't already moved on to tracking a different PO meanwhile.
    if outcome == "auto-approved" and po.created_by is not None:
        creator = await db.get(User, po.created_by)
        if creator is not None and creator.active_po_id == po.id:
            creator.active_po_id = None

    # A PR that was approved into this PO is done once the PO's cycle
    # actually completes cleanly — same "auto-approved only" bar as clearing
    # active_po_id above, not on escalation (still needs review/correction).
    if outcome == "auto-approved":
        pr = (
            await db.execute(select(PurchaseRequisition).where(PurchaseRequisition.po_id == po.id))
        ).scalar_one_or_none()
        if pr is not None:
            pr.status = "resolved"
