from datetime import datetime, timedelta, timezone

from fastapi import Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import csrf_for_session, hash_token, new_token
from app.dependencies.auth import CSRF_COOKIE, SESSION_COOKIE
from app.models import User, UserSession


def start_session(db: Session, response: Response, user: User, settings: Settings, remember: bool) -> None:
    """Creates a server-side session and sets the cookies on the response."""
    db.execute(delete(UserSession).where(UserSession.expires_at <= datetime.now(timezone.utc)))  # tidy old rows
    hours = settings.session_hours_remembered if remember else settings.session_hours
    token = new_token()
    db.add(UserSession(token_hash=hash_token(token), user_id=user.id, expires_at=datetime.now(timezone.utc) + timedelta(hours=hours)))
    db.commit()

    secure = settings.cookie_secure or settings.is_production
    max_age = hours * 3600
    # The session cookie can never be read by JavaScript (HttpOnly).
    response.set_cookie(SESSION_COOKIE, token, max_age=max_age, httponly=True, secure=secure, samesite=settings.cookie_samesite, path="/")
    # The CSRF token must be readable by our own frontend so it can echo it in a header.
    response.set_cookie(
        CSRF_COOKIE, csrf_for_session(token, settings.secret_key), max_age=max_age, httponly=False, secure=secure,
        samesite=settings.cookie_samesite, path="/",
    )


def clear_cookies(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
