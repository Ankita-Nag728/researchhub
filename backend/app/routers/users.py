from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.rate_limit import limiter
from app.core.security import hash_password, hash_token, verify_password
from app.database.session import get_db
from app.dependencies.auth import SESSION_COOKIE, csrf_protect, require_user
from app.models import User, UserSession
from app.schemas.user import ChangePasswordIn, ProfileUpdateIn, UserOut

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(csrf_protect)])


@router.get("/me", response_model=UserOut)
def get_profile(user: User = Depends(require_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_profile(payload: ProfileUpdateIn, user: User = Depends(require_user), db: Session = Depends(get_db)):
    # Email and role are deliberately not editable here.
    for field, value in payload.model_dump().items():
        setattr(user, field, value)
    db.commit()
    return user


@router.patch("/me/password")
@limiter.limit("10/hour")
def change_password(request: Request, payload: ChangePasswordIn, user: User = Depends(require_user), db: Session = Depends(get_db)):
    if not verify_password(user.password_hash, payload.current_password):
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    user.password_hash = hash_password(payload.new_password)
    # Keep this browser signed in, sign out every other device.
    current = hash_token(request.cookies.get(SESSION_COOKIE, ""))
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.token_hash != current))
    db.commit()
    return {"detail": "Your password has been updated."}
