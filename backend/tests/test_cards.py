from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from app.main import app
from app.db.session import SessionLocal
from app.models.card import Card


def today():
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


@pytest.fixture
def card_payload():
    return dict(
        nickname="Primary Card",
        issuer_name="Nova Bank",
        card_name="Platinum",
        last_four="4482",
        due_date=str(today() + timedelta(days=30)),
    )


@pytest.fixture
def saved(authenticated, card_payload):
    response = authenticated.post("/api/cards", json=card_payload)
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def other():
    with TestClient(
        app,
        headers={"X-Requested-With": "CardRoute", "Origin": "http://localhost:5173"},
    ) as client:
        body = dict(
            name="Other User",
            email="other@example.com",
            password="AnotherStrong123",
            confirm_password="AnotherStrong123",
        )
        assert client.post("/api/auth/register", json=body).status_code == 201
        assert client.post("/api/auth/login", json=body).status_code == 200
        yield client


def test_create_defaults(authenticated, card_payload):
    r = authenticated.post("/api/cards", json=card_payload)
    assert r.status_code == 201
    card = r.json()
    assert (
        card["credit_limit"] == "100000.00"
        and card["outstanding_balance"] == "10000.00"
    )
    assert (
        card["available_credit"] == "90000.00"
        and card["utilization_percentage"] == "10.00"
    )
    assert (
        card["minimum_due"] == "2000.00"
        and card["network"] == "Visa"
        and card["status"] == "ACTIVE"
    )
    assert "user_id" not in card and "password_hash" not in card
    with SessionLocal() as db:
        stored = db.get(Card, card["id"])
        assert (
            stored.available_credit == Decimal("90000.00")
            and stored.user_id == authenticated.get("/api/auth/me").json()["id"]
        )


def test_exact_decimal_arithmetic(authenticated, card_payload):
    body = card_payload | dict(
        credit_limit="100000.10", outstanding_balance="10000.05", minimum_due="2000.01"
    )
    r = authenticated.post("/api/cards", json=body)
    assert r.status_code == 201
    assert r.json()["available_credit"] == "90000.05"
    r = authenticated.patch(
        "/api/cards/" + r.json()["id"],
        json={
            "credit_limit": "0.30",
            "outstanding_balance": "0.10",
            "minimum_due": "0.01",
        },
    )
    assert (
        r.status_code == 200
        and r.json()["available_credit"] == "0.20"
        and r.json()["utilization_percentage"] == "33.33"
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("credit_limit", 0),
        ("credit_limit", -1),
        ("outstanding_balance", -1),
        ("outstanding_balance", 100001),
        ("minimum_due", -1),
        ("minimum_due", 10001),
        ("last_four", "123"),
        ("last_four", "12345"),
        ("last_four", "abcd"),
        ("last_four", "１２３４"),
        ("issuer_name", "  "),
        ("card_name", ""),
        ("network", "FakeNetwork"),
        ("status", "DELETED"),
        ("due_date", "2026-02-30"),
        ("credit_limit", "100.001"),
        ("credit_limit", "NaN"),
        ("credit_limit", "Infinity"),
        ("credit_limit", "1000000000000"),
        ("user_id", "someone-else"),
        ("available_credit", 999999),
        ("utilization_percentage", 0),
        ("full_card_number", "1234567890123456"),
        ("cvv", "123"),
    ],
)
def test_invalid_card(authenticated, card_payload, field, value):
    r = authenticated.post("/api/cards", json=card_payload | {field: value})
    assert r.status_code == 422, r.text
    assert authenticated.get("/api/cards").json() == []


@pytest.mark.parametrize(
    "network", ["Visa", "Mastercard", "RuPay", "American Express", "Other"]
)
def test_supported_networks(authenticated, card_payload, network):
    assert (
        authenticated.post(
            "/api/cards", json=card_payload | {"network": network}
        ).json()["network"]
        == network
    )


@pytest.mark.parametrize("status", ["ACTIVE", "INACTIVE", "BLOCKED"])
def test_supported_statuses(authenticated, saved, status):
    assert (
        authenticated.patch(
            "/api/cards/" + saved["id"], json={"status": status}
        ).json()["status"]
        == status
    )


def test_list_and_details(authenticated, saved):
    assert authenticated.get("/api/cards").json() == [saved]
    assert authenticated.get("/api/cards/" + saved["id"]).json() == saved


def test_update_and_recalculate(authenticated, saved):
    r = authenticated.patch(
        "/api/cards/" + saved["id"],
        json={"outstanding_balance": "15000", "nickname": "Updated"},
    )
    assert r.status_code == 200
    assert (
        r.json()["available_credit"] == "85000.00"
        and r.json()["utilization_percentage"] == "15.00"
    )
    r = authenticated.patch(
        "/api/cards/" + saved["id"], json={"credit_limit": "200000"}
    )
    assert (
        r.json()["available_credit"] == "185000.00"
        and r.json()["utilization_percentage"] == "7.50"
    )
    assert r.json()["updated_at"] != saved["updated_at"]


@pytest.mark.parametrize(
    "patch",
    [
        {"outstanding_balance": "1000"},
        {"credit_limit": "9000"},
        {"minimum_due": None},
        {"status": None},
        {"user_id": "other"},
        {"available_credit": "1000000"},
        {"minimum_due": "10001"},
        {"issuer_name": "  "},
    ],
)
def test_invalid_patch_preserves_card(authenticated, saved, patch):
    assert (
        authenticated.patch("/api/cards/" + saved["id"], json=patch).status_code == 422
    )
    assert authenticated.get("/api/cards/" + saved["id"]).json() == saved


