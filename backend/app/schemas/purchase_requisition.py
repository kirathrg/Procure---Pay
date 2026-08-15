import uuid
from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel


class PurchaseRequisitionOut(CamelModel):
    id: uuid.UUID
    created_by_name: str
    item: str
    quantity: str
    deadline: str
    urgency: Literal["low", "normal", "urgent"]
    notes: str
    status: Literal["pending", "in_progress", "resolved"]
    po_id: uuid.UUID | None = None
    po_number: str | None = None
    created_at: datetime

    @classmethod
    def from_model(cls, pr) -> "PurchaseRequisitionOut":
        return cls(
            id=pr.id,
            created_by_name=pr.created_by_user.name,
            item=pr.item,
            quantity=pr.quantity,
            deadline=pr.deadline,
            urgency=pr.urgency,
            notes=pr.notes,
            status=pr.status,
            po_id=pr.po_id,
            po_number=pr.purchase_order.po_number if pr.purchase_order is not None else None,
            created_at=pr.created_at,
        )


class CreatePurchaseRequisitionIn(CamelModel):
    item: str
    quantity: str
    deadline: str = ""
    urgency: Literal["low", "normal", "urgent"] = "normal"
    notes: str = ""


class ApprovePurchaseRequisitionOut(CamelModel):
    purchase_requisition: PurchaseRequisitionOut
    po_number: str | None = None
    routing_failure_reason: str | None = None
