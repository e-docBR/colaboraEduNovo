# Arquitetura do Sistema — ColaboraEdu

## Visão Geral

O ColaboraEdu é uma plataforma SaaS multi-tenant de gestão escolar. A arquitetura suporta múltiplas escolas com isolamento total de dados, autenticação JWT com refresh silencioso, processamento assíncrono de PDFs via fila Redis/RQ e análise inteligente com IA.

```
┌─────────────────────────────────────────────────────────────────────┐
│                            USUÁRIOS                                  │
│  (Alunos, Professores, Coordenadores, Diretores, Super-Admin)       │
└──────────────────┬──────────────────────────┬───────────────────────┘
                   │ Web Browser               │ Mobile (Expo)
                   ▼                           ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  Frontend Web (React/MUI)    │  │  App Mobile (React Native)   │
│  Redux Toolkit + RTK Query   │  │  Zustand + TanStack Query    │
│  Silent token refresh        │  │                              │
└──────────┬───────────────────┘  └──────────────┬───────────────┘
           │                                     │
           │           HTTPS / REST API          │
           ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Traefik (Proxy Reverso)                        │
│                    TLS automático (Let's Encrypt)                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Flask 3 / Python 3.12)                  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Middleware de Tenant (before_request)                        │  │
│  │  Resolve tenant: JWT claim > Header X-Tenant-ID > Host       │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │  API Routes (Blueprint api_v1)                                │  │
│  │  /auth  /alunos  /turmas  /notas  /ocorrencias                │  │
│  │  /comunicados  /relatorios  /graficos  /usuarios              │  │
│  │  /uploads  /audit  /ia  /super-admin                         │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │  Services Layer                                               │  │
│  │  AIChat  AIPredictor  Analytics  InterventionService          │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │  Models (SQLAlchemy 2.0)                                      │  │
│  │  Tenant  AcademicYear  Usuario  Aluno  Nota                   │  │
│  │  Ocorrencia  Comunicado  AuditLog  Upload                     │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
┌──────────────────────┐          ┌──────────────────────┐
│   PostgreSQL 15      │          │      Redis 7         │
│  (Dados principais)  │          │  Cache / Jobs /      │
│  Row-level tenant    │          │  JWT blocklist /     │
│  isolation via ORM   │          │  Password reset      │
└──────────────────────┘          └──────────┬───────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │   RQ Worker          │
                                  │  Ingestão de PDF     │
                                  │  Notificações        │
                                  └──────────────────────┘
```

---

## Multi-Tenancy

### Modelo

Cada escola é um registro na tabela `tenants` com `slug` único (ex: `escola-central`). Todo registro de dado (aluno, nota, usuário, etc.) carrega `tenant_id` como FK obrigatória.

### Resolução de Tenant (Middleware)

O middleware `before_request` resolve o tenant nesta ordem de prioridade:

1. **JWT claim** `tenant_id` — usuário autenticado carrega o tenant no token
2. **Header** `X-Tenant-ID` — para chamadas server-to-server
3. **Host header** — mapeamento de domínio customizado por escola
4. **Fallback localhost** — apenas em `FLASK_ENV=development`

Super-admin tem `tenant_id = NULL` no JWT e bypassa o filtro automático.

### Isolamento Automático (ORM Event Listener)

```python
# core/extensions.py — do_orm_execute
# Injeta WHERE tenant_id = X AND academic_year_id = Y em TODAS as queries
# automaticamente, sem necessidade de filtros manuais nos endpoints.
```

O `academic_year_id` também é propagado pelo JWT para que todas as queries sejam isoladas por ano letivo.

---

## Autenticação e Autorização

### JWT

- **Access token**: TTL 30 minutos, carrega `roles`, `tenant_id`, `academic_year_id`, `aluno_id`
- **Refresh token**: TTL 7 dias
- **Blocklist**: tokens revogados armazenados no Redis com chave `blocklist:{jti}`
- **Fail-closed**: se o Redis estiver indisponível, todos os tokens são tratados como revogados

### Refresh Silencioso (Web)

RTK Query usa um wrapper `baseQueryWithReauth`: ao receber 401, tenta automaticamente `POST /auth/refresh` antes de fazer logout. O usuário não percebe a renovação do token.

### RBAC — Roles Canônicas

| Role | Descrição |
|------|-----------|
| `super_admin` | Gerencia todas as escolas (sem tenant) |
| `admin` | Administrador da escola |
| `diretor` | Diretor escolar |
| `coordenador` | Coordenação pedagógica |
| `orientador` | Orientação educacional |
| `professor` | Acesso a turmas e alunos atribuídos |
| `aluno` | Acesso apenas ao próprio boletim |

**Constantes centralizadas em `core/roles.py`:**

```python
STAFF_ROLES     # admin, super_admin, professor, coordenador, diretor, orientador
MANAGER_ROLES   # admin, super_admin, coordenador, diretor, orientador
ADMIN_ROLES     # admin, super_admin
UPLOAD_ROLES    # staff que pode fazer upload de PDFs
```

