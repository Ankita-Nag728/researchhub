"""Projects and papers: public reading, admin-only writing, search/filter/sort/pagination."""

from datetime import datetime, timedelta, timezone

import pytest

from app.tests.conftest import add_paper, add_project, add_user, application_payload, paper_payload, project_payload

# ---------- projects: reading ----------

def test_projects_are_public(client, db):
    add_project(db)
    r = client.get("/api/projects")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1 and body["items"][0]["title"].startswith("Sample Project") and body["total_pages"] == 1


def test_project_detail_has_all_required_fields(client, db):
    project = add_project(db)
    body = client.get(f"/api/projects/{project.id}").json()
    for field in ["title", "full_description", "research_objectives", "domain", "institution", "supervisor", "required_skills",
                  "eligibility", "duration", "available_positions", "application_deadline", "status", "application_instructions"]:
        assert field in body
    assert client.get("/api/projects/99999").status_code == 404


def test_search_filter_sort_and_pagination(client, db):
    now = datetime.now(timezone.utc)
    add_project(db, title="Graph Neural Networks Study", domain="Machine Learning", institution="Inst A", application_deadline=(now + timedelta(days=50)).isoformat())
    add_project(db, title="Phishing Detection Study", domain="Cybersecurity", institution="Inst B", application_deadline=(now + timedelta(days=5)).isoformat())
    add_project(db, title="River Quality Study", domain="Environmental Science", institution="Inst A", status="completed",
                application_deadline=(now - timedelta(days=5)).isoformat())
    add_project(db, title="No Deadline Study", domain="Data Science", institution="Inst C", application_deadline=None)

    titles = lambda **p: [i["title"] for i in client.get("/api/projects", params=p).json()["items"]]  # noqa: E731
    assert titles(q="phishing") == ["Phishing Detection Study"]
    assert titles(q="PYTHON") and len(titles(q="PYTHON")) == 4  # matches required_skills, case-insensitively
    assert set(titles(domain="Machine Learning")) == {"Graph Neural Networks Study"}
    assert set(titles(institution="Inst A")) == {"Graph Neural Networks Study", "River Quality Study"}
    assert titles(status="completed") == ["River Quality Study"]
    assert titles(sort="deadline")[:3] == ["River Quality Study", "Phishing Detection Study", "Graph Neural Networks Study"]
    assert titles(sort="deadline")[-1] == "No Deadline Study"  # no deadline sorts last
    assert titles(sort="newest")[0] == "No Deadline Study" and titles(sort="oldest")[0] == "Graph Neural Networks Study"
    soon = (now + timedelta(days=10)).date().isoformat()
    assert set(titles(deadline_before=soon)) == {"Phishing Detection Study", "River Quality Study"}

    page2 = client.get("/api/projects", params={"page": 2, "page_size": 3}).json()
    assert page2["total"] == 4 and page2["total_pages"] == 2 and len(page2["items"]) == 1


def test_search_treats_wildcards_literally(client, db):
    add_project(db, title="Plain Title Study")
    add_project(db, title="Growth of 100% Studies")
    assert [i["title"] for i in client.get("/api/projects", params={"q": "100%"}).json()["items"]] == ["Growth of 100% Studies"]
    assert client.get("/api/projects", params={"q": "%"}).json()["total"] == 1
    assert client.get("/api/projects", params={"q": "_"}).json()["total"] == 0


@pytest.mark.parametrize("attack", ["'; DROP TABLE users; --", "' OR '1'='1", "\" OR 1=1 --", "1; SELECT pg_sleep(5)"])
def test_sql_injection_attempts_are_just_text(client, db, attack):
    add_project(db)
    for param in ("q", "domain", "institution"):
        r = client.get("/api/projects", params={param: attack})
        assert r.status_code == 200 and r.json()["total"] == 0
    assert client.get("/api/projects").json()["total"] == 1  # table still intact


def test_bad_query_values_are_rejected(client):
    for params in ({"status": "hacked"}, {"sort": "random"}, {"page": 0}, {"page_size": 500}, {"deadline_before": "tomorrow"}):
        assert client.get("/api/projects", params=params).status_code == 422


def test_filter_options_list_distinct_values(client, db):
    add_project(db, domain="Data Science", institution="Inst B")
    add_project(db, domain="Data Science", institution="Inst A")
    assert client.get("/api/projects/filters").json() == {"domains": ["Data Science"], "institutions": ["Inst A", "Inst B"]}


def test_archived_projects_are_hidden_from_everyone_but_admins(client, admin_client, db):
    archived = add_project(db, title="Archived Sample Study", status="archived")
    assert client.get("/api/projects").json()["total"] == 0
    assert client.get("/api/projects", params={"include_archived": True}).json()["total"] == 0  # ignored for guests
    assert client.get(f"/api/projects/{archived.id}").status_code == 404
    assert admin_client.get("/api/projects", params={"include_archived": True}).json()["total"] == 1
    assert admin_client.get(f"/api/projects/{archived.id}").status_code == 200
    assert client.get("/api/projects/filters").json()["domains"] == []


# ---------- projects: writing ----------

def test_guest_and_student_cannot_write_projects(client, student_client, db):
    project = add_project(db)
    for who, expected in ((client, 401), (student_client, 403)):
        assert who.post("/api/projects", json=project_payload()).status_code == expected
        assert who.put(f"/api/projects/{project.id}", json=project_payload(title="Hijacked Title Here")).status_code == expected
        assert who.delete(f"/api/projects/{project.id}").status_code == expected
    assert client.get(f"/api/projects/{project.id}").json()["title"].startswith("Sample Project")


