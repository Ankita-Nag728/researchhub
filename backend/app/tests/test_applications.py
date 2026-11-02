"""Applications, ownership, admin review, bookmarks, profile, admin tools."""

from datetime import datetime, timedelta, timezone

import pytest

from app.tests.conftest import (
    PASSWORD, CsrfClient, add_paper, add_project, add_user, application_payload, login_as,
)


@pytest.fixture()
def open_project(db):
    return add_project(db)


# ---------- applying ----------

def test_guests_cannot_apply(client, open_project):
    assert client.post("/api/applications", json=application_payload(open_project.id)).status_code == 401


def test_student_can_apply_and_sees_it_in_history(student_client, open_project):
    r = student_client.post("/api/applications", json=application_payload(open_project.id))
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "submitted" and body["project_title"] == open_project.title and body["applicant"] is None
    mine = student_client.get("/api/applications/my").json()
    assert [a["id"] for a in mine] == [body["id"]] and mine[0]["project_institution"] == "Sample Institution"


def test_cannot_apply_twice(student_client, open_project):
    assert student_client.post("/api/applications", json=application_payload(open_project.id)).status_code == 201
    r = student_client.post("/api/applications", json=application_payload(open_project.id))
    assert r.status_code == 409 and "already applied" in r.json()["detail"]
    assert len(student_client.get("/api/applications/my").json()) == 1


def test_different_students_can_apply_to_the_same_project(student_client, other_client, open_project):
    assert student_client.post("/api/applications", json=application_payload(open_project.id)).status_code == 201
    assert other_client.post("/api/applications", json=application_payload(open_project.id)).status_code == 201


@pytest.mark.parametrize("status", ["ongoing", "completed", "closed"])
def test_cannot_apply_to_projects_that_are_not_open(student_client, db, status):
    project = add_project(db, status=status)
    r = student_client.post("/api/applications", json=application_payload(project.id))
    assert r.status_code == 400 and "not open" in r.json()["detail"]


