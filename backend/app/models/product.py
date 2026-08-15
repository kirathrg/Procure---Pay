import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class Product(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "products"

    sku: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    uom: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String, default="")
    reference_price: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String, default="active")  # active | discontinued

    supplier_links: Mapped[list["ProductSupplier"]] = relationship(back_populates="product")


class ProductSupplier(Base):
    """Join table: which suppliers can fulfill which products, and at what terms."""

    __tablename__ = "product_suppliers"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), primary_key=True
    )
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    lead_time_days: Mapped[int]
    preferred: Mapped[bool] = mapped_column(Boolean, default=False)

    product: Mapped["Product"] = relationship(back_populates="supplier_links")
    supplier: Mapped["Supplier"] = relationship(back_populates="product_links")
