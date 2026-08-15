import uuid

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class Payment(Base, UUIDPk, CreatedAtMixin):
    """One release-payment request per match case, created the moment a
    manager sends a case for approval (not when they actually approve it) so
    the manager dashboard has a real row to list as "pending" — approval
    only fills in the Razorpay fields and flips status."""

    __tablename__ = "payments"

    match_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("match_cases.id", ondelete="CASCADE")
    )
    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | released
    razorpay_order_id: Mapped[str | None] = mapped_column(String, nullable=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String, nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    match_case: Mapped["MatchCase"] = relationship()
    purchase_order: Mapped["PurchaseOrder"] = relationship()
