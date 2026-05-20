#!/usr/bin/env bash
# =============================================================================
# ColaboraEdu — Script de Desenvolvimento Local
# =============================================================================
# Uso:
#   ./dev.sh setup    → Primeira vez: instala deps, cria .env, roda migrations
#   ./dev.sh start    → Sobe tudo (infra + backend + worker + frontend)
#   ./dev.sh stop     → Para tudo
#   ./dev.sh restart  → Para e sobe tudo novamente
#   ./dev.sh reset    → Destrói banco e recomeça do zero
#   ./dev.sh status   → Mostra estado dos serviços
#   ./dev.sh logs     → Mostra logs em tempo real (todos os processos)
#   ./dev.sh migrate  → Roda apenas as migrations
#   ./dev.sh seed     → Cria dados de demo (alunos, notas, etc.)
#   ./dev.sh test     → Roda os testes do backend
#   ./dev.sh shell    → Abre shell Python com contexto Flask
# =============================================================================

set -euo pipefail

# ── Configuração base ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV="$SCRIPT_DIR/.venv"
LOG_DIR="$SCRIPT_DIR/.logs"
PID_DIR="$SCRIPT_DIR/.pids"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_DEV_FILE="$SCRIPT_DIR/.env.development"

# Portas
POSTGRES_PORT="${POSTGRES_EXTERNAL_PORT:-5440}"
REDIS_PORT="${REDIS_EXTERNAL_PORT:-6389}"
BACKEND_PORT="5000"
FRONTEND_PORT="5173"

# ── Cores ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Funções utilitárias ───────────────────────────────────────────────────────
info()    { echo -e "${GREEN}→${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*" >&2; }
step()    { echo -e "\n${BOLD}${BLUE}[$1]${NC} ${BOLD}$2${NC}"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
dim()     { echo -e "${DIM}$*${NC}"; }

die() {
  error "$*"
  exit 1
}

# Lê valor de variável do .env (ignora comentários e linhas em branco)
env_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true
}

# Carrega .env no ambiente atual
load_env() {
  if [ -f "$ENV_FILE" ]; then
    set -o allexport
    # shellcheck disable=SC1090
    source <(grep -E '^[A-Z_]+=.' "$ENV_FILE" | grep -v '^\s*#')
    set +o allexport
  fi
}

# Verifica se porta está ouvindo
port_open() {
  local host="${1:-localhost}"
  local port="$2"
  nc -z "$host" "$port" 2>/dev/null
}

# Salva PID de processo em background
save_pid() {
  mkdir -p "$PID_DIR"
  echo "$2" > "$PID_DIR/$1.pid"
}

# Para processo pelo PID salvo
stop_process() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      rm -f "$pid_file"
      success "Parou $name (PID $pid)"
    else
      rm -f "$pid_file"
    fi
  fi
}

# ── Verificação de pré-requisitos ─────────────────────────────────────────────
check_requirements() {
  step "PRÉ-REQUISITOS" "Verificando dependências do sistema"

  local missing=()

  if ! command -v python3 &>/dev/null; then
    missing+=("python3 (3.12+ requerido)")
  else
    local pyver
    pyver=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    dim "  python3: $pyver"
  fi

  if ! command -v docker &>/dev/null; then
    missing+=("docker")
  else
    dim "  docker: $(docker --version | head -1)"
  fi

  if ! command -v node &>/dev/null; then
    missing+=("node (18+ requerido)")
  else
    dim "  node: $(node --version)"
  fi

  if ! command -v npm &>/dev/null; then
    missing+=("npm")
  fi

  if ! command -v nc &>/dev/null && ! command -v ncat &>/dev/null; then
    warn "nc (netcat) não encontrado — verificação de porta vai usar Python"
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    error "Dependências faltando:"
    for dep in "${missing[@]}"; do
      echo "    - $dep"
    done
    echo ""
    echo "  Ubuntu/Debian:"
    echo "    sudo apt update && sudo apt install -y python3 python3-venv python3-pip nodejs npm docker.io"
    die "Instale as dependências acima e tente novamente."
  fi

  success "Pré-requisitos OK"
}

