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
sudo apt-get install -y -q curl git ufw

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
read -rsp "Senha do Redis: " REDIS_PASSWORD; echo ""

# Gera chaves secretas automaticamente
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)

cat > .env <<EOF
# === Traefik / Domínio ===
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

# === PostgreSQL ===
POSTGRES_USER=colabora_user
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=colabora_edu

# === Redis ===
REDIS_PASSWORD=${REDIS_PASSWORD}

# === Flask / Backend ===
FLASK_ENV=production
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
ALLOWED_ORIGINS=["https://${DOMAIN}"]
BRAND_NAME=ColaboraEdu

# === SMTP (preencha após setup) ===
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@${DOMAIN}

# === WhatsApp Evolution API (opcional) ===
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=

# === Backup (opcional — S3/Hetzner Object Storage) ===
# BACKUP_S3_BUCKET=
# BACKUP_AWS_ACCESS_KEY_ID=
# BACKUP_AWS_SECRET_ACCESS_KEY=
# BACKUP_S3_ENDPOINT=https://fsn1.your-objectstorage.com
EOF

echo -e "${GREEN}Arquivo .env criado.${NC}"

# 5. Preparar volume do Let's Encrypt (necessário que acme.json exista com permissão correta)
mkdir -p letsencrypt
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json

# 6. Subir os containers
echo -e "${GREEN}[5/6] Iniciando containers via Docker Compose...${NC}"
docker compose -f docker-compose.prod.yml up -d --build

echo -e "${GREEN}[6/6] Aguardando backend iniciar e aplicando migrations...${NC}"
sleep 20
docker compose -f docker-compose.prod.yml exec -T backend flask --app app db upgrade || \
    echo -e "${YELLOW}⚠  Migration retornou erro — verifique logs: docker compose logs backend${NC}"

echo ""
echo -e "${BLUE}=== Setup Concluído ===${NC}"
echo -e "  Sistema:   ${GREEN}https://${DOMAIN}${NC}"
echo -e "  Logs:      ${BLUE}docker compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "  Monit.:    ${GREEN}https://${DOMAIN}:3001${NC} (Uptime Kuma)"
echo ""
echo -e "${YELLOW}Próximos passos:"
echo "  1. Configure as variáveis SMTP no .env e reinicie: docker compose -f docker-compose.prod.yml restart backend"
echo "  2. Crie o super-admin: docker compose -f docker-compose.prod.yml exec backend flask --app app create-superadmin"
echo "  3. Configure o pipeline CI/CD no GitHub (veja .github/workflows/deploy.yml)"
echo -e "${NC}"

