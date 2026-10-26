import hashlib, secrets
from datetime import timedelta
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from fastapi import HTTPException
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import case
from app.core.config import settings
from app.models.user import AuthSession, LoginAttempt, now

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))


def verify(password, hashed):
    try:
        return hasher.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def rate_limit(db, email, ip):
    # PostgreSQL atomic upsert shares limits across workers. Never trust forwarded IP headers.
    for identity in ("email:" + email, "ip:" + ip):
        key = hashlib.sha256(identity.encode()).hexdigest()
        start = now()
        cutoff = start - timedelta(minutes=15)
        stmt = insert(LoginAttempt).values(key=key, count=1, window_start=start)
        stmt = stmt.on_conflict_do_update(
            index_elements=["key"],
            set_={
                "count": case(
                    (LoginAttempt.window_start < cutoff, 1),
                    else_=LoginAttempt.count + 1,
                ),
                "window_start": case(
                    (LoginAttempt.window_start < cutoff, start),
                    else_=LoginAttempt.window_start,
                ),
            },
        ).returning(LoginAttempt.count)
        count = db.execute(stmt).scalar_one()
        db.commit()
        if count > (10 if identity.startswith("email:") else 100):
            raise HTTPException(
                429,
                "Too many attempts. Try again in 15 minutes.",
                headers={"Retry-After": "900"},
            )


def create_session(db, user, response):
    expires = now() + timedelta(hours=8)
    session = AuthSession(id=secrets.token_hex(32), user_id=user.id, expires_at=expires)
    db.add(session)
    user.last_login = now()
    db.commit()
    token = jwt.encode(
        {"sub": user.id, "sid": session.id, "exp": expires},
        settings().jwt_secret,
        algorithm="HS256",
    )
    response.set_cookie(
        "cardroute_session",
        token,
        httponly=True,
        secure=settings().app_env == "production",
        samesite="lax",
        max_age=28800,
        path="/",
    )
