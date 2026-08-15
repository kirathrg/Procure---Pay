import uuid
from typing import Literal

from app.schemas.common import CamelModel


class RequisitionSlotOut(CamelModel):
    key: Literal["item", "quantity", "deadline", "urgency", "priority"]
    label: str
    value: str


class ChatMessageOut(CamelModel):
    id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    slots: list[RequisitionSlotOut] | None = None


class RequisitionSessionOut(CamelModel):
    id: uuid.UUID
    status: Literal["active", "confirmed", "routed"]
    messages: list[ChatMessageOut]
    po_id: uuid.UUID | None = None


class SendMessageIn(CamelModel):
    content: str


class SendMessageOut(CamelModel):
    session: RequisitionSessionOut
    ready_to_confirm: bool
    po_number: str | None = None
    """Set when this turn created a real PurchaseOrder. If the session
    reached "routed" but this is still null, routing_failure_reason explains
    why no PO could be created — the frontend must not assume routed implies
    a PO exists."""
    routing_failure_reason: str | None = None


class TranscribeOut(CamelModel):
    text: str
