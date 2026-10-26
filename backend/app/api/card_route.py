from fastapi import APIRouter, Depends
from app.api.dependencies import current_user
from app.db.session import get_db
from app.schemas.card_route import RouteValidationRequest, RouteValidationResult
from app.services.card_route import validate_request

router = APIRouter(tags=["Card route validation"])


@router.post("/card-route/validate", response_model=RouteValidationResult)
def validate(
    body: RouteValidationRequest, user=Depends(current_user), db=Depends(get_db)
):
    return validate_request(db, user.id, body)
