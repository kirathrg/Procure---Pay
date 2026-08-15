import uuid

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class RequisitionSession(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "requisition_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String, default="active")  # active | confirmed | routed
    # Set once the session routes to a real PurchaseOrder (see
    # services/requisition_routing.py). Stays null if the requisition's item
    # never matched a known product — the session is still "routed", just
    # without a PO, so the chat can say so honestly instead of pretending.
    po_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=True
    )

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "chat_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("requisition_sessions.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String)  # user | assistant
    content: Mapped[str] = mapped_column(String)
    slots: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)

    session: Mapped["RequisitionSession"] = relationship(back_populates="messages")
