# Sistema de Notificações — ColaboraEDU

Guia completo de configuração e operação do sistema de notificações de ocorrências por **E-mail** e **WhatsApp**.

---

## Índice

1. [Como funciona](#1-como-funciona)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Configurar E-mail (SMTP)](#3-configurar-e-mail-smtp)
4. [Configurar WhatsApp (Evolution API)](#4-configurar-whatsapp-evolution-api)
5. [Cadastrar contato do responsável no aluno](#5-cadastrar-contato-do-responsável-no-aluno)
6. [Aplicar a migration do banco de dados](#6-aplicar-a-migration-do-banco-de-dados)
7. [Verificar o worker RQ](#7-verificar-o-worker-rq)
8. [Registrar uma ocorrência e enviar notificação](#8-registrar-uma-ocorrência-e-enviar-notificação)
9. [Reenviar notificação de uma ocorrência existente](#9-reenviar-notificação-de-uma-ocorrência-existente)
10. [Diagnóstico e logs](#10-diagnóstico-e-logs)
11. [Status possíveis da notificação](#11-status-possíveis-da-notificação)
12. [Fluxo técnico completo](#12-fluxo-técnico-completo)
13. [Variáveis de ambiente — referência completa](#13-variáveis-de-ambiente--referência-completa)

---

## 1. Como funciona

```
Professor/Coordenador
      │  cria ocorrência com "Notificar Responsáveis" ✓
      ▼
  API Flask (POST /api/v1/ocorrencias)
      │  marca status = "Pendente"
      │  enfileira tarefa no Redis
      ▼
  Redis Queue (RQ)
      │
      ▼
  Worker RQ (processo separado)
      │  lê ocorrência + dados do aluno/responsável
      │  monta mensagem personalizada
      ├──► Flask-Mail → SMTP → E-mail do responsável
      └──► requests → Evolution API → WhatsApp do responsável
      │
      ▼
  Atualiza ocorrencia.notificacao_status
  "Enviado" | "Parcial (Email: OK, WhatsApp: Falha)" | "Falha"
```

**Prioridade de destinatário:**
| Campo | Usado para |
|---|---|
| `aluno.email_responsavel` | E-mail (prioridade 1) |
| `aluno.email` | E-mail (fallback) |
| `aluno.telefone_responsavel` | WhatsApp (prioridade 1) |
| `aluno.telefones` | WhatsApp (fallback, extrai primeiro número com ≥10 dígitos) |

---

## 2. Pré-requisitos

- Docker e Docker Compose instalados
- Serviços `postgres`, `redis`, `backend` e `worker` rodando
- Acesso a um servidor SMTP (Gmail, Outlook, Sendgrid…) **e/ou** uma instância da Evolution API conectada ao WhatsApp

---

## 3. Configurar E-mail (SMTP)

### Opção A — Gmail (mais comum)

1. Acesse [myaccount.google.com](https://myaccount.google.com) → **Segurança**
2. Ative **Verificação em 2 etapas** (obrigatório para App Passwords)
3. Pesquise por **"Senhas de app"** → selecione "Outro" → nomeie como "ColaboraEDU"
4. Copie a senha de 16 caracteres gerada
5. No arquivo `.env` da raiz do projeto:

```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=suaconta@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx   # senha de app (com ou sem espaços)
SMTP_FROM=suaconta@gmail.com
```

### Opção B — Outlook / Microsoft 365

```env
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USER=noreply@suaescola.edu.br
SMTP_PASSWORD=SUA_SENHA_AQUI
SMTP_FROM=noreply@suaescola.edu.br
```

### Opção C — Sendgrid

```env
SMTP_SERVER=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=noreply@suaescola.edu.br
```

### Testar o envio de e-mail manualmente

```bash
# Dentro do container backend:
docker compose exec backend python -c "
from app import create_app
from app.services.communication_service import CommunicationService
app = create_app()
with app.app_context():
    ok = CommunicationService.send_email('seu@email.com', 'Teste ColaboraEDU', 'Funcionou!')
    print('OK' if ok else 'FALHOU — veja os logs')
"
```

---

## 4. Configurar WhatsApp (Evolution API)

### Instalação rápida da Evolution API (Docker)

```bash
# Crie um arquivo docker-compose.evolution.yml separado ou adicione ao seu stack:
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=MEU_TOKEN_SECRETO \
  -e DATABASE_ENABLED=false \
  atendai/evolution-api:latest
```

> Para produção recomenda-se usar o `docker-compose` oficial da Evolution API com Redis e banco de dados persistente. Consulte: https://doc.evolution-api.com/get-started/installation

### Conectar ao WhatsApp

1. Acesse `http://SEU_SERVIDOR:8080` (ou domínio configurado)
2. No Swagger UI, autentique com o token definido em `AUTHENTICATION_API_KEY`
3. Crie uma instância: `POST /instance/create` com body `{"instanceName": "colaboraedu", "qrcode": true}`
4. Acesse `GET /instance/connect/colaboraedu` — aparecerá um QR Code
5. Abra o WhatsApp no celular → **Aparelhos Conectados** → **Conectar um aparelho** → escaneie o QR
6. Confirme em `GET /instance/fetchInstances` que o status é `"open"`

### Configurar no .env

```env
WHATSAPP_API_URL=http://SEU_SERVIDOR:8080    # ou https://evolution.suaescola.com.br
WHATSAPP_API_TOKEN=MEU_TOKEN_SECRETO         # valor de AUTHENTICATION_API_KEY
WHATSAPP_INSTANCE=colaboraedu               # nome exato da instância criada
```

### Testar o envio de WhatsApp manualmente

```bash
docker compose exec backend python -c "
from app import create_app
from app.services.communication_service import CommunicationService
app = create_app()
with app.app_context():
    ok = CommunicationService.send_whatsapp('73999999999', 'Teste ColaboraEDU via WhatsApp!')
    print('OK' if ok else 'FALHOU — veja os logs')
"
```

> O número deve conter apenas dígitos com DDD, sem `+55`. O sistema adiciona automaticamente `55` se necessário via Evolution API.

---

## 5. Cadastrar contato do responsável no aluno

Os campos `email_responsavel` e `telefone_responsavel` foram adicionados ao cadastro do aluno. Para preencher:

1. Acesse **Alunos** → clique no nome do aluno → ícone de **Editar** (lápis)
2. Role até a seção **"Contato do Responsável"**
3. Preencha **Email do Responsável** e/ou **WhatsApp do Responsável**
4. Clique em **Salvar Alterações**

**Se esses campos ficarem vazios**, o sistema usa como fallback o `email` e `telefones` do próprio aluno.

---

## 6. Aplicar a migration do banco de dados

A migration `c7f2a9e1b3d8` adiciona as colunas `email_responsavel` e `telefone_responsavel` à tabela `alunos`.

```bash
# Execute dentro do container backend (ou no host com DATABASE_URL apontando para o postgres):
docker compose exec backend flask --app app db upgrade
```

Se o comando `flask db` não estiver disponível, use alembic diretamente:

```bash
docker compose exec backend alembic upgrade head
```

Verifique que as colunas foram criadas:

```bash
docker compose exec postgres psql -U postgres -d colabora_edu \
  -c "\d alunos" | grep responsavel
```

Saída esperada:
```
 email_responsavel    | character varying(255) |
 telefone_responsavel | character varying(100) |
```

---

## 7. Verificar o worker RQ

O worker processa as tarefas de notificação em background. Confirme que está rodando:

```bash
docker compose ps worker
# Deve mostrar "Up" na coluna STATUS

docker compose logs worker --tail=30
# Deve mostrar: "Worker rq:worker:... started"
```

Se o worker estiver parado, reinicie:

```bash
docker compose restart worker
```

Monitorar jobs em tempo real:

```bash
docker compose exec redis redis-cli monitor | grep rq
```

---

## 8. Registrar uma ocorrência e enviar notificação

1. No menu lateral → **Ocorrências** → botão **Nova Ocorrência**
2. Selecione o aluno (filtre por turma se necessário)
3. Preencha **Tipo**, **Gravidade**, **Descrição** e **Data**
4. Preencha **Instruções para os Pais** (aparece na mensagem)
5. Marque ☑ **Notificar Responsáveis**
   - Um preview da mensagem exata aparecerá abaixo do checkbox
   - Se o aluno não tiver email/telefone cadastrado, um aviso amarelo será exibido
6. Clique em **Registrar Ocorrência**

O card da ocorrência exibirá o chip de status:
- 🟡 **Pendente** — job enfileirado, aguardando worker
- 🟢 **Enviado** — email E WhatsApp enviados com sucesso
- 🟠 **Parcial** — apenas um dos canais funcionou (ex: `Parcial (Email: OK, WhatsApp: Falha)`)
- 🔴 **Falha** — nenhum canal funcionou

---

## 9. Reenviar notificação de uma ocorrência existente

Útil quando:
- A primeira tentativa falhou (status "Falha" ou "Parcial")
- O contato do responsável foi atualizado após o registro

1. No card da ocorrência → menu **⋮** (três pontos)
2. Clique em **Reenviar Notificação**
3. O status volta para **Pendente** e o worker reprocessa

**Endpoint da API:**
```
POST /api/v1/ocorrencias/{id}/notificar
Authorization: Bearer <token>
Roles permitidas: admin, super_admin, coordenador, diretor, orientador
```

---

## 10. Diagnóstico e logs

### Ver logs do worker em tempo real

```bash
docker compose logs -f worker
```

Saída de sucesso esperada:
```
INFO  | Starting notification task for occurrence 42
INFO  | Email sent to pai@exemplo.com
INFO  | WhatsApp message sent to 73999999999
INFO  | Notification task for occurrence 42 finished. Status: Enviado
```

Saída de falha:
```
ERROR | Failed to send email to pai@exemplo.com: (535, 'Authentication failed')
ERROR | Failed to send WhatsApp to 73999: Phone number too short after cleaning
```

### Verificar jobs com falha na fila RQ

```bash
docker compose exec redis redis-cli lrange rq:failed:default 0 -1
```

### Checar configuração carregada

```bash
docker compose exec backend python -c "
from app.core.config import settings
print('SMTP:', settings.smtp_server, settings.smtp_port, settings.smtp_user)
print('WA URL:', settings.whatsapp_api_url)
print('WA Instance:', settings.whatsapp_instance)
print('WA Token:', '***' if settings.whatsapp_api_token else '(vazio)')
"
```

### Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Status sempre "Pendente" | Worker não está rodando | `docker compose restart worker` |
| `AttributeError: settings has no attribute 'whatsapp_instance'` | Config desatualizada | Reiniciar backend após pull |
| `535 Authentication Failed` (email) | Senha SMTP errada | Verificar App Password do Gmail |
| `401 Unauthorized` (WhatsApp) | Token inválido | Verificar `WHATSAPP_API_TOKEN` no `.env` |
| `Phone number too short` | Campo telefone mal formatado | Preencher `telefone_responsavel` com DDD |
| WhatsApp enviado mas não recebido | Instância desconectada | Reconectar instância via QR Code |

---

## 11. Status possíveis da notificação

| Status | Significado |
|---|---|
| `null` / vazio | Notificação não solicitada no momento do registro |
| `Pendente` | Job enfileirado — aguardando processamento pelo worker |
| `Enviado` | Email **e** WhatsApp enviados com sucesso |
| `Parcial (Email: OK, WhatsApp: Falha)` | Apenas email funcionou |
| `Parcial (Email: Falha, WhatsApp: OK)` | Apenas WhatsApp funcionou |
| `Falha` | Nenhum canal funcionou |

---

## 12. Fluxo técnico completo

```
frontend/src/features/ocorrencias/OcorrenciasPage.tsx
  └─ useCreateOcorrenciaMutation({ notificar_responsaveis: true })
       └─ POST /api/v1/ocorrencias
            └─ backend/app/api/v1/ocorrencias.py → create_ocorrencia()
                 └─ OcorrenciaService.create()
                      ├─ repository.create(payload)           # salva no banco
                      ├─ novo.notificacao_status = "Pendente" # marca antes de enfileirar
                      └─ queue.enqueue(notify_occurrence_task, novo.id)
                                │
                                ▼ (Redis)
                      backend/app/core/tasks.py → notify_occurrence_task(id)
                           ├─ busca Ocorrencia + Aluno + Tenant
                           ├─ monta mensagem com nome da escola dinâmico
                           ├─ email_destino = email_responsavel OR email
                           ├─ telefone_destino = telefone_responsavel OR telefones
                           ├─ CommunicationService.send_email(...)
                           │    └─ Flask-Mail → SMTP configurado nas env vars
                           ├─ CommunicationService.send_whatsapp(...)
                           │    ├─ _extract_first_phone() → limpa e valida o número
                           │    └─ POST {WHATSAPP_API_URL}/message/sendText/{INSTANCE}
                           └─ atualiza ocorrencia.notificacao_status
```

---

## 13. Variáveis de ambiente — referência completa

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `SMTP_SERVER` | Sim (para email) | `smtp.gmail.com` | Servidor SMTP |
| `SMTP_PORT` | Sim | `587` | Porta SMTP (587=STARTTLS, 465=SSL) |
| `SMTP_USER` | Sim | `""` | Usuário/login SMTP |
| `SMTP_PASSWORD` | Sim | `""` | Senha SMTP ou App Password |
| `SMTP_FROM` | Sim | `suporte@colaboraedu.com` | E-mail remetente |
| `WHATSAPP_API_URL` | Não | `""` | URL base da Evolution API |
| `WHATSAPP_API_TOKEN` | Não | `""` | Token de autenticação (apikey) |
| `WHATSAPP_INSTANCE` | Não | `""` | Nome da instância criada na Evolution API |
| `REDIS_URL` | Sim | `redis://localhost:6379/0` | URL de conexão com o Redis |

> Se `WHATSAPP_API_URL` ou `WHATSAPP_INSTANCE` estiverem vazios, o envio de WhatsApp é silenciosamente ignorado (sem erro). O sistema continua tentando o email normalmente.

---

*Última atualização: 2026-04-23 — ColaboraEDU v1.6*
