from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.card_route import (
    SourceSnapshot,
    DestinationSnapshot,
    ValidationCheck,
    ValidationFailure,
)


class QuoteResult(BaseModel):
    quote_id: str | None = None
    route_type: str = "CARD_TO_CARD"
    eligible: bool
    status: str | None = None
    amount: Decimal
    fee_percentage: Decimal | None = None
    fee_amount: Decimal | None = None
    tax_amount: Decimal | None = None
    total_source_impact: Decimal | None = None
    destination_payment_amount: Decimal | None = None
    currency: str = "INR"
    expires_at: datetime | None = None
    server_time: datetime
    source_card: SourceSnapshot
    destination_card: DestinationSnapshot
    preview_source_available: Decimal | None = None
    preview_destination_outstanding: Decimal | None = None
    demo_limit: Decimal
    simulation_only: bool = True
    reason_codes: list[str]
    failures: list[ValidationFailure]
    checks: list[ValidationCheck]
