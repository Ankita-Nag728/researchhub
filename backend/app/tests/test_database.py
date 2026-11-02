"""The database itself must enforce the rules, not just the application code."""

from datetime import datetime, timedelta, timezone

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.database.base import Base
from app.models import (
    Application,
    Bookmark,
    PaperBookmark,
    ResearchPaper,
    ResearchProject,
    User,
    UserSession,
)
from app.tests.conftest import alembic_config


def make_user(db, email="student@example.org", **kw):
    user = User(full_name="Sample Student", email=email, password_hash="not-a-real-hash", **kw)
    db.add(user)
    db.commit()
    return user


def make_project(db, slug="sample-project", **kw):
    data = dict(
        title="Sample Project", slug=slug, short_description="s", full_description="f", research_objectives="o",
        domain="Data Science", institution="Sample Institution", supervisor="Sample Supervisor",
        eligibility="e", duration="3 months", application_deadline=datetime.now(timezone.utc) + timedelta(days=30),
    )
    data.update(kw)
    project = ResearchProject(**data)
    db.add(project)
    db.commit()
    return project


def make_paper(db, **kw):
    data = dict(title="Sample Paper", authors="A. Author", abstract="a", publication_year=2024,
                category="Data Science", external_url="https://example.org/p")
    data.update(kw)
    paper = ResearchPaper(**data)
    db.add(paper)
    db.commit()
    return paper


# ---------- migrations ----------

def test_migrations_create_every_expected_table(engine):
    tables = set(inspect(engine).get_table_names())
    assert {
        "users", "research_projects", "research_papers", "applications", "bookmarks",
        "paper_bookmarks", "sessions", "password_reset_tokens", "alembic_version",
    } <= tables


def test_models_and_migration_are_in_sync(engine):
    """If a model changes without a new migration, this fails."""
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diff == [], f"Models differ from migrations: {diff}"


def test_migration_can_be_reversed_and_reapplied(engine):
    cfg = alembic_config()
    command.downgrade(cfg, "base")
    assert inspect(engine).get_table_names() == ["alembic_version"]
    command.upgrade(cfg, "head")
    assert "users" in inspect(engine).get_table_names()


# ---------- users ----------

def test_email_must_be_unique(db):
    make_user(db)
    with pytest.raises(IntegrityError):
        make_user(db)


def test_email_must_be_stored_lowercase(db):
    with pytest.raises(IntegrityError):
        make_user(db, email="Student@Example.org")


def test_role_must_be_valid_and_defaults_to_student(db):
    assert make_user(db).role == "student"
    db.rollback()
    with pytest.raises(IntegrityError):
        make_user(db, email="x@example.org", role="superuser")


# ---------- projects and papers ----------

def test_project_status_and_positions_are_validated(db):
    with pytest.raises(IntegrityError):
        make_project(db, status="published")
    db.rollback()
    with pytest.raises(IntegrityError):
        make_project(db, slug="neg", available_positions=-1)


def test_project_slug_must_be_unique(db):
    make_project(db)
    with pytest.raises(IntegrityError):
        make_project(db)


def test_project_defaults(db):
    p = make_project(db)
    assert p.status == "open" and p.available_positions == 1 and p.required_skills == [] and p.is_sample is False
    assert p.created_at is not None


def test_paper_doi_unique_but_many_papers_may_have_no_doi(db):
    make_paper(db, doi="10.0000/sample")
    with pytest.raises(IntegrityError):
        make_paper(db, doi="10.0000/sample")
    db.rollback()
    make_paper(db, doi=None)
    make_paper(db, doi=None)
    # one paper with a DOI + two with no DOI: PostgreSQL treats NULLs as distinct, so all three exist
    assert len(db.scalars(select(ResearchPaper)).all()) == 3


def test_paper_year_must_be_reasonable(db):
    with pytest.raises(IntegrityError):
        make_paper(db, publication_year=1)


# ---------- applications ----------

