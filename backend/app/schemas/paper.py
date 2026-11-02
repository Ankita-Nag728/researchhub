from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import HttpUrl, LongText, ORMModel, text


class PaperOut(ORMModel):
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


class PaperIn(BaseModel):
    title: text(3, 300)
    authors: text(2, 2000)
    abstract: LongText
    publication_year: int = Field(ge=1800, le=2200)
    category: text(2, 80)
    journal: text(1, 200) | None = None
    doi: text(5, 120) | None = None
    external_url: HttpUrl


class PaperFilters(BaseModel):
    categories: list[str]
    years: list[int]
