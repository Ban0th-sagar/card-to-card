from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import select, func
from fastapi import HTTPException
from app.models.card import Card, utilization


def owned_card(db, user_id, card_id, *, lock=False):
    query = select(Card).where(Card.id == str(card_id), Card.user_id == user_id)
    if lock:
        query = query.with_for_update()
    card = db.scalar(query)
    # Identical response for missing cards and cards owned by somebody else.
    if card is None:
        raise HTTPException(404, "Card not found")
    return card


def dashboard(db, user_id):
    count, limit, outstanding, available = db.execute(
        select(
            func.count(Card.id),
            func.coalesce(func.sum(Card.credit_limit), 0),
            func.coalesce(func.sum(Card.outstanding_balance), 0),
            func.coalesce(func.sum(Card.available_credit), 0),
        ).where(Card.user_id == user_id)
    ).one()
    cards = list(
        db.scalars(
            select(Card)
            .where(Card.user_id == user_id)
            .order_by(Card.created_at.desc(), Card.id)
            .limit(4)
        )
    )
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    upcoming = db.scalar(
        select(Card)
        .where(Card.user_id == user_id, Card.due_date >= today)
        .order_by(Card.due_date, Card.created_at, Card.id)
        .limit(1)
    )
    return dict(
        total_cards=count,
        total_credit_limit=limit,
        total_outstanding=outstanding,
        total_available_credit=available,
        portfolio_utilization=utilization(outstanding, limit),
        cards=cards,
        upcoming_due=upcoming,
    )
