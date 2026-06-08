#!/bin/bash

# ColaboraEdu — Hetzner Auto-Setup Script
# Configura Docker, firewall, variáveis e sobe o stack via docker compose.
# SSL/TLS é gerenciado pelo Traefik com Let's Encrypt (ACME) — NÃO instala nginx nem certbot.

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== ColaboraEdu — Setup Hetzner ===${NC}"

# 1. Atualização do sistema
echo -e "${GREEN}[1/6] Atualizando sistema...${NC}"
sudo apt-get update -q
sudo apt-get install -y -q curl git ufw openssl apache2-utils

# 2. Docker (método oficial, sem docker.io do apt que é legado)
echo -e "${GREEN}[2/6] Instalando Docker Engine...${NC}"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sudo bash
    sudo usermod -aG docker "$USER"
    echo -e "${YELLOW}⚠  Docker instalado. Você pode precisar fazer logout/login para usar 'docker' sem sudo.${NC}"
fi
sudo systemctl enable --now docker

# 3. Firewall UFW — apenas portas essenciais
echo -e "${GREEN}[3/6] Configurando firewall (UFW)...${NC}"
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp   # HTTP — Traefik (redirect para HTTPS)
sudo ufw allow 443/tcp  # HTTPS — Traefik
sudo ufw --force enable
sudo ufw status verbose

# 4. Variáveis de ambiente
echo -e "${GREEN}[4/6] Configurando variáveis de ambiente...${NC}"
read -rp "Domínio público (ex: app.escola.com.br): " DOMAIN
read -rp "E-mail para Let's Encrypt (ACME): " ACME_EMAIL
read -rsp "Senha do banco de dados (PostgreSQL): " DB_PASSWORD; echo ""
read -rsp "Senha do usuário app do banco (APP_DB_USER): " APP_DB_PASSWORD; echo ""
read -rsp "Senha do Redis: " REDIS_PASSWORD; echo ""
read -rsp "Senha do painel de monitoramento (Uptime Kuma): " MONITOR_PASSWORD; echo ""
read -rp "Usuário SMTP: " SMTP_USER
read -rsp "Senha SMTP: " SMTP_PASSWORD; echo ""
read -rp "Remetente SMTP (ex: noreply@${DOMAIN}): " SMTP_FROM

# Gera chaves secretas automaticamente
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)
MONITOR_BASICAUTH=$(htpasswd -nb admin "$MONITOR_PASSWORD" | sed 's/\$/\$\$/g')
SMTP_FROM=${SMTP_FROM:-noreply@${DOMAIN}}

cat > .env <<EOF
# === Traefik / Domínio ===
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

# === PostgreSQL ===
POSTGRES_USER=colabora_user
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=colabora_edu
APP_DB_USER=colabora_app
APP_DB_PASSWORD=${APP_DB_PASSWORD}

# === Redis ===
REDIS_PASSWORD=${REDIS_PASSWORD}

# === Flask / Backend ===
FLASK_ENV=production
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
FRONTEND_URL=https://${DOMAIN}
ALLOWED_ORIGINS=["https://${DOMAIN}"]
BRAND_NAME=ColaboraEdu

# === Monitoramento ===
MONITOR_BASICAUTH=${MONITOR_BASICAUTH}

# === SMTP ===
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
SMTP_FROM=${SMTP_FROM}

# === WhatsApp Evolution API (opcional) ===
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
WHATSAPP_INSTANCE=

# === Backup ===
BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}

# === Backup externo (opcional — S3/Hetzner Object Storage) ===
S3_BACKUP_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
S3_ENDPOINT=

# === Monitoramento de erros / Faturamento (opcionais) ===
SENTRY_DSN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
EOF

echo -e "${GREEN}Arquivo .env criado.${NC}"

echo -e "${GREEN}Validando configuração de produção...${NC}"
./scripts/prod-preflight.sh

# 5. Preparar volume do Let's Encrypt (necessário que acme.json exista com permissão correta)
mkdir -p letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json

# 6. Subir os containers
echo -e "${GREEN}[5/6] Iniciando containers via Docker Compose...${NC}"
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans --scale worker=3

echo -e "${GREEN}[6/6] Aguardando backend iniciar e aplicando migrations...${NC}"
sleep 20
docker compose -f docker-compose.prod.yml exec -T backend flask --app app db upgrade || \
    echo -e "${YELLOW}⚠  Migration retornou erro — verifique logs: docker compose logs backend${NC}"

echo ""
echo -e "${BLUE}=== Setup Concluído ===${NC}"
echo -e "  Sistema:   ${GREEN}https://${DOMAIN}${NC}"
echo -e "  Logs:      ${BLUE}docker compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "  Monit.:    ${GREEN}https://monitor.${DOMAIN}${NC} (Uptime Kuma, usuário: admin)"
echo ""
echo -e "${YELLOW}Próximos passos:"
echo "  1. Crie o super-admin: docker compose -f docker-compose.prod.yml exec backend flask --app app create-superadmin"
echo "  2. Configure Sentry/Stripe/S3 no .env se for usar esses recursos."
echo "  3. Configure o pipeline CI/CD no GitHub (veja .github/workflows/deploy.yml)"
echo -e "${NC}"
