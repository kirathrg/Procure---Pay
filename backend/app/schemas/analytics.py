from app.schemas.common import CamelModel


class AnalyticsSummaryOut(CamelModel):
    touchless_rate: float
    avg_cycle_days: float
    cost_saved: float
    exceptions_this_week: int


class CycleTimePointOut(CamelModel):
    week: str
    avg_days: float


class SupplierPerformanceOut(CamelModel):
    name: str
    on_time_rate: float
    orders: int
    avg_quality: float


class ExceptionReasonOut(CamelModel):
    reason: str
    count: int
