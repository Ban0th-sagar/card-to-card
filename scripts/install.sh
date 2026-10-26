#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/python -m pip install --cache-dir /tmp/cardroute-pip-cache -r backend/requirements.txt
npm ci --prefix frontend --cache /tmp/cardroute-npm-cache
npm ci --prefix tools/postgres --cache /tmp/cardroute-npm-cache
npm run build --prefix frontend
