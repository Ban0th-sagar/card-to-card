from datetime import timedelta
from decimal import Decimal
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.main import app
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.route_quote import RouteQuote, RouteQuoteAudit
from app.models.user import now


@pytest.fixture
def quote_cards(authenticated):
    base = dict(
        issuer_name="Nova Bank",
        card_name="Platinum",
        last_four="1234",
        due_date="2027-11-15",
    )
    source = authenticated.post(
        "/api/cards", json=base | dict(nickname="Nova Platinum")
    ).json()
    destination = authenticated.post(
        "/api/cards",
        json=base
        | dict(
            nickname="Zenith Rewards",
            issuer_name="Zenith Bank",
            outstanding_balance="30000",
            last_four="5678",
        ),
    ).json()
    return source, destination


def body(cards, amount="10000"):
    return dict(
        source_card_id=cards[0]["id"], destination_card_id=cards[1]["id"], amount=amount
    )


def quote(client, cards, amount="10000"):
    r = client.post("/api/routes/quote", json=body(cards, amount))
    assert r.status_code == 200, r.text
    return r.json()


def count(model):
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(model))


def test_primary_quote(authenticated, quote_cards):
    before = authenticated.get("/api/cards").json()
    q = quote(authenticated, quote_cards)
    assert (
        q["eligible"] is True
        and q["status"] == "ACTIVE"
        and q["route_type"] == "CARD_TO_CARD"
    )
    assert (
        q["amount"] == "10000.00"
        and q["fee_percentage"] == "1.25"
        and q["fee_amount"] == "125.00"
        and q["tax_amount"] == "0.00"
    )
    assert (
        q["total_source_impact"] == "10125.00"
        and q["destination_payment_amount"] == "10000.00"
    )
    assert (
        q["preview_source_available"] == "79875.00"
        and q["preview_destination_outstanding"] == "20000.00"
    )
    assert (
        q["currency"] == "INR"
        and q["simulation_only"] is True
        and q["reason_codes"] == []
    )
    assert all(c["passed"] for c in q["checks"])
    with SessionLocal() as db:
        row = db.get(RouteQuote, q["quote_id"])
        assert 299 <= (row.expires_at - row.created_at).total_seconds() <= 301
        audit = db.scalar(select(RouteQuoteAudit))
        assert audit.event_type == "ROUTE_QUOTE_CREATED" and audit.quote_id == row.id
    assert authenticated.get("/api/cards").json() == before
    assert (
        authenticated.get("/api/routes/quotes/" + q["quote_id"]).json()["eligible"]
        is True
    )


@pytest.mark.parametrize(
    "amount,fee,total",
    [
        ("0.39", "0.00", "0.39"),
        ("0.40", "0.01", "0.41"),
        ("1.20", "0.02", "1.22"),
        ("10000.05", "125.00", "10125.05"),
    ],
)
def test_paise_rounding(authenticated, quote_cards, amount, fee, total):
    q = quote(authenticated, quote_cards, amount)
    assert q["fee_amount"] == fee and q["total_source_impact"] == total


@pytest.mark.parametrize("available", ["10050", "10000"])
def test_insufficient_after_fees(authenticated, quote_cards, available):
    authenticated.patch(
        "/api/cards/" + quote_cards[0]["id"],
        json={"outstanding_balance": str(Decimal("100000") - Decimal(available))},
    )
    assert (
        authenticated.post("/api/card-route/validate", json=body(quote_cards)).json()[
            "valid"
        ]
        is True
    )
    q = quote(authenticated, quote_cards)
    assert (
        q["eligible"] is False
        and q["reason_codes"] == ["INSUFFICIENT_CREDIT_AFTER_FEES"]
        and "quote_id" not in q
    )
    assert (
        q["total_source_impact"] == "10125.00"
        and q["source_card"]["available_credit"] == available + ".00"
    )
    assert count(RouteQuote) == 0
    with SessionLocal() as db:
        assert db.scalar(select(RouteQuoteAudit)).event_type == "ROUTE_QUOTE_REJECTED"


def test_exact_total_boundary(authenticated, quote_cards):
    authenticated.patch(
        "/api/cards/" + quote_cards[0]["id"], json={"outstanding_balance": "89875"}
    )
    assert quote(authenticated, quote_cards)["eligible"] is True


def test_route_limit_boundary(authenticated, quote_cards):
    assert quote(authenticated, quote_cards, "25000")["eligible"] is True
    q = quote(authenticated, quote_cards, "25000.01")
    assert q["eligible"] is False and q["reason_codes"] == ["EXCEEDS_ROUTE_LIMIT"]
    assert q["demo_limit"] == "25000" and count(RouteQuote) == 1


