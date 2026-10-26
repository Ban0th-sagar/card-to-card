import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, Boolean, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base
from app.models.user import now


class RouteQuote(Base):
    __tablename__ = "route_quotes"
    __table_args__ = (
        CheckConstraint("route_type = 'CARD_TO_CARD'", name="quotes_route_type"),
        CheckConstraint(
            "status IN ('ACTIVE','EXPIRED','INVALIDATED')", name="quotes_status"
        ),
        CheckConstraint(
            "amount > 0 AND fee_percentage >= 0 AND fee_amount >= 0 AND tax_amount >= 0",
            name="quotes_positive_amounts",
        ),
        CheckConstraint(
            "total_source_impact = amount + fee_amount + tax_amount AND destination_payment_amount = amount",
            name="quotes_accounting",
        ),
    )
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Keep quotes/audits after card removal; deleted references become NULL.
    source_card_id: Mapped[str | None] = mapped_column(
        ForeignKey("cards.id", ondelete="SET NULL"), nullable=True
    )
    destination_card_id: Mapped[str | None] = mapped_column(
        ForeignKey("cards.id", ondelete="SET NULL"), nullable=True
    )
    route_type: Mapped[str] = mapped_column(String(24), default="CARD_TO_CARD")
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    fee_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    fee_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    total_source_impact: Mapped[Decimal] = mapped_column(Numeric(16, 2))
    destination_payment_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    eligible: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE")
    reason_codes: Mapped[list] = mapped_column(JSONB, default=list)
    checks: Mapped[list] = mapped_column(JSONB)
    source_snapshot: Mapped[dict] = mapped_column(JSONB)
    destination_snapshot: Mapped[dict] = mapped_column(JSONB)
    source_fingerprint: Mapped[dict] = mapped_column(JSONB)
    destination_fingerprint: Mapped[dict] = mapped_column(JSONB)
    config_snapshot: Mapped[dict] = mapped_column(JSONB)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )


class RouteQuoteAudit(Base):
    __tablename__ = "route_quote_audits"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('ROUTE_QUOTE_CREATED','ROUTE_QUOTE_REJECTED','ROUTE_QUOTE_EXPIRED','ROUTE_QUOTE_INVALIDATED')",
            name="quote_audit_event",
        ),
    )
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    quote_id: Mapped[str | None] = mapped_column(
        ForeignKey("route_quotes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(String(40))
    source_card_id: Mapped[str] = mapped_column(String(36))
    destination_card_id: Mapped[str] = mapped_column(String(36))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    eligible: Mapped[bool] = mapped_column(Boolean)
    reason_codes: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
