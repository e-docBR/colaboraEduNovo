# Implementation Blueprint — Plataforma Boletins Frei

## 1. Repository Layout
```
colaboraFREI/
├─ docs/
│  ├─ implementation-blueprint.md   # arquitetura e decisões
│  └─ api-contract.md               # OpenAPI draft (a criar)
├─ backend/
│  ├─ app/
│  │  ├─ __init__.py
│  │  ├─ api/
│  │  │  ├─ __init__.py
│  │  │  ├─ auth.py
│  │  │  ├─ alunos.py
│  │  │  ├─ notas.py
│  │  │  ├─ turmas.py
│  │  │  ├─ relatorios.py
│  │  │  └─ uploads.py
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  ├─ database.py
│  │  │  └─ security.py
│  │  ├─ services/
│  │  │  ├─ analytics.py
│  │  │  ├─ ai_chat.py
│  │  │  ├─ ai_predictor.py
│  │  │  ├─ ingestion.py
│  │  │  └─ audit.py
│  │  └─ models/
│  │     ├─ __init__.py
│  │     ├─ aluno.py
│  │     ├─ nota.py
│  │     └─ usuario.py
│  ├─ tests/
│  ├─ pyproject.toml
│  ├─ alembic.ini (se migrar p/ Alembic futuramente)
│  └─ README.md
├─ frontend/
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ routes.tsx
│  │  │  └─ store.ts
│  │  ├─ components/
│  │  ├─ features/
│  │  │  ├─ dashboard/
│  │  │  ├─ alunos/
│  │  │  ├─ turmas/
│  │  │  ├─ notas/
│  │  │  ├─ graficos/
│  │  │  ├─ graficos/
│  │  │  ├─ relatorios/
│  │  │  ├─ comunicados/
│  │  │  └─ ocorrencias/
│  │  ├─ layouts/
│  │  ├─ lib/
│  │  ├─ theme/
│  │  └─ types/
│  ├─ public/
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.ts
└─ prompt.md
```

## 2. Backend Decisions
- **Framework**: Flask 3.x com Blueprint modular e `flask-jwt-extended` para JWT.
- **Configuração**: `pydantic-settings` para variáveis (.env). Ambiente dev vs prod.
- **Banco**: SQLite (WAL) via SQLAlchemy 2.0; camadas de modelo e repositório separados.
- **Ingestão**: `services/ingestion.py` agora parseia PDFs com `pdfplumber`, normaliza linhas e faz *upsert* direto em `Aluno/Nota`; mantém ponto de extensão para mover a execução para uma fila (Celery/RQ) futuramente.
- **Validação**: Marshmallow/Pydantic para schemas API.
- **Observabilidade**: logging estruturado (loguru) + middlewares de request timing.
- **Testes**: Pytest + coverage; fixtures para banco em memória.

## 3. Frontend Decisions
- **Stack**: React 18 + Vite + TypeScript.
- **UI Kit**: MUI v6 (Joy + Material mix) com tokens próprios.
- **Estado**: Redux Toolkit + RTK Query p/ chamadas REST.
- **Roteamento**: React Router 6.26+ com rotas protegidas via loader.
- **Charts**: Recharts (principais) + @mui/x-charts para casos simples.
- **Formulários**: React Hook Form + Zod.
- **Temas**: Sistema claro/escuro com CSS variables e persistência em `localStorage`.
- **Internacionalização**: pt-BR inicial, preparado para i18n (react-i18next) se exigido.

## 4. API Surface (Resumo)
| Domínio | Endpoints (prefix `/api/v1`) | Notas |
| --- | --- | --- |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | JWT + refresh, roles no payload |
| Alunos | `GET /alunos`, `GET /alunos/{id}`, `POST /alunos`, `PUT /alunos/{id}`, `DELETE /alunos/{id}` | Filtros por turno/turma, paginação |
| Notas | `GET /notas`, `PATCH /notas/{id}` | Atualização restrita a admin |
| Turmas | `GET /turmas`, `GET /turmas/{id}` | KPIs agregados |
| Relatórios | `GET /relatorios/{tipo}` | Accept `csv|xlsx|pdf` |
| Gráficos | `GET /graficos/{tipo}` | Dados normalizados p/ charts |
| Uploads | `POST /uploads/pdf` | Chama pipeline ingestão, retorna job id |

## 5. Milestones
1. **Fundação**: configs, lint, containers dev, endpoints stub com testes.
2. **Autenticação + Dashboard API**: fluxos auth, KPIs essenciais.
3. **Módulos CRUD**: alunos, turmas, notas com filtros.
4. **Relatórios e Exportações**: rotas avançadas e serviços.
5. **Ingestão + Admin**: upload, monitoramento, gestão de usuários.
6. **Polimento**: testes e documentação final.

## 6. Próximas Tarefas
- Criar scaffolds em `backend/` (Flask app básico) e `frontend/` (Vite React).
- Esboçar contrato API em `docs/api-contract.md` (OpenAPI 3.1) após scaffold.
- Configurar automações (pre-commit, lint, CI) na próxima etapa.

## 7. Fluxo de Upload Atualizado
- `POST /api/v1/uploads/pdf` exige `turno` e `turma`, armazena o PDF em `UPLOAD_FOLDER/<turno>/<turma>` e dispara `enqueue_pdf` imediatamente.
- `enqueue_pdf` gera um `job_id`, processa o arquivo com `parse_pdf` e aplica as notas: matrículas existentes são atualizadas; novas são criadas automaticamente.
- Frontend ganhou a página `/uploads` com formulário (turno + turma + arquivo) e *feedback* de sucesso/erro usando `useUploadBoletimMutation` (RTK Query).
- Alertas rápidos instruem o usuário sobre como o processamento organiza as pastas e como os dados serão refletidos no dashboard após a ingestão.

## 8. Atualizações — 12/12/2025
- **Dashboard:** o gráfico "Situação geral" agora consome `/graficos/situacao-distribuicao`, exibe estados de carregamento/erro e legenda dinâmica.
- **Métricas por disciplina:** `_disciplinas_medias` passou a somar notas e contabilizar entradas antes de normalizar para evitar distorções em disciplinas com rótulos unificados (ex.: LÍNGUA INGLESA).
- **Shell autenticado:** o topo da aplicação ganhou menu de usuário com ações de troca de senha e logout, além de rótulos humanizados para papéis (Administrador, Coordenador, etc.).
- **Relatório "Melhores alunos":** novo endpoint agrega top 10 alunos com filtros por turno/série/turma; o frontend ganhou seletor dinâmico derivado da lista de turmas.
- **Filtros combinados:** endpoint e UI agora aceitam disciplina como filtro adicional e validam inconsistências de turno/série/turma antes de buscar os dados.
- **Estabilidade do relatório:** a tela passou a calcular métricas derivadas antes dos estados de loading/erro, mantendo a ordem dos hooks do React e evitando falhas na navegação.

## 9. Atualizações Recentes e Status (Janeiro 2026)
- **Módulos de IA**: Backend implementado (`ai_chat` e `ai_predictor`). Frontend do Chatbot pendente.
- **Novos Módulos**: `Comunicados` e `Ocorrências` implementados no frontend e backend.
- **Dashboard**: `TeacherDashboard` adicionado para visão específica do professor.
- **Risco**: Modelo de regressão logística implementado para predição de risco de reprovação.

## 10. Próximos Passos (Imediato)
Consultar `docs/ROADMAP.md` para detalhes. O foco imediato é a **Interface do Chatbot de Dados**.
