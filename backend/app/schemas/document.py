import uuid
from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel


class BBox(CamelModel):
    x: float
    y: float
    w: float
    h: float


class InvoiceFieldOut(CamelModel):
    key: str
    label: str
    value: str
    confidence: float
    bbox: BBox

    @classmethod
    def from_model(cls, field) -> "InvoiceFieldOut":
        return cls(
            key=field.key,
            label=field.label,
            value=field.value,
            confidence=field.confidence,
            bbox=BBox(x=field.bbox_x, y=field.bbox_y, w=field.bbox_w, h=field.bbox_h),
        )


class InvoiceOut(CamelModel):
    id: uuid.UUID
    invoice_number: str
    po_number: str
    vendor: str
    image_url: str | None
    fields: list[InvoiceFieldOut]

    @classmethod
    def from_model(cls, invoice) -> "InvoiceOut":
        return cls(
            id=invoice.id,
            invoice_number=invoice.invoice_number,
            po_number=invoice.purchase_order.po_number,
            vendor=invoice.vendor,
            image_url=invoice.image_url,
            fields=[InvoiceFieldOut.from_model(f) for f in invoice.fields],
        )


class ScanReceiptIn(CamelModel):
    """The QR payload is decoded client-side (live webcam scan or an
    uploaded photo, both via the browser's BarcodeDetector-backed scanner —
    see Receiving.tsx) — the backend never handles raw image bytes for this
    flow, only the already-decoded text and, optionally, a photo taken for
    the record."""

    decoded_data: str | None = None
    """Raw text decoded from the QR code, expected to be the same JSON
    {poNumber, quantity} payload dev_tools.py's QR generator produces. None
    if the scanner ran but found no decodable code in the frame/image."""
    image_data_url: str | None = None
    """Optional data: URL of a photo of the scanned item/label, kept only
    for the record (e.g. a webcam frame grabbed at the moment of a
    successful scan) — not used for decoding."""


class ReceiptOut(CamelModel):
    id: uuid.UUID
    po_number: str
    scanned_quantity: int | None
    ordered_quantity: int
    status: Literal["pending", "scanning", "received"]
    damage_detected: bool
    image_url: str | None
    timestamp: datetime
    discrepancy: str | None = None

    @classmethod
    def from_model(cls, receipt, discrepancy: str | None = None) -> "ReceiptOut":
        po = receipt.purchase_order
        # Callers that know why a scan failed (the scan endpoint, which sees the
        # decoded barcode) pass `discrepancy` in. For listed history that
        # context is gone, so fall back to re-deriving it from the quantities.
        if discrepancy is None:
            if receipt.scanned_quantity is None:
                discrepancy = "Barcode could not be decoded."
            elif receipt.scanned_quantity != po.quantity:
                delta = receipt.scanned_quantity - po.quantity
                discrepancy = (
                    f"Scanned quantity {receipt.scanned_quantity} does not match "
                    f"ordered {po.quantity} ({delta:+d})."
                )
        return cls(
            id=receipt.id,
            po_number=po.po_number,
            scanned_quantity=receipt.scanned_quantity,
            ordered_quantity=po.quantity,
            status=receipt.status,
            damage_detected=receipt.damage_detected,
            image_url=receipt.image_url,
            timestamp=receipt.created_at,
            discrepancy=discrepancy,
        )