# ── Criação do .env ───────────────────────────────────────────────────────────
setup_env() {
  step "AMBIENTE" "Configurando variáveis de ambiente"

  if [ -f "$ENV_FILE" ]; then
    warn ".env já existe — mantendo configuração atual"
    return 0
  fi

  # Tenta copiar de .env.development se existir
  if [ -f "$ENV_DEV_FILE" ]; then
    cp "$ENV_DEV_FILE" "$ENV_FILE"
    success "Criou .env a partir de .env.development"
    return 0
  fi

  # Cria .env com defaults mínimos para desenvolvimento local
  cat > "$ENV_FILE" << 'EOF'
# =============================================================================
# ColaboraEdu — Ambiente de Desenvolvimento Local
# Gerado automaticamente por dev.sh setup
# =============================================================================

FLASK_ENV=development
FLASK_DEBUG=1

# Banco de dados (postgres sobe na porta 5440 via Docker)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=colaboraedu_dev_2024
POSTGRES_DB=colabora_edu
DATABASE_URL=postgresql://postgres:colaboraedu_dev_2024@localhost:5440/colabora_edu

# Redis (sobe na porta 6389 via Docker)
REDIS_URL=redis://localhost:6389/0

# Flask (chaves de desenvolvimento — NUNCA use em produção)
SECRET_KEY=dev-secret-key-only-for-local-development
JWT_SECRET_KEY=dev-jwt-key-only-for-local-development

# CORS
ALLOWED_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
FRONTEND_URL=http://localhost:5173
BRAND_NAME=ColaboraEdu

# Uploads
UPLOAD_FOLDER=../data/uploads

# SMTP desativado (use Mailtrap ou MailHog para testar emails em dev)
# Para MailHog local: docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
SMTP_SERVER=localhost
SMTP_PORT=1025
SMTP_USE_TLS=false
SMTP_USE_SSL=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=dev@localhost

# WhatsApp desativado em dev
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
WHATSAPP_INSTANCE=

# Stripe desativado em dev
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# Sentry desativado em dev
SENTRY_DSN=

# Modo comercial
COMMERCIAL_MODE=saas
EOF

  success "Criou .env com valores padrão para desenvolvimento"
  warn "Para receber emails em dev: docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog"
}

# ── Virtualenv ────────────────────────────────────────────────────────────────
setup_venv() {
  step "PYTHON" "Configurando virtualenv"

  if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
    success "Virtualenv criado em $VENV"
  else
    dim "  Virtualenv já existe"
  fi

  # Atualiza pip silenciosamente
  "$VENV/bin/pip" install --quiet --upgrade pip

  info "Instalando dependências do backend..."
  "$VENV/bin/pip" install --quiet -e "backend[dev]"
  success "Dependências Python instaladas"
}

# ── Frontend ──────────────────────────────────────────────────────────────────
setup_frontend() {
  step "FRONTEND" "Instalando dependências Node"

  cd "$SCRIPT_DIR/frontend"
  if [ ! -d node_modules ]; then
    npm install --silent
    success "Dependências do frontend instaladas"
  else
    dim "  node_modules já existe"
    npm install --silent
  fi
  cd "$SCRIPT_DIR"
}

# ── Diretórios ────────────────────────────────────────────────────────────────
setup_directories() {
  mkdir -p data/uploads 2>/dev/null || mkdir -p backend/uploads
  mkdir -p "$LOG_DIR"
  mkdir -p "$PID_DIR"
  success "Diretórios criados"
}

