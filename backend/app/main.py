import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import Settings, get_settings
from app.core.errors import GENERIC_MESSAGES, register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestSizeLimitMiddleware, SecurityHeadersMiddleware
from app.core.rate_limit import limiter
from app.dependencies.auth import csrf_protect
from app.routers import admin, applications, auth, bookmarks, health, papers, projects, users

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Builds the application. A function (not a module-level global) so tests can
    create apps with their own settings."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="ResearchHub API",
        version="0.1.0",
        # Interactive API docs are handy in development but hidden in production.
        docs_url=None if settings.is_production else "/api/docs",
        redoc_url=None,
        dependencies=[Depends(csrf_protect)],  # forgery protection for every state-changing route
        openapi_url=None if settings.is_production else "/api/openapi.json",
    )
    app.state.settings = settings
    app.state.limiter = limiter

    register_exception_handlers(app)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limited(_: Request, exc: RateLimitExceeded):
        return JSONResponse({"detail": GENERIC_MESSAGES[429]}, status_code=429, headers={"Retry-After": "60"})

    # Middleware: the LAST one added runs FIRST on the way in.
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware, max_bytes=settings.max_request_bytes)
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,  # explicit list only, never "*"
        allow_credentials=True,  # needed for the session cookie
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
        max_age=600,
    )

    for module in (health, auth, users, projects, papers, applications, bookmarks, admin):
        app.include_router(module.router)
    return app


# The object uvicorn serves:  uvicorn app.main:app
# (The database connection is created lazily, so importing this never needs a database.)
app = create_app()
