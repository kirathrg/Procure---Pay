from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class Supplier(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "suppliers"

    name: Mapped[str] = mapped_column(String)
    contact_name: Mapped[str] = mapped_column(String, default="")
    contact_email: Mapped[str] = mapped_column(String, default="")
    contact_phone: Mapped[str] = mapped_column(String, default="")
    address_line: Mapped[str] = mapped_column(String, default="")
    category: Mapped[str] = mapped_column(String, default="")
    tax_id: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="active")  # active | preferred | blocked

    product_links: Mapped[list["ProductSupplier"]] = relationship(back_populates="supplier")
