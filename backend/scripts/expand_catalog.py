"""One-time additive seed: expands the existing catalog with more suppliers,
more products (including two new categories), and enough product-supplier
links per product that the cheapest-total-price ranking in services/sourcing.py
is a real choice between several real options, not a coin-flip between one
or two suppliers.

Unlike scripts/seed.py (a from-scratch full seed, not safe to re-run), this
script only adds new rows alongside whatever is already in the database —
existing suppliers/products/POs are left untouched. It also backfills extra
supplier links onto the three products that currently have only one.

Usage:
    python scripts/expand_catalog.py
"""

import asyncio
import uuid

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Product, ProductSupplier, Supplier

new_supplier_ids: dict[str, uuid.UUID] = {}
new_product_ids: dict[str, uuid.UUID] = {}


async def add_suppliers(db) -> None:
    data = [
        dict(
            key="sup-5",
            name="Coromandel Office Depot",
            contact_name="Divya Nataraj",
            contact_email="divya.n@coromandeldepot.example",
            contact_phone="+91 44 2678 3391",
            address_line="45 Anna Salai, Chennai, TN 600002, IN",
            category="Office Supplies",
            tax_id="33AAFCC7789K1Z1",
            status="active",
        ),
        dict(
            key="sup-6",
            name="Velachery Stationery Traders",
            contact_name="Suresh Balakrishnan",
            contact_email="suresh.b@velacherystationery.example",
            contact_phone="+91 44 2244 5567",
            address_line="12 Velachery Main Rd, Chennai, TN 600042, IN",
            category="Office Supplies",
            tax_id="33AABCV4521L1Z9",
            status="preferred",
        ),
        dict(
            key="sup-7",
            name="Bharat Compute Systems",
            contact_name="Lakshmi Narasimhan",
            contact_email="lakshmi.n@bharatcompute.example",
            contact_phone="+91 44 3312 8845",
            address_line="Plot 5, Sholinganallur IT Park, Chennai, TN 600119, IN",
            category="IT Equipment",
            tax_id="33AADCB6634M1Z3",
            status="preferred",
        ),
        dict(
            key="sup-8",
            name="Southern Networks & Peripherals",
            contact_name="Ravi Chandran",
            contact_email="ravi.c@southernnetworks.example",
            contact_phone="+91 44 4456 2210",
            address_line="22 OMR Road, Chennai, TN 600096, IN",
            category="IT Equipment",
            tax_id="33AACCS8842N1Z6",
            status="active",
        ),
        dict(
            key="sup-9",
            name="TechHive Distributors",
            contact_name="Anjali Menon",
            contact_email="anjali.m@techhivedist.example",
            contact_phone="+91 44 2987 1123",
            address_line="9 Perungudi Industrial Estate, Chennai, TN 600096, IN",
            category="IT Equipment",
            tax_id="33AABCT9987P1Z8",
            status="active",
        ),
        dict(
            key="sup-10",
            name="Kanchipuram Wood Works",
            contact_name="Ganesh Moorthy",
            contact_email="ganesh.m@kanchiwoodworks.example",
            contact_phone="+91 44 2718 6634",
            address_line="Kancheepuram Industrial Area, TN 631501, IN",
            category="Furniture",
            tax_id="33AAECK1123Q1Z4",
            status="active",
        ),
        dict(
            key="sup-11",
            name="Guindy Electronics Wholesale",
            contact_name="Vikram Raghunathan",
            contact_email="vikram.r@guindyelectronics.example",
            contact_phone="+91 44 2225 7789",
            address_line="Guindy Industrial Estate, Chennai, TN 600032, IN",
            category="Electronics",
            tax_id="33AADCG5567R1Z2",
            status="active",
        ),
        dict(
            key="sup-12",
            name="Redhills Storage Systems",
            contact_name="Fathima Rahman",
            contact_email="fathima.r@redhillsstorage.example",
            contact_phone="+91 44 2688 3345",
            address_line="Redhills Industrial Zone, Chennai, TN 600052, IN",
            category="Warehousing",
            tax_id="33AABCR2234S1Z7",
            status="active",
        ),
    ]
    for row in data:
        key = row.pop("key")
        existing = (await db.execute(select(Supplier).where(Supplier.name == row["name"]))).scalar_one_or_none()
        if existing is not None:
            new_supplier_ids[key] = existing.id
            continue
        sid = uuid.uuid4()
        new_supplier_ids[key] = sid
        db.add(Supplier(id=sid, **row))
    await db.flush()


