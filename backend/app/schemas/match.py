import uuid
from typing import Literal

from app.schemas.common import CamelModel


class MatchFieldOut(CamelModel):
    label: str
    po_value: str
    receipt_value: str
    invoice_value: str
    match: bool
    delta_note: str | None = None


class MatchCaseOut(CamelModel):
    id: uuid.UUID
    po_number: str
    vendor: str
    fields: list[MatchFieldOut]
    outcome: Literal["auto-approved", "escalated", "pending"]
    reason: str
    routed_to: str | None = None
    resolved_status: Literal["pending_approval", "released"] | None = None

    @classmethod
    def from_model(cls, case) -> "MatchCaseOut":
        return cls(
            id=case.id,
            po_number=case.purchase_order.po_number,
            vendor=case.purchase_order.supplier.name,
            fields=[
                MatchFieldOut(
                    label=f.label,
                    po_value=f.po_value,
                    receipt_value=f.receipt_value,
                    invoice_value=f.invoice_value,
                    match=f.is_match,
                    delta_note=f.delta_note,
                )
                for f in case.fields
            ],
            outcome=case.outcome,
            reason=case.reason,
            routed_to=case.routed_to,
            resolved_status=case.resolved_status,
        )


class ResolveMatchIn(CamelModel):
    action: Literal["release", "review"]


class ResolveMatchOut(CamelModel):
    resolved_status: Literal["pending_approval"]
