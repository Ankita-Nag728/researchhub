from sqlalchemy import CheckConstraint, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin


class ResearchPaper(TimestampMixin, Base):
    """Metadata only. Papers are linked to their legitimate source, never hosted here."""

    __tablename__ = "research_papers"
    __table_args__ = (CheckConstraint("publication_year BETWEEN 1800 AND 2200", name="year_reasonable"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    authors: Mapped[str] = mapped_column(Text)
    abstract: Mapped[str] = mapped_column(Text)
    publication_year: Mapped[int] = mapped_column(index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    journal: Mapped[str | None] = mapped_column(String(200))
    doi: Mapped[str | None] = mapped_column(String(120), unique=True)  # NULLs are allowed to repeat
    external_url: Mapped[str] = mapped_column(String(500))
    is_sample: Mapped[bool] = mapped_column(server_default="false")

    bookmarks = relationship("PaperBookmark", back_populates="paper", cascade="all, delete-orphan", passive_deletes=True)
