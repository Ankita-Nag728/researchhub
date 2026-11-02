import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc, distinct, func, nulls_last, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import csrf_protect, get_optional_user, require_admin
from app.models import ResearchProject, User
from app.schemas.common import PathId, like_pattern, make_page
from app.schemas.content import ProjectIn, ProjectOut, ProjectStatus

router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(csrf_protect)])


def slugify(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80] or "project"
    return base


def unique_slug(db: Session, title: str, exclude_id: int | None = None) -> str:
    base, slug, n = slugify(title), slugify(title), 1
    while True:
        query = select(ResearchProject.id).where(ResearchProject.slug == slug)
        if exclude_id:
            query = query.where(ResearchProject.id != exclude_id)
        if not db.scalar(query):
            return slug
        n += 1
        slug = f"{base}-{n}"


@router.get("")
def list_projects(
    q: str | None = Query(None, max_length=120),
    domain: str | None = Query(None, max_length=80),
    institution: str | None = Query(None, max_length=160),
    status: ProjectStatus | None = None,
    deadline_before: date | None = None,
    sort: Literal["newest", "oldest", "deadline"] = "newest",
    include_archived: bool = False,
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(9, ge=1, le=50),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),
):
    stmt = select(ResearchProject)
    # Archived projects are hidden from everyone except admins who ask for them.
    if not (include_archived and viewer and viewer.role == "admin"):
        stmt = stmt.where(ResearchProject.status != "archived")
    if q and q.strip():
        pattern = like_pattern(q.strip())
        stmt = stmt.where(or_(
            ResearchProject.title.ilike(pattern, escape="\\"),
            ResearchProject.short_description.ilike(pattern, escape="\\"),
            ResearchProject.full_description.ilike(pattern, escape="\\"),
            ResearchProject.domain.ilike(pattern, escape="\\"),
            func.array_to_string(ResearchProject.required_skills, " ").ilike(pattern, escape="\\"),
        ))
    if domain:
        stmt = stmt.where(ResearchProject.domain == domain)
    if institution:
        stmt = stmt.where(ResearchProject.institution == institution)
    if status:
        stmt = stmt.where(ResearchProject.status == status)
    if deadline_before:
        end_of_day = datetime.combine(deadline_before + timedelta(days=1), time.min, tzinfo=timezone.utc)
        stmt = stmt.where(ResearchProject.application_deadline < end_of_day)

    order = {
        "newest": [desc(ResearchProject.created_at), desc(ResearchProject.id)],
        "oldest": [asc(ResearchProject.created_at), asc(ResearchProject.id)],
        "deadline": [nulls_last(asc(ResearchProject.application_deadline)), asc(ResearchProject.id)],
    }[sort]
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(*order).limit(page_size).offset((page - 1) * page_size)).all()
    return make_page([ProjectOut.model_validate(r) for r in rows], total, page, page_size)


@router.get("/filters")
def filter_options(db: Session = Depends(get_db)):
    visible = ResearchProject.status != "archived"
    return {
        "domains": db.scalars(select(distinct(ResearchProject.domain)).where(visible).order_by(ResearchProject.domain)).all(),
        "institutions": db.scalars(select(distinct(ResearchProject.institution)).where(visible).order_by(ResearchProject.institution)).all(),
    }


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: PathId, db: Session = Depends(get_db), viewer: User | None = Depends(get_optional_user)):
    project = db.get(ResearchProject, project_id)
    if project is None or (project.status == "archived" and not (viewer and viewer.role == "admin")):
        raise HTTPException(status_code=404, detail="We could not find that project.")
    return project


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    project = ResearchProject(**payload.model_dump(), slug=unique_slug(db, payload.title))
    db.add(project)
    db.commit()
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: PathId, payload: ProjectIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    project = db.get(ResearchProject, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="We could not find that project.")
    for field, value in payload.model_dump().items():
        setattr(project, field, value)
    project.slug = unique_slug(db, payload.title, exclude_id=project.id)
    db.commit()
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: PathId, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    project = db.get(ResearchProject, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="We could not find that project.")
    try:
        db.delete(project)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This project has applications, so it cannot be deleted. Archive it instead to keep the history.",
        )