@pytest.mark.parametrize(
    "index,field,reason",
    [
        (0, "card_to_card_source_enabled", "SOURCE_ROUTE_DISABLED"),
        (1, "card_to_card_destination_enabled", "DESTINATION_ROUTE_DISABLED"),
    ],
)
def test_route_flags(authenticated, quote_cards, index, field, reason):
    assert quote_cards[index][field] is True
    authenticated.patch("/api/cards/" + quote_cards[index]["id"], json={field: False})
    q = quote(authenticated, quote_cards)
    assert (
        q["eligible"] is False
        and q["reason_codes"] == [reason]
        and count(RouteQuote) == 0
    )


@pytest.mark.parametrize(
    "index,status,reason",
    [
        (0, "INACTIVE", "SOURCE_INACTIVE"),
        (0, "BLOCKED", "SOURCE_INACTIVE"),
        (1, "INACTIVE", "DESTINATION_INACTIVE"),
        (1, "BLOCKED", "DESTINATION_INACTIVE"),
    ],
)
def test_structural_status_first(authenticated, quote_cards, index, status, reason):
    authenticated.patch(
        "/api/cards/" + quote_cards[index]["id"], json={"status": status}
    )
    q = quote(authenticated, quote_cards)
    assert (
        q["eligible"] is False
        and reason in q["reason_codes"]
        and count(RouteQuote) == 0
    )
    assert "fee_amount" not in q


@pytest.mark.parametrize(
    "amount,reason",
    [
        ("0", "INVALID_AMOUNT"),
        ("-1", "INVALID_AMOUNT"),
        ("40000", "AMOUNT_EXCEEDS_DESTINATION_OUTSTANDING"),
    ],
)
def test_structural_amount_first(authenticated, quote_cards, amount, reason):
    q = quote(authenticated, quote_cards, amount)
    assert (
        q["eligible"] is False
        and reason in q["reason_codes"]
        and count(RouteQuote) == 0
    )
    assert "fee_amount" not in q


def test_same_card(authenticated, quote_cards):
    r = authenticated.post(
        "/api/routes/quote", json=body((quote_cards[0], quote_cards[0]))
    )
    assert (
        r.json()["reason_codes"] == ["SOURCE_DESTINATION_SAME"]
        and count(RouteQuote) == 0
    )


def test_empty_destination(authenticated, quote_cards):
    authenticated.patch(
        "/api/cards/" + quote_cards[1]["id"],
        json={"outstanding_balance": "0", "minimum_due": "0"},
    )
    assert quote(authenticated, quote_cards)["reason_codes"] == [
        "DESTINATION_HAS_NO_OUTSTANDING"
    ]


def test_expiry_and_idempotent_audit(authenticated, quote_cards, monkeypatch):
    import app.services.quotes as service

    q = quote(authenticated, quote_cards)
    with SessionLocal() as db:
        expires = db.get(RouteQuote, q["quote_id"]).expires_at
    monkeypatch.setattr(service, "now", lambda: expires + timedelta(seconds=1))
    for _ in range(2):
        data = authenticated.get("/api/routes/quotes/" + q["quote_id"]).json()
        assert (
            data["eligible"] is False
            and data["status"] == "EXPIRED"
            and data["reason_codes"] == ["QUOTE_EXPIRED"]
        )
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(func.count(RouteQuoteAudit.id)).where(
                    RouteQuoteAudit.event_type == "ROUTE_QUOTE_EXPIRED"
                )
            )
            == 1
        )


@pytest.mark.parametrize("index", [0, 1])
def test_deleted_card_invalidates_quote(authenticated, quote_cards, index):
    q = quote(authenticated, quote_cards)
    assert (
        authenticated.delete("/api/cards/" + quote_cards[index]["id"]).status_code
        == 204
    )
    data = authenticated.get("/api/routes/quotes/" + q["quote_id"]).json()
    assert data["eligible"] is False and data["status"] == "INVALIDATED"
    assert (
        "SOURCE_CARD_DELETED" if index == 0 else "DESTINATION_CARD_DELETED"
    ) in data["reason_codes"]


