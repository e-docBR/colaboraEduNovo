# ColaboraEdu — Plataforma de Gestão Escolar

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/react-18-blue.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)

Plataforma SaaS multi-tenant para gestão escolar com backend Flask, frontend React/MUI e app mobile Expo. Inclui sistema de boletins, ocorrências disciplinares, comunicados, análise de dados com IA e recuperação de senha.

---

## Índice

- [Características](#características)
- [Tecnologias](#tecnologias)
- [Início Rápido](#início-rápido)
- [Configuração de Ambiente](#configuração-de-ambiente)
- [Documentação](#documentação)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Comandos Úteis](#comandos-úteis)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Características

### Funcionalidades Principais

- **Dashboard Interativo**: Visualização de KPIs, gráficos e estatísticas em tempo real
- **Gestão de Boletins**: Sistema completo de notas por trimestre, médias e status acadêmico
- **Gestão de Alunos e Turmas**: Cadastro, organização e portais individuais
- **Ocorrências Disciplinares**: Registro de advertências, elogios e suspensões com severidade
- **Mural de Comunicados**: Envio de avisos para escola, turmas ou alunos específicos com paginação
- **Intervenções com IA**: Análise automática de alunos em risco com sugestões de intervenção (Anthropic Claude)
- **Relatórios Avançados**: Radar de abandono, eficiência docente, top movers e mais
- **Ingestão de PDF**: Importação automática de boletins escolares via upload de PDF
- **Multi-Tenancy**: Suporte para múltiplas escolas na mesma instalação com isolamento total de dados
- **Portal do Aluno**: Interface dedicada para estudantes e responsáveis
- **App Mobile**: Aplicativo React Native/Expo para acesso mobile

### Segurança

- JWT com refresh token silencioso (access 30min, refresh 30 dias)
- RBAC com roles: `super_admin`, `admin`, `coordenador`, `diretor`, `orientador`, `professor`, `aluno`
- Redis blocklist fail-closed para tokens revogados
- Rate limiting em endpoints sensíveis
- Security headers HTTP (HSTS, X-Frame-Options, CSP)
- Recuperação de senha via e-mail (token Redis TTL 1h)
- Força troca de senha no primeiro login

---

## Tecnologias

### Backend
- **Python 3.12** com **Flask 3.x**
- **SQLAlchemy 2.0** — ORM com event listener para multi-tenancy automático
- **PostgreSQL 15** — banco de dados principal
- **Redis 7** — cache, fila de jobs e blocklist de tokens
- **RQ** — background job processing (ingestão de PDF, notificações)
- **Pydantic v2** — validação de dados e schemas
- **Flask-JWT-Extended** — autenticação JWT
- **Flask-Limiter** — rate limiting
- **Gunicorn** — servidor WSGI de produção

### Frontend Web
- **React 18** com **TypeScript**
- **Vite** — build tool e dev server
- **Material UI v6 (MUI)** — componentes e design system
- **Redux Toolkit + RTK Query** — estado global e chamadas de API
- **Recharts** — gráficos e visualizações

### App Mobile
- **React Native 0.81** com **Expo**
- **Zustand** — estado global
- **TanStack Query** — cache e fetch de dados

### Infra / DevOps
- **Docker + Docker Compose** — containerização
- **Traefik v2** — proxy reverso com TLS automático (Let's Encrypt)
- **Alembic** — migrações de banco de dados

---

## Início Rápido

### Pré-requisitos

- Docker Engine 24+ e Docker Compose 2.20+
- OU Python 3.12+, Node.js 18+, PostgreSQL 15+, Redis 7+

### Desenvolvimento Local (Docker)

```bash
# Clone o repositório
git clone <repository-url>
cd colaboraEdu

# Inicie os containers
docker-compose up -d --build

# Inicialize o banco e crie o super-admin
docker-compose exec backend flask --app app init-db
docker-compose exec backend flask --app app create-admin

# Acesse a aplicação
# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
```

### Desenvolvimento Manual (sem Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example .env  # edite com suas configurações
flask --app app init-db
flask --app app run --debug --host 0.0.0.0 --port 5000

# Frontend (outro terminal)
cd frontend
npm install
npm run dev

# Worker (outro terminal)
cd backend
source .venv/bin/activate
rq worker default --url redis://localhost:6379/0
```

---

## Configuração de Ambiente

Copie `.env.example` para `.env` na raiz do projeto e preencha as variáveis:

```bash
cp .env.example .env
```

Variáveis obrigatórias para produção:

| Variável | Descrição |
|----------|-----------|
| `DOMAIN` | Domínio público (ex: `app.suaescola.com.br`) |
| `SECRET_KEY` | Chave Flask (mín. 32 chars — `openssl rand -hex 32`) |
| `JWT_SECRET_KEY` | Chave JWT (mín. 32 chars — `openssl rand -hex 32`) |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL |
| `REDIS_PASSWORD` | Senha do Redis |
| `SMTP_SERVER` | Servidor SMTP para e-mails de recuperação de senha |
| `SMTP_USER` | Usuário SMTP |
| `SMTP_PASSWORD` | Senha SMTP |
| `ACME_EMAIL` | E-mail para certificado Let's Encrypt |

Veja `.env.example` para a lista completa com descrições.

---

## Documentação

- **[Guia de Deployment](docs/DEPLOYMENT.md)** — instalação, produção, variáveis de ambiente, SSL
- **[Arquitetura do Sistema](docs/ARCHITECTURE.md)** — stack, multi-tenancy, segurança, modelos de dados
- **[Referência da API](docs/API.md)** — endpoints, autenticação, exemplos de request/response
- **[CHANGELOG](CHANGELOG.md)** — histórico de versões
- **[Guia de Contribuição](CONTRIBUTING.md)** — como contribuir com o projeto

### Endpoints Principais da API

Base URL: `https://{domain}/api/v1`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/auth/login` | Autenticação |
| `POST` | `/auth/refresh` | Renovar access token |
| `POST` | `/auth/logout` | Revogar tokens |
| `POST` | `/auth/forgot-password` | Solicitar recuperação de senha |
| `POST` | `/auth/reset-password` | Redefinir senha com token |
| `POST` | `/auth/change-password` | Alterar senha (autenticado) |
| `GET` | `/alunos` | Listar alunos (paginado) |
| `GET` | `/turmas` | Listar turmas |
| `GET` | `/notas` | Listar notas |
| `GET/POST` | `/ocorrencias` | Ocorrências disciplinares |
| `GET` | `/comunicados` | Listar comunicados (paginado) |
| `GET` | `/relatorios` | Gerar relatórios |
| `GET` | `/graficos` | Dados para gráficos |
| `POST` | `/uploads/pdf` | Upload de PDF de boletim (queued) |
| `GET` | `/uploads/jobs/<id>` | Status do job de ingestão |
| `GET` | `/exports/alunos?format=csv\|xlsx` | Exportar lista de alunos com médias |
| `GET` | `/exports/notas?format=csv\|xlsx` | Exportar notas completas |
| `GET` | `/usuarios/me` | Perfil do usuário logado |
| `GET` | `/audit-logs` | Logs de auditoria |
| `GET` | `/health` | Health check (DB + Redis) |
| `GET` | `/health/detailed` | Health detalhado (migrações, pool, fila) |

---

## Estrutura do Projeto

```
colaboraEdu/
├── backend/              # API Flask
│   ├── app/
│   │   ├── api/v1/      # Endpoints REST
│   │   ├── models/      # Modelos SQLAlchemy
│   │   ├── services/    # Lógica de negócio (IA, analytics, intervenções)
│   │   ├── schemas/     # Validação Pydantic
│   │   ├── core/        # Config, middleware, cache, segurança
│   │   └── templates/   # Templates HTML (boletim PDF)
│   ├── migrations/      # Migrações Alembic
│   └── pyproject.toml
│
├── frontend/            # SPA React
│   ├── src/
│   │   ├── app/         # Store Redux, rotas, hooks
│   │   ├── components/  # Componentes reutilizáveis (UI, navegação)
│   │   ├── features/    # Features por domínio
│   │   │   ├── auth/    # Login, troca/recuperação de senha
│   │   │   ├── dashboard/   # Dashboard, intervenções IA
│   │   │   ├── alunos/  # Listagem e detalhe de alunos
│   │   │   ├── notas/   # Boletins e notas
│   │   │   └── ...
│   │   └── lib/         # Cliente API (RTK Query)
│   └── public/          # Assets estáticos
│
├── mobile/              # App React Native/Expo
│   └── app/             # Telas e navegação
│
├── docs/                # Documentação
├── data/                # Uploads e dados locais (gitignored)
├── docker-compose.yml   # Desenvolvimento
├── docker-compose.prod.yml  # Produção (Traefik + TLS)
├── .env.example         # Template de variáveis de ambiente
└── README.md
```

---

## Comandos Úteis

```bash
# Criar super-admin inicial
docker-compose exec backend flask --app app create-admin

# Carregar dados de demonstração
docker-compose exec backend flask --app app seed-demo

# Executar migrações
docker-compose exec backend flask --app app db upgrade

# Ver logs em tempo real
docker-compose logs -f backend

# Backup do banco de dados
docker-compose exec postgres pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > backup_$(date +%Y%m%d).sql

# Produção — iniciar
docker-compose -f docker-compose.prod.yml up -d --build

# Produção — ver status
docker-compose -f docker-compose.prod.yml ps
```

---

## Contribuindo

Contribuições são bem-vindas! Leia o [Guia de Contribuição](CONTRIBUTING.md) antes de abrir um PR.

---

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## Suporte

Para dúvidas ou problemas:
- Consulte a [documentação](docs/)
- Abra uma issue no repositório
- Contato: suporte@colaboraedu.com
