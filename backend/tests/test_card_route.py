from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def route_cards(authenticated):
    base = dict(
        issuer_name="Nova Bank",
        card_name="Platinum",
        last_four="1234",
        due_date="2027-11-15",
    )
    source = authenticated.post(
        "/api/cards", json=base | {"nickname": "Nova Platinum"}
    ).json()
    destination = authenticated.post(
        "/api/cards",
        json=base
        | dict(
            nickname="Zenith Rewards",
            issuer_name="Zenith Bank",
            card_name="Rewards",
            last_four="5678",
            outstanding_balance="30000",
        ),
    ).json()
    return source, destination


def request(cards, amount="10000"):
    return dict(
        source_card_id=cards[0]["id"], destination_card_id=cards[1]["id"], amount=amount
    )


def test_valid_request_and_no_writes(authenticated, route_cards):
    before = authenticated.get("/api/cards").json()
    r = authenticated.post("/api/card-route/validate", json=request(route_cards))
    assert r.status_code == 200, r.text
    data = r.json()
    assert (
        data["valid"] is True and data["reason_codes"] == [] and data["failures"] == []
    )
    assert len(data["checks"]) == 10 and all(
        c["passed"] is True for c in data["checks"]
    )
    assert {c["code"] for c in data["checks"]} == {
        "SOURCE_CARD_EXISTS",
        "DESTINATION_CARD_EXISTS",
        "SOURCE_CARD_OWNED_BY_USER",
        "DESTINATION_CARD_OWNED_BY_USER",
        "SOURCE_ACTIVE",
        "DESTINATION_ACTIVE",
        "SOURCE_DESTINATION_DIFFERENT",
        "VALID_AMOUNT",
        "SOURCE_AVAILABLE_CREDIT_SUFFICIENT",
        "DESTINATION_OUTSTANDING_SUFFICIENT",
    }
    assert (
        data["source_card"]["available_credit"] == "90000.00"
        and data["destination_card"]["outstanding_balance"] == "30000.00"
    )
    assert data["amount"] == "10000" and data["source_card"]["last_four"] == "1234"
    assert "user_id" not in data["source_card"] and "password_hash" not in r.text
    assert authenticated.get("/api/cards").json() == before


def test_same_card(authenticated, route_cards):
    body = request(route_cards)
    body["destination_card_id"] = body["source_card_id"]
    data = authenticated.post("/api/card-route/validate", json=body).json()
    assert data["valid"] is False and "SOURCE_DESTINATION_SAME" in data["reason_codes"]
    assert (
        data["failures"][0]["message"]
        == "Source and destination cards must be different."
    )


@pytest.mark.parametrize("side", ["source_card_id", "destination_card_id"])
def test_missing_card(authenticated, route_cards, side):
    body = request(route_cards)
    body[side] = str(uuid4())
    r = authenticated.post("/api/card-route/validate", json=body)
    assert r.status_code == 404 and "source_card" not in r.json()


@pytest.mark.parametrize("side", ["source_card_id", "destination_card_id"])
def test_foreign_card_returns_same_as_missing(authenticated, route_cards, side):
    with TestClient(
        app,
        headers={"X-Requested-With": "CardRoute", "Origin": "http://localhost:5173"},
    ) as other:
        credentials = dict(
            name="Other User",
            email="other@example.com",
            password="OtherPassword123",
            confirm_password="OtherPassword123",
        )
        assert other.post("/api/auth/register", json=credentials).status_code == 201
        assert other.post("/api/auth/login", json=credentials).status_code == 200
        card = other.post(
            "/api/cards",
            json=dict(
                issuer_name="Secret Issuer",
                card_name="Private",
                last_four="9999",
                due_date="2027-12-01",
            ),
        ).json()
    body = request(route_cards)
    body[side] = card["id"]
    foreign = authenticated.post("/api/card-route/validate", json=body)
    body[side] = str(uuid4())
    missing = authenticated.post("/api/card-route/validate", json=body)
    assert (
        foreign.status_code == missing.status_code == 404
        and foreign.json() == missing.json()
    )
    assert (
        card["id"] not in foreign.text
        and "Secret Issuer" not in foreign.text
        and "9999" not in foreign.text
    )


@pytest.mark.parametrize(
    "index,status,check",
    [
        (0, "INACTIVE", "SOURCE_ACTIVE"),
        (0, "BLOCKED", "SOURCE_ACTIVE"),
        (1, "INACTIVE", "DESTINATION_ACTIVE"),
        (1, "BLOCKED", "DESTINATION_ACTIVE"),
    ],
)
def test_status_reloaded(authenticated, route_cards, index, status, check):
    authenticated.patch(
        "/api/cards/" + route_cards[index]["id"], json={"status": status}
    )
    data = authenticated.post(
        "/api/card-route/validate", json=request(route_cards)
    ).json()
    assert (
        data["valid"] is False
        and next(c for c in data["checks"] if c["code"] == check)["passed"] is False
    )


