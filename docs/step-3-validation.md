# Step 3 — card selection and structural validation

Implemented on 2026-10-26. Steps 1 and 2 remain in place. Authentication, card storage, financial calculations and existing card-management services were retained. No money moves.

## Files and features

- Backend: `app/schemas/card_route.py`, `app/services/card_route.py`, `app/api/card_route.py`; registered through the existing `app/api/routes.py`.
- Frontend: `pages/PayRoute.tsx`, `pages/RouteOptions.tsx`, `components/RouteCardSelector.tsx`, `components/RouteResult.tsx`, `components/RouteCTA.tsx`, and `routeValidation.ts`.
- Existing UI integration: `App.tsx`, Dashboard, CardSummary, Activity-only Placeholder and responsive styles.
- Tests: `backend/tests/test_card_route.py`, `frontend/tests/route.spec.ts`; Playwright retains traces/screenshots for failed checks.
- Documentation: README, architecture guide and this report. Cloud startup draft updated to stop at Step 3.

No database migration is needed: validation reads the existing cards table and persists no route, transaction, audit event or validation token. Existing migrations remain `001` and `002`.

## API contract

`POST /api/card-route/validate` requires the existing authenticated session and mutation headers. Its only accepted input fields are source_card_id, destination_card_id and amount. Decimal strings are recommended. Authoritative fields such as user_id, credit_limit, available_credit, outstanding_balance and status are rejected on input.

Missing/foreign card IDs return the same generic HTTP 404 without source/destination snapshots. Malformed IDs, non-finite amounts, invalid currency strings, excessive precision or extra fields return HTTP 422. Well-formed requests return HTTP 200 with valid, safe authoritative card snapshots, amount, ten checks, reason_codes and failures. Zero/negative decimal amounts return valid:false with INVALID_AMOUNT; dependent balance checks have passed:null and are not evaluated.

All ten checks are represented once access succeeds: SOURCE_CARD_EXISTS, DESTINATION_CARD_EXISTS, SOURCE_CARD_OWNED_BY_USER, DESTINATION_CARD_OWNED_BY_USER, SOURCE_ACTIVE, DESTINATION_ACTIVE, SOURCE_DESTINATION_DIFFERENT, VALID_AMOUNT, SOURCE_AVAILABLE_CREDIT_SUFFICIENT and DESTINATION_OUTSTANDING_SUFFICIENT. Same cards return SOURCE_DESTINATION_SAME. Available/outstanding boundaries are inclusive. An empty destination returns DESTINATION_HAS_NO_OUTSTANDING. Status messages explain that neither INACTIVE nor BLOCKED cards can participate.

The service loads both owner-scoped cards in one SELECT, uses Decimal comparisons, and performs no writes. This is structural validity at request time, not a quote, provider eligibility, a reservation or payment approval. Later steps must reload and revalidate data independently.

## Manual acceptance flow

Start the existing application as documented in README. No new environment variables are required. Sign in and create these fictional ACTIVE cards if not already present:

| Field | Source | Destination | Low-availability source |
| --- | --- | --- | --- |
| Nickname | Nova Platinum | Zenith Rewards | Orbit Low Available |
| Issuer | Nova Bank | Zenith Bank | Orbit Bank |
| Card name | Platinum | Rewards | Prime |
| Last four | 1234 | 5678 | 9012 |
| Limit | 100000 | 100000 | 10000 |
| Outstanding | 10000 | 30000 | 2000 |
| Minimum due | 2000 | 2000 | 500 |
| Due date | Any valid date | Any valid date | Any valid date |

1. Open Pay / Route from navigation, the Dashboard's Pay Another Card CTA, or a card's Use as Source link.
2. Choose Nova Platinum as FROM and Zenith Rewards as TO. Confirm source availability is ₹90,000 and destination outstanding is ₹30,000.
3. Enter 10000 and select Check Request. Expect REQUEST VALID, amount ₹10,000, ten passed checks and Continue to Route Options.
4. Change the amount to 40000. The old result and continuation link disappear immediately. Check again; expect REQUEST CANNOT CONTINUE and an explanation that the amount exceeds destination outstanding.
5. Select Change Request, enter 10000 and choose Orbit Low Available as FROM. Check again; expect insufficient source available credit (₹8,000).
6. Return FROM to Nova Platinum. In TO, Nova Platinum must be disabled because the same card cannot fill both roles. The backend independently rejects identical IDs with SOURCE_DESTINATION_SAME.
7. Choose Nova → Zenith and validate 10000 again. Swap Cards; the old result disappears. Selections become Zenith → Nova. Check again; 10000 is valid at the destination's exact outstanding boundary.
8. Try Minimum Due, 25%, 50%, Full Outstanding and Custom. Each selection changes the amount and clears any old validation. Percentage presets round half-up to the nearest paise. Invalid amounts remain subject to backend checks.
9. From a valid result select Continue to Route Options. Expect only: “Route pricing and provider eligibility will be added in Step 4.” No payment is initiated.
10. Return to Cards/Dashboard and confirm that validation did not alter balances, card status or timestamps.
11. Mark an extra test card INACTIVE or BLOCKED through normal card editing. It remains visible but disabled in both selectors. With fewer than two active cards, Pay / Route shows the add/manage-card state instead of the form.
12. Check on desktop, tablet and 390 × 844 mobile. Inputs remain editable during a request; editing cancels/invalidates its response, so an old successful check cannot restore a continuation link.

