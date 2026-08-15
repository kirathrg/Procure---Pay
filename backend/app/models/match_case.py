import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class MatchCase(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "match_cases"

    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"))
    outcome: Mapped[str] = mapped_column(String)  # auto-approved | escalated | pending
    reason: Mapped[str] = mapped_column(String, default="")
    routed_to: Mapped[str | None] = mapped_column(String, nullable=True)
    resolved_status: Mapped[str | None] = mapped_column(String, nullable=True)  # released | review | null

    purchase_order: Mapped["PurchaseOrder"] = relationship()
    fields: Mapped[list["MatchField"]] = relationship(back_populates="match_case", cascade="all, delete-orphan")


class MatchField(Base, UUIDPk):
    __tablename__ = "match_fields"

    match_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("match_cases.id", ondelete="CASCADE")
    )
    label: Mapped[str] = mapped_column(String)
    po_value: Mapped[str] = mapped_column(String)
    receipt_value: Mapped[str] = mapped_column(String)
    invoice_value: Mapped[str] = mapped_column(String)
    is_match: Mapped[bool] = mapped_column(Boolean)
    delta_note: Mapped[str | None] = mapped_column(String, nullable=True)

    match_case: Mapped["MatchCase"] = relationship(back_populates="fields")
