# PLAN-multitenant-years.md - Multi-Tenancy & Academic Year Architecture

Este plano detalha a transformação do ColaboraFREI em uma plataforma SaaS multi-escola com isolamento total de dados e organização por anos letivos.

## 📌 Visão Geral
- **Objetivo**: Permitir que várias instituições usem a mesma infraestrutura, com dados segregados por `tenant_id` e filtrados por `ano_letivo`.
- **Tipo de Projeto**: WEB (Full-stack)
- **Status**: 📝 Planejamento

## 🎯 Critérios de Sucesso
- [ ] Todas as consultas ao banco de dados injetam automaticamente `tenant_id`.
- [ ] Dashboard e listagens refletem o ano selecionado no seletor global do TopBar.
- [ ] Super Admin consegue criar e gerenciar Tenants (Escolas).
- [ ] Sistema permite iniciar um novo ano "limpo" mantendo o histórico dos anos anteriores.

## 🛠️ Stack Tecnológica
- **Backend**: Python/Flask + SQLAlchemy (Mixins para Multi-tenancy).
- **Frontend**: React + Material UI (Seletor Global no Layout).
- **Banco de Dados**: PostgreSQL (Isolamento via coluna `tenant_id`).

---

## 📅 Cronograma de Implementação

### Fase 1: Fundação do Banco de Dados & Modelos
**Agente**: `database-architect` | **Skill**: `database-design`
- [ ] Criar modelo `AcademicYear` (id, tenant_id, ano_label, is_current).
- [ ] Criar um Mixin SQLAlchemy `TenantYearMixin` que adiciona `tenant_id` e `academic_year_id` a todas as tabelas.
- [ ] Migrar Tabelas: `Notas`, `Ocorrências`, `Comunicados`, `Faltas` para incluir as novas colunas.
- [ ] Atualizar o modelo `Tenant` para incluir configurações específicas (ex: logo da escola).
- [ ] Implementar índices compostos `(tenant_id, academic_year_id)` para performance.

### Fase 2: Segurança & Middleware (Isolamento)
**Agente**: `backend-specialist` | **Skill**: `api-patterns`
- [ ] Implementar o Perfil **Super Admin** (Global).
- [ ] Atualizar `tenant_required` middleware para extrair o `ano_letivo` do header `X-Academic-Year` ou query param.
- [ ] **Crucial**: Implementar filtros globais no SQLAlchemy para garantir que nenhum dado vaze entre tenants ou anos (Multi-tenant filter).
- [ ] Criar CRUD de Tenanst para o Super Admin.

### Fase 3: Frontend - Seletor Global & Contexto
**Agente**: `frontend-specialist` | **Skill**: `frontend-design`
- [ ] Criar `AcademicYearContext` para gerenciar o ano selecionado globalmente.
- [ ] Adicionar Seletor de Ano no `TopBar` (ex: 2024, 2025).
- [ ] Configurar Axios/Fetch para enviar automaticamente o `tenant_id` (via subdomínio/host) e o `academic_year_id` em todas as requisições.
- [ ] Criar painel do Super Admin para criação de escolas.

### Fase 4: Gestão de Ciclo de Vida do Ano (Roll-over)
**Agente**: `backend-specialist` | **Skill**: `nodejs-best-practices` (Adaptado para Python)
- [ ] Criar endpoint para "Abrir Novo Ano Letivo".
- [ ] Implementar lógica de base limpa (Cria o ano no banco, sem copiar notas do ano anterior).
- [ ] Ajustar importação de CSV para validar se o ano letivo de destino está correto.

---

## ✅ PHASE X: Verificação Final
- [ ] Validar que usuário da Escola A não consegue acessar IDs da Escola B (via URL).
- [ ] Garantir que ao trocar de 2024 para 2025, o gráfico de médias mude instantaneamente.
- [ ] Executar `python .agent/scripts/verify_all.py .`
- [ ] Testar criação de novo Tenant via Super Admin.

---

##  Assign Assignments
- `backend-specialist`: Alteração de modelos, middleware de segurança e filtros globais.
- `frontend-specialist`: UI do seletor global e adaptação do estado da aplicação.
- `database-architect`: Migrações complexas e Mixins de auditoria/tenant.

[OK] Plan created: docs/PLAN-multitenant-years.md