@pytest.mark.parametrize("amount", ["0", "0.00", "-1", "-0.01"])
def test_nonpositive_amount(authenticated, route_cards, amount):
    r = authenticated.post(
        "/api/card-route/validate", json=request(route_cards, amount)
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False and "INVALID_AMOUNT" in r.json()["reason_codes"]
    assert (
        next(
            c
            for c in r.json()["checks"]
            if c["code"] == "SOURCE_AVAILABLE_CREDIT_SUFFICIENT"
        )["passed"]
        is None
    )


@pytest.mark.parametrize(
    "amount",
    [
        "NaN",
        "Infinity",
        "-Infinity",
        "hello",
        "",
        None,
        True,
        "1.001",
        "1000000000000.00",
    ],
)
def test_malformed_amount(authenticated, route_cards, amount):
    assert (
        authenticated.post(
            "/api/card-route/validate", json=request(route_cards, amount)
        ).status_code
        == 422
    )


def test_insufficient_source_credit(authenticated, route_cards):
    authenticated.patch(
        "/api/cards/" + route_cards[0]["id"], json={"outstanding_balance": "92000"}
    )
    data = authenticated.post(
        "/api/card-route/validate", json=request(route_cards)
    ).json()
    assert (
        data["valid"] is False and data["source_card"]["available_credit"] == "8000.00"
    )
    assert data["reason_codes"] == ["INSUFFICIENT_SOURCE_AVAILABLE_CREDIT"]


def test_amount_equals_source_available(authenticated, route_cards):
    authenticated.patch(
        "/api/cards/" + route_cards[0]["id"], json={"outstanding_balance": "90000"}
    )
    assert (
        authenticated.post(
            "/api/card-route/validate", json=request(route_cards)
        ).json()["valid"]
        is True
    )


def test_destination_exceeded(authenticated, route_cards):
    data = authenticated.post(
        "/api/card-route/validate", json=request(route_cards, "40000")
    ).json()
    assert data["valid"] is False and data["reason_codes"] == [
        "AMOUNT_EXCEEDS_DESTINATION_OUTSTANDING"
    ]


def test_amount_equals_destination_outstanding(authenticated, route_cards):
    assert (
        authenticated.post(
            "/api/card-route/validate", json=request(route_cards, "30000")
        ).json()["valid"]
        is True
    )


def test_no_destination_outstanding(authenticated, route_cards):
    authenticated.patch(
        "/api/cards/" + route_cards[1]["id"],
        json={"outstanding_balance": "0", "minimum_due": "0"},
    )
    data = authenticated.post(
        "/api/card-route/validate", json=request(route_cards)
    ).json()
    assert data["valid"] is False and data["reason_codes"] == [
        "DESTINATION_HAS_NO_OUTSTANDING"
    ]


def test_decimal_exact_boundary(authenticated, route_cards):
    authenticated.patch(
        "/api/cards/" + route_cards[0]["id"],
        json={"credit_limit": "100000.10", "outstanding_balance": "90000.05"},
    )
    assert (
        authenticated.post(
            "/api/card-route/validate", json=request(route_cards, "10000.05")
        ).json()["valid"]
        is True
    )
    result = authenticated.post(
        "/api/card-route/validate", json=request(route_cards, "10000.06")
    ).json()
    assert result["reason_codes"] == ["INSUFFICIENT_SOURCE_AVAILABLE_CREDIT"]


@pytest.mark.parametrize(
    "field,value",
    [
        ("user_id", "other"),
        ("available_credit", 999999),
        ("outstanding", 0),
        ("outstanding_balance", 0),
        ("status", "ACTIVE"),
        ("credit_limit", 999999),
    ],
)
def test_authoritative_fields_rejected(authenticated, route_cards, field, value):
    assert (
        authenticated.post(
            "/api/card-route/validate", json=request(route_cards) | {field: value}
        ).status_code
        == 422
    )


def test_stale_card_data_reloaded(authenticated, route_cards):
    assert (
        authenticated.post(
            "/api/card-route/validate", json=request(route_cards)
        ).json()["valid"]
        is True
    )
    authenticated.patch(
        "/api/cards/" + route_cards[1]["id"], json={"outstanding_balance": "7000"}
    )
    response = authenticated.post(
        "/api/card-route/validate", json=request(route_cards)
    ).json()
    assert (
        response["valid"] is False
        and response["destination_card"]["outstanding_balance"] == "7000.00"
    )
    assert response["reason_codes"] == ["AMOUNT_EXCEEDS_DESTINATION_OUTSTANDING"]


def test_deleted_card_reloaded(authenticated, route_cards):
    authenticated.delete("/api/cards/" + route_cards[0]["id"])
    assert (
        authenticated.post(
            "/api/card-route/validate", json=request(route_cards)
        ).status_code
        == 404
    )


def test_unauthenticated(client):
    assert (
        client.post(
            "/api/card-route/validate",
            json=dict(
                source_card_id=str(uuid4()),
                destination_card_id=str(uuid4()),
                amount="100",
            ),
        ).status_code
        == 401
    )


@pytest.mark.parametrize("field", ["source_card_id", "destination_card_id"])
def test_invalid_id_format(authenticated, route_cards, field):
    assert (
        authenticated.post(
            "/api/card-route/validate", json=request(route_cards) | {field: "bad-id"}
        ).status_code
        == 422
    )
