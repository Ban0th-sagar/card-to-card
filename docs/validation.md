# Step 1 validation

Validated in the cloud workspace on 2026-10-26. No deployment was performed.

| Check | Result |
| --- | --- |
| Reusable `bash scripts/install.sh` | Passed: frozen Python requirements, npm lockfiles, frontend build |
| Local PostgreSQL launcher, stop and restart with persisted data | Passed |
| `alembic upgrade head` | Passed against development, dedicated test, and container databases |
| `alembic check` | Passed: no schema drift |
| `python -m pytest -q` from backend | **19 passed**, no failures or skipped tests |
| `npm run build` from frontend | Passed: TypeScript and Vite production build |
| Playwright with system Chromium | **4 passed**: desktop 1440×1000 and mobile 390×844 |
| Desktop/mobile landing render and mobile horizontal overflow | Passed |
| Docker image build | Passed with TLS verification and trusted proxy CA supplied as a BuildKit secret |
| Docker Compose configuration validation | Passed |
| Isolated Docker application + PostgreSQL smoke test | Passed with custom `PORT=8123` |
| `/api/health` in development and container instances | `status: ok`, `database: connected` |

Backend coverage includes registration, case-insensitive duplicate email, invalid email, weak password, mismatched confirmation, blank name, login success, wrong password, authenticated/unauthenticated current user, copied-token revocation after logout, protected profile access, name updates, role-change rejection, database health, shared login limits, origin/header checks, expired sessions, disabled users and malformed tokens. PostgreSQL storage checks confirm Argon2id hashing and public response fields omit authentication data.

Both browser sizes exercise the full journey: landing → create account → registration success → sign in → zero-card dashboard → cards placeholder → profile → edit name → persist after reload → logout → all five protected routes redirect to sign in → log in again. Additional tests verify mismatched-password errors and the password recovery notice. Browser tests use unique test email addresses and leave these development-only accounts in the development database.

The Docker smoke test used separate disposable containers and a private Docker network, migrated an empty database, served the compiled SPA, returned JSON 404 for unknown APIs, registered and authenticated a user, edited their name, revoked their session, and verified an Argon2id hash in PostgreSQL. Temporary test containers, anonymous volumes and the test network were removed. No production services were started.

Initial Chromium download was denied by cloud network policy; installed `/usr/bin/chromium` was used successfully. No extra network domains remain in the saved configuration. Docker builds initially lacked container DNS and proxy trust. The successful cloud build used the existing proxy, a resolved proxy-host mapping and the host's trusted CA bundle through the Dockerfile's optional `build_ca` BuildKit secret. Verification was never disabled. Ordinary local builds do not need cloud-specific proxy settings.

One upstream Starlette/httpx deprecation warning remains during pytest; it does not affect the 19 passing tests. No known functional Step 1 issues remain. Password recovery, cards, activity and routing are intentionally unavailable. Production hosting, TLS setup, email delivery and deployment remain outside this step.

Cloud `install_script` and `start_skill` were saved as draft configuration. This confirms persistence only: the user still reviews/saves settings and publishes the environment to activate a reusable snapshot. Fresh-task snapshot restoration has not been tested.
