import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import Invoice, PurchaseOrder, PurchaseRequisition, Receipt, User
from app.schemas.purchase_order import (
    CandidateSupplierOut,
    CandidateSuppliersOut,
    EmailPoOut,
    PurchaseOrderOut,
    UpdatePOStatus,
    UpdatePOType,
)
from app.services.email import EmailNotConfiguredError, EmailSendError, send_po_email
from app.services.gemini import get_gemini_service
from app.services.po_pdf import render_po_pdf
from app.services.product_matching import find_matching_product
from app.services.sourcing import rank_suppliers_for_product
from app.services.users import get_or_create_user

# Statuses that end active-PO tracking. "escalated" is deliberately excluded —
# it still needs attention (e.g. re-uploading a corrected invoice), so it
# should stay reachable from Receiving/Invoicing rather than falling off as
# if the cycle were done. See the matching exclusion in match_trigger.py.
_TERMINAL_STATUSES = {"matched", "paid"}

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])

# Default spend envelope applied when a PO is switched to an allocation-bearing
# type. The ceiling is a multiple of the current committed total; the term
# length differs by instrument — planned POs cover a delivery schedule, blanket
# POs a rolling spend window, contract POs a full agreement year.
_ALLOCATION_CEILING_MULTIPLE = 4
_ALLOCATION_TERM_DAYS = {"planned": 90, "blanket": 180, "contract": 365}


def _load_options():
    return [selectinload(PurchaseOrder.supplier), selectinload(PurchaseOrder.buyer)]


async def _latest_receipts_and_invoice_flags(
    db: AsyncSession, po_ids: list[uuid.UUID]
) -> tuple[dict[uuid.UUID, Receipt], set[uuid.UUID]]:
    """Batched lookup for PurchaseOrderOut's receiving_status/invoice_status —
    one query per table for the whole list instead of two per PO, so the
    Purchase Orders table doesn't N+1 as the list grows."""
    if not po_ids:
        return {}, set()

    receipts = (
        await db.execute(select(Receipt).where(Receipt.po_id.in_(po_ids)).order_by(Receipt.created_at.desc()))
    ).scalars().all()
    latest_receipt_by_po: dict[uuid.UUID, Receipt] = {}
    for r in receipts:
        latest_receipt_by_po.setdefault(r.po_id, r)  # first hit per po_id is the newest, thanks to the ORDER BY

    invoiced_po_ids = set(
        (await db.execute(select(Invoice.po_id).where(Invoice.po_id.in_(po_ids)).distinct())).scalars().all()
    )
    return latest_receipt_by_po, invoiced_po_ids


@router.get("", response_model=list[PurchaseOrderOut])
async def list_purchase_orders(db: AsyncSession = Depends(get_db)) -> list[PurchaseOrderOut]:
    # created_at, not issued_date — issued_date is day-precision, so multiple
    # POs created the same day (e.g. several test requisitions in one
    # session) would tie and sort arbitrarily, hiding which one is actually
    # newest. created_at always breaks the tie correctly.
    result = await db.execute(
        select(PurchaseOrder).options(*_load_options()).order_by(PurchaseOrder.created_at.desc())
    )
    pos = result.scalars().all()
    latest_receipts, invoiced_ids = await _latest_receipts_and_invoice_flags(db, [po.id for po in pos])
    return [
        PurchaseOrderOut.from_model(po, latest_receipt=latest_receipts.get(po.id), has_invoice=po.id in invoiced_ids)
        for po in pos
    ]


@router.get("/active", response_model=PurchaseOrderOut | None)
async def get_active_purchase_order(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PurchaseOrderOut | None:
    """The PO this user is currently walking through Requisition -> Sourcing
    -> Receiving -> Invoicing for — set when a requisition routes to a new
    PO, cleared once that PO completes a match (see match_trigger.py). Every
    module reads this instead of independently guessing "whichever PO isn't
    done yet", so they all agree on the same PO and each can resume exactly
    where the last one left off. Registered before /{po_id} so "active"
    isn't parsed as a UUID path param."""
    user = await get_or_create_user(db, current_user)
    if user.active_po_id is None:
        return None
    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == user.active_po_id).options(*_load_options())
    )
    po = result.scalar_one_or_none()
    if po is None:
        # The active PO was deleted out from under the pointer — heal rather
        # than 404 the whole app on every page that reads this.
        user.active_po_id = None
        await db.commit()
        return None
    latest_receipts, invoiced_ids = await _latest_receipts_and_invoice_flags(db, [po.id])
    return PurchaseOrderOut.from_model(po, latest_receipt=latest_receipts.get(po.id), has_invoice=po.id in invoiced_ids)


@router.get("/{po_id}", response_model=PurchaseOrderOut)
async def get_purchase_order(po_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> PurchaseOrderOut:
    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(*_load_options())
    )
    po = result.scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    latest_receipts, invoiced_ids = await _latest_receipts_and_invoice_flags(db, [po.id])
    return PurchaseOrderOut.from_model(po, latest_receipt=latest_receipts.get(po.id), has_invoice=po.id in invoiced_ids)


