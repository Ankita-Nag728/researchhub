import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.core.security import DUMMY_HASH, hash_password, hash_token, needs_rehash, new_token, verify_password
from app.database.session import get_db
from app.dependencies.auth import CSRF_COOKIE, SESSION_COOKIE, csrf_protect, require_user
from app.models import PasswordResetToken, User, UserSession
from app.schemas.user import ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn, UserOut
from app.services.email import send_password_reset

router = APIRouter(prefix="/api/auth", tags=["auth"], dependencies=[Depends(csrf_protect)])
logger = logging.getLogger(__name__)

RESET_MINUTES = 30
INVALID_LOGIN = "Invalid email or password."


def _set_cookie(response: Response, name: str, value: str, max_age: int, http_only: bool) -> None:
    settings = get_settings()
    response.set_cookie(
        name, value, max_age=max_age, httponly=http_only,
        secure=settings.cookie_secure, samesite=settings.cookie_samesite, path="/",
    )


def _start_session(response: Response, db: Session, user: User, remember: bool) -> None:
    settings = get_settings()
    hours = settings.session_hours_remembered if remember else settings.session_hours
    token = new_token()
    now = datetime.now(timezone.utc)
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at < now))  # tidy up
    db.add(UserSession(token_hash=hash_token(token), user_id=user.id, expires_at=now + timedelta(hours=hours)))
    db.commit()
    # Session cookie: HttpOnly, so page scripts (and therefore XSS) can never read it.
    _set_cookie(response, SESSION_COOKIE, token, hours * 3600, http_only=True)
    # CSRF cookie: must be readable by our frontend, which copies it into a header.
    _set_cookie(response, CSRF_COOKIE, new_token(), hours * 3600, http_only=False)


@router.get("/csrf", status_code=204)
def issue_csrf_token() -> Response:
    """Gives anonymous visitors a CSRF token before they log in or register."""
    response = Response(status_code=204)
    _set_cookie(response, CSRF_COOKIE, new_token(), 8 * 3600, http_only=False)
    return response


@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit("20/hour")
def register(request: Request, payload: RegisterIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists. Try logging in instead.")
    user = User(
        full_name=payload.full_name, email=email, password_hash=hash_password(payload.password),
        university=payload.university, department=payload.department, academic_year=payload.academic_year,
        role=payload.role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two simultaneous sign-ups with the same email
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists. Try logging in instead.")
    _start_session(response, db, user, remember=False)
    return user


@router.post("/login", response_model=UserOut)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    # Always run a password check, so response time does not reveal whether the email exists.
    valid = verify_password(user.password_hash if user else DUMMY_HASH, payload.password)
    if not user or not valid or not user.is_active:
        raise HTTPException(status_code=401, detail=INVALID_LOGIN)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    _start_session(response, db, user, remember=payload.remember_me)
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, db: Session = Depends(get_db)) -> Response:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
        db.commit()
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)):
    return user


@router.post("/forgot-password")
@limiter.limit("5/hour")
def forgot_password(request: Request, payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    """Always answers the same way, so this cannot be used to discover which emails have accounts."""
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user and user.is_active:
        token = new_token()
        db.add(PasswordResetToken(
            token_hash=hash_token(token), user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_MINUTES),
        ))
        db.commit()
        send_password_reset(user.email, f"{get_settings().public_app_url}/reset-password?token={token}")
    return {"detail": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit("10/hour")
def reset_password(request: Request, payload: ResetPasswordIn, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    record = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_token(payload.token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )
    if record is None:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")
    user = db.get(User, record.user_id)
    user.password_hash = hash_password(payload.new_password)
    record.used_at = now  # single use
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))  # sign out everywhere
    db.commit()
    return {"detail": "Your password has been updated. You can now log in."}