async def add_products(db) -> None:
    data = [
        dict(key="prod-8", sku="OFS-PPR-008", name="Copier Paper Reams", category="Office Supplies", uom="ream",
             description="A4 80gsm multipurpose copier paper, 500 sheets per ream.", reference_price=4.5),
        dict(key="prod-9", sku="OFS-PEN-009", name="Ballpoint Pen Box", category="Office Supplies", uom="box",
             description="Box of 50 medium-tip ballpoint pens.", reference_price=6.2),
        dict(key="prod-10", sku="OFS-BND-010", name="Ring Binders", category="Office Supplies", uom="each",
             description="A4 2-inch capacity ring binder with clear sleeve.", reference_price=3.1),
        dict(key="prod-11", sku="ITE-LAP-011", name="Business Laptop", category="IT Equipment", uom="each",
             description="14-inch business laptop, 16GB RAM, 512GB SSD.", reference_price=890),
        dict(key="prod-12", sku="ITE-MON-012", name="27-inch Monitor", category="IT Equipment", uom="each",
             description="27-inch QHD IPS monitor with USB-C input.", reference_price=245),
        dict(key="prod-13", sku="ITE-DOC-013", name="USB-C Docking Station", category="IT Equipment", uom="each",
             description="USB-C dock with dual HDMI, ethernet, and 100W passthrough.", reference_price=95),
        dict(key="prod-14", sku="ITE-RTR-014", name="Enterprise WiFi Router", category="IT Equipment", uom="each",
             description="Wi-Fi 6 enterprise access point with PoE.", reference_price=175),
        dict(key="prod-15", sku="FRN-BKS-015", name="Bookshelf Unit", category="Furniture", uom="each",
             description="5-tier open bookshelf, engineered wood.", reference_price=110),
        dict(key="prod-16", sku="ELC-PRJ-016", name="Portable Projector", category="Electronics", uom="each",
             description="1080p portable projector with built-in speaker.", reference_price=310),
    ]
    for row in data:
        key = row.pop("key")
        existing = (await db.execute(select(Product).where(Product.sku == row["sku"]))).scalar_one_or_none()
        if existing is not None:
            new_product_ids[key] = existing.id
            continue
        pid = uuid.uuid4()
        new_product_ids[key] = pid
        db.add(Product(id=pid, **row))
    await db.flush()


