# Step 2 — credit card management validation

Completed 2026-10-26. Authentication from Step 1 was retained; the only middleware configuration extension adds DELETE to CORS for the new resource. No deployment or Step 3 work was performed.

## Results

| Check | Result |
| --- | --- |
| PostgreSQL migration `002`, following existing `001` | Passed in development, test and disposable Docker databases |
| `alembic check` | Passed; no schema drift |
| Complete backend pytest suite | **82 passed**, 0 failed, 0 skipped (19 existing authentication tests + 63 card/seed cases) |
| TypeScript + Vite production build | Passed |
| Complete Playwright suite | **12 passed**, 0 failed, 0 skipped |
| Desktop 1440 × 1000 | All 4 browser tests passed |
| Tablet 820 × 1180 | All 4 browser tests passed |
| Mobile 390 × 844 | All 4 browser tests passed |
| Docker image `cardroute:step2` | Built successfully with TLS verification enabled |
| Docker app + PostgreSQL smoke test | Passed, including custom `PORT=8123` |
| Running development API health | Healthy, PostgreSQL connected |

Backend checks cover create/defaults, decimal precision and rounding, financial bounds, supported networks/statuses, malformed dates/last-four values, extra and sensitive field rejection, listing, details, partial updates, automatic recalculation, invalid-update preservation, removal, authentication for all new endpoints, foreign-owner read/update/delete denial, owner-scoped dashboard data, weighted totals, empty portfolios, nearest future/today due dates, exclusion of past dates, latest-four card previews, database-level constraints, and repeat-safe demo-only seeding.

The browser suite preserves the Step 1 account/profile/logout/route-guard regressions and adds two Step 2 tests per screen size. The complete journey creates a card with ₹1,00,000 limit / ₹10,000 outstanding / ₹2,000 minimum due, verifies ₹90,000 available and 10% utilization, checks dashboard totals and upcoming due, edits outstanding to ₹15,000, verifies ₹85,000 / 15%, reloads to confirm persistence, checks changed dashboard totals, cancels removal once, then confirms deletion and verifies zero totals. Input/error coverage includes last-four validation, excessive outstanding/minimum due, saving-disabled state and recovery from an API failure. Layout checks detect horizontal overflow on list, form, details and dashboard.

Early runs found a test-fixture parameter collision and browser locator ambiguities. Those tests were corrected; the final complete runs above passed. Services were also restarted to load the newly added routes. No tests, assertions, tenant checks or authentication protections were disabled.

Docker validation used fresh disposable PostgreSQL and application containers on a private test network. It verified migrations, generated available credit, create/list/edit/delete, exact utilization, aggregate dashboard updates, existing authentication/profile/logout, SPA hosting and a non-default PORT. Its containers, anonymous volumes and network were removed afterward. The cloud build used its existing proxy and trusted CA through the optional BuildKit `build_ca` mount; certificate verification was never bypassed.

## Reproduce

From the repository root, with development PostgreSQL, backend and Vite running:

```bash
cd backend
../.venv/bin/python -m pytest -q
../.venv/bin/alembic check
cd ../frontend
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

Use `npx playwright install chromium` and omit `PLAYWRIGHT_CHROMIUM_EXECUTABLE` on machines without system Chromium. Backend tests use and truncate only the dedicated `cardroute_test` database. Browser tests create uniquely named development accounts. Completed card lifecycle tests delete their own card; older failed browser runs may leave test accounts or card metadata. Ordinary existing accounts and cards were not deleted. The optional seed was validated in the test database, not run against ordinary development users.

## Scope and remaining limitations

No known functional Step 2 issues remain. The upstream Starlette/httpx deprecation warning from Step 1 remains non-fatal. Balances and dates are manually entered metadata; no issuer synchronization exists. Totals include all statuses. Upcoming dues use the Asia/Kolkata calendar and include today. Utilization categories provide context only.

No full card number, PAN, CVV, PIN, OTP, bank credentials, source/destination selectors, route eligibility, provider architecture, payment simulation, payment API, transaction ledger, balance transfer or refinancing was added. Pay / Route and Activity remain placeholders. Password recovery remains the existing availability notice.

Reusable cloud startup instructions were updated for Step 2; the existing installer remains applicable. Draft persistence does not publish or deploy the environment. Review/save settings and publish the environment to activate a new reusable snapshot; fresh-task snapshot restoration is not claimed here.
