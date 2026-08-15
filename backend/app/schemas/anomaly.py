import uuid
from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel


class AnomalyOut(CamelModel):
    id: uuid.UUID
    type: Literal["duplicate-invoice", "price-jump", "split-po"]
    title: str
    detail: str
    severity: Literal["low", "medium", "high"]
    data_points: list[str]
    timestamp: datetime

    @classmethod
    def from_model(cls, anomaly) -> "AnomalyOut":
        return cls(
            id=anomaly.id,
            type=anomaly.type,
            title=anomaly.title,
            detail=anomaly.detail,
            severity=anomaly.severity,
            data_points=anomaly.data_points,
            timestamp=anomaly.created_at,
        )
