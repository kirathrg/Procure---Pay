from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import Anomaly
from app.schemas.anomaly import AnomalyOut
from app.services.anomaly_detection import detect_duplicate_invoices, detect_price_jumps, detect_split_pos
from app.services.gemini import get_gemini_service

router = APIRouter(prefix="/anomalies", tags=["anomalies"])

_TITLES = {
    "duplicate-invoice": "Possible duplicate invoice",
    "price-jump": "Unusual unit price increase",
    "split-po": "Potential split-PO pattern",
}


@router.get("", response_model=list[AnomalyOut])
async def list_anomalies(db: AsyncSession = Depends(get_db)) -> list[AnomalyOut]:
    result = await db.execute(select(Anomaly).order_by(Anomaly.created_at.desc()))
    return [AnomalyOut.from_model(a) for a in result.scalars().all()]


@router.post("/detect", response_model=list[AnomalyOut])
async def run_detection(
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> list[AnomalyOut]:
    """Runs all three rule-based detectors and persists any newly-found
    anomalies (each detector's thresholds are deterministic — see
    services/anomaly_detection.py). Gemini is called once per finding, only
    to phrase the `detail` narrative text."""
    detected = [
        *await detect_duplicate_invoices(db),
        *await detect_price_jumps(db),
        *await detect_split_pos(db),
    ]

    # Detection is idempotent: re-running it must not pile up identical rows.
    # A finding's identity is its type plus its data points (the deterministic
    # evidence), so anything already stored under that key is skipped — which
    # also avoids paying for a Gemini call to re-narrate a known finding.
    existing = (await db.execute(select(Anomaly.type, Anomaly.data_points))).all()
    seen = {(t, tuple(dp or [])) for t, dp in existing}

    gemini = get_gemini_service()
    created: list[Anomaly] = []
    for finding in detected:
        key = (finding.type, tuple(finding.data_points))
        if key in seen:
            continue
        seen.add(key)
        detail = await gemini.generate_anomaly_detail(finding.type, finding.data_points)
        anomaly = Anomaly(
            type=finding.type,
            title=_TITLES[finding.type],
            detail=detail,
            severity=finding.severity,
            data_points=finding.data_points,
        )
        db.add(anomaly)
        created.append(anomaly)

    await db.commit()
    for a in created:
        await db.refresh(a)
    return [AnomalyOut.from_model(a) for a in created]
