"""One-time seed script: populates the database with the same content the
frontend's src/data/mock.ts previously hardcoded, so behavior is identical
on day one — just served from Postgres instead of a JS array.

Mock string ids (e.g. "sup-1", "prod-1") are translated to real UUIDs here;
a local dict keeps the mapping consistent across FK references within this
script. Analytics rollups (cycleTimeTrend, supplierPerformance,
exceptionReasons, analyticsSummary) are intentionally NOT seeded as tables —
per the plan, those are computed via SQL aggregation at request time.

Usage:
    python scripts/seed.py
"""

import asyncio
import uuid
from datetime import date, datetime

from app.database import SessionLocal
from app.models import (
    Anomaly,
    Buyer,
    Invoice,
    InvoiceField,
    MatchCase,
    MatchField,
    Product,
    ProductSupplier,
    PurchaseOrder,
    Receipt,
    Supplier,
)

supplier_ids: dict[str, uuid.UUID] = {}
product_ids: dict[str, uuid.UUID] = {}
buyer_ids: dict[tuple[str, str], uuid.UUID] = {}
po_ids: dict[str, uuid.UUID] = {}


def new_id() -> uuid.UUID:
    return uuid.uuid4()


async def seed_suppliers(db) -> None:
    data = [
        dict(
            key="sup-1",
            name="Meridian Office Supply Co.",
            contact_name="Arun Vellore",
            contact_email="arun.vellore@meridiansupply.example",
            contact_phone="+91 44 2345 6781",
            address_line="220 Industrial Estate Rd, Chennai, TN 600058, IN",
            category="Furniture",
            tax_id="33AAECM1234F1Z5",
            status="preferred",
        ),
        dict(
            key="sup-2",
            name="Chennai Furnishing Group",
            contact_name="Priya Ramanathan",
            contact_email="priya.r@chennaifurnish.example",
            contact_phone="+91 44 2891 4402",
            address_line="14 Guindy Industrial Estate, Chennai, TN 600032, IN",
            category="Furniture",
            tax_id="33AACCC5678G1Z2",
            status="active",
        ),
        dict(
            key="sup-3",
            name="Apex Workspace Solutions",
            contact_name="Karthik Subramaniam",
            contact_email="karthik.s@apexworkspace.example",
            contact_phone="+91 44 4020 7710",
            address_line="8th Cross, Ambattur Industrial Estate, Chennai, TN 600058, IN",
            category="Electronics",
            tax_id="33AADCA9012H1Z8",
            status="active",
        ),
        dict(
            key="sup-4",
            name="Nord Logistics Ltd.",
            contact_name="Meera Iyer",
            contact_email="meera.iyer@nordlogistics.example",
            contact_phone="+91 44 3355 9021",
            address_line="Plot 12, Manali Industrial Area, Chennai, TN 600068, IN",
            category="Warehousing",
            tax_id="33AABCN3456J1Z4",
            status="active",
        ),
    ]
    for row in data:
        key = row.pop("key")
        sid = new_id()
        supplier_ids[key] = sid
        db.add(Supplier(id=sid, **row))
    await db.flush()


async def seed_products(db) -> None:
    data = [
        dict(key="prod-1", sku="FRN-CHR-001", name="Ergonomic Office Chair", category="Furniture", uom="each",
             description="Adjustable-height mesh-back office chair with lumbar support.", reference_price=370),
        dict(key="prod-2", sku="FRN-DSK-002", name="Standing Desk Frame", category="Furniture", uom="each",
             description="Electric height-adjustable desk frame, dual-motor.", reference_price=210),
        dict(key="prod-3", sku="ELC-DSP-003", name="Conference Room Display", category="Electronics", uom="each",
             description="75-inch 4K conference room display with built-in speakers.", reference_price=1120),
        dict(key="prod-4", sku="FRN-CAB-004", name="Filing Cabinets", category="Furniture", uom="each",
             description="3-drawer lockable steel filing cabinet.", reference_price=145),
        dict(key="prod-5", sku="WHS-RCK-005", name="Warehouse Pallet Racking", category="Warehousing", uom="bay",
             description="Selective pallet racking bay, 3-tier, 2000kg per level.", reference_price=82),
        dict(key="prod-6", sku="ELC-KBM-006", name="Wireless Keyboard and Mouse Set", category="Electronics", uom="set",
             description="Compact wireless keyboard and mouse combo, USB-C rechargeable.", reference_price=46),
        dict(key="prod-7", sku="ELC-LMP-007", name="LED Desk Lamp", category="Electronics", uom="each",
             description="Dimmable LED desk lamp with USB charging port.", reference_price=28),
    ]
    for row in data:
        key = row.pop("key")
        pid = new_id()
        product_ids[key] = pid
        db.add(Product(id=pid, **row))
    await db.flush()


