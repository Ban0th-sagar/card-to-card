from datetime import timedelta
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from app.core.config import settings
from app.models.card import Card
from app.models.user import now
from app.models.route_quote import RouteQuote, RouteQuoteAudit
from app.schemas.card_route import (
    RouteValidationRequest,
    ValidationFailure,
    ValidationCheck,
)
from app.schemas.route_quote import QuoteResult
from app.services.card_route import validate_request
from app.services.eligibility import CardToCardEligibilityService, quote_configuration

MESSAGES = {
    "SOURCE_ROUTE_DISABLED": "This card is not currently enabled as a source for Card-to-Card routing.",
    "DESTINATION_ROUTE_DISABLED": "This card is not currently enabled to receive this route.",
    "INSUFFICIENT_CREDIT_AFTER_FEES": "Your available credit is not enough to cover the amount and estimated fee.",
    "EXCEEDS_ROUTE_LIMIT": "The requested amount exceeds the current Card-to-Card route limit.",
    "ROUTE_NOT_ELIGIBLE": "This simulated route is not currently eligible.",
    "SOURCE_INACTIVE": "The source card must be active.",
    "DESTINATION_INACTIVE": "The destination card must be active.",
    "AMOUNT_EXCEEDS_DESTINATION_OUTSTANDING": "The amount cannot exceed the destination card's current outstanding balance.",
    "DESTINATION_HAS_NO_OUTSTANDING": "This card currently has no outstanding balance to handle.",
    "QUOTE_EXPIRED": "This quote has expired. Request a new quote.",
    "CARD_DATA_CHANGED": "Card details changed after this quote was created. Request a new quote.",
    "SOURCE_CARD_DELETED": "The source card was removed. Choose another card.",
    "DESTINATION_CARD_DELETED": "The destination card was removed. Choose another card.",
    "QUOTE_CONFIGURATION_CHANGED": "Quote settings changed. Request a new quote.",
}


def fingerprint(card):
    return dict(
        updated_at=card.updated_at.isoformat(),
        credit_limit=str(card.credit_limit),
        outstanding_balance=str(card.outstanding_balance),
        available_credit=str(card.available_credit),
        minimum_due=str(card.minimum_due),
        status=card.status,
        source_enabled=card.card_to_card_source_enabled,
        destination_enabled=card.card_to_card_destination_enabled,
    )


def audit(
    db,
    event,
    user_id,
    source_id,
    destination_id,
    amount,
    eligible,
    reasons,
    quote_id=None,
):
    db.add(
        RouteQuoteAudit(
            event_type=event,
            user_id=user_id,
            quote_id=quote_id,
            source_card_id=str(source_id),
            destination_card_id=str(destination_id),
            amount=amount,
            eligible=eligible,
            reason_codes=reasons,
        )
    )


def rejected(
    db, user_id, request, structural, checks=None, failures=None, amounts=None
):
    failures = structural.failures if failures is None else failures
    codes = [failure.code for failure in failures]
    audit(
        db,
        "ROUTE_QUOTE_REJECTED",
        user_id,
        request.source_card_id,
        request.destination_card_id,
        request.amount,
        False,
        codes,
    )
    db.commit()
    values = dict(amount=request.amount) | (amounts or {})
    return QuoteResult(
        eligible=False,
        server_time=now(),
        source_card=structural.source_card,
        destination_card=structural.destination_card,
        demo_limit=settings().card_to_card_demo_limit,
        reason_codes=codes,
        failures=failures,
        checks=checks or structural.checks,
        **values,
    )


def structural_or_reject_access(db, user_id, request):
    try:
        return validate_request(db, user_id, request)
    except HTTPException as exc:
        if exc.status_code == 404:
            audit(
                db,
                "ROUTE_QUOTE_REJECTED",
                user_id,
                request.source_card_id,
                request.destination_card_id,
                request.amount,
                False,
                ["ROUTE_NOT_ELIGIBLE"],
            )
            db.commit()
        raise


