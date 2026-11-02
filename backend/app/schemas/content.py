import re
from datetime import datetime
from typing import Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Annotated

from app.models import APPLICATION_STATUSES, PROJECT_STATUSES
from app.schemas.common import BodyId, InputModel, SkillList, optional_text, optional_url, required_url, text
from app.schemas.user import UserOut

ProjectStatus = Literal["open", "ongoing", "completed", "closed", "archived"]
ApplicationStatus = Literal["submitted", "under_review", "shortlisted", "accepted", "rejected"]
assert set(ProjectStatus.__args__) == set(PROJECT_STATUSES) and set(ApplicationStatus.__args__) == set(APPLICATION_STATUSES)


# ---------- projects ----------

class ProjectIn(InputModel):
    title: text(5, 200)
    short_description: text(10, 300)
    full_description: text(20, 8000)
    research_objectives: text(10, 4000)
    domain: text(2, 80)
    institution: text(2, 160)
    supervisor: text(2, 120)
    required_skills: SkillList = []
    eligibility: text(5, 3000)
    duration: text(1, 60)
    available_positions: Annotated[int, Field(ge=0, le=500)] = 1
    application_deadline: datetime | None = None
    application_instructions: optional_text(3000) = None
    status: ProjectStatus = "open"
    is_sample: bool = False

    @field_validator("application_deadline")
    @classmethod
    def _needs_timezone(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("Include a timezone, e.g. 2027-03-31T23:59:00Z")
        return value


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    short_description: str
    full_description: str
    research_objectives: str
    domain: str
    institution: str
    supervisor: str
    required_skills: list[str]
    eligibility: str
    duration: str
    available_positions: int
    application_deadline: datetime | None
    application_instructions: str | None
    status: str
    is_sample: bool
    created_at: datetime
    updated_at: datetime


# ---------- papers ----------

_DOI = re.compile(r"^10\.\d{4,9}/\S+$")


def _doi(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if not _DOI.match(value) or len(value) > 120:
        raise ValueError("Enter a DOI like 10.1000/example")
    return value


class PaperIn(InputModel):
    title: text(3, 300)
    authors: text(2, 2000)
    abstract: text(10, 6000)
    publication_year: Annotated[int, Field(ge=1800, le=2200)]
    category: text(2, 80)
    journal: optional_text(200) = None
    doi: Annotated[str | None, AfterValidator(_doi)] = None
    external_url: required_url(500)
    is_sample: bool = False


class PaperOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    authors: str
    abstract: str
    publication_year: int
    category: str
    journal: str | None
    doi: str | None
    external_url: str
    is_sample: bool
    created_at: datetime


# ---------- applications ----------

class ApplicationIn(InputModel):
    project_id: BodyId
    statement_of_interest: text(30, 3000)
    academic_background: text(10, 2000)
    relevant_skills: text(3, 1000)
    experience: text(3, 2000)
    portfolio_url: optional_url(500) = None


class StatusUpdateIn(InputModel):
    status: ApplicationStatus


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    project_title: str
    project_institution: str
    statement_of_interest: str
    academic_background: str
    relevant_skills: str
    experience: str
    portfolio_url: str | None
    status: str
    submitted_at: datetime
    updated_at: datetime
    applicant: UserOut | None = None  # only filled in for administrators


def application_out(application, include_applicant: bool = False) -> ApplicationOut:
    return ApplicationOut(
        id=application.id, project_id=application.project_id,
        project_title=application.project.title, project_institution=application.project.institution,
        statement_of_interest=application.statement_of_interest, academic_background=application.academic_background,
        relevant_skills=application.relevant_skills, experience=application.experience,
        portfolio_url=application.portfolio_url, status=application.status,
        submitted_at=application.created_at, updated_at=application.updated_at,
        applicant=UserOut.model_validate(application.user) if include_applicant else None,
    )


# ---------- bookmarks ----------

class BookmarkIn(InputModel):
    project_id: BodyId | None = None
    paper_id: BodyId | None = None

    @model_validator(mode="after")
    def _exactly_one(self):
        if (self.project_id is None) == (self.paper_id is None):
            raise ValueError("Provide either project_id or paper_id.")
        return self


class ProjectBookmarkOut(BaseModel):
    bookmark_id: int
    created_at: datetime
    project: ProjectOut


class PaperBookmarkOut(BaseModel):
    bookmark_id: int
    created_at: datetime
    paper: PaperOut


class BookmarksOut(BaseModel):
    projects: list[ProjectBookmarkOut]
    papers: list[PaperBookmarkOut]