# ── Infra Docker ───────────────────────────────────────────────────────────────
start_infra() {
  step "DOCKER" "Subindo PostgreSQL e Redis"

  load_env

  docker compose up -d postgres redis

  info "Aguardando PostgreSQL ficar pronto..."
  local max=30 i=0
  until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null; do
    i=$((i+1))
    [ "$i" -ge "$max" ] && die "PostgreSQL não ficou pronto após ${max}s"
    printf "\r  ${DIM}Aguardando... %d/%ds${NC}" "$i" "$max"
    sleep 1
  done
  echo ""
  success "PostgreSQL pronto (porta $POSTGRES_PORT)"

  info "Aguardando Redis ficar pronto..."
  i=0
  until docker compose exec -T redis redis-cli ping &>/dev/null; do
    i=$((i+1))
    [ "$i" -ge 15 ] && die "Redis não ficou pronto após 15s"
    sleep 1
  done
  success "Redis pronto (porta $REDIS_PORT)"
}

# ── Migrations ────────────────────────────────────────────────────────────────
run_migrations() {
  step "DATABASE" "Rodando migrations Alembic"

  load_env
  cd "$SCRIPT_DIR/backend"
  FLASK_APP=app "$VENV/bin/python" -m flask db upgrade
  cd "$SCRIPT_DIR"
  success "Migrations aplicadas"
}

# ── Admin padrão ──────────────────────────────────────────────────────────────
create_admin() {
  step "ADMIN" "Criando usuário administrador"

  load_env
  cd "$SCRIPT_DIR/backend"
  FLASK_APP=app "$VENV/bin/python" -m flask create-admin 2>&1 || true
  cd "$SCRIPT_DIR"
  success "Admin criado (ou já existia)"
}

# ── Iniciar processos em background ──────────────────────────────────────────
start_backend() {
  load_env
  mkdir -p "$LOG_DIR" "$PID_DIR"

  info "Iniciando backend Flask (porta $BACKEND_PORT)..."
  cd "$SCRIPT_DIR/backend"
  FLASK_APP=app \
  FLASK_DEBUG=1 \
  DATABASE_URL="$(env_val DATABASE_URL)" \
  REDIS_URL="$(env_val REDIS_URL)" \
  SECRET_KEY="$(env_val SECRET_KEY)" \
  JWT_SECRET_KEY="$(env_val JWT_SECRET_KEY)" \
  ALLOWED_ORIGINS="$(env_val ALLOWED_ORIGINS)" \
  FRONTEND_URL="$(env_val FRONTEND_URL)" \
  BRAND_NAME="$(env_val BRAND_NAME)" \
  UPLOAD_FOLDER="$(env_val UPLOAD_FOLDER)" \
  SMTP_SERVER="$(env_val SMTP_SERVER)" \
  SMTP_PORT="$(env_val SMTP_PORT)" \
  SMTP_USE_TLS="$(env_val SMTP_USE_TLS)" \
  SMTP_USE_SSL="$(env_val SMTP_USE_SSL)" \
  SMTP_USER="$(env_val SMTP_USER)" \
  SMTP_PASSWORD="$(env_val SMTP_PASSWORD)" \
  SMTP_FROM="$(env_val SMTP_FROM)" \
  WHATSAPP_API_URL="$(env_val WHATSAPP_API_URL)" \
  WHATSAPP_API_TOKEN="$(env_val WHATSAPP_API_TOKEN)" \
  WHATSAPP_INSTANCE="$(env_val WHATSAPP_INSTANCE)" \
  STRIPE_SECRET_KEY="$(env_val STRIPE_SECRET_KEY)" \
  STRIPE_WEBHOOK_SECRET="$(env_val STRIPE_WEBHOOK_SECRET)" \
  STRIPE_PRICE_ID="$(env_val STRIPE_PRICE_ID)" \
  SENTRY_DSN="$(env_val SENTRY_DSN)" \
    "$VENV/bin/python" -m flask run \
      --host=0.0.0.0 --port="$BACKEND_PORT" --reload \
      >> "$LOG_DIR/backend.log" 2>&1 &
  save_pid "backend" "$!"
  cd "$SCRIPT_DIR"
  success "Backend iniciado (PID $!) → http://localhost:$BACKEND_PORT"
}

