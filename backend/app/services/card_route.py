from fastapi import HTTPException
from sqlalchemy import select
from app.models.card import Card
from app.schemas.card_route import (
    RouteValidationRequest,
    RouteValidationResult,
    ValidationCheck,
    ValidationFailure,
    SourceSnapshot,
    DestinationSnapshot,
)


def validate_request(
    db, user_id: str, request: RouteValidationRequest
) -> RouteValidationResult:
    # One owner-scoped statement obtains both authoritative card snapshots.
    # Missing and foreign IDs are indistinguishable, with no metadata returned.
    requested = {str(request.source_card_id), str(request.destination_card_id)}
    cards = {
        card.id: card
        for card in db.scalars(
            select(Card).where(Card.user_id == user_id, Card.id.in_(requested))
        )
    }
    if cards.keys() != requested:
        raise HTTPException(
            404, "Selected cards were not found. Refresh your cards and try again."
        )
    source = cards[str(request.source_card_id)]
    destination = cards[str(request.destination_card_id)]
    amount = request.amount
    valid_amount = amount > 0
    checks = []
    failures = []

    def check(code, passed, message, reason=None, failure_message=None):
        checks.append(ValidationCheck(code=code, passed=passed, message=message))
        if passed is False:
            failures.append(
                ValidationFailure(
                    code=reason or code, message=failure_message or message
                )
            )

    check("SOURCE_CARD_EXISTS", True, "Source card found")
    check("DESTINATION_CARD_EXISTS", True, "Destination card found")
    check("SOURCE_CARD_OWNED_BY_USER", True, "Source card belongs to you")
    check("DESTINATION_CARD_OWNED_BY_USER", True, "Destination card belongs to you")
    check(
        "SOURCE_ACTIVE",
        source.status == "ACTIVE",
        "Source card active",
        "SOURCE_INACTIVE",
        "The source card must be active. Inactive or blocked cards cannot be used.",
    )
    check(
        "DESTINATION_ACTIVE",
        destination.status == "ACTIVE",
        "Destination card active",
        "DESTINATION_INACTIVE",
        "The destination card must be active. Inactive or blocked cards cannot be used.",
    )
    check(
        "SOURCE_DESTINATION_DIFFERENT",
        source.id != destination.id,
        "Different cards",
        "SOURCE_DESTINATION_SAME",
        "Source and destination cards must be different.",
    )
    check(
        "VALID_AMOUNT",
        valid_amount,
        "Valid currency amount",
        "INVALID_AMOUNT",
        "Enter an amount greater than zero with no more than two decimal places.",
    )
    check(
        "SOURCE_AVAILABLE_CREDIT_SUFFICIENT",
        amount <= source.available_credit if valid_amount else None,
        "Source available credit sufficient",
        "INSUFFICIENT_SOURCE_AVAILABLE_CREDIT",
        "Your selected source card does not have enough available credit for this amount.",
    )
    no_outstanding = destination.outstanding_balance == 0
    check(
        "DESTINATION_OUTSTANDING_SUFFICIENT",
        amount <= destination.outstanding_balance and not no_outstanding
        if valid_amount
        else None,
        "Amount within destination outstanding",
        "DESTINATION_HAS_NO_OUTSTANDING"
        if no_outstanding
        else "AMOUNT_EXCEEDS_DESTINATION_OUTSTANDING",
        "This card currently has no outstanding balance to handle."
        if no_outstanding
        else "The amount cannot exceed the destination card's current outstanding balance.",
    )
    # This is a read-only structural check, never an approval, reservation or payment.
    return RouteValidationResult(
        valid=not failures,
        source_card=SourceSnapshot(
            id=source.id,
            nickname=source.nickname,
            issuer=source.issuer_name,
            card_name=source.card_name,
            last_four=source.last_four,
            available_credit=source.available_credit,
            status=source.status,
        ),
        destination_card=DestinationSnapshot(
            id=destination.id,
            nickname=destination.nickname,
            issuer=destination.issuer_name,
            card_name=destination.card_name,
            last_four=destination.last_four,
            outstanding_balance=destination.outstanding_balance,
            status=destination.status,
        ),
        amount=amount,
        reason_codes=[failure.code for failure in failures],
        failures=failures,
        checks=checks,
    )
