import uuid
from datetime import date
from typing import Literal

from app.schemas.common import CamelModel

PO_STATUSES = Literal["pending", "scanning", "received", "matched", "escalated", "paid"]
PO_TYPES = Literal["standard", "planned", "blanket", "contract"]

# Standard POs cover a single committed purchase and carry no spend envelope.
# The other three are all open/recurring instruments, so they share one
# ceiling + validity-window shape (differing in intent, not in fields).
ALLOCATION_PO_TYPES = ("planned", "blanket", "contract")


class BuyerOut(CamelModel):
    name: str
    email: str
    department: str


class PurchaseOrderAllocationOut(CamelModel):
    ceiling: float
    released: float
    valid_from: date
    valid_to: date


RECEIVING_STATUSES = Literal["not_started", "pending", "scanning", "received"]
INVOICE_STATUSES = Literal["not_started", "received"]


class PurchaseOrderOut(CamelModel):
    id: uuid.UUID
    po_number: str
    supplier: str  # display name, matches frontend's flat `supplier` field
    supplier_id: uuid.UUID
    item: str
    quantity: int
    unit_price: float
    total: float
    issued_date: date
    status: PO_STATUSES
    po_type: PO_TYPES
    buyer: BuyerOut
    allocation: PurchaseOrderAllocationOut | None = None
    # Surfaced so the Purchase Orders table can show receiving/invoice
    # progress per row without a second round trip per PO. Derived from the
    # most recent receipt/invoice, not stored — po.status already tracks the
    # PO's own lifecycle, this is specifically "how far along is each leg."
    receiving_status: RECEIVING_STATUSES = "not_started"
    invoice_status: INVOICE_STATUSES = "not_started"

    @classmethod
    def from_model(cls, po, *, latest_receipt=None, has_invoice: bool = False) -> "PurchaseOrderOut":
        allocation = None
        if po.po_type in ALLOCATION_PO_TYPES and po.bucket_ceiling is not None:
            allocation = PurchaseOrderAllocationOut(
                ceiling=po.bucket_ceiling,
                released=po.bucket_released or 0,
                valid_from=po.bucket_valid_from,
                valid_to=po.bucket_valid_to,
            )
        return cls(
            id=po.id,
            po_number=po.po_number,
            supplier=po.supplier.name,
            supplier_id=po.supplier_id,
            item=po.item,
            quantity=po.quantity,
            unit_price=po.unit_price,
            total=po.total,
            issued_date=po.issued_date,
            status=po.status,
            po_type=po.po_type,
            buyer=BuyerOut(name=po.buyer.name, email=po.buyer.email, department=po.buyer.department),
            allocation=allocation,
            receiving_status=latest_receipt.status if latest_receipt is not None else "not_started",
            invoice_status="received" if has_invoice else "not_started",
        )


class UpdatePOType(CamelModel):
    po_type: PO_TYPES


class UpdatePOStatus(CamelModel):
    status: PO_STATUSES


class CandidateSupplierOut(CamelModel):
    """One ranked candidate for GET /purchase-orders/{id}/candidate-suppliers.
    unit_price/lead_time_days/preferred come straight from the real
    product_suppliers row; on_time_rate is computed from that supplier's PO
    history (same logic as the analytics leaderboard). There is no quality or
    risk score anywhere in this system, so none is reported — see
    CandidateSuppliersOut.unmatched for why the list can be empty."""

    supplier_id: uuid.UUID
    name: str
    unit_price: float
    total_price: float
    lead_time_days: int
    preferred: bool
    on_time_rate: float
    order_count: int
    selected: bool
    explain: str | None = None


class CandidateSuppliersOut(CamelModel):
    product_id: uuid.UUID | None
    candidates: list[CandidateSupplierOut]
    unmatched: bool = False
    """True when PO.item didn't match any known Product by name — candidates
    will be empty and the frontend should say so rather than show a blank
    list with no explanation."""


class EmailPoOut(CamelModel):
    sent_to: str
    message_id: str
