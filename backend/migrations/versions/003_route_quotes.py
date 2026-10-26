"""Simulation route flags, quotes, and credential-free audit events."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "003"
down_revision = "002"


def upgrade():
    for name in ["card_to_card_source_enabled", "card_to_card_destination_enabled"]:
        op.add_column(
            "cards",
            sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.true()),
        )
    op.create_table(
        "route_quotes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_card_id",
            sa.String(36),
            sa.ForeignKey("cards.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "destination_card_id",
            sa.String(36),
            sa.ForeignKey("cards.id", ondelete="SET NULL"),
        ),
        sa.Column("route_type", sa.String(24), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("fee_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("fee_amount", sa.Numeric(16, 2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(16, 2), nullable=False),
        sa.Column("total_source_impact", sa.Numeric(16, 2), nullable=False),
        sa.Column("destination_payment_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("eligible", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        *[
            sa.Column(name, JSONB(), nullable=False)
            for name in [
                "reason_codes",
                "checks",
                "source_snapshot",
                "destination_snapshot",
                "source_fingerprint",
                "destination_fingerprint",
                "config_snapshot",
            ]
        ],
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("route_type = 'CARD_TO_CARD'", name="quotes_route_type"),
        sa.CheckConstraint(
            "status IN ('ACTIVE','EXPIRED','INVALIDATED')", name="quotes_status"
        ),
        sa.CheckConstraint(
            "amount > 0 AND fee_percentage >= 0 AND fee_amount >= 0 AND tax_amount >= 0",
            name="quotes_positive_amounts",
        ),
        sa.CheckConstraint(
            "total_source_impact = amount + fee_amount + tax_amount AND destination_payment_amount = amount",
            name="quotes_accounting",
        ),
    )
    op.create_index("ix_route_quotes_user_id", "route_quotes", ["user_id"])
    op.create_index("ix_route_quotes_expires_at", "route_quotes", ["expires_at"])
    op.create_table(
        "route_quote_audits",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "quote_id",
            sa.String(36),
            sa.ForeignKey("route_quotes.id", ondelete="SET NULL"),
        ),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("source_card_id", sa.String(36), nullable=False),
        sa.Column("destination_card_id", sa.String(36), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("eligible", sa.Boolean(), nullable=False),
        sa.Column("reason_codes", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "event_type IN ('ROUTE_QUOTE_CREATED','ROUTE_QUOTE_REJECTED','ROUTE_QUOTE_EXPIRED','ROUTE_QUOTE_INVALIDATED')",
            name="quote_audit_event",
        ),
    )
    op.create_index("ix_route_quote_audits_user_id", "route_quote_audits", ["user_id"])
    op.create_index(
        "ix_route_quote_audits_quote_id", "route_quote_audits", ["quote_id"]
    )


def downgrade():
    op.drop_table("route_quote_audits")
    op.drop_table("route_quotes")
    op.drop_column("cards", "card_to_card_source_enabled")
    op.drop_column("cards", "card_to_card_destination_enabled")
