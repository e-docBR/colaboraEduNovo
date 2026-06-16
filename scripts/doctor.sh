#!/usr/bin/env bash
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

status=0

check_cmd() {
  label="$1"
  path="$2"
  if [ -x "$path" ]; then
    printf '[OK] %s: %s\n' "$label" "$path"
  else
    printf '[ERR] %s: ausente em %s\n' "$label" "$path"
    status=1
  fi
}

check_python_module() {
  label="$1"
  module="$2"
  if ./.venv/bin/python -c "import $module" >/dev/null 2>&1; then
    printf '[OK] backend python module: %s\n' "$label"
  else
    printf '[ERR] backend python module: %s\n' "$label"
    status=1
  fi
}

check_cmd "backend python" "$ROOT_DIR/.venv/bin/python"
if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
  check_python_module "sqlalchemy" "sqlalchemy"
  check_python_module "redis" "redis"
  check_python_module "alembic" "alembic"
  check_python_module "pytest" "pytest"
  check_python_module "ruff" "ruff"
fi

check_cmd "frontend tsc" "$ROOT_DIR/frontend/node_modules/.bin/tsc"
check_cmd "frontend vite" "$ROOT_DIR/frontend/node_modules/.bin/vite"
check_cmd "frontend eslint" "$ROOT_DIR/frontend/node_modules/.bin/eslint"

check_cmd "mobile tsc" "$ROOT_DIR/mobile/node_modules/.bin/tsc"

exit "$status"
