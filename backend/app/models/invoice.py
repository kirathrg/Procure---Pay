import uuid

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class Invoice(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "invoices"

    po_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"))
    invoice_number: Mapped[str] = mapped_column(String)
    vendor: Mapped[str] = mapped_column(String)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="invoices")
    fields: Mapped[list["InvoiceField"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceField(Base, UUIDPk):
    __tablename__ = "invoice_fields"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)
    value: Mapped[str] = mapped_column(String)
    confidence: Mapped[float] = mapped_column(Float)

    # Percentage-of-image coordinates (0-100), matching the frontend's
    # InvoiceField.bbox {x,y,w,h} contract directly — converted from
    # OCR.space's pixel-space boxes in OcrService.extract_invoice_fields.
    bbox_x: Mapped[float] = mapped_column(Float)
    bbox_y: Mapped[float] = mapped_column(Float)
    bbox_w: Mapped[float] = mapped_column(Float)
    bbox_h: Mapped[float] = mapped_column(Float)

    invoice: Mapped["Invoice"] = relationship(back_populates="fields")