start_worker() {
  load_env
  mkdir -p "$LOG_DIR" "$PID_DIR"

  info "Iniciando RQ worker..."
  cd "$SCRIPT_DIR/backend"
  DATABASE_URL="$(env_val DATABASE_URL)" \
  REDIS_URL="$(env_val REDIS_URL)" \
  SECRET_KEY="$(env_val SECRET_KEY)" \
  JWT_SECRET_KEY="$(env_val JWT_SECRET_KEY)" \
  UPLOAD_FOLDER="$(env_val UPLOAD_FOLDER)" \
  SMTP_SERVER="$(env_val SMTP_SERVER)" \
  SMTP_PORT="$(env_val SMTP_PORT)" \
  SMTP_USE_TLS="$(env_val SMTP_USE_TLS)" \
  SMTP_USE_SSL="$(env_val SMTP_USE_SSL)" \
  SMTP_USER="$(env_val SMTP_USER)" \
  SMTP_PASSWORD="$(env_val SMTP_PASSWORD)" \
  SMTP_FROM="$(env_val SMTP_FROM)" \
  WHATSAPP_API_URL="$(env_val WHATSAPP_API_URL)" \
  WHATSAPP_API_TOKEN="$(env_val WHATSAPP_API_TOKEN)" \
  WHATSAPP_INSTANCE="$(env_val WHATSAPP_INSTANCE)" \
    "$VENV/bin/python" worker.py \
      >> "$LOG_DIR/worker.log" 2>&1 &
  save_pid "worker" "$!"
  cd "$SCRIPT_DIR"
  success "Worker iniciado (PID $!)"
}

start_frontend() {
  load_env
  mkdir -p "$LOG_DIR" "$PID_DIR"

  info "Iniciando frontend Vite (porta $FRONTEND_PORT)..."
  cd "$SCRIPT_DIR/frontend"
  VITE_API_BASE_URL="/api/v1" \
  VITE_BACKEND_URL="http://localhost:$BACKEND_PORT" \
    npm run dev -- --host 0.0.0.0 \
      >> "$LOG_DIR/frontend.log" 2>&1 &
  save_pid "frontend" "$!"
  cd "$SCRIPT_DIR"
  success "Frontend iniciado (PID $!) → http://localhost:$FRONTEND_PORT"
}

# ── Aguardar serviços ficarem prontos ─────────────────────────────────────────
wait_for_services() {
  step "AGUARDANDO" "Serviços iniciando..."

  local max=45 i=0
  while [ $i -lt $max ]; do
    local backend_up=0 frontend_up=0
    port_open localhost "$BACKEND_PORT"  && backend_up=1
    port_open localhost "$FRONTEND_PORT" && frontend_up=1

    printf "\r  Backend: %s  Frontend: %s  (%ds)" \
      "$( [ $backend_up  -eq 1 ] && echo "${GREEN}✓${NC}" || echo "${YELLOW}...${NC}" )" \
      "$( [ $frontend_up -eq 1 ] && echo "${GREEN}✓${NC}" || echo "${YELLOW}...${NC}" )" \
      "$i"

    [ $backend_up -eq 1 ] && [ $frontend_up -eq 1 ] && { echo ""; break; }
    i=$((i+1))
    sleep 1
  done
  echo ""
}

# ── Parar tudo ────────────────────────────────────────────────────────────────
cmd_stop() {
  step "STOP" "Parando todos os serviços"

  stop_process "backend"
  stop_process "worker"
  stop_process "frontend"

  info "Parando containers Docker..."
  docker compose stop postgres redis 2>/dev/null || true
  success "Todos os serviços parados"
}

# ── Setup completo (primeira vez) ─────────────────────────────────────────────
cmd_setup() {
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║   ColaboraEdu — Setup de Desenvolvimento     ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
  echo ""

  check_requirements
  setup_env
  setup_directories
  setup_venv
  setup_frontend
  start_infra
  run_migrations
  create_admin

  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║   ✅  Setup concluído com sucesso!           ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}Próximo passo:${NC}  ./dev.sh start"
  echo ""
  echo -e "  ${DIM}Credenciais:    admin / admin${NC}"
  echo -e "  ${DIM}Frontend:       http://localhost:$FRONTEND_PORT${NC}"
  echo -e "  ${DIM}Backend API:    http://localhost:$BACKEND_PORT/api/v1${NC}"
  echo ""
}

