import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class Receipt(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "receipts"

    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"))
    scanned_quantity: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | scanning | received
    damage_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    # damage_detected is never set true by real inference — no trained CV model
    # exists for this (see plan section 1); kept only for schema/type compatibility
    # with the frontend's ReceiptRecord.damageDetected field.
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="receipts")
