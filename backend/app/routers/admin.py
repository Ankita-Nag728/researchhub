from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import delete, desc, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database.session import get_db
from app.dependencies.auth import csrf_protect, require_admin
from app.models import Application, ResearchPaper, ResearchProject, User, UserSession
from app.schemas.common import InputModel, PathId, like_pattern, make_page
from app.schemas.content import ApplicationStatus, StatusUpdateIn, application_out
from app.schemas.user import AdminUserOut

# Every route in this file requires an administrator (checked on the server, per request).
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(csrf_protect), Depends(require_admin)])


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    return {
        "users": count(User),
        "projects": count(ResearchProject, ResearchProject.status != "archived"),
        "papers": count(ResearchPaper),
        "applications": count(Application),
        "pending_applications": count(Application, Application.status.in_(["submitted", "under_review"])),
    }


@router.get("/applications")
def list_applications(
    status: ApplicationStatus | None = None,
    project_id: Annotated[int, Field(ge=1, le=2_147_483_647)] | None = None,
    q: str | None = Query(None, max_length=120),
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(Application).join(Application.user).join(Application.project)
    if status:
        stmt = stmt.where(Application.status == status)
    if project_id:
        stmt = stmt.where(Application.project_id == project_id)
    if q and q.strip():
        p = like_pattern(q.strip())
        stmt = stmt.where(or_(User.full_name.ilike(p, escape="\\"), User.email.ilike(p, escape="\\"), ResearchProject.title.ilike(p, escape="\\")))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.options(joinedload(Application.user), joinedload(Application.project))
        .order_by(desc(Application.created_at)).limit(page_size).offset((page - 1) * page_size)
    ).all()
    return make_page([application_out(a, include_applicant=True) for a in rows], total, page, page_size)


@router.patch("/applications/{application_id}/status")
def update_application_status(application_id: PathId, payload: StatusUpdateIn, db: Session = Depends(get_db)):
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="We could not find that application.")
    application.status = payload.status
    db.commit()
    return application_out(application, include_applicant=True)


class UserStatusIn(InputModel):
    is_active: bool


@router.get("/users")
def list_users(
    q: str | None = Query(None, max_length=120),
    role: Literal["student", "researcher", "admin"] | None = None,
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = select(User)
    if q and q.strip():
        p = like_pattern(q.strip())
        stmt = stmt.where(or_(User.full_name.ilike(p, escape="\\"), User.email.ilike(p, escape="\\"), User.university.ilike(p, escape="\\")))
    if role:
        stmt = stmt.where(User.role == role)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(desc(User.created_at)).limit(page_size).offset((page - 1) * page_size)).all()
    return make_page([AdminUserOut.model_validate(u) for u in rows], total, page, page_size)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def set_user_active(user_id: PathId, payload: UserStatusIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Suspend or restore an account. Roles can never be changed through the API."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="We could not find that user.")
    if user.id == admin.id or user.role == "admin":
        raise HTTPException(status_code=400, detail="Administrator accounts cannot be suspended here.")
    user.is_active = payload.is_active
    if not payload.is_active:
        db.execute(delete(UserSession).where(UserSession.user_id == user.id))  # sign them out immediately
    db.commit()
    return user
