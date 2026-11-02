"""Shared test setup. Tests run against a REAL PostgreSQL database (never the dev one)."""

import os

# Must be set before the app is imported, because settings are read at import time.
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://researchhub:dev_only_change_me@localhost:5432/researchhub_test",
)
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["SECRET_KEY"] = "test-only-secret-not-used-in-production"
os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.database.base import Base  # noqa: E402
from app.main import create_app  # noqa: E402

assert "test" in TEST_DB_URL.rsplit("/", 1)[-1], "Refusing to run tests against a database not named *test*"


def alembic_config() -> Config:
    cfg = Config("alembic.ini")
    cfg.attributes["database_url"] = TEST_DB_URL
    return cfg


@pytest.fixture(scope="session")
def engine():
    engine = create_engine(TEST_DB_URL)
    # Build the schema with the real migrations, so migrations are exercised by every test run.
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    command.upgrade(alembic_config(), "head")
    yield engine
    engine.dispose()


@pytest.fixture()
def db(engine):
    """A database session; every table is emptied after each test."""
    with Session(engine, expire_on_commit=False) as session:
        yield session
        session.rollback()
    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture()
def app(engine):
    get_settings.cache_clear()
    return create_app()




# ---------------------------------------------------------------------------
# Helpers for API tests (auth, content, security)
# ---------------------------------------------------------------------------
from datetime import datetime, timedelta, timezone  # noqa: E402

from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import ResearchPaper, ResearchProject, User  # noqa: E402

PASSWORD = "CorrectHorse9!"
_PASSWORD_HASH = hash_password(PASSWORD)  # hashed once; Argon2 is deliberately slow


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    limiter.reset()
    yield


class CsrfClient(TestClient):
    """Behaves like our frontend: fetches a CSRF token if it has none, and sends it on writes."""

    def request(self, method, url, **kwargs):
        # Tests opt out by sending the marker header "X-No-CSRF" (it is removed before the request goes out).
        headers = dict(kwargs.get("headers") or {})
        skip = headers.pop("X-No-CSRF", None) is not None
        kwargs["headers"] = headers
        if method.upper() not in ("GET", "HEAD", "OPTIONS") and not skip:
            if not self.cookies.get("csrf_token"):
                super().request("GET", "/api/auth/csrf")
            headers.setdefault("X-CSRF-Token", self.cookies.get("csrf_token") or "")
        return super().request(method, url, **kwargs)


@pytest.fixture()
def client(app):
    return CsrfClient(app, raise_server_exceptions=False)


def add_user(db, email, role="student", **extra) -> User:
    user = User(full_name=extra.pop("full_name", "Sample User"), email=email, password_hash=_PASSWORD_HASH, role=role,
                university="Sample University", department="Sample Dept", academic_year="3", **extra)
    db.add(user)
    db.commit()
    return user


def login_as(app, email) -> CsrfClient:
    c = CsrfClient(app, raise_server_exceptions=False)
    r = c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return c


@pytest.fixture()
def student(db):
    return add_user(db, "student@example.org")


@pytest.fixture()
def student_client(app, student):
    return login_as(app, student.email)


@pytest.fixture()
def other_client(app, db):
    add_user(db, "other@example.org")
    return login_as(app, "other@example.org")


@pytest.fixture()
def admin_client(app, db):
    add_user(db, "admin@example.org", role="admin")
    return login_as(app, "admin@example.org")


def project_payload(**kw) -> dict:
    data = dict(
        title="Sample Project About Graph Learning", short_description="A short sample description.",
        full_description="A full sample description that is long enough to pass validation.",
        research_objectives="Sample objectives for the project.", domain="Machine Learning",
        institution="Sample Institution", supervisor="Sample Supervisor", required_skills=["Python", "Statistics"],
        eligibility="Open to enrolled students.", duration="3 months", available_positions=2,
        application_deadline=(datetime.now(timezone.utc) + timedelta(days=30)).isoformat(), status="open",
    )
    data.update(kw)
    return data


def paper_payload(**kw) -> dict:
    data = dict(title="A Sample Paper Title", authors="A. Author, B. Author", abstract="A sample abstract long enough to pass.",
                publication_year=2023, category="Data Science", journal="Sample Journal", doi="10.1234/sample.1",
                external_url="https://example.org/paper")
    data.update(kw)
    return data


def add_project(db, **kw) -> ResearchProject:
    data = project_payload(**kw)
    data["application_deadline"] = datetime.fromisoformat(data["application_deadline"]) if data["application_deadline"] else None
    slug = data["title"].lower().replace(" ", "-")[:60] + f"-{db.query(ResearchProject).count()}"
    project = ResearchProject(slug=slug, **data)
    db.add(project)
    db.commit()
    return project


def add_paper(db, **kw) -> ResearchPaper:
    paper = ResearchPaper(**paper_payload(**kw))
    db.add(paper)
    db.commit()
    return paper


def application_payload(project_id, **kw) -> dict:
    data = dict(project_id=project_id, statement_of_interest="I am keen to work on this because it matches my studies closely.",
                academic_background="Third-year computer science student.", relevant_skills="Python, statistics",
                experience="One course project using graphs.", portfolio_url="https://github.com/example")
    data.update(kw)
    return data
