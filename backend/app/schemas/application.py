from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import LongText, ORMModel, OptionalUrl
from app.schemas.project import ProjectSummary
from app.schemas.user import UserOut

AppStatus = Literal["submitted", "under_review", "shortlisted", "accepted", "rejected"]


class ApplicationIn(BaseModel):
    project_id: int
    statement_of_interest: LongText
    relevant_skills: LongText
    academic_background: LongText
    experience: LongText
    portfolio_url: OptionalUrl = None


class ApplicationOut(ORMModel):
    id: int
    project_id: int
    statement_of_interest: str
    academic_background: str
    relevant_skills: str
    experience: str
    portfolio_url: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    project: ProjectSummary


class AdminApplicationOut(ApplicationOut):
    user: UserOut


class StatusUpdate(BaseModel):
    status: AppStatus
