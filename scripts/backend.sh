#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend"
../.venv/bin/alembic upgrade head
exec ../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
