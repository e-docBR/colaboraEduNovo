# 🚀 Guia Rápido - ColaboraFREI

## ⚡ Comandos Essenciais

### Iniciar Sistema (Desenvolvimento)
```bash
docker-compose up -d --build
```

### Iniciar Sistema (Produção)
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### Ver Logs
```bash
# Todos os serviços
docker-compose logs -f

# Serviço específico
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Parar Sistema
```bash
docker-compose down
```

### Reiniciar Serviço
```bash
docker-compose restart backend
docker-compose restart frontend
```

---

## 🌐 URLs de Acesso

### Desenvolvimento
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health
- **PostgreSQL**: localhost:5440
- **Redis**: localhost:6389

### Produção
- **Frontend**: http://localhost:8090
- **Backend API**: http://localhost:5000 (interno)

---

## 🔧 Comandos do Backend

### Inicializar Banco de Dados
```bash
docker-compose exec backend flask --app app init-db
```

### Criar Dados de Demonstração
```bash
docker-compose exec backend flask --app app seed-demo
```

### Executar Migrações
```bash
docker-compose exec backend flask db upgrade
```

### Criar Nova Migração
```bash
docker-compose exec backend flask db migrate -m "Descrição da migração"
```

### Acessar Shell Python
```bash
docker-compose exec backend flask shell
```

---

## 💾 Backup e Restauração

### Fazer Backup
```bash
docker-compose exec postgres pg_dump -U postgres colabora_edu > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar Backup
```bash
docker-compose exec -T postgres psql -U postgres colabora_edu < backup_20260113_143000.sql
```

---

## 🔍 Troubleshooting Rápido

### Container não inicia
```bash
docker-compose down -v
docker-compose up -d --build
```

### Ver uso de recursos
```bash
docker stats
```

### Limpar sistema Docker
```bash
docker system prune -a
```

### Verificar conectividade
```bash
# Backend
curl http://localhost:5000/health

# Frontend
curl http://localhost:5173
```

---

## 📊 Estrutura de Diretórios

```
colaboraFREI/
├── backend/          # API Flask
├── frontend/         # React App
├── docs/            # Documentação
├── data/            # Uploads e dados
└── docker-compose.yml
```

---

## 🔐 Credenciais Padrão

### Desenvolvimento
- **Usuário**: admin
- **Senha**: admin

### Banco de Dados
- **Host**: localhost:5440
- **Database**: colabora_edu
- **User**: postgres
- **Password**: password

---

## 📚 Documentação Completa

- [README.md](../README.md) - Visão geral
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guia de deployment
- [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitetura
- [CHANGELOG.md](../CHANGELOG.md) - Histórico

---

## 🆘 Comandos de Emergência

### Parar tudo imediatamente
```bash
docker-compose down
```

### Resetar completamente (⚠️ APAGA DADOS)
```bash
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

### Ver processos em execução
```bash
docker-compose ps
```

---

## 📝 Git Workflow

### Atualizar código
```bash
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Enviar mudanças
```bash
git add .
git commit -m "Descrição das mudanças"
git push origin main
```

---

## 🎯 Endpoints API Principais

```
POST   /api/v1/auth/login          # Login
GET    /api/v1/alunos              # Listar alunos
POST   /api/v1/alunos              # Criar aluno
GET    /api/v1/turmas              # Listar turmas
GET    /api/v1/notas               # Listar notas
POST   /api/v1/ocorrencias         # Criar ocorrência
GET    /api/v1/comunicados         # Listar comunicados
GET    /api/v1/relatorios          # Gerar relatórios
```

---

## ⚙️ Variáveis de Ambiente Importantes

### Backend (.env)
```env
FLASK_DEBUG=1
DATABASE_URL=postgresql://postgres:password@postgres:5432/colabora_edu
REDIS_URL=redis://redis:6379/0
SECRET_KEY=sua_chave_secreta
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

---

**Última atualização:** 2026-01-13  
**Versão:** 0.2.0
