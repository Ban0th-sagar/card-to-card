from uuid import UUID
from fastapi import APIRouter, Depends
from app.api.dependencies import current_user
from app.db.session import get_db
from app.schemas.card_route import RouteValidationRequest
from app.schemas.route_quote import QuoteResult
from app.services.quotes import create_quote, revalidate_quote

router = APIRouter(tags=["Simulated route quotes"])


@router.post(
    "/routes/quote", response_model=QuoteResult, response_model_exclude_none=True
)
def quote(body: RouteValidationRequest, user=Depends(current_user), db=Depends(get_db)):
    return create_quote(db, user.id, body)


@router.get(
    "/routes/quotes/{quote_id}",
    response_model=QuoteResult,
    response_model_exclude_none=True,
)
def get_quote(quote_id: UUID, user=Depends(current_user), db=Depends(get_db)):
    return revalidate_quote(db, user.id, quote_id)
