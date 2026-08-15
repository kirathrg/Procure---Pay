import uuid
from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel


class PaymentOut(CamelModel):
    id: uuid.UUID
    po_id: uuid.UUID
    po_number: str
    vendor: str
    match_outcome: Literal["auto-approved", "escalated", "pending"]
    amount: float
    status: Literal["pending", "released"]
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    created_at: datetime

    @classmethod
    def from_model(cls, payment) -> "PaymentOut":
        return cls(
            id=payment.id,
            po_id=payment.po_id,
            po_number=payment.purchase_order.po_number,
            vendor=payment.purchase_order.supplier.name,
            match_outcome=payment.match_case.outcome,
            amount=float(payment.amount),
            status=payment.status,
            razorpay_order_id=payment.razorpay_order_id,
            razorpay_payment_id=payment.razorpay_payment_id,
            created_at=payment.created_at,
        )


class CreateOrderOut(CamelModel):
    """What the frontend needs to open Razorpay Checkout."""

    razorpay_order_id: str
    amount: int  # smallest currency unit (paise), as Razorpay Checkout expects
    currency: str
    key_id: str


class CapturePaymentIn(CamelModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
