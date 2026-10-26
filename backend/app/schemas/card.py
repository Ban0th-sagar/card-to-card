from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator

Network = Literal["Visa", "Mastercard", "RuPay", "American Express", "Other"]
Status = Literal["ACTIVE", "INACTIVE", "BLOCKED"]
Money = Annotated[
    Decimal, Field(ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False)
]
Limit = Annotated[
    Decimal, Field(gt=0, max_digits=14, decimal_places=2, allow_inf_nan=False)
]
Name = Annotated[str, Field(min_length=1, max_length=100)]
LastFour = Annotated[str, Field(pattern=r"^[0-9]{4}$")]


class CardFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("nickname", "issuer_name", "card_name", check_fields=False)
    @classmethod
    def nonblank(cls, value):
        if value is not None and not value.strip():
            raise ValueError("This field cannot be blank")
        return value


class CardCreate(CardFields):
    card_to_card_source_enabled: bool = Field(default=True, strict=True)
    card_to_card_destination_enabled: bool = Field(default=True, strict=True)
    nickname: Name = "My Card"
    issuer_name: Name
    card_name: Name
    network: Network = "Visa"
    last_four: LastFour
    credit_limit: Limit = Decimal("100000.00")
    outstanding_balance: Money = Decimal("10000.00")
    minimum_due: Money = Decimal("2000.00")
    due_date: date
    status: Status = "ACTIVE"

    @model_validator(mode="after")
    def financial_rules(self):
        if self.outstanding_balance > self.credit_limit:
            raise ValueError("Outstanding balance cannot exceed credit limit")
        if self.minimum_due > self.outstanding_balance:
            raise ValueError("Minimum due cannot exceed outstanding balance")
        return self


class CardPatch(CardFields):
    card_to_card_source_enabled: bool | None = Field(default=None, strict=True)
    card_to_card_destination_enabled: bool | None = Field(default=None, strict=True)
    nickname: Name | None = None
    issuer_name: Name | None = None
    card_name: Name | None = None
    network: Network | None = None
    last_four: LastFour | None = None
    credit_limit: Limit | None = None
    outstanding_balance: Money | None = None
    minimum_due: Money | None = None
    due_date: date | None = None
    status: Status | None = None

    @model_validator(mode="after")
    def reject_nulls(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Card fields cannot be null")
        return self


class CardOut(BaseModel):
    card_to_card_source_enabled: bool
    card_to_card_destination_enabled: bool
    model_config = ConfigDict(from_attributes=True)
    id: str
    nickname: str
    issuer_name: str
    card_name: str
    network: str
    last_four: str
    credit_limit: Decimal
    outstanding_balance: Decimal
    available_credit: Decimal
    utilization_percentage: Decimal
    minimum_due: Decimal
    due_date: date
    status: str
    created_at: datetime
    updated_at: datetime


class DashboardOut(BaseModel):
    total_cards: int
    total_credit_limit: Decimal
    total_outstanding: Decimal
    total_available_credit: Decimal
    portfolio_utilization: Decimal
    cards: list[CardOut]
    upcoming_due: CardOut | None
