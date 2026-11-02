from sqlalchemy import Boolean, CheckConstraint, String, Text, true
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

# "admin" can only be created from the command line, never through public registration.
PUBLIC_ROLES = ("student", "researcher")
ALL_ROLES = PUBLIC_ROLES + ("admin",)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('student', 'researcher', 'admin')", name="role_valid"),
        # Emails are always stored lowercase so uniqueness is case-insensitive.
        CheckConstraint("email = lower(email)", name="email_lowercase"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))  # Argon2id hash, never the password
    university: Mapped[str | None] = mapped_column(String(160))
    department: Mapped[str | None] = mapped_column(String(160))
    academic_year: Mapped[str | None] = mapped_column(String(40))
    bio: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), server_default="{}")
    github_url: Mapped[str | None] = mapped_column(String(300))
    linkedin_url: Mapped[str | None] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(20), server_default="student")
    # Lets admins suspend an account without deleting its history.
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())

    applications = relationship("Application", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    paper_bookmarks = relationship("PaperBookmark", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