# ── Start tudo ────────────────────────────────────────────────────────────────
cmd_start() {
  echo ""
  echo -e "${BOLD}${CYAN}ColaboraEdu — Iniciando ambiente de desenvolvimento${NC}"
  echo ""

  # Verifica se setup foi feito
  if [ ! -d "$VENV" ] || [ ! -d "frontend/node_modules" ]; then
    warn "Setup não encontrado. Rodando setup primeiro..."
    cmd_setup
  fi

  load_env

  # Para processos anteriores se existirem
  stop_process "backend"  2>/dev/null || true
  stop_process "worker"   2>/dev/null || true
  stop_process "frontend" 2>/dev/null || true

  start_infra
  run_migrations

  start_backend
  start_worker
  start_frontend
  wait_for_services

  print_banner
  print_logs_hint
}

# ── Reset (apaga banco e recomeça) ────────────────────────────────────────────
cmd_reset() {
  echo ""
  echo -e "${RED}${BOLD}⚠  ATENÇÃO: Isso vai APAGAR o banco de dados local!${NC}"
  read -r -p "   Continuar? (s/N) " confirm
  [[ "$confirm" =~ ^[Ss]$ ]] || { echo "Cancelado."; exit 0; }

  step "RESET" "Destruindo e recriando banco de dados"

  stop_process "backend"  2>/dev/null || true
  stop_process "worker"   2>/dev/null || true

  load_env
  docker compose stop postgres redis 2>/dev/null || true
  docker compose rm -f postgres redis 2>/dev/null || true
  docker volume rm "$(basename "$SCRIPT_DIR")_postgres_data" 2>/dev/null || true
  docker volume rm "$(basename "$SCRIPT_DIR")_redis_data"    2>/dev/null || true

  start_infra
  run_migrations
  create_admin

  success "Banco resetado e pronto!"
  info "Rode ./dev.sh start para iniciar os serviços"
}

# ── Status ────────────────────────────────────────────────────────────────────
cmd_status() {
  echo ""
  echo -e "${BOLD}ColaboraEdu — Status dos Serviços${NC}"
  echo ""

  # Docker
  local pg_status redis_status
  if docker compose ps postgres 2>/dev/null | grep -q "healthy\|running"; then
    pg_status="${GREEN}✓ rodando${NC} (porta $POSTGRES_PORT)"
  else
    pg_status="${RED}✗ parado${NC}"
  fi

  if docker compose ps redis 2>/dev/null | grep -q "healthy\|running"; then
    redis_status="${GREEN}✓ rodando${NC} (porta $REDIS_PORT)"
  else
    redis_status="${RED}✗ parado${NC}"
  fi

  echo -e "  PostgreSQL   → $pg_status"
  echo -e "  Redis        → $redis_status"

  # Processos locais
  for name in backend worker frontend; do
    local pid_file="$PID_DIR/$name.pid"
    if [ -f "$pid_file" ]; then
      local pid
      pid=$(cat "$pid_file")
      if kill -0 "$pid" 2>/dev/null; then
        echo -e "  ${name^}      → ${GREEN}✓ rodando${NC} (PID $pid)"
      else
        echo -e "  ${name^}      → ${RED}✗ processo morto${NC}"
        rm -f "$pid_file"
      fi
    else
      echo -e "  ${name^}      → ${DIM}não iniciado${NC}"
    fi
  done

  echo ""
  # Teste de conectividade HTTP
  if port_open localhost "$BACKEND_PORT"; then
    local health
    health=$(curl -sf "http://localhost:$BACKEND_PORT/health" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "?")
    echo -e "  Backend health → ${GREEN}$health${NC}"
  fi
}

