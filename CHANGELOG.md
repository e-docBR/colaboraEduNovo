# Changelog

All notable changes to this project will be documented in this file.

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
