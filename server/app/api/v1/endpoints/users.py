from fastapi import APIRouter, Depends, Response

from app.core.auth import current_active_user, fastapi_users
from app.models.user import User
from app.schemas.user import UserRead, UserUpdate
from app.services.user_manager import UserManager, get_user_manager

router = APIRouter()


@router.delete("/me", status_code=204)
async def delete_current_user(
    user: User = Depends(current_active_user),
    user_manager: UserManager = Depends(get_user_manager),
):
    """Delete the current user's account permanently (GDPR Art. 17)."""
    await user_manager.delete(user)
    return Response(status_code=204)


router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
)