def test_delete(authenticated, saved):
    assert authenticated.delete("/api/cards/" + saved["id"]).status_code == 204
    assert authenticated.get("/api/cards").json() == []
    assert authenticated.get("/api/cards/" + saved["id"]).status_code == 404
    assert authenticated.get("/api/dashboard").json()["total_cards"] == 0


@pytest.mark.parametrize(
    "method,attack",
    [("get", None), ("patch", {"nickname": "Stolen"}), ("delete", None)],
)
def test_tenant_ownership(authenticated, saved, other, method, attack):
    args = {} if attack is None else {"json": attack}
    assert other.request(method, "/api/cards/" + saved["id"], **args).status_code == 404
    assert other.get("/api/cards").json() == []
    summary = other.get("/api/dashboard").json()
    assert (
        summary["total_cards"] == 0
        and summary["upcoming_due"] is None
        and summary["cards"] == []
    )
    assert authenticated.get("/api/cards/" + saved["id"]).json() == saved


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/cards"),
        ("post", "/api/cards"),
        ("get", "/api/cards/00000000-0000-0000-0000-000000000000"),
        ("patch", "/api/cards/00000000-0000-0000-0000-000000000000"),
        ("delete", "/api/cards/00000000-0000-0000-0000-000000000000"),
        ("get", "/api/dashboard"),
    ],
)
def test_auth_required(client, card_payload, method, path):
    kwargs = {"json": card_payload} if method in ["post", "patch"] else {}
    assert client.request(method, path, **kwargs).status_code == 401


def test_missing_card(authenticated):
    assert authenticated.get("/api/cards/" + str(uuid4())).status_code == 404


def test_dashboard_summary(authenticated, card_payload):
    authenticated.post("/api/cards", json=card_payload)
    authenticated.post(
        "/api/cards",
        json=card_payload | {"nickname": "Second", "outstanding_balance": "20000"},
    )
    summary = authenticated.get("/api/dashboard").json()
    assert summary["total_cards"] == 2 and summary["total_credit_limit"] == "200000.00"
    assert (
        summary["total_outstanding"] == "30000.00"
        and summary["total_available_credit"] == "170000.00"
    )
    assert summary["portfolio_utilization"] == "15.00" and len(summary["cards"]) == 2


def test_empty_summary(authenticated):
    data = authenticated.get("/api/dashboard").json()
    assert data["total_cards"] == 0 and Decimal(data["total_credit_limit"]) == 0
    assert (
        data["portfolio_utilization"] == "0.00"
        and data["cards"] == []
        and data["upcoming_due"] is None
    )


def test_upcoming_nearest_future(authenticated, card_payload):
    for days, name in [(-1, "Overdue"), (20, "Later"), (2, "Nearest")]:
        authenticated.post(
            "/api/cards",
            json=card_payload
            | {"nickname": name, "due_date": str(today() + timedelta(days=days))},
        )
    assert (
        authenticated.get("/api/dashboard").json()["upcoming_due"]["nickname"]
        == "Nearest"
    )
    authenticated.post(
        "/api/cards",
        json=card_payload | {"nickname": "Today", "due_date": str(today())},
    )
    assert (
        authenticated.get("/api/dashboard").json()["upcoming_due"]["nickname"]
        == "Today"
    )


def test_only_past_due(authenticated, card_payload):
    authenticated.post(
        "/api/cards", json=card_payload | {"due_date": str(today() - timedelta(days=1))}
    )
    assert authenticated.get("/api/dashboard").json()["upcoming_due"] is None


def test_dashboard_four_cards_and_all_totals(authenticated, card_payload):
    for n in range(6):
        authenticated.post("/api/cards", json=card_payload | {"nickname": str(n)})
    data = authenticated.get("/api/dashboard").json()
    assert (
        len(data["cards"]) == 4
        and data["total_cards"] == 6
        and data["total_credit_limit"] == "600000.00"
    )


def test_database_financial_constraint(authenticated, saved):
    with SessionLocal() as db:
        with pytest.raises(IntegrityError):
            db.execute(
                update(Card)
                .where(Card.id == saved["id"])
                .values(outstanding_balance=Decimal("100001"))
            )
        db.rollback()
        assert db.get(Card, saved["id"]).available_credit == Decimal("90000")


def test_demo_seed_is_scoped_and_repeat_safe(authenticated):
    from scripts.seed_demo import seed_demo, DEMO_EMAIL
    from app.models.user import User
    from sqlalchemy import func

    with SessionLocal() as db:
        assert seed_demo(db, "DemoPassword123") is True
        assert seed_demo(db, "DifferentPassword123") is False
        user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        assert (
            db.scalar(select(func.count(Card.id)).where(Card.user_id == user.id)) == 4
        )
        assert db.scalar(
            select(func.sum(Card.credit_limit)).where(Card.user_id == user.id)
        ) == Decimal("400000")
    assert authenticated.get("/api/cards").json() == []


def test_seed_never_modifies_existing_demo_email(authenticated):
    from scripts.seed_demo import seed_demo, DEMO_EMAIL
    from app.models.user import User
    from app.services.auth import hasher
    from sqlalchemy import func

    with SessionLocal() as db:
        user = User(
            name="Existing Account",
            email=DEMO_EMAIL,
            password_hash=hasher.hash("OriginalPassword123"),
        )
        db.add(user)
        db.commit()
        assert seed_demo(db, "NewPassword123") is False
        assert db.scalar(select(func.count(Card.id))) == 0
        assert db.get(User, user.id).name == "Existing Account"
