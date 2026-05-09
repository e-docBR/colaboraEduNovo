# 🚀 Plano de Implantação: ColaboraFREI na Hetzner

Este documento detalha o procedimento para implantar o sistema no servidor **157.180.37.249** sob o domínio **freironaldo.colaboraedu.cloud**.

## 📋 Resumo da Infraestrutura
- **Host:** Hetzner Cloud VPS (Ubuntu + Docker)
- **Proxy Reverso:** Traefik (com SSL Automático Let's Encrypt)
- **Stack:** Docker Compose (Nginx, Flask, PostgreSQL 15, Redis 7)
- **Recursos:** 4 vCPUs, 8GB RAM

---

## 🛠️ Passo 1: Preparação do Servidor

### 1.1 Segurança SSH
Como não existem chaves SSH configuradas, execute este comando no seu terminal **local** para enviar sua chave para o servidor (substitua `~/.ssh/id_rsa.pub` pelo caminho da sua chave se for diferente):

```bash
ssh-copy-id root@157.180.37.249
```

### 1.2 Firewall (UFW)
Acesse o servidor via SSH e configure o firewall básico:
```bash
ssh root@157.180.37.249

# No servidor:
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 📂 Passo 2: Transferência de Arquivos

Envie os arquivos do projeto para o servidor:
```bash
# No seu terminal local, na raiz do projeto:
rsync -avz --exclude '.git' --exclude 'node_modules' --exclude '__pycache__' . root@157.180.37.249:/opt/colaborafrei
```

---

## ⚙️ Passo 3: Configuração de Ambiente

Já preparei o arquivo `.env.production` localmente. Garanta que ele esteja correto no servidor:
```bash
# No servidor:
cd /opt/colaborafrei
cp .env.production .env
```

*Nota: Verifique se o `DOMAIN` no `.env` é exatamente `freironaldo.colaboraedu.cloud`.*

---

## 🚀 Passo 4: Deployment

Execute a stack em modo detached:
```bash
cd /opt/colaborafrei
docker compose -f docker-compose.prod.yml up -d --build
```

### 4.1 Verificar Status
Aguarde alguns minutos para a emissão do certificado SSL e inicialização do banco:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

---

## 🧪 Passo 5: Verificação Pós-Implantção

1.  **Acesse:** `https://freironaldo.colaboraedu.cloud`
2.  **Health Check:** Verifique se os ícones e dados de teste aparecem.
3.  **Certificado:** Verifique se o cadeado (HTTPS) está ativo e é válido.

---

## 🆘 Troubleshooting e Comandos Úteis

- **Logs do Backend:** `docker compose logs -f backend`
- **Reisnitializar Banco:** `docker compose exec backend flask db upgrade`
- **Backup do Banco:** `docker compose exec postgres pg_dump -U postgres colabora_edu > backup.sql`
- **Reiniciar Proxy:** `docker compose restart traefik`

---
> **Aviso de Segurança:** Nunca armazene o arquivo `.env` no Git. Ele contém segredos de produção.
