from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser, get_current_user
from app.database import get_db
from app.schemas.user import UserOut
from app.services.users import get_or_create_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserOut:
    """The authenticated user's real profile role — needed by the frontend
    to decide where to redirect after login (e.g. a Warehouse Employee goes
    to /employee, a Manager to /manager, everyone else to the main app).
    Supabase's own session/JWT has no concept of this app-specific role."""
    user = await get_or_create_user(db, current_user)
    return UserOut.model_validate(user)
