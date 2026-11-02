from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import LongText, ORMModel, SkillList, text

Status = Literal["open", "ongoing", "completed", "closed", "archived"]


class ProjectSummary(ORMModel):
    id: int
    title: str
    slug: str
    short_description: str
    domain: str
    institution: str
    supervisor: str
    application_deadline: datetime | None
    status: str
    is_sample: bool


class ProjectOut(ProjectSummary):
    full_description: str
    research_objectives: str
    required_skills: list[str]
    eligibility: str
    duration: str
    available_positions: int
    application_instructions: str | None
    created_at: datetime
    updated_at: datetime
    # Computed per request: can someone apply right now?
    is_accepting_applications: bool = False


class ProjectIn(BaseModel):
    title: text(3, 200)
    short_description: text(10, 300)
    full_description: LongText
    research_objectives: LongText
    domain: text(2, 80)
    institution: text(2, 160)
    supervisor: text(2, 120)
    required_skills: SkillList = Field(default_factory=list)
    eligibility: LongText
    duration: text(1, 60)
    available_positions: int = Field(default=1, ge=0, le=1000)
    application_deadline: datetime | None = None
    application_instructions: text(1, 3000) | None = None
    status: Status = "open"


class ProjectFilters(BaseModel):
    domains: list[str]
    institutions: list[str]
