import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import ProductSupplier, Supplier
from app.schemas.product import SuppliedProductOut, SupplierCreate, SupplierOut

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("", response_model=list[SupplierOut])
async def list_suppliers(db: AsyncSession = Depends(get_db)) -> list[Supplier]:
    result = await db.execute(select(Supplier).order_by(Supplier.name))
    return list(result.scalars().all())


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> Supplier:
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.get("/{supplier_id}/products", response_model=list[SuppliedProductOut])
async def list_supplier_products(
    supplier_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[ProductSupplier]:
    supplier_exists = await db.get(Supplier, supplier_id)
    if supplier_exists is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")

    result = await db.execute(
        select(ProductSupplier)
        .where(ProductSupplier.supplier_id == supplier_id)
        .options(selectinload(ProductSupplier.product))
        .order_by(ProductSupplier.unit_price)
    )
    return list(result.scalars().all())
