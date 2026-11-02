import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.session import get_db

router = APIRouter(prefix="/api/health", tags=["health"])
logger = logging.getLogger(__name__)


@router.get("")
def liveness() -> dict:
    """Is the server process running? Does not touch the database."""
    return {"status": "ok"}


@router.get("/ready")
def readiness(db: Session = Depends(get_db)) -> dict:
    """Can the server reach the database? Hosting platforms use this to decide whether to send traffic."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.error("Readiness check failed: %s", type(exc).__name__)
        # Deliberately vague: no host names, credentials or driver messages.
        raise HTTPException(status_code=503, detail="The service is temporarily unavailable.")
    return {"status": "ready"}
