from decimal import Decimal, ROUND_HALF_UP
from app.core.config import settings
from app.schemas.card_route import ValidationCheck, ValidationFailure

PAISE = Decimal("0.01")


def financials(amount):
    amount = amount.quantize(PAISE, rounding=ROUND_HALF_UP)
    percent = settings().card_to_card_fee_percent
    fee = (amount * percent / Decimal("100")).quantize(PAISE, rounding=ROUND_HALF_UP)
    tax = Decimal("0.00")
    return dict(
        amount=amount,
        fee_percentage=percent.quantize(PAISE),
        fee_amount=fee,
        tax_amount=tax,
        total_source_impact=amount + fee + tax,
        destination_payment_amount=amount,
    )


def quote_configuration():
    config = settings()
    return dict(
        fee_percent=str(config.card_to_card_fee_percent),
        demo_limit=str(config.card_to_card_demo_limit),
        environment=config.app_env,
    )


class CardToCardEligibilityService:
    @staticmethod
    def evaluate(source, destination, amount, structural):
        checks = [
            ValidationCheck(
                code=code,
                passed=next(c.passed for c in structural.checks if c.code == original),
                message=message,
            )
            for code, original, message in [
                ("SOURCE_ACTIVE", "SOURCE_ACTIVE", "Source card active"),
                ("DESTINATION_ACTIVE", "DESTINATION_ACTIVE", "Destination card active"),
                ("DIFFERENT_CARDS", "SOURCE_DESTINATION_DIFFERENT", "Different cards"),
                ("VALID_AMOUNT", "VALID_AMOUNT", "Valid amount"),
                (
                    "SOURCE_AVAILABLE_CREDIT",
                    "SOURCE_AVAILABLE_CREDIT_SUFFICIENT",
                    "Available credit sufficient",
                ),
                (
                    "DESTINATION_OUTSTANDING",
                    "DESTINATION_OUTSTANDING_SUFFICIENT",
                    "Destination outstanding sufficient",
                ),
            ]
        ]
        failures = []

        def add(code, passed, message, reason, failure):
            checks.append(ValidationCheck(code=code, passed=passed, message=message))
            if not passed:
                failures.append(ValidationFailure(code=reason, message=failure))

        add(
            "SOURCE_ROUTE_SUPPORTED",
            source.card_to_card_source_enabled,
            "Source route supported",
            "SOURCE_ROUTE_DISABLED",
            "This card is not currently enabled as a source for Card-to-Card routing.",
        )
        add(
            "DESTINATION_ROUTE_SUPPORTED",
            destination.card_to_card_destination_enabled,
            "Destination route supported",
            "DESTINATION_ROUTE_DISABLED",
            "This card is not currently enabled to receive this route.",
        )
        add(
            "SIMULATION_ROUTE_SUPPORTED",
            settings().app_env in ("development", "simulation"),
            "Simulation route supported",
            "ROUTE_NOT_ELIGIBLE",
            "Card-to-Card quotes are available only in development or simulation mode.",
        )
        amounts = financials(amount)
        add(
            "TOTAL_WITHIN_SOURCE_LIMIT",
            amounts["total_source_impact"] <= source.available_credit,
            "Total including fee within source available credit",
            "INSUFFICIENT_CREDIT_AFTER_FEES",
            "Your available credit is not enough to cover the amount and estimated fee.",
        )
        add(
            "ROUTE_WITHIN_DEMO_LIMIT",
            amount <= settings().card_to_card_demo_limit,
            "Amount within route limit",
            "EXCEEDS_ROUTE_LIMIT",
            "The requested amount exceeds the current Card-to-Card route limit.",
        )
        return amounts, checks, failures
