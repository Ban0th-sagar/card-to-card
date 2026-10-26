from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from app.api.dependencies import current_user
from app.db.session import get_db
from app.models.card import Card
from app.schemas.card import CardCreate, CardPatch, CardOut, DashboardOut
from app.services.cards import owned_card, dashboard

router = APIRouter(tags=["Cards"])


@router.post("/cards", response_model=CardOut, status_code=201)
def create(body: CardCreate, user=Depends(current_user), db=Depends(get_db)):
    card = Card(user_id=user.id, **body.model_dump())
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.get("/cards", response_model=list[CardOut])
def listing(user=Depends(current_user), db=Depends(get_db)):
    return list(
        db.scalars(
            select(Card)
            .where(Card.user_id == user.id)
            .order_by(Card.created_at.desc(), Card.id)
        )
    )


@router.get("/cards/{card_id}", response_model=CardOut)
def details(card_id: UUID, user=Depends(current_user), db=Depends(get_db)):
    return owned_card(db, user.id, card_id)


@router.patch("/cards/{card_id}", response_model=CardOut)
def update(
    card_id: UUID, body: CardPatch, user=Depends(current_user), db=Depends(get_db)
):
    card = owned_card(db, user.id, card_id, lock=True)
    changes = body.model_dump(exclude_unset=True)
    existing = {key: getattr(card, key) for key in CardCreate.model_fields}
    try:
        CardCreate.model_validate(existing | changes)
    except ValidationError as exc:
        raise HTTPException(422, "; ".join(error["msg"] for error in exc.errors()))
    for key, value in changes.items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return card


@router.delete("/cards/{card_id}", status_code=204)
def remove(card_id: UUID, user=Depends(current_user), db=Depends(get_db)):
    card = owned_card(db, user.id, card_id, lock=True)
    db.delete(card)
    db.commit()


@router.get("/dashboard", response_model=DashboardOut)
def summary(user=Depends(current_user), db=Depends(get_db)):
    return dashboard(db, user.id)