# ── Logs ─────────────────────────────────────────────────────────────────────
cmd_logs() {
  local target="${1:-all}"
  mkdir -p "$LOG_DIR"

  case "$target" in
    backend)  tail -f "$LOG_DIR/backend.log" 2>/dev/null || warn "Log do backend não encontrado" ;;
    worker)   tail -f "$LOG_DIR/worker.log"  2>/dev/null || warn "Log do worker não encontrado" ;;
    frontend) tail -f "$LOG_DIR/frontend.log" 2>/dev/null || warn "Log do frontend não encontrado" ;;
    all|*)
      echo -e "${DIM}Mostrando logs de todos os processos. Ctrl+C para sair.${NC}"
      echo ""
      # Se tail suportar múltiplos arquivos com --tag
      if tail --version 2>/dev/null | grep -q GNU; then
        tail -f \
          "$LOG_DIR/backend.log" \
          "$LOG_DIR/worker.log" \
          "$LOG_DIR/frontend.log" \
          2>/dev/null || warn "Nenhum log encontrado. Rode ./dev.sh start primeiro."
      else
        # macOS e BSDs
        tail -f \
          "$LOG_DIR/backend.log" \
          "$LOG_DIR/worker.log" \
          "$LOG_DIR/frontend.log" \
          2>/dev/null || warn "Nenhum log encontrado. Rode ./dev.sh start primeiro."
      fi
      ;;
  esac
}

# ── Migrations ────────────────────────────────────────────────────────────────
cmd_migrate() {
  load_env
  step "MIGRATE" "Rodando flask db upgrade"
  run_migrations
}

# ── Seed de dados demo ────────────────────────────────────────────────────────
cmd_seed() {
  load_env
  step "SEED" "Criando dados de demonstração"
  cd "$SCRIPT_DIR/backend"
  FLASK_APP=app \
  DATABASE_URL="$(env_val DATABASE_URL)" \
  REDIS_URL="$(env_val REDIS_URL)" \
  SECRET_KEY="$(env_val SECRET_KEY)" \
  JWT_SECRET_KEY="$(env_val JWT_SECRET_KEY)" \
    "$VENV/bin/python" -m flask seed-demo 2>&1 || \
    warn "Comando seed-demo não encontrado ou falhou"
  cd "$SCRIPT_DIR"
}

# ── Testes ────────────────────────────────────────────────────────────────────
cmd_test() {
  load_env
  step "TESTES" "Rodando pytest"
  cd "$SCRIPT_DIR/backend"
  DATABASE_URL="$(env_val DATABASE_URL)" \
  REDIS_URL="$(env_val REDIS_URL)" \
  SECRET_KEY="$(env_val SECRET_KEY)" \
  JWT_SECRET_KEY="$(env_val JWT_SECRET_KEY)" \
    "$VENV/bin/python" -m pytest tests/ -v --tb=short "$@"
  cd "$SCRIPT_DIR"
}

# ── Shell Flask ───────────────────────────────────────────────────────────────
cmd_shell() {
  load_env
  step "SHELL" "Abrindo shell Flask"
  cd "$SCRIPT_DIR/backend"
  FLASK_APP=app \
  DATABASE_URL="$(env_val DATABASE_URL)" \
  REDIS_URL="$(env_val REDIS_URL)" \
  SECRET_KEY="$(env_val SECRET_KEY)" \
  JWT_SECRET_KEY="$(env_val JWT_SECRET_KEY)" \
    "$VENV/bin/python" -m flask shell
  cd "$SCRIPT_DIR"
}

# ── Banner e dicas ────────────────────────────────────────────────────────────
print_banner() {
  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║   🎓 ColaboraEdu rodando em desenvolvimento!         ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}Frontend:${NC}    ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
  echo -e "  ${BOLD}Backend:${NC}     ${CYAN}http://localhost:$BACKEND_PORT${NC}"
  echo -e "  ${BOLD}API Docs:${NC}    ${CYAN}http://localhost:$BACKEND_PORT/api/v1${NC}"
  echo ""
  echo -e "  ${BOLD}PostgreSQL:${NC}  localhost:$POSTGRES_PORT  (user: postgres)"
  echo -e "  ${BOLD}Redis:${NC}       localhost:$REDIS_PORT"
  echo ""
  echo -e "  ${DIM}Credenciais:  admin / admin${NC}"
  echo ""
}

