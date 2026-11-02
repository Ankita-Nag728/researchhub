"""Who is making this request, and are they allowed? Every protected route uses these."""

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_token, tokens_match
from app.database.session import get_db
from app.models import User, UserSession

SESSION_COOKIE = "rh_session"
CSRF_COOKIE = "csrf_token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def csrf_protect(request: Request) -> None:
    """Blocks forged cross-site requests (double-submit cookie + Origin check).

    Browsers attach our cookies to any request, even ones started by another
    website. A forged request cannot read our csrf_token cookie, so it cannot
    copy it into the X-CSRF-Token header. We also reject a mismatching Origin.
    """
    if request.method in SAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in get_settings().cors_origins:
        raise HTTPException(status_code=403, detail="This request was blocked for security reasons.")
    cookie = request.cookies.get(CSRF_COOKIE)
    header = request.headers.get("x-csrf-token")
    if not cookie or not header or not tokens_match(cookie, header):
        raise HTTPException(status_code=403, detail="Your security token is missing or expired. Please refresh the page and try again.")


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == hash_token(token), UserSession.expires_at > datetime.now(timezone.utc)
        )
    )
    if session is None or not session.user.is_active:
        return None
    return session.user


def require_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="You need to sign in to do that.")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    # Checked on the server for every admin request; hiding links in React is only cosmetics.
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="You do not have permission to do that.")
    return user