Todos os endpoints importam dessas constantes — nunca defina listas de roles inline.

### Segurança Implementada

- Rate limiting em endpoints sensíveis (`/auth/login`, `/auth/change-password`, `/auth/forgot-password`)
- Security headers HTTP via `after_request`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (apenas produção), `Referrer-Policy`, `Permissions-Policy`
- Senhas: mínimo 8 caracteres, ao menos 1 maiúscula e 1 número (Pydantic validator)
- Geração segura de senhas temporárias via `secrets.token_urlsafe(16)`
- Recuperação de senha: token Redis TTL 1h, uso único, sem enumeração de e-mails
- Sourcemaps desabilitados em produção (`build.sourcemap = false` no Vite)

---

## Componentes Principais

### Frontend Web (React 18)

**Stack:** React 18, TypeScript, Vite, Material UI v6, Redux Toolkit + RTK Query, Recharts

```
frontend/src/
├── app/              # Store Redux, rotas (React Router v6), hooks globais
│   ├── store.ts
│   ├── routes.tsx    # createBrowserRouter com guards de autenticação
│   └── hooks.ts
├── components/       # Componentes reutilizáveis
│   ├── navigation/   # Sidebar, TopBar, NotificationBell
│   └── ui/           # Componentes UI genéricos
├── features/         # Features por domínio (co-localização de tudo)
│   ├── auth/         # Login, ChangePassword, ForgotPassword, ResetPassword
│   ├── dashboard/    # Dashboard, TeacherDashboard, AIInterventionBoard
│   ├── alunos/       # AlunosPage, AlunoDetailPage, MeuBoletimPage
│   ├── notas/        # NotasPage (boletim editável)
│   ├── comunicados/  # ComunicadosPage (paginado)
│   ├── ocorrencias/  # OcorrenciasPage
│   ├── relatorios/   # RelatoriosPage, RelatorioDetailPage
│   ├── graficos/     # GraficosPage
│   ├── usuarios/     # UsuariosPage, AuditLogsPage
│   └── super-admin/  # TenantsPage
└── lib/
    └── api.ts        # Todas as mutations/queries RTK Query + baseQueryWithReauth
```

### Backend (Flask 3)

**Stack:** Flask 3, SQLAlchemy 2, Pydantic v2, Flask-JWT-Extended, Flask-Limiter, Flask-Mail

```
backend/app/
├── __init__.py       # App factory, security headers, blueprints
├── api/v1/           # Endpoints REST (um arquivo por domínio)
│   ├── auth.py       # Login, refresh, logout, change-password, forgot/reset-password
│   ├── alunos.py
│   ├── notas.py
│   ├── ocorrencias.py   # paginado (page/per_page)
│   ├── comunicados.py
│   ├── exports.py    # GET /exports/alunos e /exports/notas (CSV + XLSX)
│   ├── relatorios.py
│   ├── graficos.py
│   ├── usuarios.py
│   ├── turmas.py
│   ├── audit.py
│   ├── ai.py
│   └── __init__.py   # Blueprint + PUBLIC_ENDPOINTS set
├── models/           # SQLAlchemy models (TenantYearMixin em todos)
├── services/         # Lógica de negócio
│   ├── ai_chat.py
│   ├── ai_predictor.py   # modelo joblib por tenant + SHA-256 integrity
│   ├── analytics.py      # build_teacher_dashboard + build_dashboard_metrics
│   └── intervention_service.py
├── schemas/          # Pydantic v2 (validação de request/response)
├── core/
│   ├── config.py     # Pydantic BaseSettings (lê de variáveis de ambiente)
│   ├── middleware.py # Resolução de tenant/ano letivo
│   ├── database.py   # engine, session_scope(), ORM event listener (isolamento)
│   ├── security.py   # JWT blocklist (fail-closed)
│   ├── cache.py      # Redis cache com role-segmented keys (evita cache poisoning)
│   ├── roles.py      # Constantes de roles — STAFF_ROLES, MANAGER_ROLES, etc.
│   └── decorators.py # @require_roles, etc.
└── templates/
    └── documents/bulletin.html  # Template do boletim PDF
```

### App Mobile (React Native / Expo)

**Stack:** React Native 0.81, Expo, Zustand, TanStack Query

```
mobile/
└── app/
    ├── (tabs)/       # Telas principais com navegação por abas
    └── _layout.tsx   # Layout e navegação raiz
```

---

## Banco de Dados

### Modelo Simplificado