async def seed_product_suppliers(db) -> None:
    links = [
        ("prod-1", "sup-1", 370, 6, True),
        ("prod-1", "sup-2", 395, 4, False),
        ("prod-1", "sup-3", 424, 9, False),
        ("prod-2", "sup-2", 210, 4, True),
        ("prod-2", "sup-1", 225, 7, False),
        ("prod-3", "sup-3", 1120, 9, True),
        ("prod-4", "sup-1", 145, 6, True),
        ("prod-4", "sup-2", 152, 5, False),
        ("prod-5", "sup-4", 82, 11, True),
        ("prod-6", "sup-3", 46, 8, True),
        ("prod-6", "sup-1", 51, 6, False),
        ("prod-7", "sup-3", 28, 8, False),
    ]
    for product_key, supplier_key, unit_price, lead_time, preferred in links:
        db.add(
            ProductSupplier(
                product_id=product_ids[product_key],
                supplier_id=supplier_ids[supplier_key],
                unit_price=unit_price,
                lead_time_days=lead_time,
                preferred=preferred,
            )
        )
    await db.flush()


def get_or_create_buyer(db, name: str, email: str, department: str) -> uuid.UUID:
    key = (name, email)
    if key not in buyer_ids:
        bid = new_id()
        buyer_ids[key] = bid
        db.add(Buyer(id=bid, name=name, email=email, department=department))
    return buyer_ids[key]


async def seed_purchase_orders(db) -> None:
    # po_type spread across all four kinds so every variant renders without
    # having to switch types by hand. The three non-standard types carry an
    # allocation (ceiling/released/validity); standard carries none.
    data = [
        dict(key="po-4501", po_number="PO-4501", supplier_key="sup-1", item="Ergonomic Office Chair",
             quantity=50, unit_price=370, total=18500, issued_date=date(2026, 8, 5), status="matched",
             po_type="standard",
             buyer=("Rahul Lingaesh", "rahul.lingaesh@p2p.example", "Facilities")),
        dict(key="po-4498", po_number="PO-4498", supplier_key="sup-4", item="Warehouse Pallet Racking",
             quantity=120, unit_price=82, total=9840, issued_date=date(2026, 8, 3), status="escalated",
             po_type="blanket", allocation=(48000, 9840, date(2026, 8, 3), date(2027, 1, 30)),
             buyer=("Divya Chandran", "divya.chandran@p2p.example", "Operations")),
        dict(key="po-4492", po_number="PO-4492", supplier_key="sup-2", item="Standing Desk Frame",
             quantity=30, unit_price=210, total=6300, issued_date=date(2026, 8, 1), status="paid",
             po_type="planned", allocation=(25200, 6300, date(2026, 8, 1), date(2026, 10, 30)),
             buyer=("Rahul Lingaesh", "rahul.lingaesh@p2p.example", "Facilities")),
        dict(key="po-4487", po_number="PO-4487", supplier_key="sup-3", item="Conference Room Display",
             quantity=8, unit_price=1120, total=8960, issued_date=date(2026, 7, 29), status="received",
             po_type="contract", allocation=(107520, 8960, date(2026, 7, 29), date(2027, 7, 29)),
             buyer=("S. Krishnan", "s.krishnan@p2p.example", "IT")),
        dict(key="po-4480", po_number="PO-4480", supplier_key="sup-1", item="Filing Cabinets",
             quantity=22, unit_price=145, total=3190, issued_date=date(2026, 7, 27), status="pending",
             po_type="standard",
             buyer=("Divya Chandran", "divya.chandran@p2p.example", "Operations")),
    ]
    for row in data:
        key = row.pop("key")
        supplier_key = row.pop("supplier_key")
        buyer_name, buyer_email, buyer_dept = row.pop("buyer")
        allocation = row.pop("allocation", None)
        if allocation is not None:
            ceiling, released, valid_from, valid_to = allocation
            row.update(
                bucket_ceiling=ceiling,
                bucket_released=released,
                bucket_valid_from=valid_from,
                bucket_valid_to=valid_to,
            )
        pid = new_id()
        po_ids[key] = pid
        db.add(
            PurchaseOrder(
                id=pid,
                supplier_id=supplier_ids[supplier_key],
                buyer_id=get_or_create_buyer(db, buyer_name, buyer_email, buyer_dept),
                **row,
            )
        )
    await db.flush()


