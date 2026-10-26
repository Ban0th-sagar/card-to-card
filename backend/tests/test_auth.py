import pytest
from datetime import timedelta
from sqlalchemy import select, text
from app.db.session import SessionLocal
from app.models.user import User, AuthSession, now
from app.services.auth import verify


def test_registration(client, payload):
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 201
    assert set(r.json()) == {"id", "name", "email", "role", "created_at"}
    assert r.json()["role"] == "CUSTOMER"
    with SessionLocal() as db:
        user = db.scalar(select(User))
        assert user.password_hash != payload["password"] and verify(
            payload["password"], user.password_hash
        )
        assert user.status == "ACTIVE" and user.updated_at and user.created_at


def test_duplicate(client, payload):
    client.post("/api/auth/register", json=payload)
    payload["email"] = "AVERY@example.com"
    assert client.post("/api/auth/register", json=payload).status_code == 409


@pytest.mark.parametrize(
    "field,value",
    [
        ("email", "not-an-email"),
        ("password", "short"),
        ("confirm_password", "different"),
        ("name", "   "),
    ],
)
def test_invalid_registration(client, payload, field, value):
    payload[field] = value
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 422
    assert payload.get("password") not in r.text


def test_login_success(client, payload):
    client.post("/api/auth/register", json=payload)
    r = client.post(
        "/api/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert (
        r.status_code == 200
        and "HttpOnly" in r.headers["set-cookie"]
        and "SameSite=lax" in r.headers["set-cookie"]
    )
    with SessionLocal() as db:
        assert db.scalar(select(User)).last_login


def test_wrong_password(client, payload):
    client.post("/api/auth/register", json=payload)
    assert (
        client.post(
            "/api/auth/login", json={"email": payload["email"], "password": "wrong"}
        ).status_code
        == 401
    )


def test_me_authenticated(authenticated):
    r = authenticated.get("/api/auth/me")
    assert r.status_code == 200 and r.json()["email"] == "avery@example.com"
    assert "password_hash" not in r.text


def test_me_unauthenticated(client):
    assert client.get("/api/auth/me").status_code == 401


def test_logout_revokes_copied_token(authenticated):
    token = authenticated.cookies.get("cardroute_session")
    assert authenticated.post("/api/auth/logout").status_code == 204
    assert authenticated.get("/api/auth/me").status_code == 401
    authenticated.cookies.set("cardroute_session", token)
    assert authenticated.get("/api/auth/me").status_code == 401


def test_protected_update(client):
    assert client.patch("/api/users/me", json={"name": "Other"}).status_code == 401


def test_profile_update(authenticated):
    assert (
        authenticated.patch("/api/users/me", json={"name": "New Name"}).json()["name"]
        == "New Name"
    )
    assert authenticated.get("/api/auth/me").json()["name"] == "New Name"
    assert (
        authenticated.patch(
            "/api/users/me", json={"name": "Admin", "role": "ADMIN"}
        ).status_code
        == 422
    )
    assert authenticated.get("/api/auth/me").json()["role"] == "CUSTOMER"


def test_database_health(client):
    assert client.get("/api/health").json() == {
        "status": "ok",
        "database": "connected",
        "environment": "development",
    }


def test_rate_limit(client):
    for _ in range(10):
        assert (
            client.post(
                "/api/auth/login",
                json={"email": "nobody@example.com", "password": "wrong"},
            ).status_code
            == 401
        )
    assert (
        client.post(
            "/api/auth/login", json={"email": "nobody@example.com", "password": "wrong"}
        ).status_code
        == 429
    )


def test_csrf_origin(authenticated):
    assert (
        authenticated.patch(
            "/api/users/me",
            json={"name": "Intruder"},
            headers={"Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    assert (
        authenticated.post(
            "/api/auth/logout", headers={"X-Requested-With": ""}
        ).status_code
        == 403
    )


def test_expired_session(authenticated):
    with SessionLocal() as db:
        db.scalar(select(AuthSession)).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert authenticated.get("/api/auth/me").status_code == 401


def test_disabled_user(authenticated):
    with SessionLocal() as db:
        db.scalar(select(User)).status = "DISABLED"
        db.commit()
    assert authenticated.get("/api/auth/me").status_code == 401


def test_tampered_token(client):
    client.cookies.set("cardroute_session", "not.a.token")
    assert client.get("/api/auth/me").status_code == 401
