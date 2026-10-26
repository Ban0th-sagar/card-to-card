# Step 4 — simulated Card-to-Card quote and eligibility engine

Implemented and verified on 2026-10-26. No payment provider, balance movement, transaction execution, ledger, webhook, refund or settlement was added.

## Changes

New backend files: `app/models/route_quote.py`, `app/schemas/route_quote.py`, `app/services/eligibility.py`, `app/services/quotes.py`, `app/api/quotes.py`, migration `003_route_quotes.py`, and `tests/test_quotes.py`.

Existing backend integration: quote router registration, migration model discovery, card simulation flags and safe card schemas, three configuration settings, and supported/unsupported fictional seeds. Authentication and the standalone Step 3 validation service were preserved.

Frontend additions: `quotes.ts`, `QuoteContinuation.tsx`, `PaymentPlaceholder.tsx` and `tests/quotes.spec.ts`. Route Options is now a quote analysis screen. The shared card form exposes simulation flags; structural results request quotes through the new continuation button. Styles, navigation, README, architecture and phase-specific tests were updated. The former Step 4 placeholder expectation in Step 3 tests now checks the implemented eligible quote page.

The checkout had no committed baseline before this work: previous Steps 1–3 were untracked. The requested Step 4 commit therefore captures the existing application foundation together with this step. Ignored `.env`, `.local` database/credential files, virtual environments, dependency caches, builds and test artifacts are excluded.

## Database migration and API

Migration **003**, after unchanged 001/002:

- Adds `cards.card_to_card_source_enabled` and `card_to_card_destination_enabled`, both default true.
- Adds `route_quotes` with owner, nullable card references, amount/fee/tax/accounting fields, eligibility/status, reasons/checks, safe snapshots/fingerprints/configuration, expiry and timestamps.
- Adds `route_quote_audits` with CREATED, REJECTED, EXPIRED and INVALIDATED lifecycle events, internal IDs, user, amount, eligibility and reasons. No authentication or full card credentials are logged.

Endpoints:

- `POST /api/routes/quote`: accepts only source_card_id, destination_card_id and amount; repeats Step 3 validation before quoting.
- `GET /api/routes/quotes/{quote_id}`: owner-scoped authoritative expiry/staleness revalidation. Foreign/missing quote IDs return the same 404.

Eligible attempts create an ACTIVE quote plus creation audit. Rejected attempts produce an audit but **no ACTIVE quote**. Structurally invalid requests receive no fee quote. Quote expiry and invalidation are persisted/audited on access; repeated reads do not duplicate lifecycle events. No background expiry scheduler is included. Card deletion preserves the quote/audit via nullable references and causes unusable status on revalidation. Any card edit conservatively requires a fresh quote.

## Pricing and eligibility

Configuration defaults:

| Setting | Default |
| --- | --- |
| CARD_TO_CARD_FEE_PERCENT | 1.25 |
| CARD_TO_CARD_DEMO_LIMIT | 25000 |
| ROUTE_QUOTE_EXPIRY_SECONDS | 300 |

The settings are in `.env.example`, Pydantic configuration and Compose. Quotes are offered only in development/simulation mode, not production mode. Amounts are Decimal/NUMERIC; fees round HALF_UP to paise. Tax is exactly zero. Source impact = amount + fee + tax. Destination payment = amount, never amount + fee.

Eligibility checks cover active cards, different IDs, positive valid amount, source availability, destination outstanding, both simulation support flags, supported environment, inclusive demo limit, and total source impact within availability. Reasons include SOURCE_ROUTE_DISABLED, DESTINATION_ROUTE_DISABLED, INSUFFICIENT_CREDIT_AFTER_FEES, EXCEEDS_ROUTE_LIMIT, ROUTE_NOT_ELIGIBLE, QUOTE_EXPIRED and existing structural reasons.

The quote page displays safe FROM/TO metadata, amounts/fee/tax/total, previews, checklist, countdown, simulation explanation and failures. It uses server time plus monotonic elapsed time for the UX clock. Continue is disabled at local expiry and always makes an authoritative GET before opening the protected Step 5 placeholder. Refresh requests a new quote after current structural validation. Stored card balances/timestamps do not change because of quoting.

## Exact verification results

| Check | Result |
| --- | --- |
| Complete backend Step 1–4 suite | **168 passed**, 0 failed, 0 skipped (122 prior cases + 46 new quote cases) |
| Complete frontend Step 1–4 suite | **36 passed**, 0 failed, 0 skipped |
| Desktop 1440 × 1000 | 12 passed |
| Tablet 820 × 1180 | 12 passed |
| Mobile 390 × 844 | 12 passed |
| TypeScript / Vite production build | Passed |
| Alembic upgrade 003 and schema check | Passed; no schema drift |
| Docker image `cardroute:step4` | Built successfully with TLS verification |
| Docker/PostgreSQL smoke test | Passed; migrations 001–003 and custom PORT verified |
| Compose configuration validation | Passed |
| Original development instance after testing | Healthy; original database preserved |

Backend coverage includes ₹10,000 → ₹125 fee / ₹10,125 total / ₹10,000 destination, HALF_UP paise boundaries, fee-inclusive insufficient credit, exact source-total boundary, exact ₹25,000 demo boundary, excess limit, route flags, inactive/blocked cards, low/zero destination outstanding, identical IDs, malformed/extra client fields, expiry/audit idempotence, quote/card ownership, deletion, changed financial/status/flag values, configurable fee/limit/expiry, production guard and fresh seed support flags. Card snapshots before/after quoting are compared to prove no balance/timestamp mutation.

