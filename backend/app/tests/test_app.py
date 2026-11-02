"""Health, error handling, security headers, CORS, size limits, rate limiting, config."""

import logging

import pytest
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ValidationError
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from fastapi import Depends
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.config import Settings
from app.core.logging import RedactingFilter
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database.session import get_db
from app.main import create_app


# ---------- health ----------

def test_liveness_does_not_need_database(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_readiness_ok_with_database(client):
    assert client.get("/api/health/ready").json() == {"status": "ready"}


def test_readiness_reports_503_without_leaking_details(app):
    def broken_db():
        # Real connection attempt to a port where nothing listens.
        bad = create_engine("postgresql+psycopg://user:secretpw@127.0.0.1:1/nope", connect_args={"connect_timeout": 1})
        from sqlalchemy.orm import Session

        with Session(bad) as s:
            yield s

    app.dependency_overrides[get_db] = broken_db
    r = TestClient(app, raise_server_exceptions=False).get("/api/health/ready")
    assert r.status_code == 503
    body = r.text.lower()
    assert "secretpw" not in body and "127.0.0.1" not in body and "psycopg" not in body
    assert r.json()["detail"] == "The service is temporarily unavailable."


# ---------- errors ----------

class Payload(BaseModel):
    email: str
    password: str


@pytest.fixture()
def probe_client(app):
    """Adds throwaway routes that exercise error paths."""

    probe = APIRouter()

    @probe.post("/test/validate")
    def validate(p: Payload):
        return {"ok": True}

    @probe.get("/test/boom")
    def boom():
        raise RuntimeError("secret internal detail: db password hunter2")

    @probe.get("/test/db-down")
    def db_down():
        raise OperationalError("SELECT secret_table", {}, Exception("connection to server at 10.0.0.5 failed"))

    @probe.get("/test/forbidden")
    def forbidden():
        raise HTTPException(status_code=403, detail="You do not have permission to do that.")

    # A private limiter per test, so limits never pile up on the shared one.
    test_limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = test_limiter

    @probe.get("/test/limited")
    @test_limiter.limit("2/minute")
    def limited(request: Request):
        return {"ok": True}

    @probe.post("/test/echo")
    async def echo(request: Request):
        return {"bytes": len(await request.body())}

    app.include_router(probe)
    # Behaves like the real frontend (sends a CSRF token on writes). A 200 on /test/echo also proves
    # that no login or admin requirement leaks onto unrelated routes.
    from app.tests.conftest import CsrfClient

    return CsrfClient(app, raise_server_exceptions=False)


def test_unknown_route_gives_friendly_404(client):
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert r.json() == {"detail": "We could not find what you were looking for."}


def test_wrong_method_gives_friendly_405(client):
    r = client.post("/api/health")
    assert r.status_code == 405
    assert "detail" in r.json() and "Method" not in r.json()["detail"]


def test_validation_errors_list_fields_but_never_echo_values(probe_client):
    r = probe_client.post("/test/validate", json={"password": "SuperSecret123!"})
    assert r.status_code == 422
    errors = r.json()["detail"]
    assert any(e["loc"][-1] == "email" for e in errors)
    assert "SuperSecret123!" not in r.text


def test_unexpected_errors_hide_internals(probe_client):
    r = probe_client.get("/test/boom")
    assert r.status_code == 500
    assert r.json() == {"detail": "Something went wrong on our side. Please try again."}
    assert "hunter2" not in r.text and "Traceback" not in r.text


def test_database_outage_returns_503_with_retry_hint(probe_client):
    r = probe_client.get("/test/db-down")
    assert r.status_code == 503
    assert r.headers["retry-after"] == "10"
    assert "10.0.0.5" not in r.text and "secret_table" not in r.text


def test_explicit_http_errors_keep_their_safe_message(probe_client):
    r = probe_client.get("/test/forbidden")
    assert r.status_code == 403
    assert r.json()["detail"] == "You do not have permission to do that."


# ---------- rate limiting ----------

def test_rate_limit_returns_429_in_standard_error_shape(probe_client):
    assert probe_client.get("/test/limited").status_code == 200
    assert probe_client.get("/test/limited").status_code == 200
    r = probe_client.get("/test/limited")
    assert r.status_code == 429
    assert r.json() == {"detail": "Too many requests. Please wait a moment and try again."}
    assert r.headers["retry-after"] == "60"


# ---------- security headers, CORS, size limit ----------

def test_security_headers_present_and_responses_not_cached(client):
    h = client.get("/api/health").headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert "default-src 'none'" in h["content-security-policy"]
    assert h["cache-control"] == "no-store"
    assert "strict-transport-security" not in h  # only sent in production


def test_security_headers_also_on_error_responses(client):
    assert client.get("/api/nope").headers["x-content-type-options"] == "nosniff"


def test_cors_allows_only_the_configured_frontend(client):
    ok = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert ok.headers["access-control-allow-credentials"] == "true"

    evil = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in evil.headers


def test_cors_preflight_allows_csrf_header_but_not_arbitrary_ones(client):
    ok = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-csrf-token,content-type"},
    )
    assert ok.status_code == 200
    bad = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-evil"},
    )
    assert bad.status_code == 400


