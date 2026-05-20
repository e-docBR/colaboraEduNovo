#!/usr/bin/env bash
# Gera backend/requirements.lock a partir de pyproject.toml.
# Requer: pip install pip-tools
# Uso: ./scripts/generate-lock.sh
# Após gerar, commite requirements.lock junto com alterações em pyproject.toml.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

cd "${BACKEND_DIR}"

if ! command -v pip-compile &>/dev/null; then
    echo "ERRO: pip-tools não encontrado. Instale com: pip install pip-tools"
    exit 1
fi

echo "==> Compilando dependências de produção..."
pip-compile pyproject.toml \
    --output-file=requirements.lock \
    --no-emit-index-url \
    --strip-extras \
    --generate-hashes \
    --resolver=backtracking \
    "$@"

echo ""
echo "==> Lock file gerado: backend/requirements.lock"
echo "    Verifique as alterações e commit junto com pyproject.toml:"
echo "    git add backend/requirements.lock && git commit -m 'chore(deps): atualiza lock file'"