def test_admin_project_lifecycle(admin_client, client):
    r = admin_client.post("/api/projects", json=project_payload())
    assert r.status_code == 201
    project = r.json()
    assert project["slug"] == "sample-project-about-graph-learning"
    assert admin_client.post("/api/projects", json=project_payload()).json()["slug"].endswith("-2")  # unique slugs

    edit = admin_client.put(f"/api/projects/{project['id']}", json=project_payload(title="Renamed Graph Learning Project", available_positions=5))
    assert edit.status_code == 200 and edit.json()["available_positions"] == 5 and edit.json()["slug"] == "renamed-graph-learning-project"
    assert client.get(f"/api/projects/{project['id']}").json()["title"] == "Renamed Graph Learning Project"

    assert admin_client.delete(f"/api/projects/{project['id']}").status_code == 204
    assert client.get(f"/api/projects/{project['id']}").status_code == 404
    assert admin_client.put("/api/projects/99999", json=project_payload()).status_code == 404
    assert admin_client.delete("/api/projects/99999").status_code == 404


def test_projects_with_applications_cannot_be_deleted_only_archived(admin_client, student_client, client):
    pid = admin_client.post("/api/projects", json=project_payload()).json()["id"]
    assert student_client.post("/api/applications", json=application_payload(pid)).status_code == 201
    r = admin_client.delete(f"/api/projects/{pid}")
    assert r.status_code == 409 and "Archive" in r.json()["detail"]
    assert admin_client.put(f"/api/projects/{pid}", json=project_payload(status="archived")).status_code == 200
    assert client.get(f"/api/projects/{pid}").status_code == 404
    assert len(student_client.get("/api/applications/my").json()) == 1  # applicant history survives


@pytest.mark.parametrize(
    "change",
    [
        {"title": "abc"}, {"status": "published"}, {"available_positions": -1}, {"short_description": ""},
        {"application_deadline": "2027-01-01T10:00:00"},  # no timezone
        {"slug": "custom"}, {"id": 5},  # fields the client may not set
    ],
)
def test_invalid_project_input_is_rejected(admin_client, change):
    assert admin_client.post("/api/projects", json=project_payload(**change)).status_code == 422


def test_project_text_is_cleaned_but_html_is_kept_as_inert_text(admin_client):
    r = admin_client.post("/api/projects", json=project_payload(title="  Study of <script>alert(1)</script>\x00 Graphs  ", required_skills=["Python", " python ", "", "R\x07"]))
    body = r.json()
    assert body["title"] == "Study of <script>alert(1)</script> Graphs"  # trimmed, control chars gone; React renders it as plain text
    assert body["required_skills"] == ["Python", "R"]


# ---------- papers ----------

def test_papers_are_public_and_searchable(client, db):
    add_paper(db, title="Graph Learning Survey", authors="Ada Sample", category="Machine Learning", publication_year=2022, doi="10.1/a1234")
    add_paper(db, title="Secure Systems Primer", authors="Bob Example", category="Cybersecurity", publication_year=2020, doi="10.1/b1234")
    titles = lambda **p: [i["title"] for i in client.get("/api/papers", params=p).json()["items"]]  # noqa: E731
    assert titles(q="ada") == ["Graph Learning Survey"]  # author search
    assert titles(q="primer") == ["Secure Systems Primer"]
    assert titles(category="Cybersecurity") == ["Secure Systems Primer"]
    assert titles(year=2022) == ["Graph Learning Survey"]
    assert titles(sort="oldest")[0] == "Secure Systems Primer" and titles(sort="newest")[0] == "Graph Learning Survey"
    assert titles(sort="title") == ["Graph Learning Survey", "Secure Systems Primer"]
    assert client.get("/api/papers/filters").json() == {"categories": ["Cybersecurity", "Machine Learning"], "years": [2022, 2020]}
    assert client.get("/api/papers", params={"q": "' OR 1=1 --"}).json()["total"] == 0


def test_paper_detail_and_404(client, db):
    paper = add_paper(db)
    assert client.get(f"/api/papers/{paper.id}").json()["external_url"] == "https://example.org/paper"
    assert client.get("/api/papers/9999").status_code == 404


def test_only_admins_write_papers(client, student_client, admin_client, db):
    paper = add_paper(db, doi="10.1/zzzz9")
    for who, code in ((client, 401), (student_client, 403)):
        assert who.post("/api/papers", json=paper_payload()).status_code == code
        assert who.put(f"/api/papers/{paper.id}", json=paper_payload()).status_code == code
        assert who.delete(f"/api/papers/{paper.id}").status_code == code
    created = admin_client.post("/api/papers", json=paper_payload())
    assert created.status_code == 201
    pid = created.json()["id"]
    assert admin_client.put(f"/api/papers/{pid}", json=paper_payload(title="Edited Sample Paper Title")).json()["title"] == "Edited Sample Paper Title"
    assert admin_client.delete(f"/api/papers/{pid}").status_code == 204


def test_paper_validation_and_duplicate_doi(admin_client):
    assert admin_client.post("/api/papers", json=paper_payload()).status_code == 201
    assert admin_client.post("/api/papers", json=paper_payload(title="Another Paper")).status_code == 409
    for bad in ({"external_url": "javascript:alert(1)"}, {"external_url": "ftp://example.org/p"}, {"external_url": "not a url"},
                {"doi": "not-a-doi"}, {"publication_year": 1500}, {"title": ""}):
        assert admin_client.post("/api/papers", json=paper_payload(**{"doi": "10.1234/other.2", **bad})).status_code == 422, bad


def test_blank_doi_is_stored_as_none(admin_client):
    a = admin_client.post("/api/papers", json=paper_payload(doi="", title="No Doi One")).json()
    b = admin_client.post("/api/papers", json=paper_payload(doi=None, title="No Doi Two")).json()
    assert a["doi"] is None and b["doi"] is None
