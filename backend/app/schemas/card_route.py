from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class RouteValidationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_card_id: UUID
    destination_card_id: UUID
    # Zero/negative amounts receive a structural INVALID_AMOUNT result.
    # Malformed, non-finite or over-precision input is rejected as HTTP 422.
    amount: Decimal = Field(max_digits=14, decimal_places=2, allow_inf_nan=False)


class ValidationCheck(BaseModel):
    code: str
    passed: bool | None
    message: str


class ValidationFailure(BaseModel):
    code: str
    message: str


class SourceSnapshot(BaseModel):
    id: str
    nickname: str
    issuer: str
    card_name: str
    last_four: str
    available_credit: Decimal
    status: str


class DestinationSnapshot(BaseModel):
    id: str
    nickname: str
    issuer: str
    card_name: str
    last_four: str
    outstanding_balance: Decimal
    status: str


class RouteValidationResult(BaseModel):
    valid: bool
    source_card: SourceSnapshot
    destination_card: DestinationSnapshot
    amount: Decimal
    reason_codes: list[str]
    failures: list[ValidationFailure]
    checks: list[ValidationCheck]