@router.get("/{po_id}/candidate-suppliers", response_model=CandidateSuppliersOut)
async def get_candidate_suppliers(po_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> CandidateSuppliersOut:
    """Ranks the suppliers eligible to fulfill this PO's item by real total
    price (product_suppliers.unit_price * PO.quantity) and phrases why the
    top pick wins via Gemini. There is no Product FK on PurchaseOrder yet, so
    the item is fuzzy-matched to a Product by name (see
    services/product_matching.py) — see CandidateSuppliersOut.unmatched for
    the case where nothing matches."""
    po = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))).scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")

    product = await find_matching_product(db, po.item)
    if product is None:
        return CandidateSuppliersOut(product_id=None, candidates=[], unmatched=True)

    ranked = await rank_suppliers_for_product(db, product, po.quantity)
    if not ranked:
        return CandidateSuppliersOut(product_id=product.id, candidates=[], unmatched=True)

    picked = ranked[0]
    candidate_dicts = [
        {
            "supplier_id": c.supplier_id,
            "name": c.name,
            "total_price": c.total_price,
            "lead_time_days": c.lead_time_days,
            "on_time_rate": c.on_time_rate,
        }
        for c in ranked
    ]
    picked_dict = candidate_dicts[0]
    # Deterministic ranking already picked the winner (rank_suppliers_for_product
    # sorts cheapest-first) — Gemini only phrases why, never chooses.
    explain = await get_gemini_service().generate_supplier_pick_reason(po.item, picked_dict, candidate_dicts)

    return CandidateSuppliersOut(
        product_id=product.id,
        candidates=[
            CandidateSupplierOut(
                supplier_id=c.supplier_id,
                name=c.name,
                unit_price=c.unit_price,
                total_price=c.total_price,
                lead_time_days=c.lead_time_days,
                preferred=c.preferred,
                on_time_rate=c.on_time_rate,
                order_count=c.order_count,
                selected=(c.supplier_id == picked.supplier_id),
                explain=explain if c.supplier_id == picked.supplier_id else None,
            )
            for c in ranked
        ],
    )


@router.get("/{po_id}/pdf")
async def download_po_pdf(po_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Response:
    po = (
        await db.execute(
            select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(*_load_options())
        )
    ).scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")

    # reportlab's PDF building is synchronous/CPU-bound — off the event loop
    # for the same reason as the OCR/upload calls elsewhere in this app.
    pdf_bytes = await run_in_threadpool(render_po_pdf, po)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{po.po_number}.pdf"'},
    )


@router.post("/{po_id}/email", response_model=EmailPoOut)
async def email_po_to_supplier(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> EmailPoOut:
    po = (
        await db.execute(
            select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(*_load_options())
        )
    ).scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")

    try:
        # send_po_email uses the synchronous Resend SDK (no async client
        # exists) and reportlab internally — same run_in_threadpool pattern
        # as every other blocking-library call in this app.
        message_id, sent_to = await run_in_threadpool(send_po_email, po)
    except EmailNotConfiguredError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    except EmailSendError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e

    return EmailPoOut(sent_to=sent_to, message_id=message_id)


@router.patch("/{po_id}/type", response_model=PurchaseOrderOut)
async def update_po_type(
    po_id: uuid.UUID,
    payload: UpdatePOType,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> PurchaseOrderOut:
    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(*_load_options())
    )
    po = result.scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")

    po.po_type = payload.po_type
    if payload.po_type == "standard":
        # Standard POs carry no spend envelope, so clear any allocation left
        # over from a previous type.
        po.bucket_ceiling = None
        po.bucket_released = None
        po.bucket_valid_from = None
        po.bucket_valid_to = None
    else:
        # Planned / blanket / contract all carry a ceiling + validity window.
        # Server-side default, mirroring the frontend store's prior client-side
        # logic (moved here per the plan): a sensible starting allocation so
        # the UI always has something to render immediately after the switch.
        if po.bucket_ceiling is None:
            po.bucket_ceiling = float(po.total) * _ALLOCATION_CEILING_MULTIPLE
            po.bucket_released = float(po.total)
        # The term length is a property of the type, not of the allocation, so
        # it is re-derived on every switch — otherwise moving planned -> contract
        # would silently keep the 90-day planned window.
        po.bucket_valid_from = po.issued_date
        po.bucket_valid_to = po.issued_date + timedelta(days=_ALLOCATION_TERM_DAYS[payload.po_type])

    await db.commit()
    await db.refresh(po, attribute_names=["supplier", "buyer"])
    latest_receipts, invoiced_ids = await _latest_receipts_and_invoice_flags(db, [po.id])
    return PurchaseOrderOut.from_model(po, latest_receipt=latest_receipts.get(po.id), has_invoice=po.id in invoiced_ids)


@router.patch("/{po_id}/status", response_model=PurchaseOrderOut)
async def update_po_status(
    po_id: uuid.UUID,
    payload: UpdatePOStatus,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> PurchaseOrderOut:
    result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(*_load_options())
    )
    po = result.scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")

    po.status = payload.status

    # Same "cycle completed" clearing as the automatic match trigger — a
    # manual status override into a terminal state should retire this PO
    # from "active" tracking too, not just the auto-match path.
    if payload.status in _TERMINAL_STATUSES and po.created_by is not None:
        creator = await db.get(User, po.created_by)
        if creator is not None and creator.active_po_id == po.id:
            creator.active_po_id = None

    if payload.status in _TERMINAL_STATUSES:
        pr = (
            await db.execute(select(PurchaseRequisition).where(PurchaseRequisition.po_id == po.id))
        ).scalar_one_or_none()
        if pr is not None:
            pr.status = "resolved"

    await db.commit()
    await db.refresh(po, attribute_names=["supplier", "buyer"])
    latest_receipts, invoiced_ids = await _latest_receipts_and_invoice_flags(db, [po.id])
    return PurchaseOrderOut.from_model(po, latest_receipt=latest_receipts.get(po.id), has_invoice=po.id in invoiced_ids)
