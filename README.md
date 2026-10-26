# CardRoute — Smarter credit routing.

Step 4: React/TypeScript, FastAPI/Pydantic, PostgreSQL/SQLAlchemy and Alembic. Secure accounts, card management, structural validation and a simulated Card-to-Card quote/eligibility engine. Quotes include a configurable 1.25% fee, fee-aware availability checks, previews, five-minute expiry and audit events. Activity and Step 5 payment execution remain placeholders. No real provider, money movement, payment transaction or ledger is implemented.

## Local development (Node 24, Python 3.12, Linux/macOS)

From the repository root:

```bash
bash scripts/install.sh
npm start --prefix tools/postgres
```

Keep that terminal open. The optional local launcher runs real PostgreSQL on **127.0.0.1:5432**, creates `cardroute` and `cardroute_test`, and generates an ignored `.env` with random local credentials only if one does not already exist. It stores development data in ignored `.local/`. It does not overwrite an existing `.env`. Port 5432 must be free. This helper is for local development only.

In a second terminal, from the repository root:

```bash
bash scripts/backend.sh
```

In a third terminal:

```bash
npm run dev --prefix frontend
```

Open the frontend on port **5173**. The API listens on port **8000**. Use `localhost` consistently, matching `FRONTEND_URL=http://localhost:5173`. Vite proxies `/api` to FastAPI. Register, then sign in. The backend also serves the compiled frontend on port 8000 after a build, but for that mode set `FRONTEND_URL=http://localhost:8000` and restart the backend.

### Using your own PostgreSQL instead

Copy `.env.example` to `.env`; fill `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/cardroute`, a randomly generated `JWT_SECRET` of at least 32 characters, `APP_ENV=development`, and `FRONTEND_URL=http://localhost:5173`. Create the databases `cardroute` and `cardroute_test` with your PostgreSQL administrator. Skip the local launcher; the remaining commands are identical. URL-encode credentials in connection URLs. Do not commit `.env`.

## Tests and build

Start PostgreSQL first. From the repository root:

```bash
cd backend
../.venv/bin/python -m pytest -q
cd ../frontend
npm run build
npx playwright install chromium
npm run test:e2e
```

