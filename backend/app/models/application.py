from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin

APPLICATION_STATUSES = ("submitted", "under_review", "shortlisted", "accepted", "rejected")


class Application(TimestampMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (
        # One application per student per project, enforced by the database itself.
        UniqueConstraint("user_id", "project_id", name="one_application_per_project"),
        CheckConstraint(
            "status IN ('submitted', 'under_review', 'shortlisted', 'accepted', 'rejected')", name="status_valid"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Deleting a user removes their applications (privacy); deleting a project is blocked while applications exist.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("research_projects.id", ondelete="RESTRICT"), index=True)
    statement_of_interest: Mapped[str] = mapped_column(Text)
    academic_background: Mapped[str] = mapped_column(Text)
    relevant_skills: Mapped[str] = mapped_column(Text)
    experience: Mapped[str] = mapped_column(Text)
    portfolio_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), server_default="submitted", index=True)

    user = relationship("User", back_populates="applications")
    project = relationship("ResearchProject", back_populates="applications")

    # The spec calls the creation time "submitted_at"; it is the same column as created_at.
    @property
    def submitted_at(self):
        return self.created_at
