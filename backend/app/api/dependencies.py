import jwt
from fastapi import Depends, Request, HTTPException
from app.db.session import get_db
from app.core.config import settings
from app.models.user import AuthSession, User, now


def current_user(request: Request, db=Depends(get_db)):
    try:
        data = jwt.decode(
            request.cookies.get("cardroute_session", ""),
            settings().jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "sid", "exp"]},
        )
        session = db.get(AuthSession, data["sid"])
        if not session or session.user_id != data["sub"] or session.expires_at <= now():
            raise ValueError()
        user = db.get(User, data["sub"])
        if not user or user.status != "ACTIVE":
            raise ValueError()
        request.state.session_id = session.id
        return user
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Authentication required")
