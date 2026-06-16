# Guia de Deployment — ColaboraEdu

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Desenvolvimento Local](#desenvolvimento-local)
3. [Produção com Docker + Traefik](#produção-com-docker--traefik)
4. [Variáveis de Ambiente](#variáveis-de-ambiente)
5. [Inicialização do Sistema](#inicialização-do-sistema)
6. [Configuração de E-mail (SMTP)](#configuração-de-e-mail-smtp)
7. [Backup e Manutenção](#backup-e-manutenção)
8. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

### Para Docker (recomendado)
- Docker Engine 24.0+
- Docker Compose 2.20+
- Mínimo 2GB RAM, 10GB disco

### Para instalação manual
- Python 3.12+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

---

## Desenvolvimento Local

### Com Docker

```bash
# 1. Clone e configure
git clone <repository-url>
cd colaboraEdu
cp .env.example .env  # Edite com valores locais

# 2. Inicie os serviços
docker-compose up -d --build

# 3. Inicialize banco e super-admin
docker-compose exec backend flask --app app init-db
docker-compose exec backend flask --app app create-admin

# 4. (Opcional) Dados de demo
docker-compose exec backend flask --app app seed-demo

# Acesso:
# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
```

### Manual (sem Docker)

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/Mac — no Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# Crie .env no diretório backend/ com as variáveis necessárias
# (veja seção Variáveis de Ambiente abaixo)

flask --app app init-db
flask --app app run --debug --host 0.0.0.0 --port 5000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Worker (jobs assíncronos):**
```bash
cd backend
source .venv/bin/activate
rq worker default --url redis://localhost:6379/0
```

---

## Produção com Docker + Traefik

O arquivo `docker-compose.prod.yml` provisiona:
- **Traefik v2** — proxy reverso com TLS automático (Let's Encrypt)
- **PostgreSQL 15** — banco de dados com senha
- **Redis 7** — cache e filas com senha e persistência
- **Backend** — Gunicorn (4 workers, 4 threads)
- **Worker** — RQ worker para processamento assíncrono
- **Frontend** — build Nginx otimizado

Observação importante: este projeto sobe produção com `docker compose`, não com Docker Swarm. Nesse modo, `deploy.replicas` não escala containers automaticamente. Para manter `3` workers RQ, use explicitamente `--scale worker=3` no comando de deploy.

### Passos de Deploy

```bash
# 1. Configure o ambiente
cp .env.example .env
nano .env  # preencha TODAS as variáveis (veja seção abaixo)

# 2. Valide variáveis obrigatórias e compose de produção
./scripts/prod-preflight.sh

# 3. Aponte o DNS do seu domínio para o IP do servidor
# (A record: seu-dominio.com → IP do servidor)

# 4. Inicie os containers
docker-compose -f docker-compose.prod.yml up -d --build --scale worker=3

# 5. Aguarde o Traefik obter o certificado SSL (1-2 minutos)
docker-compose -f docker-compose.prod.yml logs -f traefik

# 6. Inicialize o banco de dados
docker-compose -f docker-compose.prod.yml exec backend flask --app app init-db

# 7. Crie o super-admin inicial
docker-compose -f docker-compose.prod.yml exec backend flask --app app create-admin \
  --username admin \
  --email admin@suaescola.com.br

# O comando imprime a senha gerada aleatoriamente — salve-a!

# 8. Verifique o status
docker-compose -f docker-compose.prod.yml ps
curl https://seu-dominio.com/health
```

### Atualização em Produção

```bash
# 1. Backup preventivo criptografado
docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} \
  | gzip \
  | gpg --batch --symmetric --cipher-algo AES256 --passphrase "${BACKUP_ENCRYPTION_KEY}" \
  > backup_pre_update_$(date +%Y%m%d).sql.gz.gpg

# 2. Atualizar código
git pull origin main

# 3. Validar configuração antes de mexer nos containers
./scripts/prod-preflight.sh

# 4. Rebuild e restart
docker-compose -f docker-compose.prod.yml up -d --build --scale worker=3

# 5. Executar migrações (se houver)
docker-compose -f docker-compose.prod.yml exec backend flask --app app db upgrade

# 6. Smoke test
curl -f https://${DOMAIN}/health
```

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores. Abaixo estão as variáveis por categoria.

### Infra / Traefik

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DOMAIN` | Sim | Domínio público sem `https://` (ex: `app.suaescola.com.br`) |
| `ACME_EMAIL` | Sim | E-mail para o certificado Let's Encrypt |

### PostgreSQL

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `POSTGRES_USER` | Sim | Usuário do banco (ex: `colabora_user`) |
| `POSTGRES_PASSWORD` | Sim | Senha forte — `openssl rand -hex 32` |
| `POSTGRES_DB` | Sim | Nome do banco (ex: `colabora_edu`) |
| `APP_DB_USER` | Sim | Usuário limitado usado pela aplicação em runtime |
| `APP_DB_PASSWORD` | Sim | Senha do usuário limitado da aplicação |

### Redis

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `REDIS_PASSWORD` | Sim | Senha do Redis — `openssl rand -hex 24` |

### Backup

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `BACKUP_ENCRYPTION_KEY` | Sim | Chave para criptografar backups locais — mín. 32 chars, `openssl rand -hex 32` |
| `S3_BACKUP_BUCKET` | Não | Bucket/pasta S3-compatible para cópia externa dos backups |
| `AWS_ACCESS_KEY_ID` | Se `S3_BACKUP_BUCKET` | Access key do object storage |
| `AWS_SECRET_ACCESS_KEY` | Se `S3_BACKUP_BUCKET` | Secret key do object storage |
| `AWS_DEFAULT_REGION` | Não | Região S3-compatible |
| `S3_ENDPOINT` | Não | Endpoint customizado para Backblaze, MinIO, Hetzner, etc. |

### Flask / Backend

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SECRET_KEY` | Sim | Chave Flask — mín. 32 chars, `openssl rand -hex 32` |
| `JWT_SECRET_KEY` | Sim | Chave JWT — mín. 32 chars, `openssl rand -hex 32` |
| `FLASK_ENV` | Sim | `production` em produção, `development` em dev |
| `FRONTEND_URL` | Sim | URL pública do frontend (para links nos e-mails) |
| `BRAND_NAME` | Não | Nome da plataforma (padrão: `ColaboraEdu`) |
| `ALLOWED_ORIGINS` | Não | JSON array de origens CORS (padrão: `["https://{DOMAIN}"]`) |
| `COMMERCIAL_MODE` | Não | `saas` (multi-escola) ou `dedicated` (escola única) |

### SMTP (obrigatório para recuperação de senha)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SMTP_SERVER` | Sim | Servidor SMTP (ex: `smtp.gmail.com`) |
| `SMTP_PORT` | Sim | Porta SMTP (ex: `587` para TLS) |
| `SMTP_USER` | Sim | Usuário SMTP |
| `SMTP_PASSWORD` | Sim | Senha SMTP (use App Password no Gmail) |
| `SMTP_FROM` | Sim | Endereço remetente (ex: `noreply@suaescola.com.br`) |

### WhatsApp (opcional)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `WHATSAPP_API_URL` | Não | URL da Evolution API |
| `WHATSAPP_API_TOKEN` | Não | Token da Evolution API |

---

## Inicialização do Sistema

### Criar Super-Admin

```bash
# Cria super-admin com senha gerada automaticamente
flask --app app create-admin

# Ou especificando parâmetros
flask --app app create-admin \
  --username meuadmin \
  --email admin@suaescola.com.br \
  --password "MinhaSenh@Forte123"
```

O super-admin tem `tenant_id = NULL` e acesso a todas as escolas.

### Criar Primeira Escola (Tenant)

Após fazer login com o super-admin, acesse `/app/admin/escolas` para criar a primeira escola. Você pode também usar a CLI:

```bash
flask --app app create-tenant --name "Escola Municipal X" --slug "escola-x"
```

### Criar Admin da Escola

```bash
flask --app app create-admin \
  --username admin_escola_x \
  --email admin@escolax.com.br \
  --tenant-slug escola-x
```

---

## Configuração de E-mail (SMTP)

A recuperação de senha e notificações usam SMTP. Configure no `.env`:

### Gmail (App Password)

1. Ative autenticação de 2 fatores na conta Google
2. Acesse `myaccount.google.com` → Segurança → Senhas de app
3. Gere uma senha de app para "E-mail"
4. Use essa senha em `SMTP_PASSWORD`

```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@suaescola.com.br
SMTP_PASSWORD=xxxx xxxx xxxx xxxx   # App Password gerada
SMTP_FROM=noreply@suaescola.com.br
```

### SendGrid

```env
SMTP_SERVER=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxx
SMTP_FROM=noreply@suaescola.com.br
```

### Testar envio de e-mail

```bash
docker-compose exec backend flask --app app shell
>>> from app.core.config import settings
>>> print(settings.smtp_server, settings.smtp_user)
```

---

## Backup e Manutenção

### Backup do Banco de Dados

```bash
# Backup manual criptografado
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} \
  | gzip \
  | gpg --batch --symmetric --cipher-algo AES256 --passphrase "${BACKUP_ENCRYPTION_KEY}" \
  > backup_$(date +%Y%m%d_%H%M%S).sql.gz.gpg

# Restaurar dump criptografado com confirmação explícita
scripts/restore-postgres-backup.sh backup_20260410_120000.sql.gz.gpg
```

### Backup Automático

O `docker-compose.prod.yml` já inclui o serviço `pgbackup`, que executa backup diário às 02:00, criptografa com `BACKUP_ENCRYPTION_KEY`, valida tamanho mínimo do dump e mantém retenção local de 30 dias. Sem `BACKUP_ENCRYPTION_KEY`, o serviço recusa criar backup sem criptografia.

```bash
docker-compose -f docker-compose.prod.yml logs pgbackup
docker volume inspect colaboraedu-produc_pgbackups
```

Para produção com várias escolas, replique esse volume para armazenamento externo, como S3-compatible/Object Storage, Hetzner Storage Box ou outro destino fora do servidor.

### Monitoramento

```bash
# Status dos serviços
docker-compose -f docker-compose.prod.yml ps

# Logs em tempo real
docker-compose -f docker-compose.prod.yml logs -f

# Saúde da API
curl https://seu-dominio.com/health

# Recursos dos containers
docker stats
```

### Limpeza

```bash
# Remover imagens antigas (não remove containers ativos)
docker image prune -a

# Limpar uploads antigos (mais de 90 dias)
docker-compose -f docker-compose.prod.yml exec backend \
  find /data/uploads -type f -mtime +90 -name "*.pdf" -delete
```

---

## Troubleshooting

### Containers não iniciam

```bash
docker-compose -f docker-compose.prod.yml logs
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### Erro de conexão com banco

```bash
# Verificar status do PostgreSQL
docker-compose -f docker-compose.prod.yml ps postgres

# Testar conexão
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "SELECT 1"

# Verificar variáveis de ambiente do backend
docker-compose -f docker-compose.prod.yml exec backend env | grep DATABASE
```

### SSL/TLS não funciona

```bash
# Verificar se o DNS aponta para o servidor
dig +short seu-dominio.com

# Verificar logs do Traefik
docker-compose -f docker-compose.prod.yml logs traefik | grep -i acme

# O certificado é obtido automaticamente na primeira requisição HTTP
# Aguarde 1-2 minutos após o primeiro acesso
```

### Backend retorna 401 em todas as requisições

Provavelmente o Redis está indisponível. O sistema está em modo fail-closed — todos os tokens são tratados como revogados quando o Redis não responde.

```bash
docker-compose -f docker-compose.prod.yml ps redis
docker-compose -f docker-compose.prod.yml logs redis
docker-compose -f docker-compose.prod.yml restart redis
```

### Worker não processa PDFs

```bash
docker-compose -f docker-compose.prod.yml logs worker
docker-compose -f docker-compose.prod.yml restart worker

# Verificar fila
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli -a ${REDIS_PASSWORD} llen rq:queue:default
```

### Erro de migrações

```bash
# Ver status das migrações
docker-compose -f docker-compose.prod.yml exec backend \
  flask --app app db current

# Aplicar migrações pendentes
docker-compose -f docker-compose.prod.yml exec backend \
  flask --app app db upgrade

# Em último caso, recriar o banco (APAGA TODOS OS DADOS)
docker-compose -f docker-compose.prod.yml exec backend \
  flask --app app init-db
```

---

## Checklist de Segurança para Produção

- [ ] `SECRET_KEY` com pelo menos 32 caracteres aleatórios
- [ ] `JWT_SECRET_KEY` com pelo menos 32 caracteres aleatórios
- [ ] `POSTGRES_PASSWORD` forte e única
- [ ] `REDIS_PASSWORD` forte e única
- [ ] `FLASK_ENV=production`
- [ ] HTTPS ativo (Traefik com Let's Encrypt)
- [ ] `ALLOWED_ORIGINS` configurado apenas com domínios próprios
- [ ] SMTP configurado para recuperação de senha
- [ ] Backup automático do banco configurado
- [ ] Restore testado com `scripts/restore-postgres-backup.sh`
- [ ] `./scripts/prod-preflight.sh` passando no servidor
- [ ] `./scripts/scan-secrets.sh` passando antes do deploy
- [ ] Scraper de `/metrics` configurado com JWT de `super_admin`
- [ ] GitHub Actions CI passando antes do deploy
- [ ] `.env` não versionado no git (verificar `.gitignore`)
- [ ] Firewall: apenas portas 80 e 443 abertas externamente
- [ ] Super-admin com senha trocada após primeiro login
