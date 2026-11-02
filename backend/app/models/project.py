from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

PROJECT_STATUSES = ("open", "ongoing", "completed", "closed", "archived")


class ResearchProject(TimestampMixin, Base):
    __tablename__ = "research_projects"
    __table_args__ = (
        CheckConstraint("status IN ('open', 'ongoing', 'completed', 'closed', 'archived')", name="status_valid"),
        CheckConstraint("available_positions >= 0", name="positions_non_negative"),
        Index("ix_research_projects_status_deadline", "status", "application_deadline"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True)
    short_description: Mapped[str] = mapped_column(String(300))
    full_description: Mapped[str] = mapped_column(Text)
    research_objectives: Mapped[str] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(String(80), index=True)
    institution: Mapped[str] = mapped_column(String(160), index=True)
    supervisor: Mapped[str] = mapped_column(String(120))
    required_skills: Mapped[list[str]] = mapped_column(ARRAY(String(60)), server_default="{}")
    eligibility: Mapped[str] = mapped_column(Text)
    duration: Mapped[str] = mapped_column(String(60))
    available_positions: Mapped[int] = mapped_column(Integer, server_default="1")
    # Optional: completed or ongoing projects may have no open call.
    application_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    application_instructions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default="open", index=True)
    # True for clearly-labelled demonstration records created by the seed command.
    is_sample: Mapped[bool] = mapped_column(server_default="false")

    # RESTRICT (set on the foreign key) stops a project with applications from being hard-deleted.
    applications = relationship("Application", back_populates="project")
    bookmarks = relationship("Bookmark", back_populates="project", cascade="all, delete-orphan", passive_deletes=True)
