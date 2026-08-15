from app.schemas.common import CamelModel


class SearchResultOut(CamelModel):
    id: str
    title: str
    subtitle: str | None = None
    group: str
    path: str
