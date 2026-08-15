"""Second additive catalog expansion: 10 more products, plus enough new
suppliers that every new product has 3 real competing options — same pattern
and safety (idempotent, additive-only) as scripts/expand_catalog.py.

Usage:
    python -m scripts.expand_catalog_2
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
            key="sup-13",
            name="Ambattur Safety Equipment Co.",
            contact_name="Murugan Selvaraj",
            contact_email="murugan.s@ambatturafety.example",
            contact_phone="+91 44 2625 7712",
            address_line="Ambattur Industrial Estate, Chennai, TN 600058, IN",
            category="Safety & Facilities",
            tax_id="33AABCA4471T1Z9",
            status="preferred",
        ),
        dict(
            key="sup-14",
            name="Porur Facilities Supply",
            contact_name="Nandini Krishnan",
            contact_email="nandini.k@porurfacilities.example",
            contact_phone="+91 44 2476 8834",
            address_line="Porur Industrial Zone, Chennai, TN 600116, IN",
            category="Safety & Facilities",
            tax_id="33AADCP7823U1Z5",
            status="active",
        ),
        dict(
            key="sup-15",
            name="Madhavaram Industrial Traders",
            contact_name="Boopathy Ilango",
            contact_email="boopathy.i@madhavaramtraders.example",
            contact_phone="+91 44 2645 1123",
            address_line="Madhavaram Industrial Estate, Chennai, TN 600060, IN",
            category="Safety & Facilities",
            tax_id="33AACCM9012V1Z3",
            status="active",
        ),
        dict(
            key="sup-16",
            name="Sriperumbudur Electronics Hub",
            contact_name="Kavitha Ramesh",
            contact_email="kavitha.r@sriperumbudurhub.example",
            contact_phone="+91 44 2715 3390",
            address_line="Sriperumbudur SEZ, Kanchipuram, TN 602105, IN",
            category="Electronics",
            tax_id="33AABCS3345W1Z8",
            status="active",
        ),
        dict(
            key="sup-17",
            name="Pallikaranai IT Traders",
            contact_name="Dinesh Kumar",
            contact_email="dinesh.k@pallikaranaiit.example",
            contact_phone="+91 44 2247 6621",
            address_line="Pallikaranai, Chennai, TN 600100, IN",
            category="IT Equipment",
            tax_id="33AADCP5567X1Z1",
            status="active",
        ),
        dict(
            key="sup-18",
            name="Tambaram Office Interiors",
            contact_name="Revathi Subramaniam",
            contact_email="revathi.s@tambaraminteriors.example",
            contact_phone="+91 44 2226 4478",
            address_line="Tambaram Industrial Area, Chennai, TN 600045, IN",
            category="Furniture",
            tax_id="33AABCT6689Y1Z6",
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
        dict(key="prod-17", sku="SAF-HLM-017", name="Safety Helmets", category="Safety & Facilities", uom="each",
             description="ANSI-rated hard hat with adjustable ratchet suspension.", reference_price=14.5),
        dict(key="prod-18", sku="SAF-VST-018", name="Hi-Vis Safety Vests", category="Safety & Facilities", uom="each",
             description="Class 2 high-visibility reflective safety vest.", reference_price=9.0),
        dict(key="prod-19", sku="SAF-EXT-019", name="Fire Extinguishers", category="Safety & Facilities", uom="each",
             description="5kg ABC dry powder fire extinguisher with wall mount.", reference_price=42.0),
        dict(key="prod-20", sku="SAF-FAK-020", name="First Aid Kits", category="Safety & Facilities", uom="each",
             description="Workplace first aid kit, 50-person, wall-mountable case.", reference_price=38.0),
        dict(key="prod-21", sku="ITE-SSD-021", name="External SSD 1TB", category="IT Equipment", uom="each",
             description="Portable USB-C external SSD, 1TB, up to 1050MB/s.", reference_price=78.0),
        dict(key="prod-22", sku="ITE-WBC-022", name="Webcam 1080p", category="IT Equipment", uom="each",
             description="1080p USB webcam with autofocus and built-in mic.", reference_price=42.0),
        dict(key="prod-23", sku="ELC-SPK-023", name="Conference Speakerphone", category="Electronics", uom="each",
             description="360-degree USB/Bluetooth conference room speakerphone.", reference_price=165.0),
        dict(key="prod-24", sku="FRN-TBL-024", name="Meeting Table 6-Seat", category="Furniture", uom="each",
             description="6-seat rectangular meeting table, laminate finish.", reference_price=340.0),
        dict(key="prod-25", sku="FRN-PTN-025", name="Desk Partition Panels", category="Furniture", uom="each",
             description="Fabric-covered acoustic desk divider panel, 120x60cm.", reference_price=58.0),
        dict(key="prod-26", sku="OFS-LBL-026", name="Label Printer Rolls", category="Office Supplies", uom="pack",
             description="Thermal label printer roll 6-pack, 4x6in shipping labels.", reference_price=22.0),
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
    # Every new product gets 3 competing supplier links, mixing new and
    # already-existing suppliers whose category is a reasonable fit.
    links = [
        # Safety Helmets
        ("prod-17", "sup-13", 14.5, 4, True),
        ("prod-17", "sup-14", 15.2, 3, False),
        ("prod-17", "sup-15", 13.8, 6, False),
        # Hi-Vis Safety Vests
        ("prod-18", "sup-13", 9.0, 4, False),
        ("prod-18", "sup-14", 8.5, 3, True),
        ("prod-18", "sup-15", 9.4, 5, False),
        # Fire Extinguishers
        ("prod-19", "sup-13", 42.0, 5, True),
        ("prod-19", "sup-14", 45.5, 4, False),
        ("prod-19", "sup-15", 40.8, 7, False),
        # First Aid Kits
        ("prod-20", "sup-13", 38.0, 4, False),
        ("prod-20", "sup-14", 36.5, 3, True),
        ("prod-20", "sup-15", 39.2, 5, False),
        # External SSD 1TB
        ("prod-21", "sup-17", 78.0, 5, True),
        ("prod-21", "sup-9", 82.5, 6, False),
        ("prod-21", "sup-8", 80.0, 4, False),
        # Webcam 1080p
        ("prod-22", "sup-17", 42.0, 4, False),
        ("prod-22", "sup-9", 39.5, 6, True),
        ("prod-22", "sup-7", 44.0, 5, False),
        # Conference Speakerphone
        ("prod-23", "sup-16", 165.0, 7, True),
        ("prod-23", "sup-3", 178.0, 9, False),
        ("prod-23", "sup-11", 171.5, 6, False),
        # Meeting Table 6-Seat
        ("prod-24", "sup-18", 340.0, 10, True),
        ("prod-24", "sup-1", 358.0, 8, False),
        ("prod-24", "sup-2", 349.5, 9, False),
        # Desk Partition Panels
        ("prod-25", "sup-18", 58.0, 6, False),
        ("prod-25", "sup-1", 55.5, 7, True),
        ("prod-25", "sup-10", 60.2, 8, False),
        # Label Printer Rolls
        ("prod-26", "sup-5", 22.0, 3, True),
        ("prod-26", "sup-6", 23.5, 2, False),
        ("prod-26", "sup-1", 21.5, 4, False),
    ]

    existing_supplier_names = {
        "sup-1": "Meridian Office Supply Co.",
        "sup-2": "Chennai Furnishing Group",
        "sup-3": "Apex Workspace Solutions",
        "sup-5": "Coromandel Office Depot",
        "sup-6": "Velachery Stationery Traders",
        "sup-7": "Bharat Compute Systems",
        "sup-8": "Southern Networks & Peripherals",
        "sup-9": "TechHive Distributors",
        "sup-10": "Kanchipuram Wood Works",
        "sup-11": "Guindy Electronics Wholesale",
    }

    async def resolve_supplier(key: str) -> uuid.UUID | None:
        if key in new_supplier_ids:
            return new_supplier_ids[key]
        if key in existing_supplier_names:
            row = (
                await db.execute(select(Supplier).where(Supplier.name == existing_supplier_names[key]))
            ).scalar_one_or_none()
            return row.id if row else None
        return None

    added = 0
    for product_key, supplier_key, unit_price, lead_time, preferred in links:
        pid = new_product_ids.get(product_key)
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
    print("Catalog expansion #2 complete:")
    print(f"  {len(new_supplier_ids)} suppliers added/matched")
    print(f"  {len(new_product_ids)} products added/matched")


if __name__ == "__main__":
    asyncio.run(main())
