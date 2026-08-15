import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class PurchaseOrder(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "purchase_orders"

    po_number: Mapped[str] = mapped_column(String, unique=True, index=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("suppliers.id"))
    buyer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("buyers.id"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    item: Mapped[str] = mapped_column(String)
    quantity: Mapped[int]
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    total: Mapped[float] = mapped_column(Numeric(12, 2))
    issued_date: Mapped[date] = mapped_column(Date)

    status: Mapped[str] = mapped_column(String, default="pending")
    # pending | scanning | received | matched | escalated | paid

    # standard | planned | blanket | contract. The bucket_* columns hold the
    # shared ceiling/validity allocation carried by the latter three; the column
    # names predate the rename and stay as-is to avoid a no-op migration.
    po_type: Mapped[str] = mapped_column(String, default="standard")
    bucket_ceiling: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    bucket_released: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    bucket_valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    bucket_valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    supplier: Mapped["Supplier"] = relationship()
    buyer: Mapped["Buyer"] = relationship()
    receipts: Mapped[list["Receipt"]] = relationship(back_populates="purchase_order")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="purchase_order")
