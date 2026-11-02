from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc, distinct, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import csrf_protect, require_admin
from app.models import ResearchPaper, User
from app.schemas.common import PathId, like_pattern, make_page
from app.schemas.content import PaperIn, PaperOut

router = APIRouter(prefix="/api/papers", tags=["papers"], dependencies=[Depends(csrf_protect)])
NOT_FOUND = "We could not find that paper."
DUPLICATE_DOI = "A paper with this DOI already exists."


@router.get("")
def list_papers(
    q: str | None = Query(None, max_length=120),
    category: str | None = Query(None, max_length=80),
    year: int | None = Query(None, ge=1800, le=2200),
    sort: Literal["newest", "oldest", "title"] = "newest",
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(9, ge=1, le=50),
    db: Session = Depends(get_db),
):
    stmt = select(ResearchPaper)
    if q and q.strip():
        pattern = like_pattern(q.strip())
        stmt = stmt.where(or_(
            ResearchPaper.title.ilike(pattern, escape="\\"),
            ResearchPaper.authors.ilike(pattern, escape="\\"),
            ResearchPaper.abstract.ilike(pattern, escape="\\"),
        ))
    if category:
        stmt = stmt.where(ResearchPaper.category == category)
    if year:
        stmt = stmt.where(ResearchPaper.publication_year == year)
    order = {
        "newest": [desc(ResearchPaper.publication_year), desc(ResearchPaper.id)],
        "oldest": [asc(ResearchPaper.publication_year), asc(ResearchPaper.id)],
        "title": [asc(func.lower(ResearchPaper.title))],
    }[sort]
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(*order).limit(page_size).offset((page - 1) * page_size)).all()
    return make_page([PaperOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/filters")
def filter_options(db: Session = Depends(get_db)):
    return {
        "categories": db.scalars(select(distinct(ResearchPaper.category)).order_by(ResearchPaper.category)).all(),
        "years": db.scalars(select(distinct(ResearchPaper.publication_year)).order_by(desc(ResearchPaper.publication_year))).all(),
    }


@router.get("/{paper_id}", response_model=PaperOut)
def get_paper(paper_id: PathId, db: Session = Depends(get_db)):
    paper = db.get(ResearchPaper, paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return paper


@router.post("", response_model=PaperOut, status_code=201)
def create_paper(payload: PaperIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    paper = ResearchPaper(**payload.model_dump())
    db.add(paper)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_DOI)
    return paper


@router.put("/{paper_id}", response_model=PaperOut)
def update_paper(paper_id: PathId, payload: PaperIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    paper = db.get(ResearchPaper, paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    for field, value in payload.model_dump().items():
        setattr(paper, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_DOI)
    return paper


@router.delete("/{paper_id}", status_code=204)
def delete_paper(paper_id: PathId, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    paper = db.get(ResearchPaper, paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    db.delete(paper)
    db.commit()
