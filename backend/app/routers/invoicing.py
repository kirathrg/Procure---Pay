import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import Invoice, InvoiceField, PurchaseOrder
from app.schemas.document import InvoiceOut
from app.services.match_trigger import maybe_run_match
from app.services.ocr import OcrNotConfiguredError, get_ocr_service
from app.services.storage import upload_image

router = APIRouter(prefix="/purchase-orders", tags=["invoicing"])


@router.post("/{po_id}/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def extract_invoice(
    po_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> InvoiceOut:
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    po = result.scalar_one_or_none()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")

    content = await file.read()
    extension = (file.filename or "jpg").rsplit(".", 1)[-1].lower()
    # Both calls are synchronous (the OCR.space HTTP call, the supabase-py
    # storage client) — run_in_threadpool keeps them off the event loop so
    # they don't block every other in-flight request. A real bug caught by
    # testing: without this, a single OCR call froze the whole server (every
    # other request just hung, no error, nothing in the log) since FastAPI's
    # event loop has exactly one thread.
    image_url = await run_in_threadpool(
        upload_image, "invoices", content, file.content_type or "image/jpeg", extension
    )
    try:
        extracted = await run_in_threadpool(get_ocr_service().extract_invoice_fields, content)
    except OcrNotConfiguredError as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    by_key = {f.key: f for f in extracted}

    # The extracted "PO Reference" field is the invoice's own claim about
    # which PO it belongs to — reject outright if it names a different real
    # PO than the one being uploaded to, rather than silently saving it and
    # letting 3-way match compare against the wrong PO's data. Only rejects
    # when a PO reference was actually read and clearly doesn't match — an
    # invoice with no readable PO reference at all still goes through, same
    # as before, since that's a legitimate OCR miss, not a mismatch.
    extracted_po_number = by_key.get("poNumber")
    if extracted_po_number and extracted_po_number.value.strip().upper() != po.po_number.strip().upper():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"This invoice references {extracted_po_number.value}, not {po.po_number} — "
            "upload it to the correct purchase order instead.",
        )

    invoice = Invoice(
        po_id=po.id,
        invoice_number=by_key["invoiceNumber"].value if "invoiceNumber" in by_key else "UNKNOWN",
        vendor=by_key["vendor"].value if "vendor" in by_key else po.supplier.name,
        image_url=image_url,
    )
    db.add(invoice)
    await db.flush()

    for f in extracted:
        db.add(
            InvoiceField(
                invoice_id=invoice.id,
                key=f.key,
                label=f.label,
                value=f.value,
                confidence=f.confidence,
                bbox_x=f.bbox_x,
                bbox_y=f.bbox_y,
                bbox_w=f.bbox_w,
                bbox_h=f.bbox_h,
            )
        )

    # Auto-runs the 3-way match if this PO now has both a receipt and an
    # invoice — see services/match_trigger.py for why it requires both.
    await maybe_run_match(db, po.id)
    await db.commit()

    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice.id)
        .options(selectinload(Invoice.fields), selectinload(Invoice.purchase_order))
    )
    invoice = result.scalar_one()
    return InvoiceOut.from_model(invoice)


@router.get("/{po_id}/invoices", response_model=list[InvoiceOut])
async def list_invoices(po_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[InvoiceOut]:
    result = await db.execute(
        select(Invoice)
        .where(Invoice.po_id == po_id)
        .options(selectinload(Invoice.fields), selectinload(Invoice.purchase_order))
        .order_by(Invoice.created_at.desc())
    )
    return [InvoiceOut.from_model(i) for i in result.scalars().all()]
