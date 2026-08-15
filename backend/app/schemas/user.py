import uuid

from app.schemas.common import CamelModel


class UserOut(CamelModel):
    id: uuid.UUID
    email: str
    name: str
    role: str
