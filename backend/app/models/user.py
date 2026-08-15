import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class User(Base, UUIDPk, CreatedAtMixin):
    """Profile row keyed by Supabase auth.users.id (id is NOT auto-generated here —
    it's set to match the Supabase Auth user id on first login)."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)  # overrides UUIDPk default
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="Procurement Lead")

    # The PO this user is currently walking through Requisition -> Sourcing ->
    # Receiving -> Invoicing for. Set when a requisition routes to a new PO;
    # cleared once that PO reaches a terminal status (matched/escalated/paid)
    # so the app naturally falls back to offering the next newest PO instead
    # of pointing at a finished cycle forever. Nullable: a fresh user, or one
    # whose active PO finished, has none.
    active_po_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True
    )
