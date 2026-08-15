from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import CreatedAtMixin, UUIDPk


class Anomaly(Base, UUIDPk, CreatedAtMixin):
    __tablename__ = "anomalies"

    type: Mapped[str] = mapped_column(String)  # duplicate-invoice | price-jump | split-po
    title: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(String)
    severity: Mapped[str] = mapped_column(String)  # low | medium | high
    data_points: Mapped[list[str]] = mapped_column(JSON, default=list)
