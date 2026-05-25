#!/usr/bin/env bash
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

target="${1:-all}"

run_in_temp_node_workspace() {
  project_dir="$1"
  shift

  temp_root="$(mktemp -d "/tmp/${project_dir##*/}-validate-XXXXXX")"
  current_dir="$(pwd)"

  cleanup() {
    cd "$current_dir"
    rm -rf "$temp_root"
  }
  trap cleanup RETURN

  tar -C "$ROOT_DIR" --exclude="${project_dir}/node_modules" -cf - "$project_dir" | tar -C "$temp_root" -xf -
  (
    cd "$temp_root/$project_dir"
    npm install --include=dev >/dev/null
    "$@"
  )
}

run_backend() {
  echo "==> backend: ruff"
  ./.venv/bin/python -m ruff check backend/app backend/tests

  echo "==> backend: pytest auth/health"
  ./.venv/bin/python -m pytest --no-cov backend/tests/test_auth.py backend/tests/test_health.py
}

run_frontend() {
  if [ -x "./frontend/node_modules/.bin/eslint" ] && [ -x "./frontend/node_modules/.bin/tsc" ] && [ -x "./frontend/node_modules/.bin/vite" ]; then
    (
      cd ./frontend
      echo "==> frontend: eslint"
      ./node_modules/.bin/eslint src --ext ts,tsx

      echo "==> frontend: build"
      ./node_modules/.bin/tsc -p tsconfig.json
      ./node_modules/.bin/vite build --config vite.config.ts
    )
    return
  fi

  echo "==> frontend: fallback temp workspace"
  run_in_temp_node_workspace frontend sh -c '
    echo "==> frontend: eslint"
    ./node_modules/.bin/eslint src --ext ts,tsx
    echo "==> frontend: build"
    ./node_modules/.bin/tsc -p tsconfig.json
    ./node_modules/.bin/vite build --config vite.config.ts
  '
}

run_mobile() {
  if [ -x "./mobile/node_modules/.bin/tsc" ]; then
    echo "==> mobile: typecheck"
    ./mobile/node_modules/.bin/tsc --noEmit -p mobile/tsconfig.json
    return
  fi

  echo "==> mobile: fallback temp workspace"
  run_in_temp_node_workspace mobile sh -c '
    echo "==> mobile: typecheck"
    ./node_modules/.bin/tsc --noEmit -p tsconfig.json
  '
}

case "$target" in
  backend)
    run_backend
    ;;
  frontend)
    run_frontend
    ;;
  mobile)
    run_mobile
    ;;
  all)
    ./scripts/doctor.sh || true
    run_backend
    run_frontend
    run_mobile
    ;;
  *)
    echo "Uso: $0 [backend|frontend|mobile|all]" >&2
    exit 2
    ;;
esac
