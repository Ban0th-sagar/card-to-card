import os
from pathlib import Path
import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / ".env")
# A dedicated database is mandatory: never truncate the application database.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    os.environ["DATABASE_URL"].rsplit("/", 1)[0] + "/cardroute_test",
)
if not os.environ["DATABASE_URL"].endswith("/cardroute_test"):
    raise RuntimeError("Tests require the dedicated cardroute_test database")
from alembic.config import Config
from alembic import command

command.upgrade(Config("alembic.ini"), "head")
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db.session import engine


@pytest.fixture(autouse=True)
def clean_database():
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE auth_sessions, login_attempts, users CASCADE"))
    yield


@pytest.fixture
def client():
    with TestClient(
        app,
        headers={"X-Requested-With": "CardRoute", "Origin": "http://localhost:5173"},
    ) as client:
        yield client


@pytest.fixture
def payload():
    return {
        "name": "Avery Shah",
        "email": "avery@example.com",
        "password": "StrongPass123!",
        "confirm_password": "StrongPass123!",
    }


@pytest.fixture
def authenticated(client, payload):
    assert client.post("/api/auth/register", json=payload).status_code == 201
    assert (
        client.post(
            "/api/auth/login",
            json={"email": payload["email"], "password": payload["password"]},
        ).status_code
        == 200
    )
    return client
