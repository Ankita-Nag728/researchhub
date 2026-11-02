from datetime import datetime

from pydantic import BaseModel, model_validator

from app.schemas.common import ORMModel
from app.schemas.paper import PaperOut
from app.schemas.project import ProjectSummary


class BookmarkIn(BaseModel):
    project_id: int | None = None
    paper_id: int | None = None

    @model_validator(mode="after")
    def exactly_one(self):
        if (self.project_id is None) == (self.paper_id is None):
            raise ValueError("Provide either project_id or paper_id.")
        return self


class ProjectBookmarkOut(ORMModel):
    id: int
    created_at: datetime
    project: ProjectSummary


class PaperBookmarkOut(ORMModel):
    id: int
    created_at: datetime
    paper: PaperOut


class BookmarksOut(BaseModel):
    projects: list[ProjectBookmarkOut]
    papers: list[PaperBookmarkOut]


class BookmarkCreated(BaseModel):
    id: int
    kind: str
