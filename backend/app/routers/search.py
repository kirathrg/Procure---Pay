from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Anomaly, Invoice, MatchCase, Product, PurchaseOrder, Supplier
from app.schemas.search import SearchResultOut

router = APIRouter(prefix="/search", tags=["search"])

_MAX_PER_GROUP = 5


@router.get("", response_model=list[SearchResultOut])
async def search(q: str = Query(default="", max_length=200), db: AsyncSession = Depends(get_db)) -> list[SearchResultOut]:
    query = q.strip()
    if not query:
        return []

    pattern = f"%{query}%"
    results: list[SearchResultOut] = []

    products = (
        await db.execute(
            select(Product)
            .where(Product.name.ilike(pattern) | Product.sku.ilike(pattern) | Product.category.ilike(pattern))
            .limit(_MAX_PER_GROUP)
        )
    ).scalars().all()
    results += [
        SearchResultOut(
            id=f"prod-{p.id}",
            title=p.name,
            subtitle=f"{p.sku} · {p.category} · ${float(p.reference_price):,.2f}",
            group="Products",
            path="/catalog",
        )
        for p in products
    ]

    suppliers = (
        await db.execute(
            select(Supplier)
            .where(Supplier.name.ilike(pattern) | Supplier.category.ilike(pattern))
            .limit(_MAX_PER_GROUP)
        )
    ).scalars().all()
    results += [
        SearchResultOut(
            id=f"sup-{s.id}",
            title=s.name,
            subtitle=f"{s.category} · {s.status}",
            group="Suppliers",
            path="/suppliers",
        )
        for s in suppliers
    ]

    pos = (
        await db.execute(
            select(PurchaseOrder)
            .where(PurchaseOrder.po_number.ilike(pattern) | PurchaseOrder.item.ilike(pattern) | PurchaseOrder.supplier.has(Supplier.name.ilike(pattern)))
            .options(selectinload(PurchaseOrder.supplier))
            .limit(_MAX_PER_GROUP)
        )
    ).scalars().all()
    results += [
        SearchResultOut(
            id=f"po-{po.id}",
            title=po.po_number,
            subtitle=f"{po.supplier.name} · {po.item} · ${float(po.total):,.2f}",
            group="Purchase orders",
            path="/purchase-orders",
        )
        for po in pos
    ]

    invoices = (
        await db.execute(
            select(Invoice)
            .where(Invoice.invoice_number.ilike(pattern) | Invoice.vendor.ilike(pattern))
            .limit(_MAX_PER_GROUP)
        )
    ).scalars().all()
    results += [
        SearchResultOut(
            id=f"inv-{inv.id}",
            title=inv.invoice_number,
            subtitle=f"{inv.vendor}",
            group="Invoices",
            path="/invoicing",
        )
        for inv in invoices
    ]

    match_cases = (
        await db.execute(
            select(MatchCase)
            .join(PurchaseOrder)
            .where(PurchaseOrder.po_number.ilike(pattern) | MatchCase.outcome.ilike(pattern))
            .options(selectinload(MatchCase.purchase_order).selectinload(PurchaseOrder.supplier))
            .limit(_MAX_PER_GROUP)
        )
    ).scalars().all()
    results += [
        SearchResultOut(
            id=f"match-{m.id}",
            title=f"{m.purchase_order.po_number} match",
            subtitle=f"{m.purchase_order.supplier.name} · {m.outcome.replace('-', ' ')}",
            group="3-Way matches",
            path="/match",
        )
        for m in match_cases
    ]

    anomalies = (
        await db.execute(
            select(Anomaly).where(Anomaly.title.ilike(pattern) | Anomaly.detail.ilike(pattern)).limit(_MAX_PER_GROUP)
        )
    ).scalars().all()
    results += [
        SearchResultOut(id=f"anom-{a.id}", title=a.title, subtitle=a.detail, group="Anomalies", path="/anomalies")
        for a in anomalies
    ]

    return results