Frontend coverage adds fee/total/previews, request-before-quote ordering, quote persistence/reload, checklist/countdown, expired UI/disabled Continue, fresh quote IDs, ineligible fee/limit/support cases, stale quote rejection at Continue, Step 5-only navigation and horizontal overflow. The full run used a disposable PostgreSQL browser-test database with the normal authentication/rate limits; it was removed and the original development backend restored. Unit tests use only the guarded cardroute_test database.

An initial browser run found that navigation state could briefly render before the authoritative quote GET completed, interfering with expiry checks. Quote pages now wait for that GET before rendering eligibility. Targeted expiry/refresh checks and the final full suite passed. Frontend clock tests advance the browser clock; backend expiry tests separately control server time. No tests/assertions or authentication controls were disabled. One existing upstream Starlette/httpx deprecation warning remains non-fatal.

The Docker smoke test verified quote fee/accounting/previews, limit and fee-inclusive rejection, stale invalidation, unchanged card balances, and existing account/card/dashboard/logout behavior. Disposable containers, anonymous volumes and network were removed. The cloud build used its existing proxy and trusted CA as an optional BuildKit secret; TLS verification was never bypassed.

To reproduce, with PostgreSQL/API/Vite running:

```bash
cd backend
../.venv/bin/python -m pytest -q
../.venv/bin/alembic check
cd ../frontend
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

If system Chromium is unavailable, install it with Playwright and omit the executable override. Repeated browser runs consume the real development IP login limit; use a disposable test database for extensive repeats rather than weakening authentication.

## Exact manual acceptance flow

Start from the repository root with Node 24/Python 3.12:

```bash
bash scripts/install.sh
npm start --prefix tools/postgres
```

Keep PostgreSQL running. In two additional terminals from the root:

```bash
bash scripts/backend.sh
```

```bash
npm run dev --prefix frontend
```

Open the local frontend on port 5173. The backend startup applies migration 003. No additional secret is required.

1. Register/sign in. Add ACTIVE **Nova Platinum** (Nova Bank, last four 1234, limit 100000, outstanding 10000, minimum due 2000, any valid due date) and **Zenith Rewards** (Zenith Bank, last four 5678, limit 100000, outstanding 30000, minimum due 2000, any valid due date). Leave both simulation flags enabled.
2. Open Pay / Route, select Nova → Zenith, enter **10000**, and select Check Request. Expect REQUEST VALID. Select Continue to Route Options.
3. Expect ELIGIBLE, amount **₹10,000**, fee **₹125**, tax **₹0**, total source impact **₹10,125**, destination payment **₹10,000**, source preview **₹90,000 → ₹79,875**, destination preview **₹30,000 → ₹20,000**, passing checks and a five-minute countdown.
4. Select Continue to Payment. Expect only “Payment transaction execution will be implemented in Step 5.” Return to Cards; balances remain exactly as entered.
5. Edit Nova outstanding to **89950**, leaving limit 100000 (available **₹10,050**). Start a fresh Nova → Zenith request for 10000. Step 3 passes, but the quote must show NOT ELIGIBLE / INSUFFICIENT CREDIT AFTER FEES, required **₹10,125** versus available **₹10,050**. No active quote or balance movement is created for this rejected request.
6. Restore Nova outstanding to 10000. Start a request for **30000** to Zenith. Structural validation passes at the destination boundary; quote eligibility fails with ROUTE LIMIT EXCEEDED and current maximum **₹25,000**. The amount must remain ₹30,000, not be silently reduced.
7. Edit a card and disable its source or destination simulation flag. A structurally valid request using that role must fail with the corresponding route-disabled explanation. These flags are simulation metadata, not actual provider capabilities.
8. Generate another eligible quote. Wait five minutes: QUOTE EXPIRED appears and Continue is disabled. Refresh Quote must create a new quote and restart the countdown. For a faster local check only, temporarily configure ROUTE_QUOTE_EXPIRY_SECONDS=5 and restart the backend, then restore 300 afterward.
9. Generate an eligible quote, edit either card through Cards, then return to the quote and select Continue (or reload). Expect QUOTE INVALIDATED and a refresh requirement. Removing either card similarly invalidates the quote; choose new cards rather than using the old ID.
10. Sign in as a second user in a separate browser session and open the first user's quote URL. Expect Quote not found, with no foreign card details.
11. Optional: run the seed command from README for a **new** demo account. Nova/Zenith are supported; Orbit is disabled as source and Vertex as destination. Existing demo accounts are deliberately not rewritten.

## Git and remaining scope

Branch: `feature/step4-quote-engine`. Requested commit message: `Implement Step 4 card-to-card quote engine`. The branch is pushed without merging; the final chat report contains the resulting commit hash and push outcome.

No known functional Step 4 issue remains. Estimates are simulation-only. Quotes do not reserve funds, prove provider support or authorize execution. Expiry audits are recorded lazily on access; no scheduler is claimed. Step 5 must call authoritative revalidation before implementing its own execution-time locking/accounting. No Step 5 code beyond the static placeholder exists.

Cloud startup instructions and three non-secret configuration defaults were saved in the environment draft. This does not publish or deploy the app. Review/save settings and publish the environment separately to reuse a new snapshot; fresh-task restoration is not claimed.
