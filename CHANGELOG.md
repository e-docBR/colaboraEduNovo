# Changelog

All notable changes to this project will be documented in this file.

O projeto segue [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.  
Cada versão é marcada como uma **tag Git** (`v1.7.0`, `v1.6.9`, …) permitindo baixar
ou restaurar qualquer release via `git checkout vX.Y.Z` ou pelo GitHub → *Releases*.

---

## [1.8.2] - 2026-06-12

### Relatórios / Ata de Resultado
- **Ata de Resultado Final**: Integrou e exibiu com sucesso os dados de **Data de Nascimento** (formatada no padrão brasileiro `DD/MM/YYYY`) e **Sexo** (com fallback para `-` se ausente) para cada aluno.
- **Resolução de Colisão de Slugs**: Corrigiu o problema onde turmas com nomes semelhantes (como `6º A` e `6º A -`) colidiam no mesmo slug, resultando em dados incorretos no frontend. Agora, os slugs são gerados de forma determinística e única (ex: `6o-a` e `6o-a-2`).
- **Navegação**: Adicionou a página de "Ata de Resultado Final" ao roteador e ao menu lateral do frontend para fácil acesso pela equipe pedagógica.

### Qualidade / Code Style
- **Ajustes de Linter e Avisos**: Removeu imports e componentes não utilizados no backend e no frontend, limpando todos os avisos de linter do Ruff e ESLint para manter o build e as validações 100% livres de alertas.

---

## [1.8.1] - 2026-05-22

### Auditoria / Operação
- `audit-remediation-plan.md`: consolida o plano e as validações do ciclo.
- `docs/PRODUCTION_READINESS.md`: registra gates e pendências para go-live.
- `scripts/doctor.sh` e `scripts/validate-workspace.sh`: validação reprodutível com fallback seguro quando `node_modules` local estiver ausente/quebrado.
- `Makefile`: adiciona `make doctor`, `make validate` e alvos por projeto (backend/frontend/mobile).

### CI/CD e Deploy
- CI alinha o frontend a `VITE_API_BASE_URL` (variável efetivamente consumida).
- Deploy ajusta `docker compose` (`--scale worker=3`) e adiciona smoke test (frontend, `/health`, descoberta de tenants).
- `scripts/prod-preflight.sh`: falha cedo quando variáveis mínimas de produção estão ausentes e valida integrações opcionais (S3/Stripe) de forma consistente.

## [1.8.0] - 2026-05-20

### Segurança — Hardening Completo

#### Criptografia de API Keys LLM (Fernet/AES-128)
- Novo módulo `backend/app/core/crypto.py` com `EncryptedSecret` TypeDecorator:
  criptografia/descriptografia transparente na camada ORM sem alteração nos callers.
- Chave derivada via SHA-256 do `SECRET_KEY` → base64 URL-safe → Fernet.
  Valores criptografados têm prefixo `enc:` para compatibilidade retroativa com
  registros antigos em texto plano.
- Migration `h2i3j4k5l6m7`: altera `ai_configurations.api_key` para `Text` e
  criptografa registros existentes.
- `cryptography>=42.0.0` adicionado às dependências do backend.

#### Refresh Token em Cookie HttpOnly
- Refresh token removido do corpo JSON do `/auth/login` — enviado exclusivamente
  via cookie `HttpOnly; Secure; SameSite=Strict`, inacessível ao JavaScript.
- `/auth/refresh` lê o token somente do cookie, nunca de um header Authorization.
- `/auth/logout` revoga access token e refresh token (cookie) no Redis blocklist
  e apaga o cookie com `max_age=0`.

#### IP Real no Audit Log
- `_get_client_ip()` em `auth.py` prefere `X-Real-IP` (header setado pelo Traefik
  diretamente da conexão TCP) sobre `X-Forwarded-For`, que um cliente pode falsificar.
- Afeta os logs de `LOGIN_SUCCESS`, `LOGIN_FAILED` e `LOGOUT`.

#### Rate Limit por Tenant+Usuário no Chat IA
- Função `_chat_rate_key()` retorna `chat:{tenant_id}:{user_id}` como chave de limite,
  isolando a cota de cada usuário de cada escola.
- Aplicada via `key_func` nos endpoints `/chat` e `/chat/stream` (30 req/hora).
- Antes o limite era global — um único usuário podia esgotar a cota de todos.

#### Índice Parcial para Soft Delete em Usuários
- `UniqueConstraint` global de `(tenant_id, username)` e `(tenant_id, email)`
  substituído por índices parciais PostgreSQL com `WHERE deleted_at IS NULL`.
- Migration `i3j4k5l6m7n8`: recria os índices com cláusula parcial.
- Usuários soft-deletados não bloqueiam mais o reuso de username/email.

#### Worker com Usuário DB de Privilégios Mínimos
- Serviço `worker` no `docker-compose.prod.yml` usa `APP_DB_USER`/`APP_DB_PASSWORD`
  (DML apenas, sem DDL) em vez do superusuário `POSTGRES_USER`.
- Reduz superfície de ataque — um worker comprometido não pode alterar schema.

### Confiabilidade — AI Chat

#### Sessão DB Fechada Antes de Chamar LLM Externo
- `ai_chat.py` refatorado com método `_prepare_query()`: toda a lógica de banco de
  dados (query de alunos, disciplines, AI config) é concluída e a sessão é fechada
  antes de qualquer chamada HTTP ao provedor LLM.
- `_AIConfigSnapshot` (dataclass frozen) transporta os primitivos necessários para
  o LLM sem manter uma sessão SQLAlchemy aberta.
- Elimina risco de timeout de conexão e pool exhaustion durante chamadas lentas ao LLM.

#### Sanitização de System Prompt Customizado
- `_sanitize_system_prompt()`: remove padrões de injeção de prompt (ex:
  "ignore previous instructions") e limita a 500 caracteres.
- Regex `_INJECTION_PATTERN` detecta tentativas de jailbreak em prompts customizados
  configurados pelo tenant no painel admin.

#### Deduplicação de process_query / stream_process_query
- Ambos os métodos compartilham `_prepare_query()` para a fase de banco de dados,
  eliminando ~80 linhas de código duplicado.

#### Cleanup Periódico do Cache de Disciplinas
- `_cleanup_discipline_cache()` chamada antes de cada inserção: remove entradas
  expiradas e limita o dicionário a 200 entradas para evitar crescimento ilimitado
  em instâncias de longa duração.

### Rastreabilidade — Audit Log na Ingestão
- `ensure_aluno_user` e `ensure_responsavel_user` em `accounts.py` registram um
  `AuditLog` com `user_id=None`, `action="create"`, `source="ingestion"` e matrícula
  ao criar novas contas via upload de PDF/CSV.
- Permite distinguir contas criadas por ingestão automática de contas criadas
  manualmente pelo administrador.

### Frontend
- **ChatWidget**: interface completa de streaming SSE com histórico de conversa,
  `page_context` (aluno/turma), indicador de digitação e tratamento de erros.
- **authSlice**: integração com cookie HttpOnly, restaura estado Redux após F5
  via `/auth/refresh` sem expor o refresh token ao JavaScript.
- **api.ts**: suporte a SSE, interceptor de 401 com silent refresh automático.
- **UploadsPage**: indicador de progresso de ingestão e feedback de erros detalhado.
- **nginx.conf** e **vite.config.ts**: headers de segurança CSP e configuração de proxy.

### Infraestrutura
- `dev.sh` e `start.sh`: scripts de inicialização para desenvolvimento local.
- `scripts/generate-lock.sh`: regenera lock files de forma reproduzível.
- Migration `5dfe9b7b19b1`: merge de heads divergentes do Alembic.
- Migration `g1h2i3j4k5l6`: índice composto em notas para performance.

---

## [1.7.0] - 2026-05-08

### Correções de Infraestrutura e Migrations

#### Ambiente de Desenvolvimento
- **`REDIS_URL` corrigida no `.env`**: endereço Docker `redis:6379` substituído por
  `localhost:6389` (porta exposta pelo `docker-compose.yml`), eliminando o erro
  `Temporary failure in name resolution` que impedia todas as requisições.
- **`.env` limpo**: removida linha `# DATABASE_URL=sqlite://…` comentada que causava
  concatenação inválida no `grep` do `Makefile`, resultando em `database "colabora_edu\nsqlite://…" does not exist`.

#### Migrations
- **Conflito de revision ID resolvido**: duas migrations possuíam o ID `a1b2c3d4e5f6`.
  A migration `add_soft_delete` foi renomeada para `a1b2c3d4e5f7` e a cadeia
  linearizada.
- **Cadeia de migrations corrigida e aplicada**:
  - `b2c3d4e5f6a7` (billing Stripe nos tenants) → agora parte da cadeia principal.
  - `c9f2a8b3d1e4` (índices compostos audit_logs/comunicados) → encadeado após billing.
  - `a1b2c3d4e5f7` (soft delete em alunos e usuários) → head atual.
- **3 migrations pendentes aplicadas** ao banco de produção/desenvolvimento:
  colunas `plano`, `plano_ativo`, `plano_expira_em`, `stripe_customer_id`,
  `stripe_subscription_id` adicionadas à tabela `tenants`; índices de performance
  criados; colunas `deleted_at` e `is_archived` adicionadas a `alunos` e `usuarios`.

---

## [1.6.9] - 2026-05-06

### Melhorias de Login e Multi-Tenant
- **Seletor de Escola (Web e Mobile)**: Otimização da tela de login para suportar nativamente seleções de perfil e tenants. No web, adicionado suporte explícito para acesso `Central / Super Admin`. No mobile, implementada listagem de escolas via chips para escolha antes da autenticação.
- **Backend & Core**: Ajustes nas configurações do core, tratamento de ingestão de dados (`ingestion.py`) e serviços de chat IA (`ai_chat.py`).

### Infraestrutura e CI/CD
- **Workflows Automáticos**: Atualizações extensas no `.github/workflows/ci.yml` e ajustes no workflow de deploy para maior estabilidade na integração contínua.
- **Docker e Deploy**: Ajustes no `docker-compose.prod.yml`, `Makefile` e documentação detalhada no `DEPLOYMENT.md`.

## [1.6.8] - 2026-05-04

### Melhorias Gerais e Refatorações
- **Backend API & Serviços**: Atualização e refatoração de diversos endpoints na API v1 (AI, alunos, chat, dashboard, exports, gráficos, notas, relatórios, super_admin, uploads, usuários) e serviços core (AI predictor, ingestão, intervenções, ocorrências e usuários).
- **Segurança e Core**: Melhorias no `security.py` e ajustes no `aluno_repository.py`.
- **Testes Backend**: Ampliação da cobertura de testes automatizados (`test_auth.py`, `test_health.py`, `test_ingestion.py`).
- **Frontend & Mobile**: Ajustes no fluxo de autenticação e UI no painel web (`LoginPage.tsx`) e no aplicativo mobile (`login.tsx`, `perfil.tsx`, `api.ts`, `auth.store.ts`).
- **Infraestrutura**: Atualização do script `entrypoint.sh` e remoção do arquivo rastreado indevidamente `letsencrypt/acme.json`.

## [1.6.7] - 2026-05-04

### Segurança e Governança
- **Controle de Acesso e API**: Revisão e aprimoramento das validações de RBAC e segurança nos endpoints principais da API v1 e na camada de serviços.
- **Tratamento de Autenticação**: Atualização nas rotinas de segurança e integração de usuários.

### Melhorias de UI/UX
- **Componentes do Frontend**: Atualizações no painel de navegação (`TopBar.tsx`) e nas telas de gestão de alunos, comunicados, ocorrências, tenants e usuários.
- **Fluxo de Autenticação**: Melhorias na experiência das telas de login, recuperação e alteração de senhas.

### Infraestrutura e Estabilidade
- **Docker e Produção**: Ajustes e otimizações no arquivo `docker-compose.prod.yml` e no script `entrypoint.sh` para garantir inicialização confiável dos serviços.

## [1.6.5] - 2026-04-27

### Novas Funcionalidades e UI/UX
- **Comunicados para Professores**: Adicionado suporte para enviar comunicados direcionados a "Professor(es)" tanto no frontend (`ComunicadosPage.tsx`) quanto na validação da API (`comunicados.py`).
- **Cálculo de Risco de Alunos**: A lógica visual de Risco (Alto/Atenção) no `AlunosPage.tsx` agora usa a média de faltas (`media_faltas`) em vez das faltas totais, fornecendo um indicador mais justo em relação ao desempenho acadêmico geral da turma.

### Bugs Corrigidos
- **Vínculo de Contas de Aluno**: O serviço de contas (`accounts.py`) foi ajustado para sempre atualizar ou forçar o vínculo do `aluno_id` do usuário com sua matrícula independentemente de validações estritas de ano letivo, o que resolve problemas de login de alunos cujos anos letivos poderiam ser avaliados como não correntes no momento da sincronização.

## [1.6.4] - 2026-04-27

### Segurança e Estabilidade
- **Transações do Banco de Dados**: Refatoração do `BaseRepository` para usar `session.flush()` em vez de `session.commit()` nas operações de `create` e `update`, permitindo que o escopo da transação controle os commits e evitando inconsistências no banco.
- **Worker Customizado**: Adição de `worker.py` e atualização do `docker-compose.yml` para rodar o worker através do script Python em vez do comando CLI do RQ diretamente.

### Novas Funcionalidades e UI/UX
- **Leituras de Comunicados**: Novo endpoint no backend e interface no frontend (`ComunicadosPage.tsx`) que permite visualizar quem leu um comunicado e quando.
- **Credenciais de Acesso (Alunos)**: Adicionado um dialog de confirmação na tela de criação de alunos (`AlunosPage.tsx`) que exibe de forma clara o usuário e a senha (matrícula) gerados para o primeiro acesso.
- **Visualização para Responsáveis**: Adicionado um banner informativo no `MeuBoletimPage.tsx` destacando qual aluno está sendo visualizado quando o usuário logado é um "responsável".
- **Novas Métricas no Dashboard**: O Dashboard agora exibe métricas de `ocorrencias_abertas` (não resolvidas) e `comunicados_recentes` (últimos 7 dias).
- **Filtro de Ocorrências por Data**: Ocorrências agora suportam filtragem por período de data (`date_from` e `date_to`) na listagem da API.

### Bugs Corrigidos
- **Notificações de Ocorrências**: Tratamento mais claro de status de notificação (`Sem contato cadastrado`, `OK`, `Falha`). Adicionada também a turma do aluno no corpo do e-mail.
- **Validação de Comunicados Específicos**: Correção na criação de comunicados para alvo "ALUNO", que agora verifica no banco de dados se o aluno especificado realmente existe naquele tenant.
- **Tratamento de Erros no Frontend**: Melhorado o tratamento de erros em operações de CRUD no painel de alunos, exibindo snackbars descritivos em vez de falhas silenciosas ou console logs genéricos.

## [1.6.3] - 2026-04-24

### Segurança e Estabilidade
- **Melhoria no Envio de Emails**: Refatoração do `CommunicationService` para usar `smtplib` diretamente em vez do contexto do Flask-Mail. Isso evita falhas de contexto da aplicação ao rodar requisições em background (workers).
- **Validação de Senha Robusta**: O frontend (`ChangePasswordPage.tsx`) agora conta com validação estrita de segurança e feedback visual contínuo informando o usuário sobre os requisitos (Mínimo 8 caracteres, 1 maiúscula, 1 número).
- **Estabilidade do Banco de Dados**: Aumentado o limite de caracteres de `notificacao_status` (de 20 para 100) na tabela `ocorrencias` via nova migration (`f09657161e43`), evitando o erro de violação de tamanho ao sincronizar status longos vindo da Evolution API.

### Melhorias de Comunicação e UI/UX
- **Refinamento de Notificações**: Atualização do tom da mensagem de ocorrências enviada aos responsáveis, adotando uma abordagem mais parceira e acolhedora (assinada pela Orientação Educacional em vez da Coordenação).

### Melhorias de UI/UX
- **Acesso do Responsável**: O perfil `responsavel` agora é adequadamente redirecionado para a visualização simplificada "Meu Boletim" junto com o perfil `aluno`, impedindo acesso indevido às opções completas do dashboard de gestão e garantindo consistência na interface.

## [1.6.2] - 2026-04-24

### Segurança e Governança
- **Controle de Acesso Centralizado (RBAC)**: Consolidação de todos os roles no novo `core/roles.py` (`STAFF_ROLES`, `MANAGER_ROLES`, etc.), reforçando restrições (`require_roles("admin", "super_admin")`) em rotas sensíveis como edição de notas, exclusão de turmas e manipulação de usuários.
- **Proteção Cross-Tenant**: Garantia de que confirmações de leitura de comunicados respeitem rigidamente o `tenant_id` do usuário logado durante atualizações via ORM.
- **Validações e Sanitizações Reforçadas**: Adicionados checks de `max_length` no login (50 caracteres) e limite dinâmico de caracteres para buscas nas APIs, prevenindo payloads excessivos e DDoS.

### Novas Funcionalidades
- **Exportação Avançada (CSV/XLSX)**: Criado endpoint dedicado (`/exports`) para exportação fluida de relatórios de alunos e notas, com roteamento incluído no blueprint de rotas.
- **Monitoramento e Observabilidade**: Introduzido endpoint restrito `/health/detailed` para visualização em tempo real do estado do PostgreSQL, Redis, Fila RQ e integridade das migrações do Alembic.

### Bugs Corrigidos
- **Tratamento de Exceções no Chat AI**: Reformulado o manuseio de erros no `chat.py` para retornar mensagens construtivas e fallback JSON estruturado em vez de HTTP 500 perante falhas no LLM.

## [1.6.1] - 2026-04-23

### Segurança e Performance
- **Isolamento de Tenants no Login**: Autenticação agora exige e verifica o `tenant_id` correto no lookup do usuário, evitando colisão de usernames entre escolas.
- **Proteção de Scripts**: Adicionada variável de ambiente obrigatória (`ALLOW_BARE_MIGRATE=1`) para execução do script de migração `bare_usuarios.py`, prevenindo execuções acidentais em produção.
- **Backend Gunicorn**: O container `backend` no `docker-compose.yml` agora utiliza o servidor de produção `gunicorn` com 4 workers em vez do servidor de desenvolvimento embutido do Flask.
- **Segurança do Redis**: Adicionado suporte à variável `REDIS_PASSWORD` para proteção por senha no container do Redis.

### Novas Funcionalidades
- **Ocorrências Resolvidas**: Adicionado campo booleano `resolvida` ao modelo de Ocorrências (com respectiva migration `e2f3a4b5c6d7`) para permitir fechar/resolver ocorrências.

### Bugs Corrigidos
- **Ingestão de Boletins**: A função de upsert de Aluno agora usa também o `academic_year_id`, impedindo a mescla acidental de registros do mesmo aluno em anos letivos diferentes.
- **AI Predictor**: Corrigidos bugs no parse de `faltas` e falhas de logging na predição de risco (`ai_predictor.py`).

## [1.6.0] - 2026-04-23

### Novas Funcionalidades
- **Sistema de Notificações Integrado**: Envio de notificações de ocorrências por E-mail (SMTP) e WhatsApp (Evolution API) de forma assíncrona usando Redis Queue (RQ) e um worker dedicado.
- **Contato de Responsáveis**: Adicionados campos `email_responsavel` e `telefone_responsavel` ao cadastro de alunos (e schemas/API) para direcionamento adequado das notificações.
- **Melhorias na UI (Autenticação e Landing Page)**: Atualização visual significativa das páginas `LoginPage.tsx` e `LandingPage.tsx` para um design mais moderno e conversivo.
- **Gestão de Ocorrências Aprimorada**: A página `OcorrenciasPage.tsx` agora suporta acionamento do envio de notificações com rastreamento visual de status de entrega (Pendente, Enviado, Parcial, Falha).
- **Suporte Docker e RQ Worker**: Serviço `worker` incluído no `docker-compose.yml` para lidar com a fila assíncrona.
- **Documentação**: Novo guia `NOTIFICACOES.md` com instruções detalhadas de configuração para SMTP e WhatsApp (Evolution API).

## [1.5.1] - 2026-04-23

### Novas Funcionalidades
- **Gestão de Turmas (CRUD)**:
    - Adicionado suporte para renomear turmas (`PATCH /turmas/<slug>`) e alterar seus turnos.
    - Adicionado suporte para excluir turmas inteiras e todos os alunos associados (`DELETE /turmas/<slug>`).
    - Interface (`TurmasPage`) atualizada com botões de edição e exclusão (restrito a administradores), com modais de confirmação.

### Bugs Corrigidos
- **Upload de PDF (`IndentationError`)**: Corrigido recuo incorreto no `ingestion.py` que impedia o processamento de PDFs em background.
- **Constraints de Situação no Banco de Dados**: Expandido `CheckConstraint` da tabela `notas` para aceitar novos códigos reais de escolas (`EMC`, `EMR`, `AFC`, `DPC`, `TRN`, `ABA`).
- **Normalização de Situação**: Adicionado o helper `_normalize_situacao` para tratar códigos desconhecidos no PDF sem quebrar a ingestão inteira e criar aliases como `APROVADO` para `APR`.
- **Sincronização de Anos Letivos (Frontend vs Backend)**: Identificado por que usuários recém importados de um ano anterior não apareciam na interface caso o filtro estivesse fixado em um ano letivo diferente (ex. importação em 2025 vs seleção de 2026).

## [1.5.0] - 2026-04-10

### Segurança
- **Redis blocklist fail-closed**: se o Redis estiver indisponível, tokens são tratados como revogados (antes falhava silenciosamente, tokens revogados continuavam válidos)
- **Security headers HTTP**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (apenas produção)
- **Rate limiting em troca de senha**: `POST /auth/change-password` limitado a 5 tentativas/hora
- **Complexidade de senha**: mínimo 8 caracteres, ao menos 1 maiúscula e 1 número (Pydantic validator)
- **Senhas CLI seguras**: `create-admin` gera senha aleatória via `secrets.token_urlsafe(16)` — sem mais senhas hardcoded
- **Fallback localhost restrito**: mapeamento automático localhost → tenant1 só ativo em `FLASK_ENV=development`
- **Sourcemaps desabilitados em produção**: `vite.config.ts` agora usa `sourcemap: false` em build de produção

### Novas Funcionalidades
- **Recuperação de senha**: `POST /auth/forgot-password` + `POST /auth/reset-password` com token Redis (TTL 1h), e-mail via SMTP, sem enumeração de e-mails
- **Frontend — ForgotPasswordPage** (`/esqueci-senha`): formulário de recuperação de senha por e-mail
- **Frontend — ResetPasswordPage** (`/redefinir-senha?token=...`): redefinição de senha com token
- **Forçar troca de senha no primeiro login**: guard no loader da rota `/app` redireciona para `/alterar-senha` se `must_change_password == true`
- **Silent token refresh (web)**: `baseQueryWithReauth` no RTK Query — ao receber 401, tenta renovar o token automaticamente antes de fazer logout

### Bugs Corrigidos
- **B1 — Refresh token perde tenant_id**: `POST /auth/refresh` agora propaga `tenant_id` e `academic_year_id` no novo access token
- **B3 — Crash com parâmetros de paginação inválidos**: `int(request.args.get("page"))` agora tem try/except — `?page=abc` retorna página 1 em vez de HTTP 500
- **B4 — Nota `None` tratada como zero**: média final agora considera apenas trimestres preenchidos; alunos sem notas têm `total = null`
- **B5 — Ano hardcoded no PDF**: ano do boletim agora é dinâmico (`datetime.date.today().year` como fallback)
- **B7 — Enum de prioridade IA inconsistente**: prioridades alinhadas entre backend (`HIGH`/`MEDIUM`/`LOW`) e frontend
- **B8 — Mobile exibia campo undefined**: corrigido `user.nome` → `user.username` no app mobile
- **B11 — Qualquer usuário podia editar comunicados**: PATCH agora verifica ownership — professor só edita seus próprios comunicados
- **Q4 — Roles inconsistentes**: roles normalizados para nomes canônicos (`coordenador`, `diretor`, `orientador`)
- **Q8 — Detalhes internos de erro expostos na API**: `intervention_service.py` agora retorna mensagem genérica em caso de erro

### Qualidade
- **Paginação em comunicados**: `GET /comunicados` retorna `{items, meta}` com suporte a `page`/`per_page`
- **Frontend adaptado para comunicados paginados**: `ComunicadosPage`, `NotificationBell` e `MeuBoletimPage` usam `comunicadosData?.items`

### Infraestrutura
- **`docker-compose.prod.yml` completo**: Traefik v2 com ACME, Redis com senha e persistência, backend com todas as variáveis de ambiente (SMTP, FRONTEND_URL, JWT, etc.), worker completo
- **`.env.example` criado**: documentação de todas as variáveis de ambiente com exemplos e instruções de geração
- **`FRONTEND_URL`** adicionado às configurações do backend (usado nos links de e-mail)

## [1.4.0] - 2026-02-16

### 🚀 Added
- **🗄️ PostgreSQL Migration**: Officially migrated primary database from SQLite to PostgreSQL for production environments.
- **✉️ Notification Reliable Delivery**: Fixed critical failures in WhatsApp and Email notification services.
- **🐳 Infrastructure Hardening**: Standardized `docker-compose.yml` with environment variables for database security and flexibility.

### 🔧 Fixes & Stability
- **🔄 Worker Resiliency**: Improved background task processing for student occurrences and notifications via Redis/RQ.
- **🛡️ Database Integrity**: Resolved connection string issues and refined transaction handling for PostgreSQL.


## [1.3.0] - 2026-01-31

### 🚀 Added
- **🛡️ Professional Ocorrências System**:
    - **Severity Classification**: Added LEVE, MÉDIA, GRAVE, and GRAVÍSSIMA levels with visual color coding.
    - **Actions Taken**: New field to record disciplinary measures applied (e.g., Warning, Suspension).
    - **UI Redesign**: Reorganized the registration dialog into logical sections (Identificação, Detalhes, Resolução).
    - **Parent Instructions**: Added a dedicated field for custom instructions in notifications.
- **📊 Enhanced Visual Analytics**:
    - **New Graphics**: Implemented "Curva de Gauss (Distribuição)", "Correlação: Freq. vs Notas", and "Evolução Comparativa de Turnos" in the backend.
    - **Heatmap Improvements**: Fixed truncation issue by removing the 50-item limit, ensuring all classes are visible.
- **📑 Dynamic Report Filters & Summaries**:
    - **Context-Aware Filters**: Introduced dynamic filters for Turno, Série, Turma, and Disciplina based on report metadata.
    - **Summary KPIs**: Added real-time calculation of key metrics (e.g., Alunos em Risco, Média Geral) for reports.
- **🐛 Critical Bug Fixes**:
    - **System Stability**: Fixed a `NameError` in `graficos.py` that caused backend crashes and service disruption.
    - **Login Flow**: Resolved an issue where login options (school units) were missing due to backend downtime.
    - **Build Process**: Fixed TypeScript type errors in the frontend API layer to enable production builds.
- **🏫 Turma Standardization**:
    - **Uniform Naming**: Standardized all class names to the `Xº LETRA` format (e.g., "6º A", "7º D").
    - **EJA Support**: Implemented special handling for "Noturno" shift, normalizing grades to EJA cycles (e.g., "7º H" -> "6/7 H", "9º G" -> "8/9 G").
    - **Database Migration**: Cleaned up existing records, consolidating duplicates and enforcing EJA nomenclature.
    - **Auto-Normalization**: Ingestion service now automatically formats class names during PDF uploads to prevent future inconsistencies.
- **🐛 Bug Fixes**:
    - **Student Counts**: Resolved an issue where the "Turmas" dashboard displayed incorrect student counts (filtering out students without grades) due to an implicit database join filter.
- **📊 Reports & Analytics (Overhaul)**:
    - **New Institutional Reports**: Added "Radar de Abandono", "Eficiência Docente", and "Top Movers" for actionable pedagogical insights.
    - **Dynamic Resumos**: Integrated high-level KPI cards at the top of every report detail view.
    - **Acuracy Tuning**: Adjusted "Alunos em Risco" threshold to 50.0 and merged attendance data into performance views.
    - **Refined Viz**: Enhanced Heatmaps, Radars, and Scatters with dynamic scaling and normalized data.

## [1.2.1] - 2026-01-30

### 🔧 Fixes & Stability
- **📥 Ingestion Engine (Reliability)**:
    - **Homonym Protection**: Fixed worker crash when processing students with identical names. Now automatically handles ambiguities by creating separate records.
    - **Transaction Safety**: Added explicit session flushing during user provisioning to prevent `UniqueViolation` race conditions in background jobs.
    - **Deduplication**: Enhanced the "Matrícula Inicial" parser to deduplicate records within the same PDF file.
- **🛡️ Security & Auth**:
    - **Session Recovery**: Fixed 401 Unauthorized errors for administrative accounts through hash synchronization.
    - **RBAC**: Improved tenant resolution for super-admin profiles.

## [1.2.0] - 2026-01-30

### 🚀 Added
- **📧 Aluno Enhancements**:
    - **Contacts**: Added fields for `Email` and `Telefone` with input masks to the Student Registration form.
    - **Backend Support**: Updated `Aluno` model and schemas to persist contact information.
- **📋 Listagem de Turmas (Optimized)**:
    - **Fixed Counts**: Turma cards now correctly aggregate students regardless of inconsistent "Turno" data (Explicit `LEFT JOIN` fixes).
    - **Performance**: Optimized SQL query for sorting and grouping by Turma name.
- **📊 Analytics & Charts**:
    - **Status Intelligence**: The "Situation Distribution" chart now prioritizes administrative statuses (**Desistente**, **Transferido**) over academic grades.
    - **Dashboards**: Real-time integration of special statues into global KPI calculations.
- **📢 Comunicados Fixes**:
    - **Security**: Fixed `tenant_id` injection bug preventing formatting of new announcements.
    - **UX**: Added Autocomplete for Turma selection in "Novo Comunicado".

## [1.1.0] - 2026-01-27

### 🚀 Added
- **🎓 Student Status Management**:
    - New field **"Situação Especial"** added to student records.
    - Supported statuses: **Cancelado**, **Transferido**, and **Desistente**.
    - **Smart Analytics**: Inactive students (those with a special status) are now automatically excluded from global averages, student counts, and performance charts to ensure data accuracy.
    - **Visual Indicators**: Specific badges added to student cards, class lists, and individual reports to highlight special situations.

### 🛡️ Access Control & RBAC
- **Expanded Administrative Autonomy**:
    - **Coordenador**, **Diretor**, and **Orientador** profiles now have full access to Create, Edit, and Delete student records.
    - Previously restricted to pure `admin`, this change empowers the pedagogical team for daily student management.

### 🔧 Technical
- **Database Schema**: Successfully updated `alunos` table with the new `status` column.
- **REST API**: Enhanced student and grade serialization to include status metadata across all relevant endpoints.
- **UX**: Unified status formatting logic between Turma and Aluno detail pages for better visual consistency.

## [1.0.0] - 2026-01-27

### 🚀 Added
- **🛡️ Advanced RBAC (Role-Based Access Control)**:
    - New profiles: **Orientador** and **Diretor** added to the management ecosystem.
    - Specialized permissions: Coordenadores, Orientadores, and Diretores now have full management access to **Mural de Avisos** (Comunicados) and **Ocorrências**.
    - Restricted access: Technical management of user accounts is now exclusive to `admin` and `super_admin` roles.
- **📊 Teacher Dashboard Modernization**:
    - New KPIs: **Total Students** and **Global Average** added for quick pedagogical insights.
    - Improved Grade Distribution: Now reflects student average performance instead of raw grade counts.
    - Refined UI/UX with modern aesthetics, glassmorphism elements, and improved tooltip clarity.

### 🔧 Fixes & Stability
- **🛡️ Multi-Tenant Engineering**:
    - **Data Integrity**: Optimized ORM filters to ensure strict institution isolation while supporting safe super-admin access.
    - **User Creation**: Newly created users now automatically inherit the institution context of the creator, preventing "orphan" users.
    - **Database Migrations**: Executed data sanitation to link existing users to their respective institutions.
- **⚡ Login & Auth Experience**:
    - **Error Handling**: Enhanced UI to display detailed server validation messages (e.g., minimum password length).
    - **MUI Stability**: Fixed "out-of-range" warnings in the school selector caused by race conditions during loading.
    - **Session Recovery**: Improved tenant slug resolution during login to ensure a smoother entry experience.

### 🚀 Added (Previous 0.9.3 highlights)
- **🔍 Advanced Search Engine**:
    - TopBar search is now fully functional and synchronized with URL query parameters (`?q=...`).
    - Redirects to Alunos page automatically when searching from the Dashboard.
- **🖱️ Interactive Reports**:
    - Student names in all list views (Classes, Teacher Dashboard) are now clickable links to full student reports.

### 🔧 Fixes & Stability
- **🛡️ Multi-Tenant Engineering**:
    - Fixed mandatory ORM filtering for functional queries (`count`, `avg`, `distinct`) ensuring 100% data isolation in Dashboard KPIs.
    - Resolved "MultipleResultsFound" crash in dashboard services by enforcing scalar results.
- **⚡ Background Processing**:
    - **Worker Resilience**: Improved Redis connection stability for PDF ingestion with automated retries and socket timeouts.
    - **Proactive Monitoring**: Frontend now detects if the worker is offline and provides real-time feedback to users during uploads.
- **🎨 UI/UX Refinements**:
    - **Dynamic Branding**: Sidebar now dynamically displays the institution's name and initials.
    - **Smart Login**: Conditionally hides the "Central / Super Admin" option for student/responsible profiles.
- **📈 Performance**:
    - Implemented eager loading for tenant relationships in `/usuarios/me`, reducing API latency.

## [0.9.2] - 2026-01-27

### 🔧 Fixes
- **🚨 CRITICAL: Production System Restored**:
    - Fixed Traefik configuration to correctly route traffic to the frontend container.
    - Added missing `traefik.http.services.colaborafrei.loadbalancer.server.port=80` label.
    - Frontend now correctly uses Nginx production build instead of Vite dev server.
    - Resolved HTTP 403/521 errors preventing access to the production system.
- **🛡️ Global Multi-Tenant Enforcement**:
    - Implemented `before_request` hook in API v1 blueprint for automatic tenant/year resolution.
    - Removed redundant `@tenant_required()` decorators from individual endpoints.
    - Fixed data isolation bug where dashboard was showing aggregated data from all academic years.

## [0.9.1] - 2026-01-27

### 🚀 Added
- **📅 Automatic Academic Year Extraction**:
    - The ingestion service now automatically detects the school year (e.g., 2025) directly from the PDF header ("BOLETIM ESCOLAR - 2025").
    - **Auto-Provisioning**: Creates the `AcademicYear` record automatically if it doesn't exist for the institution, ensuring seamless historical data import.
- **🛠️ Bulk Data Recovery (CLI)**:
    - New `reprocess-pdfs` command added to the CLI to recursively re-ingest all existing documents in the cloud storage.
    - Useful for cleaning up and migration of historical data after system logic updates.
- **🛡️ Docker Networking Resilience**:
    - Implemented a dynamic DNS resolver and upstream variables in Nginx.
    - Resolves "502 Bad Gateway" errors during backend restarts by preventing IP caching in the frontend proxy.
- **🏗️ Multi-Tenant Robustness**:
    - Added a fallback mechanism in `TenantService` to the `default` slug, ensuring system stability even during complex domain migrations.
    - Improved context propagation (Tenant/Year) for background jobs in the RQ Worker.

### 🔧 Fixes
- Fixed "Inquilino não identificado" error during PDF uploads.
- Resolved database integrity violations in the worker when processing multi-tenant data.

## [0.9.0] - 2026-01-27

### 🚀 Added
- **🌐 Hetzner Cloud Infrastructure**: 
    - Full deployment plan for Hetzner VPS environment.
    - Automated SSL certificates via **Traefik Proxy** with Let's Encrypt integration.
    - Production-grade `.env.production` template with automated secret generation.
- **🛠️ DevOps & CLI Enancements**:
    - **Docker Compose V2 Support**: Optimized orchestration for modern Docker environments.
    - **Database Management CLI**: 
        - New `drop-db` command for safe environment resets.
        - Enhanced `seed-demo` command now automatically provisions mandatory `Tenant` and `AcademicYear` data.
- **🛡️ Infrastructure Hardening**:
    - Implemented **ProxyFix** middleware in Flask to correctly resolve client IPs and HTTPS protocols behind Traefik.
    - Automated SSH key provisioning for secure server management.

### 🔧 Fixes
- **🎨 Frontend Build Corrections**:
    - Fixed TypeScript errors in `api.ts` related to `Comunicado` target types.
    - Resolved JSX duplicate attribute error in `GraficosPage.tsx` preventing production builds.
    - Synchronized `Chart` types with backend multi-tenant data structures.

## [0.8.0] - 2026-01-26

### 🚀 Added
- **🏫 Multi-Tenancy & School Isolation**: 
    - Full architectural support for multiple schools on a single instance.
    - Automated data isolation via `TenantYearMixin` in the ORM.
    - Staged database migration for safe transition of existing data.
- **📅 Academic Year Management**:
    - New `AcademicYear` module for logical separation of school cycles.
    - **Global Year Selector**: Added to the TopBar for seamless switching between current and historical data.
    - **Year Filtering**: Automated backend filtering for all modules (Alunos, Notas, Comunicados, Ocorrências).
    - **Session Persistence**: Academic year state managed via global Redux `appSlice`.
- **🛠️ Super Admin Module**:
    - Centralized management of schools (tenants) and academic cycles.
    - Security-hardened endpoints for SaaS operations.

### 🔧 Technical
- **🛡️ Secure ORM Filters**: Implemented `do_orm_execute` hooks for mandatory tenant and year scoping with specific bypasses for global admin access.
- **🔗 Profile Synchronization**: New `/usuarios/me` endpoint to dynamically resolve student profiles based on the active year.
- **🐛 Bug Fixes**:
    - Fixed login issues related to password hashing for new superadmin accounts.
    - Resolved profile-loading conflicts for global admins in multi-tenant contexts.
    - Removed legacy default credentials from the login screen for better security.

## [0.7.0] - 2026-01-26

### 🚀 Added
- **📱 Mobile First Overhaul**:
    - Implemented **Responsive Drawer Navigation**: Sidebar now automatically converts to a slide-out drawer on mobile devices.
    - **Hamburger Menu**: Added an interactive toggle in the TopBar for small screens.
    - **Adaptive Dashboards**: KPIs and charts now reflow dynamically, with optimized heights for scrolling on smartphones.
    - **Smart Tables**: Implemented column prioritization in the User Management table to hide non-essential data on mobile, ensuring a clean, legible interface.
    - **UI Optimization**: Streamlined the TopBar by hiding less critical info on small devices to maximize content workspace.

### 🔧 Fixes & Enhancements
- **📐 Layout Consistency**: Standardized spacing and transitions across the dashboard layout to eliminate layout shifts during sidebar toggling.
- **⚡ Performance**: Optimized chart rendering for mobile GPU acceleration.

## [0.6.0] - 2026-01-26


### 🚀 Added
- **🤖 AI FreiRonaldo (Advanced Analytics)**:
    - Rebranded and enhanced the AI Assistant with over 20 analytical intents.
    - Added support for **multimodal responses**: Automated Pie Charts for status and Bar Charts for performance/attendance.
    - New deep-analysis features: **Radar de Abandono** (Dropout Radar) and **Missing Grades** detection.
    - Improved natural language processing for Turma recognition (e.g., "6A", "7º ANO B") and student profile lookups.
    - Integrated support for **Mural (Notices)** and **Occurrences** in chat queries.

### 🔧 Fixes & Enhancements
- **🎨 UI/UX Cleanups**: Removed the redundant global search from the Dashboard TopBar to streamline navigation.
- **🛡️ Robust Regex Matching**: Fixed backend NLP issues with accented characters and specific school academic terms.
- **📊 Real-time Chat Sync**: Updated RTK Query hooks and frontend types to support complex AI-generated datasets.

## [0.5.1] - 2026-01-26


### 🔧 Fixes & Enhancements
- **📊 Business Logic Update**: Adjusted the **"Em Risco" (At Risk)** KPI threshold from 60 to **50**. This aligns the dashboard metrics with conservative academic criteria, reducing false positives in risk reporting.

## [0.5.0] - 2026-01-26


### 🚀 Added
- **Student Management (CRUD)**:
    - Implemented full Creation, Update, and Deletion of students.
    - Added `AlunoForm` component for administrative tasks.
    - Integrated edit and delete actions in `AlunoDetailPage`.
    - Backend support with new schemas, services, and endpoints for student persistence.

### 🔧 Fixes & Enhancements
- **🔍 Global Search**: Migrated student search to server-side, enabling discovery of any student in the database regardless of pagination.
- **🎨 Sidebar Visibility**: Fixed contrast issue in Light Mode where the active menu item label would become invisible.
- **📊 Real-time Dashboard Sync**: Configured RTK Query tag invalidation to ensure student counts and averages are updated instantly after CRUD operations.

## [0.4.1] - 2026-01-26


### 🔧 Technical & Bug Fixes
- **🎨 Shared Theme System**: Implemented `ThemeContext` and global `AppThemeProvider` to ensure dark mode is synchronized across all components.
- **📊 Student Analytics Fix**: 
    - Corrected student cards in "Alunos" page to display the arithmetic average of all disciplines.
    - Updated backend repositories and services to calculate real-time averages and total absences during student listing.
    - Sincronized 100-point scale thresholds (Risk < 60) across dashboard, listing, and color logic.
- **🛠️ Refactoring**:
    - Replaced `id` based routing with `slug` in TurmasPage to resolve TypeScript lint errors.
    - Standardized field names (`media`, `alunos_em_risco`) across API and frontend.

## [0.4.0] - 2026-01-26


### 🚀 Added
- **Intelligent Reporting Engine**:
    - **Radar de Abandono**: Predictive report identifying students at high risk of dropout based on attendance and grade trends.
    - **Top Movers**: Trend analysis identifying students with significant performance shifts (up/down).
    - **Eficiência Docente**: Diagnostic report comparing Class vs School averages per discipline.
- **Client-Side Analytics**:
    - Implemented `selectors.ts` for real-time data derivation (Risk Score, Trend Delta).
- **Enhanced Visualizations**:
    - Added support for `Area`, `Scatter`, and `Bar` charts in the reporting module.
    - Integrated `recharts` for dynamic data visualization.

### 🎨 UI/UX Improvements
- **Mural de Avisos**: Redesigned as a modern, social-media style feed with pinned items and semantic icons.
- **Ocorrências**: Transformed into a card-based interface with visual status indicators (Resolved/Pending).
- **Boletim Escolar**: Modernized DataGrid with conditional grade formatting (Red/Amber/Green).

### 🔧 Technical
- **Codebase Optimization**:
    - Migrated report configurations to `config.tsx` to support JSX rendering.
    - Refactored `GraficosPage` and `RelatorioDetailPage` for better component separation and rendering logic.

## [0.2.0] - 2026-01-13

### 🚀 Added
- **Multi-Tenancy Architecture**:
    - Implementação completa de sistema multi-tenant
    - Modelo `Tenant` para isolamento de dados
    - Middleware de tenant context
    - Migrations para suporte a multi-tenancy

- **Arquitetura em Camadas**:
    - **Service Layer**: Lógica de negócio separada (AlunoService, TurmaService, OcorrenciaService, etc.)
    - **Repository Layer**: Abstração de acesso a dados
    - **Schema Layer**: Validação com Pydantic (AlunoSchema, OcorrenciaSchema, etc.)
    - **Exception Handling**: Sistema centralizado de tratamento de erros
    - **Middleware**: Request logging e tenant context

- **Docker Production Support**:
    - `docker-compose.prod.yml` para deployment em produção
    - `Dockerfile.prod` para frontend com Nginx
    - `nginx.conf` para servir frontend otimizado
    - `entrypoint.sh` para inicialização automática de migrações
    - Health checks em todos os serviços

- **Documentação Completa**:
    - `docs/DEPLOYMENT.md`: Guia completo de deployment
    - `docs/ARCHITECTURE.md`: Documentação da arquitetura do sistema
    - Instruções para Docker e deployment manual
    - Troubleshooting e manutenção

### 🔧 Changed
- **Backend Refactoring**:
    - Migração para arquitetura em camadas
    - Separação de responsabilidades (SRP)
    - Melhoria na organização de código
    - Padronização de respostas de API

- **Database Improvements**:
    - Adição de campo `tenant_id` em todas as tabelas principais
    - Índices otimizados para queries multi-tenant
    - Migrations organizadas e versionadas

- **API Enhancements**:
    - Endpoints mais consistentes
    - Melhor tratamento de erros
    - Validação de dados com Pydantic
    - Paginação otimizada

### 🐛 Fixed
- Correção de erro de migração do Alembic (alembic.ini)
- Inicialização automática do banco de dados via entrypoint
- Problemas de CORS em produção
- Isolamento de dados entre tenants

### 📚 Documentation
- Guia completo de deployment (desenvolvimento e produção)
- Documentação de arquitetura com diagramas
- Troubleshooting guide
- Convenções de código e padrões de design

## [Unreleased]
### Added
- **Dashboard Improvements**:
    - Updated "Média Geral" card label to "Média dos Totais" for clarity.
    - Added "Comparativo de médias por disciplina" (Subject Averages) BarChart to Dashboard.
    - Updated "Situação Geral" PieChart to specific categories: Aprovado, Reprovado, Outros.
    - Removed "Evolução das médias trimestrais" LineChart.

### Added
- **Ocorrências System Improvements**:
    - Fixed pagination issue in `api/v1/alunos` ensuring all students appear in the selection dropdown.
    - Added database migration for `ocorrencias` table.
    - Resolved `redis` dependency missing in backend environment.

### Added
- **Phase 6 (Data Corrections)**:
    - **Grade Editing**: Admins can now manually edit grades, absences, and status via the Student Details page.
    - **Audit Log**: All mutations are logged for security (showing old vs new values).
    - **Auto-Calculation**: Editing trimesters automatically recalculates the total if not manually overridden.
    - **Access Control**: Strict `admin` role requirement for data modification.
    - **Student Portal ('Meu Boletim')**: Added Tabs for specialized views:
        - **Boletim**: Grades and absence view.
        - **Ocorrências**: Personal disciplinary records.
        - **Recados**: Targeted communications (filtered to show only Class or Student specific messages).
- **Phase 5 (Advanced)**:
    - **Ocorrências Disciplinares**: Module to register warnings, compliments, and suspensions.
    - **Audit Logs**: Security tracking for critical actions (create/edit).
    - **Advanced AI Analyst**:
        - **Rich Visual Responses**: Chat now renders **Interactive Charts** (Bar) and **Data Tables** directly in the conversation flow.
        - **New Analytical Intents**:
            - *"Hardest Subjects"*: Identifies disciplines with lowest averages.
            - *"Status Distribution"*: Visual breakdown of APR/REP/REC.
            - *"Best Students"*: Top performing students ranking.
            - *"Performance Analysis"*: Lists students above/below global average.
    - **Teacher Dashboard**: Analytics view for teachers (grade distribution, risk alerts).
    - **Risk Engine**: Machine Learning model (Logistic Regression) to predict student failure risk.
- **Phase 6 (Data Corrections & Admin)**:
    - **Audit Logs UI**: Dedicated page for admins to view system logs.
- **Phase 4 (Communication)**:
    - **Comunicados**: Announcement system targeting School (Todos), Class (Turma), or Individual Students.
    - **Portal**: Notification center for students/guardians.
- **Phase 3 (Intelligence)**:
    - **Teacher Dashboard**: Analytics view for teachers (grade distribution, risk alerts).
    - **Risk Engine**: Machine Learning model (Logistic Regression) to predict student failure risk.
- **Infrastructure**:
    - **Docker Support**: `docker-compose.yml` for full-stack orchestration (Backend, Frontend, Postgres, Redis).
    - **PostgreSQL**: Migrated from SQLite for better performance and concurrency.
    - **Background Jobs**: Redis + RQ for asynchronous PDF processing.

### Changed
- Login profile for "Professor" in the authentication screen.
- New status "APCC" (Aprovado pelo Conselho de Classe) logic in backend and frontend.

### Changed
- Updated status calculation: "REP" (Reprovado) takes precedence over "REC" (Recuperação).
- "AR" status is now displayed as "Apr Rec" (Aprovado com Recuperação) in frontend.
- "APCC" (from ACC) status now takes precedence over "AR" in backend calculation.
- Grades below 50.0 are now highlighted in red in the class details view.
- Improved visual labels for "Reprovado" (Red) and "APCC" (Info Blue) in student details.

## [0.1.0] - initial release
- Initial project setup with Flask backend and React frontend.