def test_oversized_body_rejected_by_declared_length(probe_client):
    r = probe_client.post("/test/echo", content=b"x" * 1_100_000)
    assert r.status_code == 413


def test_oversized_body_rejected_even_without_content_length(probe_client):
    def chunks():
        for _ in range(12):
            yield b"x" * 100_000

    r = probe_client.post("/test/echo", content=chunks())  # streamed: no Content-Length header
    assert r.status_code == 413


def test_normal_sized_body_is_accepted(probe_client):
    r = probe_client.post("/test/echo", content=b"x" * 5_000)
    assert r.status_code == 200 and r.json() == {"bytes": 5000}


# ---------- configuration ----------

GOOD_PROD = dict(
    environment="production",
    database_url="postgresql+psycopg://u:p@h/db",
    secret_key="x" * 48,
    cookie_secure=True,
    frontend_origins="https://app.example.com",
)


def test_valid_production_settings_load():
    assert Settings(**GOOD_PROD).is_production


@pytest.mark.parametrize(
    "override, fragment",
    [
        ({"secret_key": "change-me"}, "SECRET_KEY"),
        ({"secret_key": "short"}, "SECRET_KEY"),
        ({"cookie_secure": False}, "COOKIE_SECURE"),
        ({"frontend_origins": "http://app.example.com"}, "https://"),
    ],
)
def test_insecure_production_settings_refuse_to_start(override, fragment):
    with pytest.raises(ValidationError) as exc:
        Settings(**{**GOOD_PROD, **override})
    assert fragment in str(exc.value)


def test_wildcard_cors_is_never_allowed():
    with pytest.raises(ValidationError):
        Settings(frontend_origins="*")


def test_production_hides_api_docs_and_sends_hsts():
    app = create_app(Settings(**GOOD_PROD))
    c = TestClient(app)
    assert c.get("/api/docs").status_code == 404
    assert c.get("/api/openapi.json").status_code == 404
    assert "strict-transport-security" in c.get("/api/health").headers


def test_development_exposes_api_docs(client):
    assert client.get("/api/docs").status_code == 200


# ---------- logging ----------

@pytest.mark.parametrize(
    "message, secret",
    [
        ("login failed password=Hunter2!", "Hunter2!"),
        ("header Authorization: Bearer abc123", "abc123"),
        ("reset token=9f8e7d6c5b", "9f8e7d6c5b"),
        ("connecting to postgresql+psycopg://admin:SuperPw@db:5432/x", "SuperPw"),
    ],
)
def test_logs_never_contain_secrets(message, secret):
    record = logging.LogRecord("t", logging.INFO, __file__, 1, message, (), None)
    RedactingFilter().filter(record)
    assert secret not in record.getMessage()
    assert "[REDACTED]" in record.getMessage()
