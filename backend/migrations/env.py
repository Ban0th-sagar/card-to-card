from alembic import context
from app.db.session import Base, engine
from app.models.user import User, AuthSession, LoginAttempt
from app.models.card import Card
from app.models.route_quote import RouteQuote, RouteQuoteAudit

with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
