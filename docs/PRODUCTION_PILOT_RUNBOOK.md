# Runbook de Produção Piloto

Este runbook transforma o plano de go-live em uma sequência executável para
liberar o ColaboraEdu primeiro em piloto controlado.

## 1. Release candidate

1. Congele o estado aprovado em branch/tag, por exemplo:
   `release/piloto-YYYY-MM-DD`.
2. Garanta que o worktree está limpo antes de taguear.
3. Rode os gates do RC:

```bash
./scripts/release-candidate-check.sh
```

Para validação local com mudanças ainda não commitadas:

```bash
ALLOW_DIRTY=1 ./scripts/release-candidate-check.sh
```

Se o ambiente local estiver sem rede para o npm registry, use apenas para ensaio
do encadeamento local:

```bash
ALLOW_DIRTY=1 RUN_FRONTEND_AUDIT=none RUN_MOBILE_AUDIT=none ./scripts/release-candidate-check.sh
```

No servidor ou CI com `.env` real:

```bash
PROD_ENV_FILE=.env ./scripts/release-candidate-check.sh
```

O piloto web/backend aceita a auditoria mobile em nível `high`, porque o audit
moderado restante depende de upgrade quebrador de Expo/React Native. Para uma
release mobile, rode:

```bash
RUN_MOBILE_AUDIT=moderate ./scripts/release-candidate-check.sh
```

## 2. Servidor e secrets

1. Rotacione credenciais expostas ou suspeitas, especialmente SSH.
2. Configure SSH apenas por chave e firewall com entrada pública somente em
   80/443.
3. Crie o `.env` real de produção no servidor.
4. Valide:

```bash
./scripts/prod-preflight.sh
docker compose -f docker-compose.prod.yml config --quiet
```

Se usar `scripts/setup-hetzner.sh`, ele já gera `SECRET_KEY`,
`JWT_SECRET_KEY`, `ENCRYPTION_KEY` e `BACKUP_ENCRYPTION_KEY`.

## 3. Staging e restore drill

1. Suba staging com o compose de produção.
2. Rode migrations:

```bash
docker compose -f docker-compose.prod.yml exec -T backend flask --app app db upgrade
```

3. Crie dados mínimos de teste: tenant ativo, super-admin, admin, aluno, turma e
   notas.
4. Confirme backup criptografado e restaure em ambiente limpo.
5. Registre a evidência em uma cópia de
   `docs/RESTORE_DRILL_EVIDENCE_TEMPLATE.md`.

Sem restore drill aprovado, não liberar produção ampla.

## 4. Deploy piloto

```bash
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans --scale worker=3
docker compose -f docker-compose.prod.yml exec -T backend flask --app app db upgrade
./scripts/smoke-rq-worker.sh
BASE_URL=https://SEU_DOMINIO ./scripts/production-http-smoke.sh
```

Para smoke autenticado:

```bash
SMOKE_SUPERADMIN_USER=... \
SMOKE_SUPERADMIN_PASSWORD=... \
SMOKE_TENANT_SLUG=... \
BASE_URL=https://SEU_DOMINIO \
./scripts/production-http-smoke.sh
```

## 5. Monitoramento do piloto

- Configure uptime externo para `/`, `/health` e `/api/v1/auth/tenants`.
- Configure Sentry backend/frontend se houver DSN definitivo.
- Monitore fila RQ e falhas de backup diariamente.
- Revise logs diariamente nos primeiros 5 dias úteis.

## 6. Go/no-go para produção ampla

Produção ampla só é permitida quando:

- piloto rodou por pelo menos 5 dias úteis sem incidente P0;
- CI está verde;
- smoke autenticado passa;
- backup criptografado diário existe;
- restore drill é repetível e registrado;
- credenciais expostas foram rotacionadas;
- LGPD foi revisada;
- responsáveis por incidente, suporte, deploy e backup estão definidos.
