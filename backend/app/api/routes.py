from fastapi import APIRouter, Depends, Request, Response, HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.db.session import get_db
from app.models.user import User, AuthSession
from app.schemas.user import Register, Login, UserOut, ProfileUpdate
from app.services.auth import hasher, verify, DUMMY_HASH, rate_limit, create_session
from app.api.dependencies import current_user
from app.core.config import settings

router = APIRouter(prefix="/api")


@router.get("/health")
def health(db=Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Database unavailable")
    return {"status": "ok", "database": "connected", "environment": settings().app_env}


@router.post("/auth/register", response_model=UserOut, status_code=201)
def register(body: Register, request: Request, db=Depends(get_db)):
    rate_limit(db, body.email, request.client.host)
    user = User(
        email=body.email, name=body.name, password_hash=hasher.hash(body.password)
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with this email already exists")
    return user


@router.post("/auth/login", response_model=UserOut)
def login(body: Login, request: Request, response: Response, db=Depends(get_db)):
    rate_limit(db, body.email, request.client.host)
    user = db.scalar(select(User).where(User.email == body.email))
    valid = verify(body.password, user.password_hash if user else DUMMY_HASH)
    if not valid or not user or user.status != "ACTIVE":
        raise HTTPException(401, "Invalid email or password")
    create_session(db, user, response)
    return user


@router.get("/auth/me", response_model=UserOut)
def me(user=Depends(current_user)):
    return user


@router.post("/auth/logout", status_code=204)
def logout(
    request: Request, response: Response, user=Depends(current_user), db=Depends(get_db)
):
    db.delete(db.get(AuthSession, request.state.session_id))
    db.commit()
    response.delete_cookie("cardroute_session", path="/")


@router.patch("/users/me", response_model=UserOut)
def update(body: ProfileUpdate, user=Depends(current_user), db=Depends(get_db)):
    user.name = body.name
    db.commit()
    db.refresh(user)
    return user


from app.api.cards import router as cards_router

router.include_router(cards_router)

from app.api.card_route import router as card_route_router

router.include_router(card_route_router)

from app.api.quotes import router as quotes_router

router.include_router(quotes_router)
