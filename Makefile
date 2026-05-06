# =============================================================================
# ColaboraEdu — Makefile de desenvolvimento local
# =============================================================================
# Uso:
#   make setup     — primeira vez: cria .env, venv, instala deps, roda migration
#   make infra     — sobe apenas postgres + redis via Docker (necessário para backend/worker)
#   make backend   — inicia Flask em modo dev (requer infra ou SQLite)
#   make worker    — inicia RQ worker local
#   make frontend  — inicia Vite dev server
#   make dev       — sobe tudo em paralelo (infra + backend + worker + frontend)
#   make docker    — sobe stack completo via docker compose (inclui frontend/backend como container)
#   make test      — roda pytest
#   make lint      — roda ruff
#   make stop      — para containers de infra
#   make clean     — remove __pycache__ e arquivos temporários
# =============================================================================

.DEFAULT_GOAL := help
.PHONY: help setup infra backend worker frontend dev docker test lint audit prod-preflight restore-backup stop clean migrate

VENV       := .venv
PYTHON     := $(VENV)/bin/python
PIP        := $(VENV)/bin/pip
FLASK      := cd backend && FLASK_APP=app $(PYTHON) -m flask
PYTEST     := cd backend && $(PYTHON) -m pytest
RUFF       := cd backend && $(PYTHON) -m ruff

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ColaboraEdu — comandos disponíveis:"
	@echo ""
	@echo "  make setup      Configura ambiente completo (primeira vez)"
	@echo "  make infra      Sobe PostgreSQL + Redis via Docker"
	@echo "  make backend    Inicia Flask dev server (localhost:5000)"
	@echo "  make worker     Inicia RQ worker"
	@echo "  make frontend   Inicia Vite dev server (localhost:5173)"
	@echo "  make dev        Infra + backend + worker + frontend em paralelo"
	@echo "  make docker     Stack completo via docker compose"
	@echo "  make migrate    Roda flask db upgrade"
	@echo "  make test       Executa pytest"
	@echo "  make lint       Executa ruff check"
	@echo "  make audit      Audita dependências Python, frontend e mobile"
	@echo "  make prod-preflight Valida .env e docker-compose de produção"
	@echo "  make restore-backup BACKUP=arquivo.sql.gz  Restaura backup PostgreSQL"
	@echo "  make stop       Para containers de infra"
	@echo "  make clean      Remove caches e temporários"
	@echo ""

# ── Setup inicial ─────────────────────────────────────────────────────────────
setup:
	@echo "→ Criando .env de desenvolvimento..."
	@[ -f .env ] && echo "  .env já existe, pulando." || cp .env.development .env
	@echo "→ Criando virtualenv Python..."
	python3 -m venv $(VENV)
	@echo "→ Instalando dependências do backend..."
	$(PIP) install --quiet -e "backend[dev]"
	@echo "→ Criando diretório de uploads..."
	mkdir -p data/uploads
	@echo "→ Subindo infra (postgres + redis)..."
	docker compose up -d postgres redis
	@echo "→ Aguardando banco ficar pronto..."
	sleep 5
	@echo "→ Rodando migrations..."
	$(FLASK) db upgrade
	@echo "→ Criando admin padrão (admin / admin)..."
	$(FLASK) create-admin || true
	@echo ""
	@echo "✅  Setup concluído!"
	@echo "   Backend:  make backend"
	@echo "   Frontend: make frontend  (em outro terminal)"

# ── Infra (apenas postgres + redis) ──────────────────────────────────────────
infra:
	docker compose up -d postgres redis
	@echo "→ PostgreSQL: localhost:5440"
	@echo "→ Redis:      localhost:6389"

# ── Backend Flask ─────────────────────────────────────────────────────────────
backend:
	@[ -f .env ] || (echo "⚠  Crie o .env primeiro: cp .env.development .env" && exit 1)
	cd backend && \
	  FLASK_APP=app \
	  FLASK_DEBUG=1 \
	  DATABASE_URL=$$(grep DATABASE_URL ../.env | cut -d= -f2-) \
	  REDIS_URL=$$(grep REDIS_URL ../.env | cut -d= -f2-) \
	  SECRET_KEY=$$(grep SECRET_KEY ../.env | cut -d= -f2-) \
	  JWT_SECRET_KEY=$$(grep JWT_SECRET_KEY ../.env | cut -d= -f2-) \
	  $(PYTHON) -m flask run --host=0.0.0.0 --port=5000 --reload

# ── RQ Worker ────────────────────────────────────────────────────────────────
worker:
	@[ -f .env ] || (echo "⚠  Crie o .env primeiro: cp .env.development .env" && exit 1)
	cd backend && \
	  DATABASE_URL=$$(grep DATABASE_URL ../.env | cut -d= -f2-) \
	  REDIS_URL=$$(grep REDIS_URL ../.env | cut -d= -f2-) \
	  $(PYTHON) -m rq worker default \
	    --url $$(grep REDIS_URL ../.env | cut -d= -f2-)

# ── Frontend Vite ────────────────────────────────────────────────────────────
frontend:
	cd frontend && npm install --silent && npm run dev

# ── Dev tudo em paralelo ──────────────────────────────────────────────────────
dev: infra
	@echo "→ Iniciando backend, worker e frontend em paralelo..."
	@command -v parallel >/dev/null 2>&1 || \
	  (echo "Dica: instale 'parallel' (apt install parallel) para 'make dev' funcionar." && \
	   echo "Alternativa: abra 3 terminais e rode: make backend | make worker | make frontend" && exit 1)
	parallel --lb --halt soon,fail=1 ::: \
	  "$(MAKE) backend" \
	  "$(MAKE) worker" \
	  "$(MAKE) frontend"

# ── Docker Compose completo ───────────────────────────────────────────────────
docker:
	docker compose up --build

# ── Migrations ────────────────────────────────────────────────────────────────
migrate:
	$(FLASK) db upgrade

# ── Testes ───────────────────────────────────────────────────────────────────
test:
	$(PYTEST) tests/ -v --tb=short

# ── Lint ─────────────────────────────────────────────────────────────────────
lint:
	$(RUFF) check app

# ── Auditoria de dependências ────────────────────────────────────────────────
audit:
	cd backend && .venv/bin/pip-audit
	cd frontend && npm audit --audit-level=moderate
	cd mobile && npm audit --audit-level=moderate

# ── Produção ─────────────────────────────────────────────────────────────────
prod-preflight:
	./scripts/prod-preflight.sh

restore-backup:
	@[ -n "$(BACKUP)" ] || (echo "Uso: make restore-backup BACKUP=/caminho/backup.sql.gz" && exit 1)
	./scripts/restore-postgres-backup.sh "$(BACKUP)"

# ── Parar infra ───────────────────────────────────────────────────────────────
stop:
	docker compose stop postgres redis

# ── Limpeza ───────────────────────────────────────────────────────────────────
clean:
	find . -type d -name "__pycache__" -not -path "./.venv/*" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -not -path "./.venv/*" -delete 2>/dev/null || true
	find . -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@echo "✅  Limpo."
