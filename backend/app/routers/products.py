import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.models import Product, ProductSupplier
from app.schemas.product import EligibleSupplierOut, ProductCreate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db)) -> list[Product]:
    result = await db.execute(select(Product).order_by(Product.name))
    return list(result.scalars().all())


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> Product:
    product = Product(**payload.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{product_id}/suppliers", response_model=list[EligibleSupplierOut])
async def list_product_suppliers(
    product_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[ProductSupplier]:
    product_exists = await db.get(Product, product_id)
    if product_exists is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    result = await db.execute(
        select(ProductSupplier)
        .where(ProductSupplier.product_id == product_id)
        .options(selectinload(ProductSupplier.supplier))
        .order_by(ProductSupplier.unit_price)
    )
    return list(result.scalars().all())