def test_cannot_apply_after_the_deadline(student_client, db):
    project = add_project(db, application_deadline=(datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat())
    r = student_client.post("/api/applications", json=application_payload(project.id))
    assert r.status_code == 400 and "deadline" in r.json()["detail"]


def test_can_apply_when_there_is_no_deadline(student_client, db):
    assert student_client.post("/api/applications", json=application_payload(add_project(db, application_deadline=None).id)).status_code == 201


def test_missing_and_archived_projects_look_the_same(student_client, db):
    archived = add_project(db, status="archived")
    assert student_client.post("/api/applications", json=application_payload(archived.id)).status_code == 404
    assert student_client.post("/api/applications", json=application_payload(99999)).status_code == 404


@pytest.mark.parametrize(
    "change",
    [
        {"statement_of_interest": "too short"}, {"academic_background": ""}, {"relevant_skills": ""}, {"experience": ""},
        {"portfolio_url": "javascript:alert(1)"}, {"portfolio_url": "github.com/example"},
        {"status": "accepted"}, {"user_id": 1},  # clients may not set these
    ],
)
def test_invalid_applications_are_rejected(student_client, open_project, change):
    assert student_client.post("/api/applications", json=application_payload(open_project.id, **change)).status_code == 422


def test_portfolio_url_is_optional(student_client, open_project):
    r = student_client.post("/api/applications", json=application_payload(open_project.id, portfolio_url=""))
    assert r.status_code == 201 and r.json()["portfolio_url"] is None


# ---------- ownership ----------

def test_students_only_see_their_own_applications(student_client, other_client, open_project):
    mine = student_client.post("/api/applications", json=application_payload(open_project.id)).json()
    assert other_client.get("/api/applications/my").json() == []
    assert other_client.get(f"/api/applications/{mine['id']}").status_code == 404  # not 403: existence is not revealed
    assert student_client.get(f"/api/applications/{mine['id']}").status_code == 200
    assert student_client.get("/api/applications/99999").status_code == 404


def test_guests_cannot_read_applications(client, student_client, open_project):
    app_id = student_client.post("/api/applications", json=application_payload(open_project.id)).json()["id"]
    assert client.get(f"/api/applications/{app_id}").status_code == 401
    assert client.get("/api/applications/my").status_code == 401


def test_admin_can_open_any_application_and_sees_the_applicant(student_client, admin_client, open_project):
    app_id = student_client.post("/api/applications", json=application_payload(open_project.id)).json()["id"]
    body = admin_client.get(f"/api/applications/{app_id}").json()
    assert body["applicant"]["email"] == "student@example.org" and "password" not in str(body)


# ---------- admin review ----------

def test_admin_lists_filters_and_updates_applications(student_client, other_client, admin_client, open_project, db):
    a1 = student_client.post("/api/applications", json=application_payload(open_project.id)).json()
    a2 = other_client.post("/api/applications", json=application_payload(open_project.id)).json()

    listing = admin_client.get("/api/admin/applications").json()
    assert listing["total"] == 2 and listing["items"][0]["applicant"]["email"]
    assert admin_client.get("/api/admin/applications", params={"q": "other@"}).json()["total"] == 1
    assert admin_client.get("/api/admin/applications", params={"project_id": 9999}).json()["total"] == 0

    r = admin_client.patch(f"/api/admin/applications/{a1['id']}/status", json={"status": "shortlisted"})
    assert r.status_code == 200 and r.json()["status"] == "shortlisted"
    assert student_client.get(f"/api/applications/{a1['id']}").json()["status"] == "shortlisted"  # student sees the change
    assert other_client.get(f"/api/applications/{a2['id']}").json()["status"] == "submitted"
    assert admin_client.get("/api/admin/applications", params={"status": "shortlisted"}).json()["total"] == 1
    assert admin_client.get("/api/admin/stats").json()["pending_applications"] == 1


def test_status_updates_are_validated(admin_client, student_client, open_project):
    app_id = student_client.post("/api/applications", json=application_payload(open_project.id)).json()["id"]
    for bad in ("approved", "", "ACCEPTED"):
        assert admin_client.patch(f"/api/admin/applications/{app_id}/status", json={"status": bad}).status_code == 422
    assert admin_client.patch("/api/admin/applications/9999/status", json={"status": "accepted"}).status_code == 404


def test_students_and_guests_cannot_use_admin_endpoints(client, student_client, open_project):
    app_id = student_client.post("/api/applications", json=application_payload(open_project.id)).json()["id"]
    requests = [
        ("get", "/api/admin/stats", None), ("get", "/api/admin/applications", None), ("get", "/api/admin/users", None),
        ("patch", f"/api/admin/applications/{app_id}/status", {"status": "accepted"}), ("patch", "/api/admin/users/1", {"is_active": False}),
    ]
    for method, url, body in requests:
        assert getattr(client, method)(url, **({"json": body} if body else {})).status_code == 401, url
        assert getattr(student_client, method)(url, **({"json": body} if body else {})).status_code == 403, url
    assert student_client.get(f"/api/applications/{app_id}").json()["status"] == "submitted"


def test_admin_stats_count_real_rows(admin_client, student_client, open_project, db):
    add_paper(db)
    student_client.post("/api/applications", json=application_payload(open_project.id))
    assert admin_client.get("/api/admin/stats").json() == {"users": 2, "projects": 1, "papers": 1, "applications": 1, "pending_applications": 1}


def test_admin_user_management(app, admin_client, student_client, student, db):
    users = admin_client.get("/api/admin/users").json()
    assert users["total"] == 2 and all("password" not in u and "is_active" in u for u in users["items"])
    assert admin_client.get("/api/admin/users", params={"q": "student@"}).json()["total"] == 1
    assert admin_client.get("/api/admin/users", params={"role": "admin"}).json()["total"] == 1

    assert admin_client.patch(f"/api/admin/users/{student.id}", json={"is_active": False}).json()["is_active"] is False
    assert student_client.get("/api/auth/me").status_code == 401  # signed out immediately
    assert admin_client.patch(f"/api/admin/users/{student.id}", json={"is_active": True}).json()["is_active"] is True
    assert login_as(app, student.email).get("/api/auth/me").status_code == 200

    admin = admin_client.get("/api/auth/me").json()
    assert admin_client.patch(f"/api/admin/users/{admin['id']}", json={"is_active": False}).status_code == 400
    assert admin_client.patch(f"/api/admin/users/{student.id}", json={"role": "admin"}).status_code == 422  # roles can't be changed
    assert admin_client.patch("/api/admin/users/9999", json={"is_active": False}).status_code == 404


# ---------- bookmarks ----------

def test_project_bookmark_lifecycle(student_client, open_project):
    assert student_client.get("/api/bookmarks").json() == {"projects": [], "papers": []}
    r = student_client.post("/api/bookmarks", json={"project_id": open_project.id})
    assert r.status_code == 201
    bid = r.json()["bookmark_id"]
    saved = student_client.get("/api/bookmarks").json()
    assert saved["projects"][0]["bookmark_id"] == bid and saved["projects"][0]["project"]["id"] == open_project.id
    assert student_client.post("/api/bookmarks", json={"project_id": open_project.id}).status_code == 409
    assert student_client.delete(f"/api/bookmarks/{bid}").status_code == 204
    assert student_client.get("/api/bookmarks").json()["projects"] == []
    assert student_client.delete(f"/api/bookmarks/{bid}").status_code == 404


def test_paper_bookmark_lifecycle(student_client, db):
    paper = add_paper(db)
    bid = student_client.post("/api/bookmarks", json={"paper_id": paper.id}).json()["bookmark_id"]
    assert student_client.get("/api/bookmarks").json()["papers"][0]["paper"]["title"] == paper.title
    assert student_client.post("/api/bookmarks", json={"paper_id": paper.id}).status_code == 409
    assert student_client.delete(f"/api/bookmarks/{bid}", params={"kind": "paper"}).status_code == 204


def test_bookmark_input_and_ownership(student_client, other_client, client, open_project, db):
    assert student_client.post("/api/bookmarks", json={}).status_code == 422
    assert student_client.post("/api/bookmarks", json={"project_id": open_project.id, "paper_id": 1}).status_code == 422
    assert student_client.post("/api/bookmarks", json={"project_id": 9999}).status_code == 404
    assert student_client.post("/api/bookmarks", json={"paper_id": 9999}).status_code == 404
    assert client.post("/api/bookmarks", json={"project_id": open_project.id}).status_code == 401
    assert client.get("/api/bookmarks").status_code == 401

    bid = student_client.post("/api/bookmarks", json={"project_id": open_project.id}).json()["bookmark_id"]
    assert other_client.delete(f"/api/bookmarks/{bid}").status_code == 404  # cannot delete someone else's
    assert student_client.get("/api/bookmarks").json()["projects"][0]["bookmark_id"] == bid
    assert other_client.get("/api/bookmarks").json()["projects"] == []


def test_archived_projects_drop_out_of_saved_lists(student_client, admin_client, open_project):
    student_client.post("/api/bookmarks", json={"project_id": open_project.id})
    admin_client.put(f"/api/projects/{open_project.id}", json={**__import__("app.tests.conftest", fromlist=["x"]).project_payload(), "status": "archived"})
    assert student_client.get("/api/bookmarks").json()["projects"] == []


# ---------- profile ----------

PROFILE = dict(full_name="Renamed Student", university="Sample University", department="Physics", academic_year="4",
               bio="I like data.", skills=["Python", "R"], github_url="https://github.com/example", linkedin_url="")


def test_profile_read_and_update(student_client):
    me = student_client.get("/api/users/me").json()
    assert "password_hash" not in me and me["profile_completion"] < 100
    r = student_client.put("/api/users/me", json=PROFILE)
    assert r.status_code == 200
    body = r.json()
    assert body["full_name"] == "Renamed Student" and body["skills"] == ["Python", "R"] and body["linkedin_url"] is None
    assert body["email"] == "student@example.org" and body["role"] == "student"
    assert body["profile_completion"] == 100


def test_profile_cannot_change_role_or_email(student_client):
    for extra in ({"role": "admin"}, {"email": "evil@example.org"}, {"is_active": True}, {"password_hash": "x"}):
        assert student_client.put("/api/users/me", json={**PROFILE, **extra}).status_code == 422
    me = student_client.get("/api/users/me").json()
    assert me["role"] == "student" and me["email"] == "student@example.org"


@pytest.mark.parametrize("change", [{"github_url": "javascript:alert(1)"}, {"linkedin_url": "linkedin.com/in/x"}, {"full_name": ""}, {"bio": "x" * 1001}, {"skills": ["a"] * 25 + [str(i) for i in range(25)]}])
def test_invalid_profile_input(student_client, change):
    assert student_client.put("/api/users/me", json={**PROFILE, **change}).status_code == 422


def test_profile_requires_login(client):
    assert client.get("/api/users/me").status_code == 401
    assert client.put("/api/users/me", json=PROFILE).status_code == 401


def test_change_password(app, student_client, student):
    second = login_as(app, student.email)  # another device
    r = student_client.patch("/api/users/me/password", json={"current_password": "wrong-password!", "new_password": "BrandNewPassw0rd!"})
    assert r.status_code == 400
    assert student_client.patch("/api/users/me/password", json={"current_password": PASSWORD, "new_password": "short"}).status_code == 422
    assert student_client.patch("/api/users/me/password", json={"current_password": PASSWORD, "new_password": "BrandNewPassw0rd!"}).status_code == 200
    assert student_client.get("/api/auth/me").status_code == 200  # this browser stays signed in
    assert second.get("/api/auth/me").status_code == 401  # other devices are signed out
    assert CsrfClient(app).post("/api/auth/login", json={"email": student.email, "password": "BrandNewPassw0rd!"}).status_code == 200
