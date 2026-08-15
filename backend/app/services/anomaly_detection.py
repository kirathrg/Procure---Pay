"""Rule-based anomaly detection — plain SQL/Python thresholds, no Gemini.
Gemini is called separately only to phrase the narrative `detail` text once
a detection has already fired deterministically (see
services/gemini.py:generate_anomaly_detail).
"""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Invoice, PurchaseOrder

SPLIT_PO_WINDOW_HOURS = 48
SPLIT_PO_THRESHOLD = 10_000
SPLIT_PO_MIN_COUNT = 3

PRICE_JUMP_PCT = 0.25  # 25% above the trailing average triggers a flag
PRICE_JUMP_MIN_HISTORY = 2  # need at least this many prior orders to compare against

DUPLICATE_INVOICE_WINDOW_DAYS = 7


@dataclass
class DetectedAnomaly:
    type: str
    severity: str
    data_points: list[str]


async def detect_duplicate_invoices(db: AsyncSession) -> list[DetectedAnomaly]:
    """Flags invoices from the same vendor with the same total, submitted
    within a short window — a lightweight, explainable proxy for "these two
    invoices look like the same bill submitted twice" without needing image
    similarity / perceptual hashing."""
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.fields)).order_by(Invoice.created_at)
    )
    invoices = list(result.scalars().all())

    found: list[DetectedAnomaly] = []
    for i, inv_a in enumerate(invoices):
        for inv_b in invoices[i + 1 :]:
            if inv_a.vendor != inv_b.vendor:
                continue
            if inv_a.id == inv_b.id:
                continue
            delta = abs((inv_b.created_at - inv_a.created_at).total_seconds())
            if delta > DUPLICATE_INVOICE_WINDOW_DAYS * 86400:
                continue

            amount_a = _invoice_total(inv_a)
            amount_b = _invoice_total(inv_b)
            if amount_a is None or amount_b is None:
                continue
            if abs(amount_a - amount_b) > max(amount_a, amount_b) * 0.05:
                continue

            days_apart = round(delta / 86400, 1)
            same_number = inv_a.invoice_number == inv_b.invoice_number
            found.append(
                DetectedAnomaly(
                    type="duplicate-invoice",
                    severity="high",
                    data_points=[
                        f"Vendor match: {inv_a.vendor}",
                        f"Amount delta: ${abs(amount_a - amount_b):,.2f}",
                        f"Submitted {days_apart} days apart",
                        (
                            f"Same invoice number submitted twice: {inv_a.invoice_number}"
                            if same_number
                            else f"Invoices: {inv_a.invoice_number} / {inv_b.invoice_number}"
                        ),
                    ],
                )
            )
    return found


async def detect_price_jumps(db: AsyncSession) -> list[DetectedAnomaly]:
    """Flags a PO whose unit price is significantly above the trailing
    average for the same item from the same supplier."""
    result = await db.execute(select(PurchaseOrder).order_by(PurchaseOrder.issued_date))
    orders = list(result.scalars().all())

    by_item_supplier: dict[tuple[str, object], list[PurchaseOrder]] = {}
    for po in orders:
        by_item_supplier.setdefault((po.item, po.supplier_id), []).append(po)

    found: list[DetectedAnomaly] = []
    for (item, _supplier_id), group in by_item_supplier.items():
        if len(group) < PRICE_JUMP_MIN_HISTORY + 1:
            continue
        group.sort(key=lambda p: p.issued_date)
        *history, latest = group
        avg_price = sum(float(p.unit_price) for p in history) / len(history)
        if avg_price <= 0:
            continue
        latest_price = float(latest.unit_price)
        increase_pct = (latest_price - avg_price) / avg_price
        if increase_pct < PRICE_JUMP_PCT:
            continue

        found.append(
            DetectedAnomaly(
                type="price-jump",
                severity="high" if increase_pct > 0.5 else "medium",
                data_points=[
                    f"Prior avg unit price: ${avg_price:.2f}",
                    f"Current unit price: ${latest_price:.2f}",
                    f"Increase: {increase_pct * 100:.0f}%",
                    f"Item: {item}",
                ],
            )
        )
    return found


async def detect_split_pos(db: AsyncSession) -> list[DetectedAnomaly]:
    """Flags clusters of POs to the same supplier, issued within a short
    window, each individually under an approval threshold that their sum
    would exceed — the classic split-PO evasion pattern."""
    result = await db.execute(
        select(PurchaseOrder).options(selectinload(PurchaseOrder.supplier)).order_by(PurchaseOrder.issued_date)
    )
    orders = list(result.scalars().all())

    by_supplier: dict[object, list[PurchaseOrder]] = {}
    for po in orders:
        by_supplier.setdefault(po.supplier_id, []).append(po)

    found: list[DetectedAnomaly] = []
    for supplier_id, group in by_supplier.items():
        group.sort(key=lambda p: p.issued_date)
        under_threshold = [p for p in group if float(p.total) < SPLIT_PO_THRESHOLD]
        if len(under_threshold) < SPLIT_PO_MIN_COUNT:
            continue

        window_start = under_threshold[0].issued_date
        window_end = window_start + timedelta(hours=SPLIT_PO_WINDOW_HOURS)
        clustered = [p for p in under_threshold if window_start <= p.issued_date <= window_end]
        if len(clustered) < SPLIT_PO_MIN_COUNT:
            continue

        vendor_name = clustered[0].supplier.name if clustered[0].supplier else "Unknown vendor"
        found.append(
            DetectedAnomaly(
                type="split-po",
                severity="high",
                data_points=[f"{p.po_number}: ${float(p.total):,.2f}" for p in clustered]
                + [f"Vendor: {vendor_name}"],
            )
        )
    return found


def _invoice_total(invoice: Invoice) -> float | None:
    for f in invoice.fields:
        if f.key == "total":
            try:
                return float(f.value.replace("$", "").replace(",", ""))
            except ValueError:
                return None
    return None