```
tenants
├── id, slug, nome, domain, ativo, settings (JSON)
└── → academic_years (1:N)

academic_years
├── id, tenant_id, year, ativo
└── [todos os dados são isolados por tenant_id + academic_year_id]

usuarios
├── id, tenant_id, username, email, password_hash
├── role (super_admin/admin/diretor/coordenador/orientador/professor/aluno)
├── must_change_password, aluno_id (FK nullable)
└── foto_url

alunos
├── id, tenant_id, academic_year_id
├── nome, matricula, turma (string), turno, serie
├── status_especial (Cancelado/Transferido/Desistente)
└── responsavel_nome, responsavel_telefone, responsavel_email

notas
├── id, tenant_id, academic_year_id, aluno_id
├── disciplina
├── trimestre1, trimestre2, trimestre3 (Numeric, nullable)
├── total (média dos trimestres preenchidos — null se todos null)
├── faltas, status (APR/REP/REC/APCC)
└── [sem tabela Turma separada — turma é campo string em aluno/nota]

ocorrencias
├── id, tenant_id, academic_year_id, aluno_id
├── tipo, severidade, descricao, data
├── acoes_tomadas, instrucoes_responsavel
└── autor_id (FK -> usuarios)

comunicados
├── id, tenant_id, academic_year_id
├── titulo, conteudo, tipo_destinatario
├── turma_id (nullable), aluno_id (nullable)
├── fixado, autor_id
└── leituras (N:M -> usuarios via comunicado_leituras)

audit_logs
└── id, tenant_id, usuario_id, acao, entidade, entidade_id, detalhes, timestamp
```

> **Nota:** Não existe uma tabela `turmas` separada. Turma é um campo `string` nos modelos `Aluno` e `Nota`, derivado dos PDFs de boletim importados.

---

## Fluxo de Ingestão de PDF

```
1. Usuário faz upload via POST /uploads
   └─> Arquivo salvo em /data/uploads/{tenant_slug}/

2. Job enfileirado no Redis (RQ)

3. Worker processa em background:
   ├─> Extrai alunos, turmas e notas do PDF
   ├─> Cria/atualiza registros no banco (upsert por matrícula)
   ├─> Cria AcademicYear automaticamente se necessário
   └─> Normaliza nome de turmas (formato "Xº LETRA", suporte a EJA)

4. Frontend monitora status via polling
```

---

## Recuperação de Senha

```
1. POST /auth/forgot-password {email}
   ├─> Gera token = secrets.token_urlsafe(32)
   ├─> Armazena Redis: pwd_reset:{token} = user_id  (TTL 3600s)
   ├─> Envia e-mail: {FRONTEND_URL}/redefinir-senha?token={token}
   └─> Sempre retorna 200 (sem enumeração de e-mails)

2. Usuário clica no link → ResetPasswordPage

3. POST /auth/reset-password {token, new_password}
   ├─> Valida token no Redis
   ├─> Valida complexidade da senha
   ├─> DELETE Redis (uso único)
   └─> Atualiza password_hash + must_change_password=False
```

---

## Cache (Redis)

### Estratégia de chave

```
{prefix}:{tenant_id}:v{version}:{year_id}:{role_category}:{path}:{query_string}
```

- **`version`** — contador incremental por tenant; `invalidate_tenant_cache()` faz `INCR` atômico em O(1), tornando todas as chaves antigas obsoletas sem varredura (`SCAN`).
- **`role_category`** — segmenta respostas por nível de permissão (`super_admin`, `admin`, `manager`, `professor`, `aluno`, `anon`). Evita que uma resposta de staff seja servida a um aluno via cache hit.

### Pontos de invalidação

| Evento | Chave invalidada |
|--------|-----------------|
| `PATCH /notas/:id` | Todo o cache do tenant |
| `POST /ocorrencias` | Todo o cache do tenant |
| Qualquer operação de escrita com `invalidate_tenant_cache()` | Todo o cache do tenant |

---

## Health Checks

| Endpoint | Auth | Retorna |
|----------|------|---------|
| `GET /health` | Não | `{ status, checks: { database, redis } }` |
| `GET /health/detailed` | JWT (super_admin para dados extras) | `{ status, checks: { database, migrations, redis, queue, [pool] } }` |

O endpoint `/health/detailed` expõe a versão aplicada de migrations (`alembic_version`), profundidade da fila RQ e estado do pool de conexões. Ideal para monitoramento pós-deploy.

---

## Exportação de Dados

Endpoints de exportação em `GET /api/v1/exports/`:

| Endpoint | Formato | Filtros disponíveis |
|----------|---------|---------------------|
| `/exports/alunos` | CSV, XLSX | `turma`, `turno` |
| `/exports/notas` | CSV, XLSX | `turma`, `turno`, `disciplina` |

Geração síncrona (sem fila). Para datasets grandes (>5000 linhas) considere migrar para job assíncrono via RQ.

---

## Performance

### Frontend
- Code splitting por rota (Vite)
- RTK Query com cache inteligente e invalidação por tags
- Sourcemaps desabilitados em produção

### Backend
- Connection pooling (SQLAlchemy) — configurável via env vars
- Paginação em todas as listagens (`page` + `per_page`)
- Cache Redis com invalidação O(1) por versão de tenant
- Background jobs para operações longas (PDF, e-mails, treinamento ML)

---

## Escalabilidade

Para escalar horizontalmente:
- **Backend**: múltiplas instâncias atrás do Traefik (stateless via JWT + Redis)
- **Workers**: múltiplos workers RQ (as filas são compartilhadas via Redis)
- **Banco**: read replicas para relatórios pesados
- **Redis**: Redis Sentinel ou Cluster para alta disponibilidade