For browser tests keep the API and Vite processes running. If Chromium is already installed, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` instead of downloading it. Tests cover desktop, tablet and **390 × 844** mobile. Browser tests create uniquely named test accounts in the development database.

Backend tests migrate and truncate **only `cardroute_test`**. They default to the configured database URL with its final database name replaced by `cardroute_test`; optionally set `TEST_DATABASE_URL` to a URL ending in `/cardroute_test`. Never run tests against valuable data. Backend fixtures reject any other database name. Restarting PostgreSQL preserves local accounts; Ctrl+C shuts down the helper cleanly.

## Docker (prepared, not deployed)

From the repository root, in a shell without an exported development `FRONTEND_URL`:

```bash
export POSTGRES_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(48))')"
export FRONTEND_URL=http://localhost:8000
export APP_ENV=development
docker compose up --build
```

Open port **8000**. Compose provisions PostgreSQL, waits for readiness, runs migrations, and serves the built frontend and API together. Keep the database password stable when reusing the named volume. The generated `.env` is only used for local development; Compose explicitly sets its own service database URL. Docker requires a working Docker engine. No deployment is performed.

Production requires HTTPS, `APP_ENV=production` (Secure cookies), an exact HTTPS `FRONTEND_URL`, private database networking, stable secrets supplied through environment settings and a controlled migration release process. Do not expose the development server publicly. See [architecture and security](docs/architecture.md).

## Optional fictional demo cards

Do not seed ordinary users. From the repository root, after PostgreSQL is running:

```bash
cd backend
../.venv/bin/alembic upgrade head
../.venv/bin/python scripts/seed_demo.py
```

Choose a password at the hidden prompt, then sign in as `demo@example.com`. For noninteractive local usage, supply `CARDROUTE_DEMO_PASSWORD` through your process environment, never in committed files. The script runs only in development, creates a new demo account and four cards from fictional Nova, Zenith, Orbit and Vertex banks. New seeds leave Nova/Zenith enabled, disable Orbit as a simulation source and disable Vertex as a simulation destination. It refuses to change any existing account using that email, including an existing demo. Repeating it makes no changes. It never seeds the currently signed-in user.

## API

- `GET /api/health`: live database check, 503 on failure.
- `POST /api/auth/register`: `name`, `email`, `password`, `confirm_password`; creates CUSTOMER, then sign in.
- `POST /api/auth/login`: `email`, `password`; sets HttpOnly session cookie.
- `GET /api/auth/me`: authenticated public user fields.
- `POST /api/auth/logout`: revokes database session and clears cookie.
- `PATCH /api/users/me`: authenticated name update only.
- `POST /api/cards`: create metadata using the signed-in user; server defaults apply to omitted financial fields.
- `GET /api/cards`: list only the current user's cards.
- `GET /api/cards/{id}`: owner-only safe card details.
- `PATCH /api/cards/{id}`: partial metadata/balance update, with merged financial validation.
- `DELETE /api/cards/{id}`: owner-only hard delete.
- `POST /api/routes/quote`: reruns structural validation, then computes simulation eligibility and fee-inclusive source impact. Eligible attempts create an owner-scoped ACTIVE quote and creation audit; rejected attempts create only an audit and clear reason codes.
- `GET /api/routes/quotes/{id}`: owner-only quote lookup; authoritatively checks expiry, current card snapshots/flags and settings. Expired or stale quotes become unusable with reason codes and audit events. This is the required revalidation service entry point for future use.
- `GET /api/dashboard`: owner-scoped aggregate totals, weighted utilization, latest four cards and nearest upcoming due.
- `POST /api/card-route/validate`: authenticated, read-only structural request validation. Send only `source_card_id`, `destination_card_id`, and `amount` (prefer decimal strings). Missing/foreign cards return an identical 404 with no card data. Malformed IDs/currency or extra fields return 422. Well-formed requests return 200 with `valid`, safe source/destination snapshots, amount, ten checks, `reason_codes`, and user-facing failures. Zero/negative amounts return `valid: false` and `INVALID_AMOUNT`; dependent money checks are not evaluated. Both cards must belong to the session user, be ACTIVE, differ, and have sufficient source availability/destination outstanding. No writes or reservations occur.

Card requests accept `nickname`, `issuer_name`, `card_name`, `network`, `last_four`, `credit_limit`, `outstanding_balance`, `minimum_due`, `due_date` and `status`. Create requires issuer name, card name, last four digits and an ISO date. Optional financial defaults are ₹1,00,000 limit, ₹10,000 outstanding and ₹2,000 minimum due; network defaults to Visa and status to ACTIVE. Use decimal strings (for example `"10000.05"`) to preserve exact money amounts. Available credit and utilization are calculated by the backend. User IDs and calculated fields are rejected on input. Unknown or foreign card IDs both return 404.

Money is serialized as decimal strings and stored in `NUMERIC(14,2)`; amounts with more than two decimal places are rejected. Dashboard totals include all card statuses. Upcoming due includes today and later using the Asia/Kolkata calendar; overdue dates are excluded. These are manually entered balances and dates, not a bank connection or a payment instruction.

All mutation requests must include `X-Requested-With: CardRoute` and use the configured frontend Origin. Send cookies with requests. Development OpenAPI documentation is at `/api/docs`. Users contain no payment data. See [Step 4 validation results](docs/step-4-validation.md).

When building behind a trusted enterprise TLS proxy, the Dockerfile optionally accepts a BuildKit CA bundle without copying it into the image: `docker build --secret id=build_ca,src=/path/to/trusted-ca-bundle.pem -t cardroute:step1 .`. Configure your proxy and DNS through the Docker engine as appropriate. Certificate verification stays enabled. This is unnecessary on ordinary local networks.


## Step 3 request check

Sign in and add at least two ACTIVE cards. Open **Pay / Route** (or use **Use as Source** on a card). Choose FROM and TO, enter an INR amount, then select **Check Request**. Inactive/blocked cards and the opposite selection are disabled. Quick amounts use the destination minimum due/outstanding; Swap exchanges selections. Any input change clears the result and cancels pending validation. A successful structural result exposes Continue to Route Options, which calls the new quote endpoint. The structural endpoint remains read-only and does not replace fee-aware quote eligibility. Both endpoints reload authoritative card data.

See the [manual acceptance flow](docs/step-3-validation.md#manual-acceptance-flow). Existing startup commands are unchanged; no Step 3 migration or additional environment secret is needed.


## Step 4 simulated quote engine

After Check Request succeeds, select **Continue to Route Options**. Eligible quotes display the transfer amount, estimated fee, zero tax, total source impact, destination payment, balance previews and countdown. Continue to Payment performs another authoritative quote GET before opening the protected Step 5 placeholder. It never executes a payment. Refresh Quote creates a new quote after rerunning structural checks. Quotes are available only when APP_ENV is development or simulation; production mode rejects this demo route.

Configuration (also in `.env.example` and Docker Compose):

| Variable | Development default |
| --- | --- |
| CARD_TO_CARD_FEE_PERCENT | 1.25 |
| CARD_TO_CARD_DEMO_LIMIT | 25000 |
| ROUTE_QUOTE_EXPIRY_SECONDS | 300 |

For ₹10,000, the demo fee is ₹125 (ROUND_HALF_UP to paise), total source impact is ₹10,125, destination payment is ₹10,000, and tax is ₹0. The fee is never added to destination payment. User-supplied prices, availability, statuses or provider support are rejected. Amounts above the configured route limit are rejected without silent reduction.

Migration `003_route_quotes.py` adds simulation flags to cards, `route_quotes`, and `route_quote_audits`. Ordinary cards default both flags to true; the card editor exposes them as simulation settings. They do not represent real provider capabilities. Fresh demo seeds include supported and unsupported cases; rerunning a seed never rewrites an existing account.

Quotes retain safe snapshots; any subsequent card edit conservatively invalidates the old quote on authoritative revalidation. Deleted card foreign keys become NULL so quotes/audits survive and return an invalidated result. Expiry and invalidation statuses/audits are persisted lazily when the quote is read, including refresh/continuation checks. Repeated reads do not duplicate lifecycle events. Nothing reserves funds or changes card balances. See [manual acceptance instructions and results](docs/step-4-validation.md).
