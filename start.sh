#!/usr/bin/env bash
# =============================================================================
# ColaboraEdu — Iniciar / Parar / Status do sistema
# Uso:
#   ./start.sh          → sobe tudo
#   ./start.sh stop     → para tudo
#   ./start.sh restart  → para e sobe
#   ./start.sh status   → exibe estado dos containers e saúde da API
#   ./start.sh logs     → exibe logs em tempo real
#   ./start.sh logs backend|worker|frontend → logs de um serviço
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Cores ─────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC}  $*"; }
info() { echo -e "${CYAN}→${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; }
sep()  { echo -e "${DIM}────────────────────────────────────────${NC}"; }

# ── Verificações básicas ──────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  err "Docker não encontrado. Instale o Docker e tente novamente."
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/.env" ]; then
  err "Arquivo .env não encontrado em $SCRIPT_DIR"
  exit 1
fi

# ── Funções ───────────────────────────────────────────────────────────────────
cmd_start() {
  echo ""
  echo -e "${BOLD}${CYAN}ColaboraEdu — Iniciando sistema${NC}"
  sep

  # Para produção se estiver rodando na mesma porta (5440)
  local prod_pg
  prod_pg=$(docker ps --format '{{.Names}}' 2>/dev/null | grep 'colaboraedu-produc-postgres' || true)
  if [ -n "$prod_pg" ]; then
    warn "Parando postgres de produção para liberar porta 5440..."
    docker stop "$prod_pg" >/dev/null 2>&1 || true
  fi

  info "Subindo containers..."
  docker compose up -d

  info "Aguardando serviços ficarem prontos..."
  local max=30 i=0
  until curl -sf http://localhost:5000/health >/dev/null 2>&1; do
    i=$((i+1))
    [ "$i" -ge "$max" ] && { err "Backend não respondeu após ${max}s"; docker compose logs --tail=20 backend; exit 1; }
    printf "\r  ${DIM}Aguardando backend... %ds${NC}" "$i"
    sleep 1
  done
  echo ""

  local frontend_ok=0
  for i in $(seq 1 15); do
    curl -sf http://localhost:5173/ >/dev/null 2>&1 && frontend_ok=1 && break
    sleep 1
  done

  echo ""
  sep
  echo -e "${BOLD}${GREEN}Sistema no ar!${NC}"
  sep
  echo -e "  ${BOLD}Frontend:${NC}   ${CYAN}http://localhost:5173${NC}"
  echo -e "  ${BOLD}API:${NC}        ${CYAN}http://localhost:5000${NC}"
  echo ""
  echo -e "  ${BOLD}Escola:${NC}     Colégio Frei Ronaldo  (freironaldo)"
  echo -e "  ${BOLD}Usuário:${NC}    admin"
  echo -e "  ${DIM}(senha no log: ./start.sh logs backend | grep 'Senha gerada')${NC}"
  echo ""
  echo -e "  ${DIM}./start.sh logs    — ver logs em tempo real${NC}"
  echo -e "  ${DIM}./start.sh stop    — parar tudo${NC}"
  echo -e "  ${DIM}./start.sh status  — checar estado${NC}"
  echo ""
}

cmd_stop() {
  echo ""
  info "Parando todos os serviços..."
  docker compose stop
  ok "Sistema parado."
  echo ""
}

cmd_restart() {
  cmd_stop
  sleep 2
  cmd_start
}

cmd_status() {
  echo ""
  echo -e "${BOLD}ColaboraEdu — Status${NC}"
  sep
  docker compose ps
  sep
  local health
  health=$(curl -sf http://localhost:5000/health 2>/dev/null || echo '{"status":"offline"}')
  echo -e "  API health: $(echo "$health" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo 'indisponível')"
  echo ""
}

cmd_logs() {
  local svc="${1:-}"
  if [ -n "$svc" ]; then
    docker compose logs -f "$svc"
  else
    docker compose logs -f
  fi
}

# ── Dispatcher ────────────────────────────────────────────────────────────────
CMD="${1:-start}"
shift 2>/dev/null || true

case "$CMD" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    cmd_logs "${1:-}" ;;
  *)
    echo "Uso: ./start.sh [start|stop|restart|status|logs [serviço]]"
    exit 1
    ;;
esac
