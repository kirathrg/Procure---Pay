import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class PurchaseRequisition(Base, UUIDPk, CreatedAtMixin):
    """A warehouse employee's request for goods — distinct from
    RequisitionSession (the procurement-lead chat flow). Sits as "pending"
    until a procurement lead reviews it and approves it into a real PO (see
    routers/purchase_requisitions.py); once that PO completes a full cycle
    (matched/paid), this flips to "resolved" automatically (see
    services/match_trigger.py and routers/purchase_orders.py, the same two
    call sites that already clear User.active_po_id on completion)."""

    __tablename__ = "purchase_requisitions"

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    item: Mapped[str] = mapped_column(String)
    quantity: Mapped[str] = mapped_column(String)
    """Free-text like the chat requisition's quantity slot (e.g. "50") —
    parsed the same way by services/requisition_routing.py on approval."""
    deadline: Mapped[str] = mapped_column(String, default="")
    urgency: Mapped[str] = mapped_column(String, default="normal")  # low | normal | urgent
    notes: Mapped[str] = mapped_column(String, default="")

    status: Mapped[str] = mapped_column(String, default="pending")  # pending | in_progress | resolved
    po_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True
    )

    created_by_user: Mapped["User"] = relationship()
    purchase_order: Mapped["PurchaseOrder"] = relationship()