@pytest.mark.parametrize(
    "index,patch",
    [
        (0, {"outstanding_balance": "11000"}),
        (1, {"outstanding_balance": "31000"}),
        (0, {"status": "INACTIVE"}),
        (1, {"status": "BLOCKED"}),
        (0, {"card_to_card_source_enabled": False}),
        (1, {"card_to_card_destination_enabled": False}),
    ],
)
def test_card_changes_make_quote_unusable(authenticated, quote_cards, index, patch):
    q = quote(authenticated, quote_cards)
    authenticated.patch("/api/cards/" + quote_cards[index]["id"], json=patch)
    for _ in range(2):
        data = authenticated.get("/api/routes/quotes/" + q["quote_id"]).json()
        assert (
            data["eligible"] is False
            and data["status"] == "INVALIDATED"
            and "CARD_DATA_CHANGED" in data["reason_codes"]
        )
    with SessionLocal() as db:
        assert (
            db.scalar(
                select(func.count(RouteQuoteAudit.id)).where(
                    RouteQuoteAudit.event_type == "ROUTE_QUOTE_INVALIDATED"
                )
            )
            == 1
        )


def test_quote_ownership_and_card_ownership(authenticated, quote_cards):
    q = quote(authenticated, quote_cards)
    with TestClient(
        app,
        headers={"X-Requested-With": "CardRoute", "Origin": "http://localhost:5173"},
    ) as other:
        user = dict(
            name="Other User",
            email="other@example.com",
            password="OtherPassword123",
            confirm_password="OtherPassword123",
        )
        assert other.post("/api/auth/register", json=user).status_code == 201
        assert other.post("/api/auth/login", json=user).status_code == 200
        assert other.get("/api/routes/quotes/" + q["quote_id"]).status_code == 404
        assert (
            other.post("/api/routes/quote", json=body(quote_cards)).status_code == 404
        )
    assert (
        authenticated.get("/api/routes/quotes/" + q["quote_id"]).json()["eligible"]
        is True
    )


@pytest.mark.parametrize(
    "field,value",
    [
        ("fee", 0),
        ("fee_amount", 0),
        ("total_source_impact", 1),
        ("eligible", True),
        ("available_credit", 999999),
        ("outstanding", 1),
        ("user_id", "other"),
        ("provider_support", True),
    ],
)
def test_untrusted_fields_rejected(authenticated, quote_cards, field, value):
    assert (
        authenticated.post(
            "/api/routes/quote", json=body(quote_cards) | {field: value}
        ).status_code
        == 422
    )
    assert count(RouteQuote) == 0


@pytest.mark.parametrize("amount", ["NaN", "Infinity", "not money", "1.001"])
def test_invalid_currency_rejected(authenticated, quote_cards, amount):
    assert (
        authenticated.post(
            "/api/routes/quote", json=body(quote_cards, amount)
        ).status_code
        == 422
    )


def test_auth_required(client):
    assert (
        client.post(
            "/api/routes/quote",
            json={
                "source_card_id": str(uuid4()),
                "destination_card_id": str(uuid4()),
                "amount": "100",
            },
        ).status_code
        == 401
    )
    assert client.get("/api/routes/quotes/" + str(uuid4())).status_code == 401


def test_missing_quote(authenticated):
    assert authenticated.get("/api/routes/quotes/" + str(uuid4())).status_code == 404


def test_configuration_and_production_guard(authenticated, quote_cards, monkeypatch):
    monkeypatch.setattr(settings(), "card_to_card_fee_percent", Decimal("2.00"))
    monkeypatch.setattr(settings(), "route_quote_expiry_seconds", 60)
    q = quote(authenticated, quote_cards)
    assert q["fee_amount"] == "200.00"
    with SessionLocal() as db:
        row = db.get(RouteQuote, q["quote_id"])
        assert 59 <= (row.expires_at - row.created_at).total_seconds() <= 61
    monkeypatch.setattr(settings(), "card_to_card_demo_limit", Decimal("5000"))
    assert quote(authenticated, quote_cards)["reason_codes"] == ["EXCEEDS_ROUTE_LIMIT"]
    assert (
        authenticated.get("/api/routes/quotes/" + q["quote_id"]).json()["status"]
        == "INVALIDATED"
    )
    monkeypatch.setattr(settings(), "app_env", "production")
    assert (
        "ROUTE_NOT_ELIGIBLE"
        in quote(authenticated, quote_cards, "1000")["reason_codes"]
    )


def test_seeded_support_and_unsupported_flags(authenticated):
    from scripts.seed_demo import seed_demo
    from app.models.card import Card

    with SessionLocal() as db:
        assert seed_demo(db, "DemoPassword123") is True
        rows = {card.nickname: card for card in db.scalars(select(Card))}
        assert rows["Nova Platinum"].card_to_card_source_enabled is True
        assert rows["Zenith Rewards"].card_to_card_destination_enabled is True
        assert rows["Orbit Prime"].card_to_card_source_enabled is False
        assert rows["Vertex Classic"].card_to_card_destination_enabled is False
