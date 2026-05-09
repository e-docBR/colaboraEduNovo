# 🚀 Plano de Desenvolvimento - ColaboraFREI

Este documento detalha o roteiro para a evolução do sistema ColaboraFREI, focando em multi-tenancy robusto, isolamento de dados por ano letivo, novas funcionalidades e excelência em design responsivo.

## 📋 Visão Geral
Transformar o protótipo funcional em uma plataforma educacional de nível empresarial capaz de atender múltiplas instituições simultaneamente com segurança, escala e uma experiência de usuário premium.

---

## 🎯 Critérios de Sucesso
- [ ] **Isolamento Total:** Garantia de que um tenant (escola) nunca acesse dados de outro.
- [ ] **Histórico Temporal:** Navegação fluida entre dados de diferentes anos letivos.
- [ ] **Mobile First:** Interface 100% funcional em smartphones e tablets.
- [ ] **IA Contextual:** Chat com IA que responde com base nos dados seguros do tenant logado.

---

## 🏗️ Tech Stack (Mantida e Otimizada)
- **Backend:** Flask 3, SQLAlchemy 2 (Mapped types), PostgreSQL 15, Redis.
- **Frontend:** React 18, Vite, Tailwind CSS v4, Shadcn/UI, TanStack Query.
- **DevOps:** Docker, Docker Compose, Nginx.

---

## 🗺️ Estrutura de Arquivos (Proposta de Manutenção)
```
colaboraFREI/
├── backend/app/
│   ├── core/
│   │   └── context.py        # Novo: Gerenciamento de contexto do Tenant/Ano
│   ├── api/v1/
│   │   └── admin/            # Novo: Endpoints de gestão de escola
│   └── services/
│       └── document_service.py # Novo: Geração de documentos (PDF/XLS)
├── frontend/src/
│   ├── components/layout/    # Melhoria: Sidebar e Mobile Nav
│   └── features/admin/       # Novo: Feature de gestão administrativa
└── .agent/                   # Mantido: Configurações de IA e Scripts
```

---

## 📝 Cronograma de Implementação

### 🛠️ Fase 1: Fundação & Isolamento (Multi-tenancy)
**Foco:** Garantir que o sistema suporte múltiplas escolas e anos com segurança.

| ID | Tarefa | Agente | Critério de Aceite |
|----|--------|--------|---------------------|
| 1.1 | Implementar Contexto Global | `backend-specialist` | Middleware Flask que extrai `tenant_id` e `year_id` do JWT e os disponibiliza no thread-safe global context. |
| 1.2 | Filtros Automáticos SQLAlchemy | `database-architect` | Adicionar listeners no SQLAlchemy para filtrar automaticamente queries por tenant/ano atual. |
| 1.3 | Gestão de Super Admin | `frontend-specialist` | Dashboard para criar novos Tenants e Anos Letivos. |

### 🚀 Fase 2: Novas Funcionalidades Core
**Foco:** Agregar valor pedagógico direto.

| ID | Tarefa | Agente | Critério de Aceite |
|----|--------|--------|---------------------|
| 2.1 | Emissão de Documentos PDF | `backend-specialist` | Endpoint para gerar Ficha Individual e Boletim em PDF usando templates HTML. |
| 2.2 | Refinamento da IA | `backend-specialist` | IA agora recebe contexto filtrado do banco de dados (RAG otimizado). |
| 2.3 | Sistema de Notificações | `frontend-specialist` | Interface para ler e gerenciar comunicados com status de leitura. |

### 📱 Fase 3: Modernização Visual & Responsividade
**Foco:** Experiência de usuário premium e mobile.

| ID | Tarefa | Agente | Critério de Aceite |
|----|--------|--------|---------------------|
| 3.1 | Audit de Responsividade | `frontend-specialist` | Todas as páginas (Dashboards, Tabelas, Formulários) 100% Mobile Ready. |
| 3.2 | Sidebar Dinâmica | `frontend-specialist` | Navegação colapsável no desktop e drawer no mobile. |
| 3.3 | Dark Mode Otimizado | `frontend-specialist` | Suporte completo a temas seguindo tokens do Tailwind v4. |

### 🔍 Fase 4: Auditoria & Performance
**Foco:** Segurança e velocidade.

| ID | Tarefa | Agente | Critério de Aceite |
|----|--------|--------|---------------------|
| 4.1 | Implementar Audit Logs | `backend-specialist` | Registro de todas as ações sensíveis (alteração de notas, exclusão de alunos). |
| 4.2 | Caching com Redis | `backend-specialist` | Cache de consultas pesadas de gráficos no Dashboard. |
| 4.3 | Testes E2E Críticos | `qa-automation-engineer` | Suite de testes Playwright cobrindo fluxos de isolamento de dados. |

---

## ✅ PHASE X: Verificação Final
- [ ] `python .agent/scripts/verify_all.py .` retorna sucesso em Segurança e Lint.
- [ ] Teste manual de troca de Tenant: Dados não vazam entre sessões.
- [ ] Lighthouse: Score > 90 em Performance e SEO.
- [ ] Build de produção gerado sem erros.

---
*Plano gerado por `project-planner` em 27/01/2026.*
