from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.rate_limit import limiter
from app.database.session import get_db
from app.dependencies.auth import csrf_protect, require_user
from app.models import Application, ResearchProject, User
from app.schemas.common import PathId
from app.schemas.content import ApplicationIn, ApplicationOut, application_out

router = APIRouter(prefix="/api/applications", tags=["applications"], dependencies=[Depends(csrf_protect)])


def check_can_apply(project: ResearchProject | None) -> ResearchProject:
    """The rules for applying (all enforced here on the server)."""
    if project is None or project.status == "archived":
        raise HTTPException(status_code=404, detail="We could not find that project.")
    if project.status != "open":
        raise HTTPException(status_code=400, detail="This project is not open for applications.")
    if project.application_deadline and project.application_deadline < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="The application deadline for this project has passed.")
    return project


@router.post("", response_model=ApplicationOut, status_code=201)
def submit_application(payload: ApplicationIn, user: User = Depends(require_user), db: Session = Depends(get_db)):
    project = check_can_apply(db.get(ResearchProject, payload.project_id))
    already = db.scalar(select(Application.id).where(Application.user_id == user.id, Application.project_id == project.id))
    if already:
        raise HTTPException(status_code=409, detail="You have already applied to this project.")
    application = Application(user_id=user.id, **payload.model_dump())
    db.add(application)
    try:
        db.commit()
    except IntegrityError:  # double-click race: the database's unique constraint is the final guard
        db.rollback()
        raise HTTPException(status_code=409, detail="You have already applied to this project.")
    return application_out(application)


@router.get("/my", response_model=list[ApplicationOut])
def my_applications(user: User = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Application).where(Application.user_id == user.id)
        .options(joinedload(Application.project)).order_by(desc(Application.created_at))
    ).all()
    return [application_out(a) for a in rows]


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(application_id: PathId, user: User = Depends(require_user), db: Session = Depends(get_db)):
    application = db.get(Application, application_id)
    # Someone else's application looks exactly like one that does not exist.
    if application is None or (application.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="We could not find that application.")
    return application_out(application, include_applicant=user.role == "admin")
