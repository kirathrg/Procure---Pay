"""Demo/test-prep helpers — NOT part of the real P2P flow. Generates a
scannable QR (for Receiving) or a synthetic invoice image (for Invoicing) on
demand for any real PO, so testing a newly created product's receiving/
invoicing path doesn't require re-running a one-off script by hand each time.

Both endpoints derive their content from the real PurchaseOrder row (item,
quantity, unit price, supplier) rather than requiring the caller to retype
values that could drift from what's actually in the database — the only
caller-supplied override is quantity, specifically so the mismatch case can
be tested on demand.
"""

import io
import json
import uuid

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, status
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import PurchaseOrder

router = APIRouter(prefix="/dev-tools", tags=["dev-tools"])


async def _get_po(db: AsyncSession, po_id: uuid.UUID) -> PurchaseOrder:
    po = (
        await db.execute(
            select(PurchaseOrder).where(PurchaseOrder.id == po_id).options(selectinload(PurchaseOrder.supplier))
        )
    ).scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    return po


@router.get("/receiving-qr/{po_id}")
async def generate_receiving_qr(
    po_id: uuid.UUID,
    quantity: int | None = Query(default=None, description="Override quantity to test a mismatch"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    po = await _get_po(db, po_id)
    payload = json.dumps({"poNumber": po.po_number, "quantity": quantity if quantity is not None else po.quantity})
    img = qrcode.make(payload)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return Response(content=buffer.getvalue(), media_type="image/png")


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in ["arial.ttf", "C:/Windows/Fonts/arial.ttf", "DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


@router.get("/invoice-image/{po_id}")
async def generate_invoice_image(
    po_id: uuid.UUID,
    quantity: int | None = Query(default=None, description="Override quantity to test a mismatch"),
    invoice_number: str = Query(default="INV-TEST-0001"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Renders a synthetic invoice image the OCR service can read back — same
    layout/field labels as scripts/generate_test_invoice.py, but built from
    this PO's real data instead of hardcoded PO-4501 content."""
    po = await _get_po(db, po_id)
    qty = quantity if quantity is not None else po.quantity
    unit_price = float(po.unit_price)
    total = qty * unit_price

    width, height = 1000, 1300
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    title_font = _load_font(36)
    label_font = _load_font(20)
    body_font = _load_font(24)

    y = 60
    draw.text((60, y), po.supplier.name, font=title_font, fill="black")
    y += 60
    draw.text((60, y), po.supplier.address_line or "", font=label_font, fill="gray")

    draw.text((650, 60), "INVOICE", font=title_font, fill="black")
    draw.text((650, 110), f"Invoice #: {invoice_number}", font=body_font, fill="black")
    draw.text((650, 145), f"PO Reference: {po.po_number}", font=body_font, fill="black")

    y = 250
    draw.line((60, y, 940, y), fill="black", width=2)
    y += 40
    draw.text((60, y), f"Vendor: {po.supplier.name}", font=body_font, fill="black")
    y += 60

    draw.line((60, y, 940, y), fill="black", width=2)
    y += 40
    draw.text((60, y), "Description", font=label_font, fill="gray")
    draw.text((450, y), "Quantity", font=label_font, fill="gray")
    draw.text((600, y), "Unit Price", font=label_font, fill="gray")
    draw.text((780, y), "Total", font=label_font, fill="gray")
    y += 40
    draw.text((60, y), po.item, font=body_font, fill="black")
    draw.text((450, y), f"{qty} units", font=body_font, fill="black")
    draw.text((600, y), f"${unit_price:.2f}", font=body_font, fill="black")
    draw.text((780, y), f"${total:,.2f}", font=body_font, fill="black")

    y += 80
    draw.line((60, y, 940, y), fill="black", width=2)
    y += 40
    draw.text((700, y), f"Total: ${total:,.2f}", font=title_font, fill="black")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return Response(content=buffer.getvalue(), media_type="image/png")
