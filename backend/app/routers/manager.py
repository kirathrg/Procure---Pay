import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import MatchCase, Payment, PurchaseOrder, PurchaseRequisition, User
from app.schemas.payment import CapturePaymentIn, CreateOrderOut, PaymentOut
from app.services.razorpay_service import (
    PaymentVerificationError,
    RazorpayNotConfiguredError,
    create_release_order,
    verify_and_get_signature_params,
)

router = APIRouter(prefix="/manager", tags=["manager"])
settings = get_settings()


async def require_manager(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> User:
    """Every /manager/* route requires the authenticated Supabase user to be
    a real row in `users` with role="Manager" — a regular procurement-lead
    login must never see this dashboard, even with a valid JWT."""
    user = await db.get(User, current_user.id)
    if user is None or user.role != "Manager":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Manager access only")
    return user


def _load_options():
    return [
        selectinload(Payment.purchase_order).selectinload(PurchaseOrder.supplier),
        selectinload(Payment.match_case),
    ]


@router.get("/payments", response_model=list[PaymentOut])
async def list_payments(
    db: AsyncSession = Depends(get_db),
    _manager: User = Depends(require_manager),
) -> list[PaymentOut]:
    """All payments, pending and released — the dashboard splits them into
    the two sections client-side by `status`."""
    result = await db.execute(select(Payment).options(*_load_options()).order_by(Payment.created_at.desc()))
    return [PaymentOut.from_model(p) for p in result.scalars().all()]


@router.post("/payments/{payment_id}/create-order", response_model=CreateOrderOut)
async def create_order(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _manager: User = Depends(require_manager),
) -> CreateOrderOut:
    """Step 1 of approval: create the Razorpay order server-side (needs the
    secret key) so the frontend can open Checkout against it. Approving
    doesn't release money by itself — only a verified callback from Checkout
    (see /capture) does."""
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    if payment.status == "released":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This payment was already released.")

    po = await db.get(PurchaseOrder, payment.po_id)
    try:
        order = await run_in_threadpool(create_release_order, float(payment.amount), po.po_number if po else "PO")
    except RazorpayNotConfiguredError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e

    payment.razorpay_order_id = order["id"]
    await db.commit()

    return CreateOrderOut(
        razorpay_order_id=order["id"],
        amount=order["amount"],
        currency=order["currency"],
        key_id=settings.razorpay_key_id,
    )


@router.post("/payments/{payment_id}/capture", response_model=PaymentOut)
async def capture_payment(
    payment_id: uuid.UUID,
    payload: CapturePaymentIn,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager),
) -> PaymentOut:
    """Step 2: called by the frontend once Razorpay Checkout's callback
    returns a payment id + signature. Verifying the signature is what
    actually proves the test payment succeeded — nothing is marked released
    without it passing."""
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id).options(*_load_options())
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    if payment.status == "released":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This payment was already released.")
    if payment.razorpay_order_id != payload.razorpay_order_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Order id doesn't match this payment.")

    try:
        await run_in_threadpool(
            verify_and_get_signature_params,
            payload.razorpay_order_id,
            payload.razorpay_payment_id,
            payload.razorpay_signature,
        )
    except PaymentVerificationError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Payment could not be verified: {e}") from e

    payment.status = "released"
    payment.razorpay_payment_id = payload.razorpay_payment_id
    payment.approved_by = manager.id

    match_case = await db.get(MatchCase, payment.match_case_id)
    if match_case is not None:
        match_case.resolved_status = "released"

    po = await db.get(PurchaseOrder, payment.po_id)
    if po is not None:
        po.status = "paid"

    pr = (
        await db.execute(select(PurchaseRequisition).where(PurchaseRequisition.po_id == payment.po_id))
    ).scalar_one_or_none()
    if pr is not None:
        pr.status = "resolved"

    await db.commit()
    await db.refresh(payment, attribute_names=["purchase_order", "match_case"])
    return PaymentOut.from_model(payment)