def application(user, project, **kw):
    data = dict(user_id=user.id, project_id=project.id, statement_of_interest="s",
                academic_background="a", relevant_skills="r", experience="e")
    data.update(kw)
    return Application(**data)


def test_duplicate_application_is_blocked_by_the_database(db):
    u, p = make_user(db), make_project(db)
    db.add(application(u, p))
    db.commit()
    db.add(application(u, p))
    with pytest.raises(IntegrityError) as exc:
        db.commit()
    assert "one_application_per_project" in str(exc.value)


def test_same_user_can_apply_to_different_projects_and_projects_take_many_users(db):
    u1, u2 = make_user(db), make_user(db, email="b@example.org")
    p1, p2 = make_project(db), make_project(db, slug="other")
    for u, p in [(u1, p1), (u1, p2), (u2, p1)]:
        db.add(application(u, p))
    db.commit()
    assert len(db.scalars(select(Application)).all()) == 3


def test_application_status_defaults_to_submitted_and_is_validated(db):
    u, p = make_user(db), make_project(db)
    a = application(u, p)
    db.add(a)
    db.commit()
    assert a.status == "submitted" and a.submitted_at == a.created_at
    a.status = "approved-ish"
    with pytest.raises(IntegrityError):
        db.commit()


def test_project_with_applications_cannot_be_deleted(db):
    u, p = make_user(db), make_project(db)
    db.add(application(u, p))
    db.commit()
    with pytest.raises(IntegrityError):
        db.execute(text("DELETE FROM research_projects WHERE id = :i"), {"i": p.id})
        db.commit()


def test_application_must_point_at_real_user_and_project(db):
    db.add(Application(user_id=999, project_id=999, statement_of_interest="s", academic_background="a",
                       relevant_skills="r", experience="e"))
    with pytest.raises(IntegrityError):
        db.commit()


# ---------- cascades and bookmarks ----------

def test_deleting_a_user_removes_their_private_data(db):
    u, p, paper = make_user(db), make_project(db), make_paper(db)
    db.add_all([application(u, p), Bookmark(user_id=u.id, project_id=p.id), PaperBookmark(user_id=u.id, paper_id=paper.id),
                UserSession(token_hash="a" * 64, user_id=u.id, expires_at=datetime.now(timezone.utc) + timedelta(hours=1))])
    db.commit()
    db.execute(text("DELETE FROM users WHERE id = :i"), {"i": u.id})
    db.commit()
    for table in ("applications", "bookmarks", "paper_bookmarks", "sessions"):
        assert db.execute(text(f"SELECT count(*) FROM {table}")).scalar() == 0
    assert db.execute(text("SELECT count(*) FROM research_projects")).scalar() == 1  # public content stays


def test_duplicate_bookmarks_are_blocked(db):
    u, p, paper = make_user(db), make_project(db), make_paper(db)
    db.add(Bookmark(user_id=u.id, project_id=p.id))
    db.commit()
    db.add(Bookmark(user_id=u.id, project_id=p.id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.add(PaperBookmark(user_id=u.id, paper_id=paper.id))
    db.commit()
    db.add(PaperBookmark(user_id=u.id, paper_id=paper.id))
    with pytest.raises(IntegrityError):
        db.commit()


def test_deleting_a_project_without_applications_removes_its_bookmarks(db):
    u, p = make_user(db), make_project(db)
    db.add(Bookmark(user_id=u.id, project_id=p.id))
    db.commit()
    db.execute(text("DELETE FROM research_projects WHERE id = :i"), {"i": p.id})
    db.commit()
    assert db.execute(text("SELECT count(*) FROM bookmarks")).scalar() == 0


def test_session_token_hash_is_unique(db):
    u = make_user(db)
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(UserSession(token_hash="b" * 64, user_id=u.id, expires_at=exp))
    db.commit()
    db.add(UserSession(token_hash="b" * 64, user_id=u.id, expires_at=exp))
    with pytest.raises(IntegrityError):
        db.commit()
