"""Owner-scoped credit card metadata and exact financial amounts."""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"


def upgrade():
    op.create_table(
        "cards",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("nickname", sa.String(100), nullable=False, server_default="My Card"),
        sa.Column("issuer_name", sa.String(100), nullable=False),
        sa.Column("card_name", sa.String(100), nullable=False),
        sa.Column("network", sa.String(24), nullable=False, server_default="Visa"),
        sa.Column("last_four", sa.String(4), nullable=False),
        sa.Column(
            "credit_limit", sa.Numeric(14, 2), nullable=False, server_default="100000"
        ),
        sa.Column(
            "outstanding_balance",
            sa.Numeric(14, 2),
            nullable=False,
            server_default="10000",
        ),
        sa.Column(
            "available_credit",
            sa.Numeric(14, 2),
            sa.Computed("credit_limit - outstanding_balance", persisted=True),
            nullable=False,
        ),
        sa.Column(
            "minimum_due", sa.Numeric(14, 2), nullable=False, server_default="2000"
        ),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("credit_limit > 0", name="cards_positive_limit"),
        sa.CheckConstraint(
            "outstanding_balance >= 0 AND outstanding_balance <= credit_limit",
            name="cards_valid_outstanding",
        ),
        sa.CheckConstraint(
            "minimum_due >= 0 AND minimum_due <= outstanding_balance",
            name="cards_valid_minimum",
        ),
        sa.CheckConstraint("last_four ~ '^[0-9]{4}$'", name="cards_valid_last_four"),
        sa.CheckConstraint(
            "network IN ('Visa','Mastercard','RuPay','American Express','Other')",
            name="cards_valid_network",
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE','INACTIVE','BLOCKED')", name="cards_valid_status"
        ),
        sa.CheckConstraint(
            "length(trim(issuer_name)) > 0 AND length(trim(card_name)) > 0",
            name="cards_nonblank_names",
        ),
    )
    op.create_index("ix_cards_user_id", "cards", ["user_id"])


def downgrade():
    op.drop_table("cards")
