"""One consistent error format for the whole API: {"detail": <string or list>}.

The frontend already understands this shape (see services/apiClient.js).
Internal details (stack traces, SQL, table names) are logged but never returned.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

GENERIC_MESSAGES = {
    400: "The request could not be understood.",
    401: "You need to sign in to do that.",
    403: "You do not have permission to do that.",
    404: "We could not find what you were looking for.",
    405: "That action is not allowed here.",
    409: "That conflicts with existing data.",
    413: "The request is too large.",
    422: "Please check the highlighted fields.",
    429: "Too many requests. Please wait a moment and try again.",
}


def _json(status: int, detail, headers: dict | None = None) -> JSONResponse:
    return JSONResponse({"detail": detail}, status_code=status, headers=headers)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        # Our own code raises HTTPException with a safe, human-written message.
        detail = exc.detail if isinstance(exc.detail, str) and exc.detail else GENERIC_MESSAGES.get(exc.status_code, "Request failed.")
        # Starlette's built-in 404/405 use stock text like "Not Found": replace with friendly copy.
        if detail in {"Not Found", "Method Not Allowed"}:
            detail = GENERIC_MESSAGES[exc.status_code]
        return _json(exc.status_code, detail, getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        # Return only the field location and message, never the submitted value
        # (which could be a password).
        errors = [{"loc": list(e.get("loc", [])), "msg": str(e.get("msg", "Invalid value"))} for e in exc.errors()]
        return _json(422, errors)

    @app.exception_handler(OperationalError)
    async def database_unavailable(request: Request, exc: OperationalError):
        logger.error("Database unavailable on %s %s: %s", request.method, request.url.path, type(exc.orig).__name__)
        return _json(503, "The service is temporarily unavailable. Please try again shortly.", {"Retry-After": "10"})

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError):
        logger.error("Database error on %s %s: %s", request.method, request.url.path, type(exc).__name__)
        return _json(500, "Something went wrong on our side. Please try again.")

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _json(500, "Something went wrong on our side. Please try again.")
