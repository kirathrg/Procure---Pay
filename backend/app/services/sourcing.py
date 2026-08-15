"""Deterministic supplier ranking for a given product + quantity — pure
Python/SQL, no Gemini. Shared by GET /purchase-orders/{id}/candidate-suppliers
and the requisition auto-PO flow (services/requisition_routing.py) so both
paths rank suppliers identically.
"""

from dataclasses import dataclass

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Product, ProductSupplier, PurchaseOrder


@dataclass
class RankedSupplier:
    supplier_id: object
    name: str
    unit_price: float
    total_price: float
    lead_time_days: int
    preferred: bool
    on_time_rate: float
    order_count: int


async def rank_suppliers_for_product(
    db: AsyncSession, product: Product, quantity: int
) -> list[RankedSupplier]:
    """Every supplier linked to `product`, ranked cheapest-total-price first.
    On-time rate is the same "% of that supplier's POs not escalated" proxy
    used by the analytics leaderboard. Empty list if no supplier is linked."""
    links = (
        await db.execute(
            select(ProductSupplier)
            .where(ProductSupplier.product_id == product.id)
            .options(selectinload(ProductSupplier.supplier))
        )
    ).scalars().all()
    if not links:
        return []

    supplier_ids = [link.supplier_id for link in links]
    perf_rows = (
        await db.execute(
            select(
                PurchaseOrder.supplier_id,
                func.count(PurchaseOrder.id).label("orders"),
                func.sum(case((PurchaseOrder.status != "escalated", 1), else_=0)).label("on_time_count"),
            )
            .where(PurchaseOrder.supplier_id.in_(supplier_ids))
            .group_by(PurchaseOrder.supplier_id)
        )
    ).all()
    perf = {row.supplier_id: row for row in perf_rows}

    ranked = []
    for link in links:
        row = perf.get(link.supplier_id)
        orders = row.orders if row else 0
        on_time_rate = round((row.on_time_count / orders) * 100, 1) if row and orders else 0.0
        ranked.append(
            RankedSupplier(
                supplier_id=link.supplier_id,
                name=link.supplier.name,
                unit_price=float(link.unit_price),
                total_price=float(link.unit_price) * quantity,
                lead_time_days=link.lead_time_days,
                preferred=link.preferred,
                on_time_rate=on_time_rate,
                order_count=orders,
            )
        )

    ranked.sort(key=lambda c: c.total_price)
    return ranked
