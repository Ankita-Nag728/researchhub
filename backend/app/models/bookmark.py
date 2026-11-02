from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Bookmark(Base):
    """A saved research project."""

    __tablename__ = "bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="one_bookmark_per_project"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("research_projects.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bookmarks")
    project = relationship("ResearchProject", back_populates="bookmarks")


class PaperBookmark(Base):
    """A saved research paper (an addition to the original schema, see ARCHITECTURE.md D8)."""

    __tablename__ = "paper_bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "paper_id", name="one_bookmark_per_paper"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    paper_id: Mapped[int] = mapped_column(ForeignKey("research_papers.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="paper_bookmarks")
    paper = relationship("ResearchPaper", back_populates="bookmarks")