print_logs_hint() {
  echo -e "  ${BOLD}Comandos úteis:${NC}"
  echo -e "  ${DIM}./dev.sh logs           — logs de todos os processos${NC}"
  echo -e "  ${DIM}./dev.sh logs backend   — apenas logs do Flask${NC}"
  echo -e "  ${DIM}./dev.sh logs worker    — apenas logs do RQ worker${NC}"
  echo -e "  ${DIM}./dev.sh status         — status dos serviços${NC}"
  echo -e "  ${DIM}./dev.sh stop           — para tudo${NC}"
  echo -e "  ${DIM}./dev.sh test           — roda os testes${NC}"
  echo ""
}

# ── Restart ───────────────────────────────────────────────────────────────────
cmd_restart() {
  cmd_stop
  sleep 2
  cmd_start
}

# ── Ajuda ─────────────────────────────────────────────────────────────────────
cmd_help() {
  echo ""
  echo -e "${BOLD}ColaboraEdu — Script de Desenvolvimento Local${NC}"
  echo ""
  echo -e "  ${BOLD}Uso:${NC} ./dev.sh <comando>"
  echo ""
  echo -e "  ${BOLD}Comandos:${NC}"
  echo -e "  ${GREEN}setup${NC}      Primeira vez: instala deps, .env, migrations, admin"
  echo -e "  ${GREEN}start${NC}      Sobe tudo (Docker infra + backend + worker + frontend)"
  echo -e "  ${GREEN}stop${NC}       Para todos os processos e containers"
  echo -e "  ${GREEN}restart${NC}    Para e inicia novamente"
  echo -e "  ${GREEN}reset${NC}      APAGA o banco e recomeça do zero"
  echo -e "  ${GREEN}status${NC}     Mostra estado de todos os serviços"
  echo -e "  ${GREEN}logs${NC}       Mostra logs em tempo real (all/backend/worker/frontend)"
  echo -e "  ${GREEN}migrate${NC}    Roda flask db upgrade"
  echo -e "  ${GREEN}seed${NC}       Cria dados de demonstração"
  echo -e "  ${GREEN}test${NC}       Roda pytest (argumentos extras são passados ao pytest)"
  echo -e "  ${GREEN}shell${NC}      Abre shell Flask com contexto da aplicação"
  echo ""
  echo -e "  ${BOLD}Exemplos:${NC}"
  echo -e "  ${DIM}./dev.sh setup                    # primeira vez${NC}"
  echo -e "  ${DIM}./dev.sh start                    # inicia o ambiente${NC}"
  echo -e "  ${DIM}./dev.sh logs backend             # ver logs do Flask${NC}"
  echo -e "  ${DIM}./dev.sh test -k test_auth        # rodar testes específicos${NC}"
  echo -e "  ${DIM}./dev.sh reset                    # limpar banco e recomeçar${NC}"
  echo ""
}

# ── Dispatcher ────────────────────────────────────────────────────────────────
CMD="${1:-help}"
shift || true

case "$CMD" in
  setup)    cmd_setup ;;
  start)    cmd_start ;;
  stop)     cmd_stop ;;
  restart)  cmd_restart ;;
  reset)    cmd_reset ;;
  status)   cmd_status ;;
  logs)     cmd_logs "${1:-all}" ;;
  migrate)  cmd_migrate ;;
  seed)     cmd_seed ;;
  test)     cmd_test "$@" ;;
  shell)    cmd_shell ;;
  help|--help|-h) cmd_help ;;
  *)
    error "Comando desconhecido: $CMD"
    cmd_help
    exit 1
    ;;
esac
