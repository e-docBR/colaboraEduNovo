## Plano de Desenvolvimento — Plataforma Boletins Frei

### 1. Contexto e Objetivos
- Modernizar a experiência digital dos boletins preservando regras de negócio e stack Flask + SQLite + pdfplumber.
- Fornecer UI rica, responsiva e multi-papéis (coordenação, professores, direção) com dashboards, gráficos, relatórios e centro administrativo.
- Garantir integrações seguras (JWT/CORS), importação confiável dos PDFs atuais e documentação/testes completos para entrega pronta a deploy.

### 2. Requisitos Principais (extraídos de `prompt.md`)
- **Front-end:** SPA moderna (React/Vue/Next), layout com sidebar, cartões de KPI, gráficos interativos, filtros globais, dark/light theme.
- **Back-end:** Manter APIs Flask existentes, expor endpoints JSON para alunos/notas/alertas, preservar scripts de ingestão (importar_boletins.py) e bases (`alunos`, `notas`, `usuarios`).
- **Relatórios/KPIs:** Riscos, desempenho comparativo, exportações (CSV/PDF), gráficos dedicados e centro de relatórios.
- **Administração:** Gestão de usuários, permissões, uploads de boletins, configurações avançadas, auditoria/logs.
- **Qualidade:** Performance (<3 s p/ dashboards), segurança (JWT, validações fortes), testes automatizados e documentação detalhada.

### 3. Insights sobre PDFs (`BOLETINS FREI/`)
- Arquivos como `MATUTINO/6_ano_A.pdf:Zone.Identifier` indicam boletins por turma/turno; conteúdo binário ainda não acessível neste ambiente.
- Necessário pipeline de ingestão capaz de extrair dados (pdfplumber/OCR) preservando metadados de série/turno, garantindo suporte a arquivos de zona (Zone.Identifier) quando migrados do Windows.

### 4. Arquitetura Proposta
1. **Camada de Autenticação & Perfis**
   - JWT/sessions via Flask, refresh tokens, RBAC alinhado a `usuarios`.
   - Middleware no front-end para rotas protegidas.
2. **Serviços Core Flask**
   - Endpoints REST para alunos, notas, turmas, alertas, KPIs, relatórios.
   - Upload service para PDFs com validação, registro e monitoramento.
3. **Motor de Ingestão**
   - Reaproveitar `importar_boletins.py` com fila/worker para processar PDFs.
   - Logs estruturados + reprocessamento manual.
4. **Analytics & Relatórios**
   - Camada de domínio calculando riscos, médias, evolução temporal e exportações.
   - Suporte a agregações por turno/série/professor.
5. **Front-end SPA**
   - Shell (sidebar/header), roteamento, state management (Redux/Pinia/TanStack Query).
   - Módulos: Dashboard, Gestão (Alunos/Turmas/Notas), Centro de Visualizações, Centro de Relatórios, Área Admin.
   - Integração com libs de charting (ECharts/Recharts) e componentes acessíveis.
6. **Infra & Observabilidade**
   - Configuração de CORS, rate limiting, monitoramento (Sentry/Prometheus), backups SQLite.
   - Pipeline CI/CD com lint, testes, build e deploy.

### 5. Roadmap Detalhado
1. **Descoberta & Design (Semana 1-2)**
   - Refinar personas e jornadas; mapear APIs atuais e lacunas.
   - Wireframes + design system (tokens de cor, tipografia, componentes críticos).
2. **Fundação Técnica (Semana 3-4)**
   - Configurar monorepo ou workspaces separados; definir lint/test/build.
   - Implementar autenticação e base da API com documentação OpenAPI.
3. **Módulos Prioritários (Semana 5-8)**
   - Dashboard com KPIs essenciais e gráficos.
   - Gestão de alunos/notas com filtros, paginação e busca.
   - Endpoint de upload + fila de ingestão com monitoramento.
4. **Relatórios & Visualizações Avançadas (Semana 9-10)**
   - Construir centro de relatórios com exportações (CSV/PDF) e gráficos especializados.
   - Implementar alertas de risco e comparativos.
5. **Administração & Hardening (Semana 11-12)**
   - Gestão de usuários, permissões, configurações avançadas.
   - Logs auditáveis, monitoramento, hardening de segurança.
6. **Qualidade & Entrega (Semana 13-14)**
   - Testes completos (unitários, integração, e2e), testes de performance.
   - Documentação final (guia de usuário, manual de operação, playbooks de deploy).

### 6. Dependências & Riscos
- Acesso aos PDFs reais (pode exigir automação extra para remover Zone.Identifier).
- Garantir compatibilidade com infraestrutura atual (SQLite, scripts legados).
- Necessidade de governança clara para papéis e permissões antes do desenvolvimento de RBAC.

### 7. Próximos Passos
1. Validar escopo e prioridades com stakeholders (direção, coordenação, TI).
2. Escolher stack front-end definitiva (React + Vite/Next) e libs de UI/charts.
3. Planejar migração/integração do pipeline de ingestão em ambiente controlado.
4. Iniciar design system e protótipos navegáveis para validação rápida.
