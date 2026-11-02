"""Cross-cutting security checks: CSRF, Origin, authentication on every protected route, seed data."""

import pytest
from sqlalchemy import select

from app.models import ResearchPaper, ResearchProject
from app.services.seed import seed_demo
from app.tests.conftest import CsrfClient, add_project, application_payload, project_payload


def test_writes_without_a_csrf_token_are_blocked(app, student_client, db):
    project = add_project(db)
    r = student_client.post("/api/applications", json=application_payload(project.id), headers={"X-No-CSRF": "1"})
    assert r.status_code == 403 and "security token" in r.json()["detail"]
    assert student_client.get("/api/applications/my").json() == []  # nothing was created


def test_a_wrong_csrf_token_is_blocked(student_client, db):
    project = add_project(db)
    r = student_client.post("/api/applications", json=application_payload(project.id), headers={"X-CSRF-Token": "forged", "X-No-CSRF": "1"})
    assert r.status_code == 403


def test_forged_cross_site_request_with_valid_cookies_is_blocked(student_client, db):
    """A malicious site makes the browser send our cookies, but it cannot read the token to put in the header."""
    project = add_project(db)
    r = student_client.post("/api/applications", json=application_payload(project.id), headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    ok = student_client.post("/api/applications", json=application_payload(project.id), headers={"Origin": "http://localhost:5173"})
    assert ok.status_code == 201


def test_login_logout_and_admin_writes_also_need_csrf(app, admin_client, student, db):
    assert CsrfClient(app).post("/api/auth/login", json={"email": student.email, "password": "x"}, headers={"X-No-CSRF": "1"}).status_code == 403
    assert admin_client.post("/api/projects", json=project_payload(), headers={"X-No-CSRF": "1"}).status_code == 403
    assert admin_client.post("/api/auth/logout", headers={"X-No-CSRF": "1"}).status_code == 403
    assert admin_client.get("/api/auth/me").status_code == 200  # still signed in: the forged logout failed


def _routes(app):
    """(METHOD, path) for every endpoint, read from the generated API description."""
    for path, methods in app.openapi()["paths"].items():
        for method in methods:
            yield method.upper(), path


def _fill(path):
    return path.replace("{bookmark_id}", "1").replace("{user_id}", "1").replace("{project_id}", "1") \
        .replace("{paper_id}", "1").replace("{application_id}", "1")


def test_every_non_public_route_rejects_anonymous_users(app):
    """Walks all registered routes. Anything not on the explicit public list must answer 401 to a guest."""
    public = {
        ("GET", "/api/health"), ("GET", "/api/health/ready"), ("GET", "/api/projects"), ("GET", "/api/projects/filters"),
        ("GET", "/api/projects/{project_id}"), ("GET", "/api/papers"), ("GET", "/api/papers/filters"), ("GET", "/api/papers/{paper_id}"),
        ("GET", "/api/auth/csrf"), ("POST", "/api/auth/register"), ("POST", "/api/auth/login"), ("POST", "/api/auth/logout"),
        ("POST", "/api/auth/forgot-password"), ("POST", "/api/auth/reset-password"),
    }
    guest = CsrfClient(app, raise_server_exceptions=False)
    checked = 0
    for method, path in _routes(app):
        if (method, path) in public:
            continue
        r = guest.request(method, _fill(path), json={})
        assert r.status_code == 401, f"{method} {path} answered {r.status_code} to a guest"
        checked += 1
    assert checked >= 20


def test_every_admin_route_rejects_students(app, student_client):
    checked = 0
    for method, path in _routes(app):
        if path.startswith("/api/admin"):
            assert student_client.request(method, _fill(path), json={}).status_code == 403, f"{method} {path}"
            checked += 1
    assert checked >= 5


def test_cookies_are_never_readable_by_scripts_for_the_session(student_client):
    jar = [c for c in student_client.cookies.jar if c.name == "rh_session"]
    assert jar and jar[0].has_nonstandard_attr("HttpOnly")


def test_api_responses_never_contain_password_hashes(student_client, admin_client, db):
    for client, url in ((student_client, "/api/auth/me"), (student_client, "/api/users/me"), (admin_client, "/api/admin/users")):
        text = client.get(url).text
        assert "argon2" not in text and "password" not in text.lower()


def test_oversized_json_is_rejected_before_processing(student_client, db):
    project = add_project(db)
    huge = application_payload(project.id, statement_of_interest="x" * 2_000_000)
    assert student_client.post("/api/applications", json=huge).status_code == 413


def test_malformed_json_gets_a_clean_error(student_client):
    r = student_client.post("/api/applications", content=b"{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and "Traceback" not in r.text


def test_error_responses_do_not_leak_stack_traces_or_sql(student_client):
    r = student_client.get("/api/projects/not-a-number")
    assert r.status_code == 422 and "sqlalchemy" not in r.text.lower() and "select " not in r.text.lower()
    assert student_client.get("/api/applications/99999999999999999999").status_code in (404, 422, 500)


def test_extremely_large_ids_do_not_crash_the_server(client):
    assert client.get("/api/projects/99999999999999999999").status_code in (404, 422)


# ---------- seed data ----------

def test_seed_data_is_labelled_idempotent_and_has_no_real_institutions(db):
    first = seed_demo()
    assert first["projects"] >= 5 and first["papers"] >= 5
    assert seed_demo() == {"projects": 0, "papers": 0}  # running twice adds nothing
    projects = db.scalars(select(ResearchProject)).all()
    assert all(p.is_sample and p.title.startswith("[Sample]") and "(demo)" in p.institution and "(demo)" in p.supervisor for p in projects)
    papers = db.scalars(select(ResearchPaper)).all()
    assert all(p.is_sample and p.abstract.startswith("[Sample summary") and p.external_url.startswith("https://") for p in papers)
    domains = {p.domain for p in projects}
    assert {"Artificial Intelligence", "Machine Learning", "Data Science", "Cybersecurity", "Environmental Science"} <= domains