def create_quote(db, user_id, request):
    structural = structural_or_reject_access(db, user_id, request)
    if not structural.valid:
        return rejected(db, user_id, request, structural)
    # Hold card locks until the quote + audit commit, using a stable lock order.
    cards = {
        c.id: c
        for c in db.scalars(
            select(Card)
            .where(
                Card.user_id == user_id,
                Card.id.in_(
                    [str(request.source_card_id), str(request.destination_card_id)]
                ),
            )
            .order_by(Card.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    }
    structural = structural_or_reject_access(db, user_id, request)
    if not structural.valid:
        return rejected(db, user_id, request, structural)
    source = cards[str(request.source_card_id)]
    destination = cards[str(request.destination_card_id)]
    amounts, checks, failures = CardToCardEligibilityService.evaluate(
        source, destination, request.amount, structural
    )
    if failures:
        return rejected(db, user_id, request, structural, checks, failures, amounts)
    created = now()
    quote = RouteQuote(
        user_id=user_id,
        source_card_id=source.id,
        destination_card_id=destination.id,
        **amounts,
        eligible=True,
        status="ACTIVE",
        reason_codes=[],
        checks=[c.model_dump(mode="json") for c in checks],
        source_snapshot=structural.source_card.model_dump(mode="json"),
        destination_snapshot=structural.destination_card.model_dump(mode="json"),
        source_fingerprint=fingerprint(source),
        destination_fingerprint=fingerprint(destination),
        config_snapshot=quote_configuration(),
        expires_at=created + timedelta(seconds=settings().route_quote_expiry_seconds),
    )
    db.add(quote)
    db.flush()
    audit(
        db,
        "ROUTE_QUOTE_CREATED",
        user_id,
        source.id,
        destination.id,
        request.amount,
        True,
        [],
        quote.id,
    )
    db.commit()
    db.refresh(quote)
    return quote_result(quote)


def quote_result(quote):
    current = now()
    usable = quote.status == "ACTIVE" and quote.eligible and quote.expires_at > current
    failures = [
        ValidationFailure(
            code=c,
            message=MESSAGES.get(
                c, "This quote is no longer eligible. Request a new quote."
            ),
        )
        for c in quote.reason_codes
    ]
    checks = [ValidationCheck(**c) for c in quote.checks]
    checks.extend(
        [
            ValidationCheck(
                code="QUOTE_NOT_EXPIRED",
                passed=quote.expires_at > current,
                message="Quote has not expired",
            ),
            ValidationCheck(
                code="QUOTE_CURRENT",
                passed=quote.status == "ACTIVE",
                message="Quote matches current card data",
            ),
        ]
    )
    return QuoteResult(
        quote_id=quote.id,
        eligible=usable,
        status=quote.status,
        route_type=quote.route_type,
        amount=quote.amount,
        fee_percentage=quote.fee_percentage,
        fee_amount=quote.fee_amount,
        tax_amount=quote.tax_amount,
        total_source_impact=quote.total_source_impact,
        destination_payment_amount=quote.destination_payment_amount,
        expires_at=quote.expires_at,
        server_time=current,
        source_card=quote.source_snapshot,
        destination_card=quote.destination_snapshot,
        preview_source_available=Decimal(quote.source_snapshot["available_credit"])
        - quote.total_source_impact,
        preview_destination_outstanding=Decimal(
            quote.destination_snapshot["outstanding_balance"]
        )
        - quote.destination_payment_amount,
        demo_limit=Decimal(quote.config_snapshot["demo_limit"]),
        reason_codes=quote.reason_codes,
        failures=failures,
        checks=checks,
    )


def revalidate_quote(db, user_id, quote_id):
    # This owner-scoped function is the required entry point for any future use.
    quote = db.scalar(
        select(RouteQuote)
        .where(RouteQuote.id == str(quote_id), RouteQuote.user_id == user_id)
        .with_for_update()
    )
    if not quote:
        raise HTTPException(404, "Quote not found")
    if now() >= quote.expires_at:
        if quote.status != "EXPIRED":
            quote.status = "EXPIRED"
            quote.eligible = False
            quote.reason_codes = ["QUOTE_EXPIRED"]
            audit(
                db,
                "ROUTE_QUOTE_EXPIRED",
                user_id,
                quote.source_snapshot["id"],
                quote.destination_snapshot["id"],
                quote.amount,
                False,
                quote.reason_codes,
                quote.id,
            )
            db.commit()
            db.refresh(quote)
        return quote_result(quote)
    if quote.status == "ACTIVE":
        reasons = []
        fresh_checks = None
        if quote.source_card_id is None:
            reasons.append("SOURCE_CARD_DELETED")
        if quote.destination_card_id is None:
            reasons.append("DESTINATION_CARD_DELETED")
        if not reasons:
            request = RouteValidationRequest(
                source_card_id=quote.source_card_id,
                destination_card_id=quote.destination_card_id,
                amount=quote.amount,
            )
            structural = validate_request(db, user_id, request)
            cards = {
                c.id: c
                for c in db.scalars(
                    select(Card).where(
                        Card.user_id == user_id,
                        Card.id.in_([quote.source_card_id, quote.destination_card_id]),
                    )
                )
            }
            source = cards[quote.source_card_id]
            destination = cards[quote.destination_card_id]
            if (
                fingerprint(source) != quote.source_fingerprint
                or fingerprint(destination) != quote.destination_fingerprint
            ):
                reasons.append("CARD_DATA_CHANGED")
            if not structural.valid:
                reasons.extend(structural.reason_codes)
            _, fresh_checks, failures = CardToCardEligibilityService.evaluate(
                source, destination, quote.amount, structural
            )
            reasons.extend(f.code for f in failures)
            if quote.config_snapshot != quote_configuration():
                reasons.append("QUOTE_CONFIGURATION_CHANGED")
        if reasons:
            if fresh_checks is not None:
                quote.checks = [c.model_dump(mode="json") for c in fresh_checks]
            quote.status = "INVALIDATED"
            quote.eligible = False
            quote.reason_codes = list(dict.fromkeys(reasons))
            audit(
                db,
                "ROUTE_QUOTE_INVALIDATED",
                user_id,
                quote.source_snapshot["id"],
                quote.destination_snapshot["id"],
                quote.amount,
                False,
                quote.reason_codes,
                quote.id,
            )
            db.commit()
            db.refresh(quote)
    return quote_result(quote)
