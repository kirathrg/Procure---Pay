from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import UUIDPk


class Buyer(Base, UUIDPk):
    __tablename__ = "buyers"

    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)
    department: Mapped[str] = mapped_column(String)
