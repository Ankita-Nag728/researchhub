"""Importing this package registers every table with SQLAlchemy and Alembic."""

from app.models.application import APPLICATION_STATUSES, Application
from app.models.auth import PasswordResetToken, UserSession
from app.models.bookmark import Bookmark, PaperBookmark
from app.models.paper import ResearchPaper
from app.models.project import PROJECT_STATUSES, ResearchProject
from app.models.user import ALL_ROLES, PUBLIC_ROLES, User

__all__ = [
    "ALL_ROLES",
    "APPLICATION_STATUSES",
    "PROJECT_STATUSES",
    "PUBLIC_ROLES",
    "Application",
    "Bookmark",
    "PaperBookmark",
    "PasswordResetToken",
    "ResearchPaper",
    "ResearchProject",
    "User",
    "UserSession",
]
