"""Registration, login, logout, sessions, password reset, password hashing."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app.core.security import hash_password, hash_token, verify_password
from app.models import PasswordResetToken, User, UserSession
from app.tests.conftest import PASSWORD, CsrfClient, add_user, login_as

REGISTER = dict(
    full_name="Sample Student", email="new.student@example.org", password=PASSWORD, confirm_password=PASSWORD,
    university="Sample University", department="Computer Science", academic_year="2",
)


# ---------- password hashing ----------

def test_passwords_are_hashed_with_argon2id_and_salted():
    h1, h2 = hash_password("same-password-1"), hash_password("same-password-1")
    assert h1.startswith("$argon2id$") and "same-password-1" not in h1
    assert h1 != h2  # unique salt each time
    assert verify_password(h1, "same-password-1") and not verify_password(h1, "wrong")
    assert verify_password("not-a-hash", "x") is False


# ---------- registration ----------

def test_register_creates_user_hashes_password_and_signs_in(client, db):
    r = client.post("/api/auth/register", json=REGISTER)
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "new.student@example.org" and body["role"] == "student"
    assert "password" not in r.text and "hash" not in r.text
    user = db.scalar(select(User).where(User.email == "new.student@example.org"))
    assert user.password_hash.startswith("$argon2id$") and PASSWORD not in user.password_hash
    assert client.get("/api/auth/me").json()["email"] == "new.student@example.org"


def test_register_lowercases_email_and_blocks_duplicates(client, db):
    assert client.post("/api/auth/register", json={**REGISTER, "email": "Mixed.Case@Example.org"}).json()["email"] == "mixed.case@example.org"
    r = client.post("/api/auth/register", json={**REGISTER, "email": "MIXED.case@example.ORG"})
    assert r.status_code == 409 and "already exists" in r.json()["detail"]


@pytest.mark.parametrize("role", ["admin", "superuser", ""])
def test_nobody_can_register_as_admin(client, db, role):
    r = client.post("/api/auth/register", json={**REGISTER, "role": role})
    assert r.status_code == 422
    assert db.scalar(select(User).where(User.email == REGISTER["email"])) is None


def test_researcher_role_is_allowed(client):
    assert client.post("/api/auth/register", json={**REGISTER, "role": "researcher"}).json()["role"] == "researcher"


def test_register_rejects_unknown_fields_like_is_active(client):
    assert client.post("/api/auth/register", json={**REGISTER, "is_active": True}).status_code == 422


@pytest.mark.parametrize(
    "change, field",
    [
        ({"email": "not-an-email"}, "email"),
        ({"password": "short1", "confirm_password": "short1"}, "password"),
        ({"password": "password123", "confirm_password": "password123"}, "password"),
        ({"confirm_password": "Different9999!"}, "confirm_password"),
        ({"full_name": ""}, "full_name"),
        ({"university": "x"}, "university"),
    ],
)
def test_register_validation_messages(client, change, field):
    r = client.post("/api/auth/register", json={**REGISTER, **change})
    assert r.status_code == 422
    assert PASSWORD not in r.text
    assert any(field in e["loc"] or e["loc"] == ["body"] for e in r.json()["detail"])


# ---------- login / logout / sessions ----------

def test_login_sets_secure_cookies(client, db):
    add_user(db, "student@example.org")
    r = client.post("/api/auth/login", json={"email": "student@example.org", "password": PASSWORD})
    assert r.status_code == 200
    cookies = {c.split("=")[0]: c for c in r.headers.get_list("set-cookie")}
    session = cookies["rh_session"].lower()
    assert "httponly" in session and "samesite=lax" in session
    assert "httponly" not in cookies["csrf_token"].lower()  # frontend must be able to read it
    assert db.scalar(select(UserSession.id)) is not None


def test_session_token_is_stored_only_as_a_hash(client, db):
    add_user(db, "student@example.org")
    client.post("/api/auth/login", json={"email": "student@example.org", "password": PASSWORD})
    token = client.cookies.get("rh_session")
    stored = db.scalar(select(UserSession.token_hash))
    assert stored == hash_token(token) and stored != token


def test_wrong_password_and_unknown_email_give_the_same_error(client, db):
    add_user(db, "student@example.org")
    a = client.post("/api/auth/login", json={"email": "student@example.org", "password": "wrong-password"})
    b = client.post("/api/auth/login", json={"email": "nobody@example.org", "password": "wrong-password"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json() == {"detail": "Invalid email or password."}


def test_login_is_case_insensitive_for_email(client, db):
    add_user(db, "student@example.org")
    assert client.post("/api/auth/login", json={"email": "STUDENT@example.org", "password": PASSWORD}).status_code == 200


def test_suspended_users_cannot_log_in_or_use_existing_sessions(app, db, student_client, student):
    assert student_client.get("/api/auth/me").status_code == 200
    db.execute(update(User).where(User.id == student.id).values(is_active=False))
    db.commit()
    assert student_client.get("/api/auth/me").status_code == 401
    assert CsrfClient(app).post("/api/auth/login", json={"email": student.email, "password": PASSWORD}).status_code == 401


def test_remember_me_makes_a_longer_session(client, db):
    add_user(db, "student@example.org")
    client.post("/api/auth/login", json={"email": "student@example.org", "password": PASSWORD})
    short = db.scalar(select(UserSession.expires_at))
    client.post("/api/auth/login", json={"email": "student@example.org", "password": PASSWORD, "remember_me": True})
    longest = max(db.scalars(select(UserSession.expires_at)).all())
    assert short - datetime.now(timezone.utc) < timedelta(hours=9)
    assert longest - datetime.now(timezone.utc) > timedelta(days=29)


def test_me_requires_login(client):
    assert client.get("/api/auth/me").status_code == 401


def test_logout_destroys_the_session_server_side(app, db, student_client):
    token = student_client.cookies.get("rh_session")
    assert student_client.post("/api/auth/logout").status_code == 204
    assert db.scalar(select(UserSession.id)) is None
    # Replaying the old cookie must fail even though the browser still had it.
    replay = CsrfClient(app, raise_server_exceptions=False)
    replay.cookies.set("rh_session", token)
    assert replay.get("/api/auth/me").status_code == 401


def test_expired_sessions_are_rejected(db, student_client):
    db.execute(update(UserSession).values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
    db.commit()
    assert student_client.get("/api/auth/me").status_code == 401


def test_login_is_rate_limited(client, db):
    add_user(db, "student@example.org")
    codes = [client.post("/api/auth/login", json={"email": "student@example.org", "password": "wrong-password"}).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10 and codes[10:] == [429, 429]


# ---------- password reset ----------

@pytest.fixture()
def outbox(monkeypatch):
    """Captures reset emails instead of sending them."""
    sent = []
    monkeypatch.setattr("app.routers.auth.send_password_reset", lambda to, link: sent.append((to, link)))
    return sent


def reset_token_for(client, outbox, email="student@example.org"):
    """Requests a reset and returns the raw token from the emailed link."""
    client.post("/api/auth/forgot-password", json={"email": email})
    return outbox[-1][1].split("token=")[1] if outbox else None


def test_forgot_password_answers_identically_for_known_and_unknown_emails(client, db, outbox):
    add_user(db, "student@example.org")
    a = client.post("/api/auth/forgot-password", json={"email": "student@example.org"})
    b = client.post("/api/auth/forgot-password", json={"email": "ghost@example.org"})
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    assert len(db.scalars(select(PasswordResetToken)).all()) == 1  # only the real account got a token
    assert [to for to, _ in outbox] == ["student@example.org"]


def test_forgot_password_is_rate_limited(client, db):
    codes = [client.post("/api/auth/forgot-password", json={"email": "ghost@example.org"}).status_code for _ in range(7)]
    assert codes[:5] == [200] * 5 and codes[5:] == [429, 429]


def test_full_reset_flow_is_single_use_and_signs_out_everywhere(app, client, db, student_client, outbox):
    token = reset_token_for(client, outbox)
    assert token, "dev mailer should print the link"
    stored = db.scalar(select(PasswordResetToken.token_hash))
    assert stored == hash_token(token) and stored != token

    new_password = "BrandNewPassw0rd!"
    r = client.post("/api/auth/reset-password", json={"token": token, "new_password": new_password})
    assert r.status_code == 200
    assert student_client.get("/api/auth/me").status_code == 401  # old session revoked

    assert CsrfClient(app).post("/api/auth/login", json={"email": "student@example.org", "password": PASSWORD}).status_code == 401
    assert CsrfClient(app).post("/api/auth/login", json={"email": "student@example.org", "password": new_password}).status_code == 200
    again = client.post("/api/auth/reset-password", json={"token": token, "new_password": "AnotherPassw0rd!"})
    assert again.status_code == 400  # already used


def test_expired_or_invalid_reset_tokens_are_rejected(client, db, outbox):
    add_user(db, "student@example.org")
    token = reset_token_for(client, outbox)
    db.execute(update(PasswordResetToken).values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)))
    db.commit()
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "BrandNewPassw0rd!"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": "x" * 43, "new_password": "BrandNewPassw0rd!"}).status_code == 400


def test_reset_rejects_weak_passwords(client, db, outbox):
    add_user(db, "student@example.org")
    token = reset_token_for(client, outbox)
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "short"}).status_code == 422


# ---------- CLI ----------

def test_create_admin_command_never_uses_a_default_password(db):
    from app.cli import create_admin

    user = create_admin(email="boss@example.org", full_name="Boss", password="A-Very-Long-Passphrase-1")
    assert user.role == "admin" and user.password_hash.startswith("$argon2id$")
    with pytest.raises(SystemExit):
        create_admin(email="weak@example.org", full_name="Weak", password="short")
    assert db.scalar(select(User).where(User.email == "weak@example.org")) is None
