import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import Invoice, MatchCase, Payment, PurchaseOrder, Receipt
from app.schemas.match import MatchCaseOut, ResolveMatchIn, ResolveMatchOut
from app.services.match_trigger import maybe_run_match

router = APIRouter(tags=["matching"])


def _case_load_options():
    return [
        selectinload(MatchCase.fields),
        selectinload(MatchCase.purchase_order).selectinload(PurchaseOrder.supplier),
    ]


@router.get("/match-cases", response_model=list[MatchCaseOut])
async def list_match_cases(db: AsyncSession = Depends(get_db)) -> list[MatchCaseOut]:
    result = await db.execute(
        select(MatchCase).options(*_case_load_options()).order_by(MatchCase.created_at.desc())
    )
    return [MatchCaseOut.from_model(c) for c in result.scalars().all()]


@router.get("/match-cases/{case_id}", response_model=MatchCaseOut)
async def get_match_case(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> MatchCaseOut:
    result = await db.execute(
        select(MatchCase).where(MatchCase.id == case_id).options(*_case_load_options())
    )
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match case not found")
    return MatchCaseOut.from_model(case)


@router.post("/purchase-orders/{po_id}/match", response_model=MatchCaseOut, status_code=status.HTTP_201_CREATED)
async def run_match(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> MatchCaseOut:
    """Manual re-run of the 3-way match — the normal path is automatic (see
    services/match_trigger.py, called right after a receipt/invoice upload
    once both exist); this endpoint exists for re-matching after resolving a
    discrepancy and re-uploading a corrected document. Requires both a
    receipt and an invoice — comparing against a missing document would
    treat every one of its fields as trivially matching, which produces a
    false auto-approved outcome rather than a real incomplete state."""
    po = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))).scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")

    has_receipt = (
        await db.execute(select(Receipt.id).where(Receipt.po_id == po_id).limit(1))
    ).scalar_one_or_none() is not None
    has_invoice = (
        await db.execute(select(Invoice.id).where(Invoice.po_id == po_id).limit(1))
    ).scalar_one_or_none() is not None
    if not has_receipt or not has_invoice:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This PO needs both a receipt and an invoice before it can be matched.",
        )

    before_count = (
        await db.execute(select(MatchCase.id).where(MatchCase.po_id == po_id).order_by(MatchCase.created_at.desc()).limit(1))
    ).scalar_one_or_none()

    await maybe_run_match(db, po_id)
    await db.commit()

    result = await db.execute(
        select(MatchCase)
        .where(MatchCase.po_id == po_id)
        .options(*_case_load_options())
        .order_by(MatchCase.created_at.desc())
        .limit(1)
    )
    case = result.scalar_one_or_none()
    if case is None or case.id == before_count:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Match did not run as expected")
    return MatchCaseOut.from_model(case)


@router.post("/match-cases/{case_id}/resolve", response_model=ResolveMatchOut)
async def resolve_match(
    case_id: uuid.UUID,
    payload: ResolveMatchIn,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> ResolveMatchOut:
    """Both an auto-approved "Release payment" and an escalated "Confirm
    routing" now land in the same place: a pending Payment row a manager has
    to actually approve, rather than instantly marking the PO paid. This is
    intentional for the escalated case too — routing to AP doesn't itself
    release money, a human approval does."""
    case = (
        await db.execute(
            select(MatchCase).where(MatchCase.id == case_id).options(selectinload(MatchCase.purchase_order))
        )
    ).scalar_one_or_none()
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match case not found")
    if case.resolved_status is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This match case was already sent for approval.")

    case.resolved_status = "pending_approval"
    db.add(
        Payment(
            match_case_id=case.id,
            po_id=case.po_id,
            amount=case.purchase_order.total,
            status="pending",
        )
    )

    await db.commit()
    return ResolveMatchOut(resolved_status="pending_approval")
