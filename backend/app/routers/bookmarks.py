from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database.session import get_db
from app.dependencies.auth import csrf_protect, require_user
from app.models import Bookmark, PaperBookmark, ResearchPaper, ResearchProject, User
from app.schemas.common import PathId
from app.schemas.content import BookmarkIn, BookmarksOut, PaperBookmarkOut, PaperOut, ProjectBookmarkOut, ProjectOut

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"], dependencies=[Depends(csrf_protect)])


@router.get("", response_model=BookmarksOut)
def list_bookmarks(user: User = Depends(require_user), db: Session = Depends(get_db)):
    projects = db.scalars(
        select(Bookmark).where(Bookmark.user_id == user.id).options(joinedload(Bookmark.project)).order_by(desc(Bookmark.created_at))
    ).all()
    papers = db.scalars(
        select(PaperBookmark).where(PaperBookmark.user_id == user.id).options(joinedload(PaperBookmark.paper)).order_by(desc(PaperBookmark.created_at))
    ).all()
    return BookmarksOut(
        projects=[ProjectBookmarkOut(bookmark_id=b.id, created_at=b.created_at, project=ProjectOut.model_validate(b.project))
                  for b in projects if b.project.status != "archived"],
        papers=[PaperBookmarkOut(bookmark_id=b.id, created_at=b.created_at, paper=PaperOut.model_validate(b.paper)) for b in papers],
    )


@router.post("", status_code=201)
def add_bookmark(payload: BookmarkIn, user: User = Depends(require_user), db: Session = Depends(get_db)):
    if payload.project_id is not None:
        project = db.get(ResearchProject, payload.project_id)
        if project is None or project.status == "archived":
            raise HTTPException(status_code=404, detail="We could not find that project.")
        bookmark = Bookmark(user_id=user.id, project_id=project.id)
        kind = "project"
    else:
        if db.get(ResearchPaper, payload.paper_id) is None:
            raise HTTPException(status_code=404, detail="We could not find that paper.")
        bookmark = PaperBookmark(user_id=user.id, paper_id=payload.paper_id)
        kind = "paper"
    db.add(bookmark)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You have already saved this.")
    return {"bookmark_id": bookmark.id, "kind": kind}


@router.delete("/{bookmark_id}", status_code=204)
def remove_bookmark(
    bookmark_id: PathId,
    kind: Literal["project", "paper"] = Query("project", description="Projects and papers have separate bookmark ids."),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    model = Bookmark if kind == "project" else PaperBookmark
    bookmark = db.get(model, bookmark_id)
    # Only the owner can delete; anyone else gets the same 404 as a missing bookmark.
    if bookmark is None or bookmark.user_id != user.id:
        raise HTTPException(status_code=404, detail="We could not find that saved item.")
    db.delete(bookmark)
    db.commit()
