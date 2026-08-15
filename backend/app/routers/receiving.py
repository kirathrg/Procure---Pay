import base64
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import PurchaseOrder, Receipt
from app.schemas.document import ReceiptOut, ScanReceiptIn
from app.services.match_trigger import maybe_run_match
from app.services.storage import upload_image

router = APIRouter(prefix="/purchase-orders", tags=["receiving"])


def _parse_decoded_data(decoded_data: str | None) -> tuple[str | None, int | None]:
    """The QR payload is decoded entirely client-side (live webcam scan or an
    uploaded photo — see Receiving.tsx / lib/qrScan.ts) via the browser's
    BarcodeDetector API, same JSON shape dev_tools.py's generator produces:
    {"poNumber": "...", "quantity": N}. Mirrors the parsing
    services/scan.py used to do server-side with pyzbar before that moved to
    the browser."""
    if not decoded_data:
        return None, None
    try:
        payload = json.loads(decoded_data)
        return payload.get("poNumber"), payload.get("quantity")
    except (json.JSONDecodeError, AttributeError):
        return None, None


def _decode_data_url(data_url: str) -> tuple[bytes, str]:
    """Splits a `data:image/png;base64,...` URL into raw bytes + extension."""
    header, _, b64data = data_url.partition(",")
    content_type = header.split(";")[0].removeprefix("data:") or "image/jpeg"
    extension = content_type.split("/")[-1]
    return base64.b64decode(b64data), extension


@router.post("/{po_id}/receipts", response_model=ReceiptOut, status_code=status.HTTP_201_CREATED)
async def scan_receipt(
    po_id: uuid.UUID,
    payload: ScanReceiptIn,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> ReceiptOut:
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    po = result.scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")

    image_url: str | None = None
    if payload.image_data_url:
        content, extension = _decode_data_url(payload.image_data_url)
        # upload_image is a synchronous network call (supabase-py) — off the
        # event loop for the same reason as invoicing.py's OCR call.
        image_url = await run_in_threadpool(
            upload_image, "receipts", content, f"image/{extension}", extension
        )

    scanned_po_number, scanned_quantity = _parse_decoded_data(payload.decoded_data)

    # Deterministic checks against the PO record — no model involved. Each
    # branch reports the actual cause, so a wrong-PO scan isn't described as a
    # quantity delta.
    decode_failed = payload.decoded_data is None or (scanned_po_number is None and scanned_quantity is None)
    if decode_failed:
        status_value = "pending"
        discrepancy = "Barcode could not be decoded."
    elif scanned_po_number and scanned_po_number != po.po_number:
        status_value = "pending"
        discrepancy = f"Barcode is for {scanned_po_number}, but this is {po.po_number}."
    elif scanned_quantity is not None and scanned_quantity != po.quantity:
        status_value = "pending"
        delta = scanned_quantity - po.quantity
        discrepancy = (
            f"Scanned quantity {scanned_quantity} does not match ordered {po.quantity} ({delta:+d})."
        )
    else:
        status_value = "received"
        discrepancy = None

    receipt = Receipt(
        po_id=po.id,
        scanned_quantity=scanned_quantity,
        status=status_value,
        damage_detected=False,  # never claimed — no labeled dataset of real damaged goods exists
        image_url=image_url,
    )
    db.add(receipt)
    await db.flush()

    # Auto-runs the 3-way match if this PO now has both a receipt and an
    # invoice — see services/match_trigger.py for why it requires both.
    await maybe_run_match(db, po.id)
    await db.commit()
    await db.refresh(receipt)

    result = await db.execute(
        select(Receipt).where(Receipt.id == receipt.id).options(selectinload(Receipt.purchase_order))
    )
    receipt = result.scalar_one()
    return ReceiptOut.from_model(receipt, discrepancy=discrepancy)


@router.get("/{po_id}/receipts", response_model=list[ReceiptOut])
async def list_receipts(po_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[ReceiptOut]:
    result = await db.execute(
        select(Receipt)
        .where(Receipt.po_id == po_id)
        .options(selectinload(Receipt.purchase_order))
        .order_by(Receipt.created_at.desc())
    )
    return [ReceiptOut.from_model(r) for r in result.scalars().all()]
