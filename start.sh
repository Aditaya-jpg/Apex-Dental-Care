#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

cleanup() {
  echo ""
  echo "Stopping PGI Dental Management System..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Ensure backend venv exists
if [[ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]]; then
  echo "Setting up backend virtual environment..."
  python3 -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"
fi

# Ensure frontend dependencies exist
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

echo "Starting Backend (http://127.0.0.1:8000)..."
(cd "$BACKEND_DIR" && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload) &
BACKEND_PID=$!

echo "Starting Frontend (http://localhost:3000)..."
(cd "$FRONTEND_DIR" && npm run dev -- --port 3000) &
FRONTEND_PID=$!

sleep 2
open "http://localhost:3000" 2>/dev/null || true

echo "Press Ctrl+C to stop both servers."
wait "$BACKEND_PID" "$FRONTEND_PID"
