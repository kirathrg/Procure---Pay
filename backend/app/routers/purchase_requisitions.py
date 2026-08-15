import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import PurchaseRequisition, User
from app.schemas.purchase_requisition import (
    ApprovePurchaseRequisitionOut,
    CreatePurchaseRequisitionIn,
    PurchaseRequisitionOut,
)
from app.services.requisition_routing import route_requisition_to_po
from app.services.users import get_or_create_user

router = APIRouter(prefix="/purchase-requisitions", tags=["purchase-requisitions"])


def _load_options():
    return [selectinload(PurchaseRequisition.created_by_user), selectinload(PurchaseRequisition.purchase_order)]


@router.get("", response_model=list[PurchaseRequisitionOut])
async def list_purchase_requisitions(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[PurchaseRequisitionOut]:
    """Warehouse employees see only their own PRs; everyone else (procurement
    leads, the default role) sees all of them — this is what powers the main
    dashboard's PR section."""
    user = await get_or_create_user(db, current_user)
    query = select(PurchaseRequisition).options(*_load_options()).order_by(PurchaseRequisition.created_at.desc())
    if user.role == "Warehouse Employee":
        query = query.where(PurchaseRequisition.created_by == user.id)
    result = await db.execute(query)
    return [PurchaseRequisitionOut.from_model(pr) for pr in result.scalars().all()]


@router.post("", response_model=PurchaseRequisitionOut, status_code=status.HTTP_201_CREATED)
async def create_purchase_requisition(
    payload: CreatePurchaseRequisitionIn,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PurchaseRequisitionOut:
    user = await get_or_create_user(db, current_user)
    pr = PurchaseRequisition(
        created_by=user.id,
        item=payload.item.strip(),
        quantity=payload.quantity.strip(),
        deadline=payload.deadline.strip(),
        urgency=payload.urgency,
        notes=payload.notes.strip(),
    )
    db.add(pr)
    await db.commit()

    result = await db.execute(
        select(PurchaseRequisition).where(PurchaseRequisition.id == pr.id).options(*_load_options())
    )
    return PurchaseRequisitionOut.from_model(result.scalar_one())


@router.post("/{pr_id}/approve", response_model=ApprovePurchaseRequisitionOut)
async def approve_purchase_requisition(
    pr_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApprovePurchaseRequisitionOut:
    """A procurement lead turns a pending PR into a real PO — same matching/
    ranking logic the requisition chat uses (see services/requisition_routing.py),
    just triggered from a PR instead of a confirmed chat session. The PR
    stays "in_progress" (not yet "resolved") until its PO completes a full
    cycle — see services/match_trigger.py and routers/purchase_orders.py."""
    approving_user = await get_or_create_user(db, current_user)
    if approving_user.role == "Warehouse Employee":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a procurement lead can approve a PR into a PO.")

    result = await db.execute(
        select(PurchaseRequisition).where(PurchaseRequisition.id == pr_id).options(*_load_options())
    )
    pr = result.scalar_one_or_none()
    if pr is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase requisition not found")
    if pr.status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This PR has already been actioned.")

    requester = await db.get(User, pr.created_by)
    slots = {"item": pr.item, "quantity": pr.quantity, "deadline": pr.deadline, "urgency": pr.urgency}
    # PO is created and attributed to whoever originally requested it, not the
    # approving procurement lead — keeps "created_by"/active-PO tracking
    # consistent with what the requester would see across the app.
    routing_result = await route_requisition_to_po(db, None, slots, requester or approving_user)

    routing_failure_reason: str | None = None
    po_number: str | None = None
    if routing_result.purchase_order is not None:
        pr.status = "in_progress"
        pr.po_id = routing_result.purchase_order.id
        po_number = routing_result.purchase_order.po_number
        if requester is not None:
            requester.active_po_id = routing_result.purchase_order.id
    else:
        routing_failure_reason = routing_result.failure_reason

    await db.commit()

    result = await db.execute(
        select(PurchaseRequisition).where(PurchaseRequisition.id == pr.id).options(*_load_options())
    )
    return ApprovePurchaseRequisitionOut(
        purchase_requisition=PurchaseRequisitionOut.from_model(result.scalar_one()),
        po_number=po_number,
        routing_failure_reason=routing_failure_reason,
    )
