from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from groq import APIConnectionError, APIStatusError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, get_current_user
from app.config import get_settings
from app.database import get_db
from app.routers import (
    analytics,
    anomalies,
    dev_tools,
    invoicing,
    manager,
    matching,
    products,
    purchase_orders,
    purchase_requisitions,
    receiving,
    requisition,
    search,
    suppliers,
    users,
)
settings = get_settings()

app = FastAPI(title="P2P API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(suppliers.router)
app.include_router(purchase_orders.router)
app.include_router(analytics.router)
app.include_router(requisition.router)
app.include_router(receiving.router)
app.include_router(invoicing.router)
app.include_router(matching.router)
app.include_router(anomalies.router)
app.include_router(search.router)
app.include_router(dev_tools.router)
app.include_router(manager.router)
app.include_router(purchase_requisitions.router)
app.include_router(users.router)


@app.exception_handler(APIConnectionError)
async def llm_unreachable(_request: Request, _exc: APIConnectionError) -> JSONResponse:
    # Groq's API is unreachable (network issue, DNS, etc). Routes that need
    # to avoid persisting a half-completed action (see requisition.py) catch
    # this themselves first; this is the fallback for every other
    # Gemini-service call site (matching, anomalies, sourcing) so none of
    # them can 500 instead of failing cleanly.
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "The AI assistant is temporarily unavailable. Please try again."},
    )


@app.exception_handler(APIStatusError)
async def llm_error(_request: Request, _exc: APIStatusError) -> JSONResponse:
    # Covers Groq API-level failures, including rate limiting (429) on the
    # free tier — surfaced the same way as any other AI-unavailable case
    # rather than a raw 500.
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "The AI assistant is temporarily unavailable. Please try again."},
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    result = await db.execute(text("select version()"))
    return {"status": "ok", "postgres_version": result.scalar()}


@app.get("/health/auth")
async def health_auth(user: CurrentUser = Depends(get_current_user)) -> dict[str, str]:
    return {"status": "ok", "user_id": str(user.id), "email": user.email or ""}
