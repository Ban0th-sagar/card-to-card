import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import (
    String,
    Boolean,
    Date,
    DateTime,
    Numeric,
    ForeignKey,
    CheckConstraint,
    Computed,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.user import now


class Card(Base):
    __tablename__ = "cards"
    __table_args__ = (
        CheckConstraint("credit_limit > 0", name="cards_positive_limit"),
        CheckConstraint(
            "outstanding_balance >= 0 AND outstanding_balance <= credit_limit",
            name="cards_valid_outstanding",
        ),
        CheckConstraint(
            "minimum_due >= 0 AND minimum_due <= outstanding_balance",
            name="cards_valid_minimum",
        ),
        CheckConstraint("last_four ~ '^[0-9]{4}$'", name="cards_valid_last_four"),
        CheckConstraint(
            "network IN ('Visa','Mastercard','RuPay','American Express','Other')",
            name="cards_valid_network",
        ),
        CheckConstraint(
            "status IN ('ACTIVE','INACTIVE','BLOCKED')", name="cards_valid_status"
        ),
        CheckConstraint(
            "length(trim(issuer_name)) > 0 AND length(trim(card_name)) > 0",
            name="cards_nonblank_names",
        ),
    )
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    user = relationship("User", back_populates="cards")
    nickname: Mapped[str] = mapped_column(
        String(100), default="My Card", server_default="My Card"
    )
    issuer_name: Mapped[str] = mapped_column(String(100))
    card_name: Mapped[str] = mapped_column(String(100))
    network: Mapped[str] = mapped_column(
        String(24), default="Visa", server_default="Visa"
    )
    last_four: Mapped[str] = mapped_column(String(4))
    credit_limit: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("100000"), server_default="100000"
    )
    outstanding_balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("10000"), server_default="10000"
    )
    available_credit: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), Computed("credit_limit - outstanding_balance", persisted=True)
    )
    minimum_due: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("2000"), server_default="2000"
    )
    due_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String(16), default="ACTIVE", server_default="ACTIVE"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )

    card_to_card_source_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    card_to_card_destination_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )

    @property
    def utilization_percentage(self) -> Decimal:
        return utilization(self.outstanding_balance, self.credit_limit)


def utilization(outstanding: Decimal, limit: Decimal) -> Decimal:
    return (
        (outstanding / limit * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if limit
        else Decimal("0.00")
    )
