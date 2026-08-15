"""Analytics endpoints — pure SQL aggregation, no stored rollup tables and
no Gemini involvement (per the plan, these are derived data, not independent
facts). With only seed data loaded, cycle-time/exception trends will look
sparse — the queries are real, the history to aggregate over just isn't
deep yet.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import MatchField, PurchaseOrder, Supplier
from app.schemas.analytics import (
    AnalyticsSummaryOut,
    CycleTimePointOut,
    ExceptionReasonOut,
    SupplierPerformanceOut,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummaryOut)
async def get_summary(db: AsyncSession = Depends(get_db)) -> AnalyticsSummaryOut:
    total_pos = (await db.execute(select(func.count(PurchaseOrder.id)))).scalar() or 0
    touchless_count = (
        await db.execute(select(func.count(PurchaseOrder.id)).where(PurchaseOrder.status != "escalated"))
    ).scalar() or 0
    touchless_rate = round((touchless_count / total_pos) * 100, 1) if total_pos else 0.0

    avg_cycle = (
        await db.execute(
            select(func.avg(func.current_date() - PurchaseOrder.issued_date)).where(
                PurchaseOrder.status.in_(["matched", "paid"])
            )
        )
    ).scalar()
    avg_cycle_days = round(float(avg_cycle), 1) if avg_cycle is not None else 0.0

    cost_saved = (
        await db.execute(select(func.coalesce(func.sum(PurchaseOrder.total), 0)).where(PurchaseOrder.status == "paid"))
    ).scalar() or 0

    week_ago = date.today() - timedelta(days=7)
    exceptions_this_week = (
        await db.execute(
            select(func.count(PurchaseOrder.id)).where(
                PurchaseOrder.status == "escalated", PurchaseOrder.issued_date >= week_ago
            )
        )
    ).scalar() or 0

    return AnalyticsSummaryOut(
        touchless_rate=touchless_rate,
        avg_cycle_days=avg_cycle_days,
        cost_saved=float(cost_saved),
        exceptions_this_week=exceptions_this_week,
    )


@router.get("/cycle-time", response_model=list[CycleTimePointOut])
async def get_cycle_time_trend(db: AsyncSession = Depends(get_db)) -> list[CycleTimePointOut]:
    """Average cycle time (issued_date -> today) for matched/paid POs,
    bucketed by ISO week of issue date, most recent 8 weeks."""
    result = await db.execute(
        select(
            func.to_char(PurchaseOrder.issued_date, "IYYY-IW").label("week"),
            func.avg(func.current_date() - PurchaseOrder.issued_date).label("avg_days"),
        )
        .where(PurchaseOrder.status.in_(["matched", "paid"]))
        .group_by("week")
        .order_by("week")
        .limit(8)
    )
    return [CycleTimePointOut(week=row.week, avg_days=round(float(row.avg_days), 1)) for row in result]


@router.get("/supplier-performance", response_model=list[SupplierPerformanceOut])
async def get_supplier_performance(db: AsyncSession = Depends(get_db)) -> list[SupplierPerformanceOut]:
    result = await db.execute(
        select(
            Supplier.name,
            func.count(PurchaseOrder.id).label("orders"),
            func.sum(case((PurchaseOrder.status != "escalated", 1), else_=0)).label("on_time_count"),
        )
        .join(PurchaseOrder, PurchaseOrder.supplier_id == Supplier.id)
        .group_by(Supplier.id, Supplier.name)
        .order_by(func.count(PurchaseOrder.id).desc())
    )
    rows = result.all()
    return [
        SupplierPerformanceOut(
            name=row.name,
            orders=row.orders,
            on_time_rate=round((row.on_time_count / row.orders) * 100, 1) if row.orders else 0.0,
            # No standalone quality-score table yet — avg_quality is derived
            # from Supplier.quality_score once sourcing-comparison data is
            # normalized out of the flat mock-era columns; 0 until then.
            avg_quality=0.0,
        )
        for row in rows
    ]


@router.get("/exceptions", response_model=list[ExceptionReasonOut])
async def get_exception_reasons(db: AsyncSession = Depends(get_db)) -> list[ExceptionReasonOut]:
    """Counts mismatched match_fields grouped by label, standing in for
    "reason" until match reasoning (build-order step 9) categorizes causes
    more richly than the raw field label."""
    result = await db.execute(
        select(MatchField.label, func.count(MatchField.id).label("count"))
        .where(MatchField.is_match.is_(False))
        .group_by(MatchField.label)
        .order_by(func.count(MatchField.id).desc())
    )
    return [ExceptionReasonOut(reason=row.label, count=row.count) for row in result]
