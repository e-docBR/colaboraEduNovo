# 📋 Resumo do Projeto — ColaboraEdu

**Data:** 09 de maio de 2026  
**Tipo:** Plataforma SaaS de Gestão Escolar  
**Status:** Ativo, em desenvolvimento

---

## 🎯 O que é ColaboraEdu?

Plataforma educacional completa (web + mobile) que permite gestão de:
- Alunos, turmas, notas (boletins)
- Ocorrências disciplinares
- Comunicados para escola/turmas/alunos
- Relatórios e análises com IA
- Multi-tenant (múltiplas escolas isoladas)

---

## 🏗️ Stack Tecnológico

**Backend:** Python 3.12 + Flask 3.x + PostgreSQL 15 + Redis 7  
**Frontend:** React 18 + TypeScript + Material UI + Vite  
**Mobile:** React Native + Expo  
**Infra:** Docker Compose + Traefik (prod)

---

## 📂 Estrutura Principal

```
colaboraEdu-produc/
├── backend/           # Flask API
├── frontend/          # React SPA
├── mobile/            # React Native
├── docs/              # Documentação técnica
├── CLAUDE.md          # Guia para Claude Code ⭐
├── CONVENTIONS.md     # Padrões de código
├── CODE_ARCHITECTURE.md # Arquitetura profunda
├── QUICK_START.md     # Começar em 30 min
└── DOCUMENTATION_INDEX.md # Índice de docs
```

---

## 🔑 Conceitos-Chave

### 1. Multi-Tenancy
- Cada escola é um `Tenant` isolado
- Isolamento automático via ORM event listener
- Sem possibilidade de data leakage

### 2. Autenticação JWT
- Access token (30 min) + refresh token (30 dias)
- Refresh automático no frontend
- Blocklist Redis para logout

### 3. Processamento Assíncrono
- RQ (job queue) para ingestão de PDFs
- Background workers em container separado
- Polling status via API

### 4. Integração IA
- Claude (Anthropic) para análise de alunos em risco
- Sugestões de intervenção personalizadas
- Chat streaming com contexto escolar

---

## 📊 Tecnologias por Camada

### Backend
- **ORM:** SQLAlchemy 2.0
- **Validação:** Pydantic v2
- **Auth:** Flask-JWT-Extended
- **Cache:** Redis (+ Flask-Caching)
- **Queue:** RQ + Redis
- **API:** Flask blueprints
- **Migrations:** Alembic

### Frontend
- **State:** Redux Toolkit
- **API Client:** RTK Query
- **UI:** Material UI v6
- **Forms:** React Hook Form + Zod
- **Routing:** React Router v6
- **Build:** Vite
- **Bundler:** esbuild

### Mobile
- **Framework:** React Native
- **State:** Zustand
- **Data Fetching:** TanStack Query
- **Navigation:** React Navigation

---

## 🚀 Como Rodar

### Docker (Recomendado)
```bash
docker-compose up -d --build
docker-compose exec backend flask --app app init-db
```

### Manual
```bash
# Backend
cd backend && python -m venv .venv && pip install -e ".[dev]"
flask --app app run --debug

# Frontend
cd frontend && npm install && npm run dev

# Worker
rq worker default
```

---

## 📚 Documentação Principal

| Arquivo | Para quem |
|---------|-----------|
| **CLAUDE.md** | Todos — guia geral |
| **CONVENTIONS.md** | Devs — padrões de código |
| **CODE_ARCHITECTURE.md** | Arquitetos — detalhes técnicos |
| **QUICK_START.md** | Novos devs — começar rápido |
| **docs/ARCHITECTURE.md** | Tech Leads — stack e segurança |
| **docs/API.md** | API consumers — endpoints |
| **DEPLOYMENT_STATUS.md** | DevOps — rodando agora |

---

## 🔄 Fluxo de Desenvolvimento

1. **Branch:** `git checkout -b feature/descricao`
2. **Mudança:** Edite código, testes passam
3. **Lint:** `npm run lint` (frontend), `pylint` (backend)
4. **Commit:** `git commit -m "feat(scope): descricao"`
5. **Push:** `git push origin feature/descricao`
6. **PR:** GitHub → await review → merge

---

## 📍 Localização dos Principais Componentes

### Backend
- **Endpoints:** `backend/app/api/v1/`
- **Lógica:** `backend/app/services/`
- **Models:** `backend/app/models/`
- **Auth:** `backend/app/core/security.py`
- **Migrations:** `backend/migrations/`

### Frontend
- **Pages:** `frontend/src/features/`
- **Components:** `frontend/src/components/`
- **API Client:** `frontend/src/lib/api.ts`
- **Redux:** `frontend/src/app/store.ts`

### Documentação
- **Docs:** `docs/`
- **Root:** `*.md` files

---

## 🔐 Segurança

- JWT com refresh silencioso
- Rate limiting endpoints sensíveis
- SQL injection protection (SQLAlchemy ORM)
- CORS headers
- HSTS, X-Frame-Options, CSP
- Password reset com token Redis TTL

---

## 🎓 Para Começar como Dev Novo

1. **Leia:** `CLAUDE.md` (15 min)
2. **Rode:** `docker-compose up` (10 min)
3. **Explore:** `backend/app/api/v1/` e `frontend/src/features/`
4. **Leia:** `CONVENTIONS.md` (20 min)
5. **Código:** Faça seu primeiro endpoint
6. **Commit:** Siga Git convention

---

## 🤝 Padrões da Equipe

- **Code Review:** 2 approvals antes de merge
- **Commits:** Semantic messages (`feat:`, `fix:`, `docs:`)
- **Branches:** `feature/`, `bugfix/`, `hotfix/`
- **Tests:** Backend + Frontend (TBD)
- **Docs:** Update quando mudar arquitetura

---

## 📞 Contatos e Links

- **Repo:** GitHub
- **Issues:** GitHub Issues
- **Documentação:** `/docs` + root `*.md`
- **Chat:** Slack/Discord (se existir)

---

**Última atualização:** 09 de maio de 2026  
**Documentação completa e pronta para uso!** ✅