async def seed_receipt_and_invoice(db) -> None:
    # Mirrors the single hardcoded receiptRecord/invoiceRecord in mock.ts,
    # both tied to PO-4501.
    db.add(
        Receipt(
            po_id=po_ids["po-4501"],
            scanned_quantity=50,
            status="pending",
            damage_detected=False,
            created_at=datetime(2026, 8, 12, 9, 14, 0),
        )
    )

    invoice_id = new_id()
    db.add(
        Invoice(
            id=invoice_id,
            po_id=po_ids["po-4501"],
            invoice_number="INV-8821",
            vendor="Meridian Office Supply Co.",
        )
    )
    fields = [
        ("invoiceNumber", "Invoice #", "INV-8821", 0.99, 62, 8, 30, 5),
        ("poNumber", "PO Reference", "PO-4501", 0.98, 62, 15, 30, 5),
        ("vendor", "Vendor", "Meridian Office Supply Co.", 0.95, 8, 8, 42, 5),
        ("quantity", "Quantity", "45 units", 0.93, 8, 46, 20, 5),
        # No leading "$" — matches what the real OcrService actually extracts
        # (its regex captures the digits only; see app/services/ocr.py).
        ("unitPrice", "Unit Price", "370.00", 0.97, 30, 46, 18, 5),
        ("total", "Total", "16,650.00", 0.99, 62, 62, 30, 6),
    ]
    for key, label, value, confidence, x, y, w, h in fields:
        db.add(
            InvoiceField(
                invoice_id=invoice_id, key=key, label=label, value=value, confidence=confidence,
                bbox_x=x, bbox_y=y, bbox_w=w, bbox_h=h,
            )
        )
    await db.flush()


async def seed_match_cases(db) -> None:
    cases = [
        dict(
            po_key="po-4501",
            outcome="escalated",
            reason="Quantity mismatch: invoice under-bills by 5 units, within normal partial-shipment range but outside auto-approve threshold.",
            routed_to="AP Approver — S. Krishnan",
            fields=[
                ("PO Number", "PO-4501", "PO-4501", "PO-4501", True, None),
                ("Quantity", "50 units", "50 units", "45 units", False, "Invoice: 45 units vs PO: 50 units"),
                ("Unit Price", "$370.00", "—", "$370.00", True, None),
                ("Total Amount", "$18,500.00", "—", "$16,650.00", False, "Invoice total $1,850 below PO"),
            ],
        ),
        dict(
            po_key="po-4492",
            outcome="auto-approved",
            reason="All fields matched within tolerance. Quantity, unit price, and total reconciled across PO, receipt, and invoice.",
            routed_to=None,
            fields=[
                ("PO Number", "PO-4492", "PO-4492", "PO-4492", True, None),
                ("Quantity", "30 units", "30 units", "30 units", True, None),
                ("Unit Price", "$210.00", "—", "$210.00", True, None),
                ("Total Amount", "$6,300.00", "—", "$6,300.00", True, None),
            ],
        ),
    ]
    for case in cases:
        case_id = new_id()
        db.add(
            MatchCase(
                id=case_id,
                po_id=po_ids[case["po_key"]],
                outcome=case["outcome"],
                reason=case["reason"],
                routed_to=case["routed_to"],
            )
        )
        for label, po_v, receipt_v, invoice_v, is_match, delta in case["fields"]:
            db.add(
                MatchField(
                    match_case_id=case_id, label=label, po_value=po_v, receipt_value=receipt_v,
                    invoice_value=invoice_v, is_match=is_match, delta_note=delta,
                )
            )
    await db.flush()


async def seed_anomalies(db) -> None:
    data = [
        dict(type="duplicate-invoice", title="Possible duplicate invoice",
             detail="Invoice #4521 is 98% visually similar to Invoice #4498, submitted 2 days apart.",
             severity="high",
             data_points=["Vendor match: Nord Logistics Ltd.", "Amount delta: $12.00", "Layout similarity: 98%"]),
        dict(type="price-jump", title="Unusual unit price increase",
             detail="Unit price for 'Warehouse Pallet Racking' rose 34% vs. trailing 6-order average from same vendor.",
             severity="medium",
             data_points=["Prior avg unit price: $61.20", "Current unit price: $82.00", "Vendor: Nord Logistics Ltd."]),
        dict(type="split-po", title="Potential split-PO pattern",
             detail="Three POs issued to the same vendor within 48 hours, each just under the $10,000 approval threshold.",
             severity="high",
             data_points=["PO-4495: $9,820", "PO-4496: $9,640", "PO-4497: $9,910", "Vendor: Meridian Office Supply Co."]),
        dict(type="price-jump", title="Line-item price outlier",
             detail="Filing cabinet unit price is 2.1 standard deviations above category median across all active suppliers.",
             severity="low",
             data_points=["Category median: $118.00", "Line price: $145.00", "Z-score: 2.1"]),
    ]
    for row in data:
        db.add(Anomaly(**row))
    await db.flush()


async def main() -> None:
    async with SessionLocal() as db:
        await seed_suppliers(db)
        await seed_products(db)
        await seed_product_suppliers(db)
        await seed_purchase_orders(db)
        await seed_receipt_and_invoice(db)
        await seed_match_cases(db)
        await seed_anomalies(db)
        await db.commit()
    print("Seed complete:")
    print(f"  {len(supplier_ids)} suppliers")
    print(f"  {len(product_ids)} products")
    print(f"  {len(po_ids)} purchase orders")
    print(f"  {len(buyer_ids)} buyers")


if __name__ == "__main__":
    asyncio.run(main())
