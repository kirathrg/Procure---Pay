import uuid
from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel


class ProductOut(CamelModel):
    id: uuid.UUID
    sku: str
    name: str
    category: str
    uom: str
    description: str
    reference_price: float
    status: Literal["active", "discontinued"]
    created_at: datetime


class ProductCreate(CamelModel):
    sku: str
    name: str
    category: str
    uom: str
    description: str = ""
    reference_price: float


class SupplierOut(CamelModel):
    id: uuid.UUID
    name: str
    contact_name: str
    contact_email: str
    contact_phone: str
    address_line: str
    category: str
    tax_id: str
    status: Literal["active", "preferred", "blocked"]
    created_at: datetime


class SupplierCreate(CamelModel):
    name: str
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    address_line: str = ""
    category: str = ""
    tax_id: str = ""
    status: Literal["active", "preferred", "blocked"] = "active"


class EligibleSupplierOut(CamelModel):
    """A supplier link as returned from GET /products/{id}/suppliers —
    carries the joined Supplier, not Product (that's already known from
    the URL)."""

    product_id: uuid.UUID
    supplier_id: uuid.UUID
    unit_price: float
    lead_time_days: int
    preferred: bool
    supplier: SupplierOut


class SuppliedProductOut(CamelModel):
    """A product link as returned from GET /suppliers/{id}/products —
    carries the joined Product, not Supplier."""

    product_id: uuid.UUID
    supplier_id: uuid.UUID
    unit_price: float
    lead_time_days: int
    preferred: bool
    product: ProductOut
