# Restore Drill Runbook

Use este procedimento em um ambiente limpo de staging/drill, nunca direto no banco de produção sem janela aprovada.

## Objetivo

Validar que um backup PostgreSQL recente pode ser restaurado, migrado e servido pela aplicação com Redis/RQ funcional.

Registre o resultado usando `docs/RESTORE_DRILL_EVIDENCE_TEMPLATE.md`.

## Pré-requisitos

- servidor limpo com Docker e Docker Compose;
- `.env` realista para o ambiente de drill;
- arquivo `backup_*.sql.gz` copiado para o servidor;
- domínio ou rota interna apontando para o ambiente restaurado.

## Procedimento

1. Validar configuração:

```bash
./scripts/prod-preflight.sh
docker compose -f docker-compose.prod.yml config --quiet
gzip -t /caminho/backup_YYYYMMDD_HHMMSS.sql.gz
```

2. Restaurar o banco:

```bash
COMPOSE_FILE=docker-compose.prod.yml WORKER_SCALE=1 \
  ./scripts/restore-postgres-backup.sh /caminho/backup_YYYYMMDD_HHMMSS.sql.gz
```

3. Subir a superfície completa do ambiente:

```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=1 frontend backend worker pgbackup
```

4. Validar saúde HTTP e dependências:

```bash
curl -fsS https://SEU_DOMINIO/health
curl -fsS https://SEU_DOMINIO/api/v1/auth/tenants
./scripts/smoke-rq-worker.sh
```

5. Validar login e leitura de dados:

- login com usuário de smoke ou superadmin do drill;
- abrir alunos, turmas, notas e comunicados;
- gerar um relatório ou boletim;
- confirmar que nenhum erro aparece nos logs de `backend` e `worker`.

## Evidência mínima

Registrar em um ticket ou ata:

- data/hora do backup usado;
- tempo total de restauração;
- resultado de `/health`;
- resultado de `scripts/smoke-rq-worker.sh`;
- usuário/tenant usado no login de smoke;
- falhas encontradas e ações corretivas.

## Critério de aprovação

O drill é aprovado quando o banco restaura sem erro, migrações aplicam, health retorna `database=ok` e `redis=ok`, o job RQ de smoke é processado, e um usuário consegue acessar dados esperados no frontend.