For a backend-only same-card check, use the authenticated browser console:

```javascript
const cards = await (await fetch('/api/cards', {credentials: 'include'})).json();
const response = await fetch('/api/card-route/validate', {
  method: 'POST',
  credentials: 'include',
  headers: {'Content-Type': 'application/json', 'X-Requested-With': 'CardRoute'},
  body: JSON.stringify({
    source_card_id: cards[0].id,
    destination_card_id: cards[0].id,
    amount: '1000'
  })
});
console.log(await response.json()); // valid:false, SOURCE_DESTINATION_SAME
```

## Test results

| Check | Final result |
| --- | --- |
| Complete backend suite | **122 passed**, 0 failed, 0 skipped (82 regressions + 40 new validation cases) |
| New Step 3 browser cases | **12 passed** across desktop, tablet and mobile |
| Complete browser regression suite | **24 passed**, 0 failed, 0 skipped (8 cases per viewport) |
| Tablet empty-state diagnostic repeats | **3 passed** with the same assertions |
| TypeScript and Vite production build | Passed |
| Alembic schema consistency | No new upgrade operations detected |
| Docker image `cardroute:step3` | Built successfully with TLS verification enabled |
| Disposable Docker/PostgreSQL smoke test | Passed |
| Development frontend/API/PostgreSQL after restoration | Running; health connected |

The backend tests cover all requested success, status, ownership, amount and boundary cases; malformed/non-finite input; extra authoritative field rejection; exact decimal boundaries; stale database balances/statuses; deleted cards; authentication; no metadata leakage; and unchanged card/balance/timestamp snapshots after validation.

Browser cases cover selectors, disabled statuses, same-card prevention, zero/text/over-precision amounts, quick amounts, success/failure messages, all ten passed checks, clearing results on source/destination/amount changes, swap, source preselection, Dashboard CTA, zero/one-card states, server-side stale-data rechecks, API error recovery, aborted in-flight results, protected routes, mobile overflow, and navigation only to the Step 4 placeholder. Existing account and card-management regressions remain included.

An early run exposed an accessibility-role issue on the result heading; the status role was moved to the containing status region so the heading retains heading semantics. One later full run had a tablet empty-state timeout while Docker was building concurrently (23 passed / 1 timed out). The unchanged case passed three diagnostic repeats, then the complete suite passed cleanly in a fresh disposable PostgreSQL database using the same authentication and rate limits. No assertion or protection was disabled. The disposable browser-test database was removed and the original development database/server restored. Failure traces and screenshots are now retained for future diagnosis. The single upstream Starlette/httpx deprecation warning remains non-fatal.

The container smoke test verified custom PORT startup, existing migrations, SPA/route-options hosting, all ten validation checks, exact decimal amounts, failure reason codes, unchanged financial/timestamp snapshots, and existing account/card/dashboard/logout capabilities. Its test containers, anonymous volumes and network were removed. No deployment was performed. The build used the existing trusted proxy CA through the optional BuildKit secret; TLS verification was never disabled.

To reproduce backend checks, start PostgreSQL, then from backend run `../.venv/bin/python -m pytest -q`. With API/Vite running, from frontend run `npm run build` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` (or install Playwright Chromium locally and omit that variable). Backend fixtures migrate/truncate only cardroute_test. Browser tests create unique test accounts; Step 3 cases remove their own cards. Repeated browser runs share the real development IP login limit; use a separate disposable PostgreSQL test instance for sustained repeat runs rather than weakening authentication controls.

No known functional Step 3 issue remains. Structural results are point-in-time snapshots only. Provider eligibility and future pricing are intentionally unavailable.

## Scope boundary

No transaction fees, provider selection, payment gateway/integration, simulation transaction, balance update from validation, ledger, webhook, payment status, balance transfer or refinancing was added. Activity and Route Options are placeholders. Optional audit persistence was omitted to keep validation read-only. The existing upstream Starlette/httpx deprecation warning is unrelated to this step.

Cloud startup instructions were saved to the configuration draft. This does not publish or deploy the environment; review/save settings and publish separately for reuse. Fresh-task snapshot restoration is not claimed.
