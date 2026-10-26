"""Optional, development-only seed; never adds cards to an existing account."""

import getpass
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User
from app.models.card import Card
from app.services.auth import hasher

DEMO_EMAIL = "demo@example.com"


def seed_demo(db, password):
    if settings().app_env != "development":
        raise RuntimeError("Demo seeding is allowed only in development")
    if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
        return False
    if len(password) < 8 or len(password) > 128:
        raise ValueError("Demo password must be 8–128 characters")
    user = User(
        name="CardRoute Demo", email=DEMO_EMAIL, password_hash=hasher.hash(password)
    )
    db.add(user)
    db.flush()
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    for i, (issuer, name, limit, outstanding) in enumerate(
        [
            ("Nova Bank", "Platinum", "100000", "10000"),
            ("Zenith Bank", "Rewards", "100000", "30000"),
            ("Orbit Bank", "Prime", "120000", "20000"),
            ("Vertex Bank", "Classic", "80000", "5000"),
        ]
    ):
        db.add(
            Card(
                user_id=user.id,
                nickname=issuer.split()[0] + " " + name,
                issuer_name=issuer,
                card_name=name,
                network="Visa",
                card_to_card_source_enabled=i != 2,
                card_to_card_destination_enabled=i != 3,
                last_four=str(1001 + i),
                credit_limit=Decimal(limit),
                outstanding_balance=Decimal(outstanding),
                minimum_due=Decimal("2000"),
                due_date=today + timedelta(days=5 + i * 7),
            )
        )
    db.commit()
    return True


if __name__ == "__main__":
    with SessionLocal() as db:
        if settings().app_env != "development":
            raise SystemExit("Demo seeding is allowed only in development")
        if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
            print("Demo email already exists. No accounts or cards were changed.")
        else:
            password = os.environ.get("CARDROUTE_DEMO_PASSWORD") or getpass.getpass(
                "Choose a demo password (8–128 characters): "
            )
            seed_demo(db, password)
            print(
                "Created demo@example.com with four fictional cards. Sign in with your chosen password."
            )
