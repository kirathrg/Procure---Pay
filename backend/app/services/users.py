from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.models import User


async def get_or_create_user(db: AsyncSession, current_user: CurrentUser) -> User:
    """Ensures a `users` profile row exists for the authenticated Supabase
    user, creating one on first sight. auth.get_current_user only verifies
    the JWT — it never touches the database — so any endpoint that needs a
    real FK into `users` (e.g. requisition_sessions.user_id,
    purchase_orders.created_by) must call this first."""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    name = current_user.email.split("@")[0] if current_user.email else "User"
    user = User(id=current_user.id, email=current_user.email or "", name=name)
    db.add(user)
    await db.flush()
    return user