async def add_links(db) -> None:
    # (product_key, supplier_key, unit_price, lead_time_days, preferred)
    # Every new product gets 3-4 supplier links with varied price/lead-time
    # so the cheapest-total-price ranking is a real decision. The three
    # existing single-supplier products (prod-3, prod-5, prod-7) are
    # backfilled here too.
    links = [
        # Copier Paper Reams
        ("prod-8", "sup-5", 4.5, 3, True),
        ("prod-8", "sup-6", 4.2, 4, False),
        ("prod-8", "sup-1", 4.9, 2, False),
        # Ballpoint Pen Box
        ("prod-9", "sup-5", 6.2, 3, False),
        ("prod-9", "sup-6", 5.8, 3, True),
        ("prod-9", "sup-2", 6.5, 5, False),
        # Ring Binders
        ("prod-10", "sup-5", 3.1, 3, True),
        ("prod-10", "sup-6", 3.4, 2, False),
        ("prod-10", "sup-1", 3.3, 4, False),
        # Business Laptop
        ("prod-11", "sup-7", 890, 10, True),
        ("prod-11", "sup-8", 915, 7, False),
        ("prod-11", "sup-9", 875, 14, False),
        # 27-inch Monitor
        ("prod-12", "sup-7", 245, 8, False),
        ("prod-12", "sup-8", 232, 6, True),
        ("prod-12", "sup-9", 251, 9, False),
        ("prod-12", "sup-3", 260, 10, False),
        # USB-C Docking Station
        ("prod-13", "sup-8", 95, 5, True),
        ("prod-13", "sup-9", 102, 4, False),
        ("prod-13", "sup-7", 99, 6, False),
        # Enterprise WiFi Router
        ("prod-14", "sup-8", 175, 7, False),
        ("prod-14", "sup-9", 168, 9, True),
        ("prod-14", "sup-7", 182, 5, False),
        # Bookshelf Unit
        ("prod-15", "sup-10", 110, 8, True),
        ("prod-15", "sup-1", 118, 6, False),
        ("prod-15", "sup-2", 121, 5, False),
        # Portable Projector
        ("prod-16", "sup-11", 310, 7, True),
        ("prod-16", "sup-3", 328, 9, False),
        ("prod-16", "sup-8", 319, 6, False),
        # Backfill: Conference Room Display (prod-3) — was sup-3 only
        ("prod-3", "sup-11", 1095, 8, False),
        ("prod-3", "sup-9", 1148, 11, False),
        # Backfill: Warehouse Pallet Racking (prod-5) — was sup-4 only
        ("prod-5", "sup-12", 79, 9, True),
        ("prod-5", "sup-10", 88, 14, False),
        # Backfill: LED Desk Lamp (prod-7) — was sup-3 only
        ("prod-7", "sup-11", 26, 6, True),
        ("prod-7", "sup-5", 30, 4, False),
    ]

    # Existing products/suppliers referenced by key (from scripts/seed.py) are
    # looked up by their known names/skus rather than assumed present in
    # new_product_ids/new_supplier_ids, since this script runs independently.
    existing_product_skus = {"prod-3": "ELC-DSP-003", "prod-5": "WHS-RCK-005", "prod-7": "ELC-LMP-007"}
    existing_supplier_names = {
        "sup-1": "Meridian Office Supply Co.",
        "sup-2": "Chennai Furnishing Group",
        "sup-3": "Apex Workspace Solutions",
        "sup-4": "Nord Logistics Ltd.",
    }

    async def resolve_product(key: str) -> uuid.UUID | None:
        if key in new_product_ids:
            return new_product_ids[key]
        if key in existing_product_skus:
            row = (await db.execute(select(Product).where(Product.sku == existing_product_skus[key]))).scalar_one_or_none()
            return row.id if row else None
        return None

    async def resolve_supplier(key: str) -> uuid.UUID | None:
        if key in new_supplier_ids:
            return new_supplier_ids[key]
        if key in existing_supplier_names:
            row = (await db.execute(select(Supplier).where(Supplier.name == existing_supplier_names[key]))).scalar_one_or_none()
            return row.id if row else None
        return None

    added = 0
    for product_key, supplier_key, unit_price, lead_time, preferred in links:
        pid = await resolve_product(product_key)
        sid = await resolve_supplier(supplier_key)
        if pid is None or sid is None:
            print(f"  skip: could not resolve {product_key} / {supplier_key}")
            continue
        existing = (
            await db.execute(
                select(ProductSupplier).where(ProductSupplier.product_id == pid, ProductSupplier.supplier_id == sid)
            )
        ).scalar_one_or_none()
        if existing is not None:
            continue
        db.add(
            ProductSupplier(
                product_id=pid,
                supplier_id=sid,
                unit_price=unit_price,
                lead_time_days=lead_time,
                preferred=preferred,
            )
        )
        added += 1
    await db.flush()
    print(f"  {added} new product-supplier links added")


async def main() -> None:
    async with SessionLocal() as db:
        await add_suppliers(db)
        await add_products(db)
        await add_links(db)
        await db.commit()
    print("Catalog expansion complete:")
    print(f"  {len(new_supplier_ids)} suppliers added/matched")
    print(f"  {len(new_product_ids)} products added/matched")


if __name__ == "__main__":
    asyncio.run(main())
