# Plano de Go-Live em Produção

Data de referência: 2026-06-01

## Objetivo

Levar o ColaboraEdu para produção com segurança operacional mínima: deploy reproduzível, segredos rotacionados, backups restauráveis, observabilidade protegida, CI verde e rollback praticável.

Runbook executável: `docs/PRODUCTION_PILOT_RUNBOOK.md`.

## Estado atual

O sistema está apto para piloto controlado, mas ainda não deve entrar em produção ampla sem concluir os gates abaixo.

Itens críticos já tratados no código:
- segredo SSH removido do repositório de trabalho;
- `/metrics` protegido por JWT com papel `super_admin`;
- backups locais obrigatoriamente criptografados com `BACKUP_ENCRYPTION_KEY`;
- preflight de produção validando segredos mínimos, CORS HTTPS e dependências opcionais;
- documentação de autenticação alinhada ao comportamento real de refresh token web/mobile;
- frontend sem vulnerabilidades npm conhecidas no audit moderado;
- backend com lint e testes completos passando localmente;
- `scripts/release-candidate-check.sh` consolida os gates de RC;
- `scripts/production-http-smoke.sh` valida frontend, health, tenant discovery, endpoints protegidos e fluxo autenticado quando credenciais de smoke existem.

## Bloqueadores antes do go-live

### P0 — Segurança e acesso

- Rotacionar/revogar a credencial SSH que já apareceu em `install_key.py`.
- Confirmar que o servidor aceita login apenas por chave SSH, sem senha.
- Remover qualquer cópia antiga do repositório que ainda contenha o segredo exposto.
- Validar firewall: expor somente 80/443 e bloquear acesso direto a Postgres, Redis, backend e Uptime Kuma.
- Garantir que `SECRET_KEY`, `JWT_SECRET_KEY`, `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `REDIS_PASSWORD` e `BACKUP_ENCRYPTION_KEY` foram gerados com entropia real e não reutilizados.

### P0 — Backup e recuperação

- Executar restore drill real em ambiente limpo seguindo `docs/RESTORE_DRILL_RUNBOOK.md`.
- Registrar evidências usando `docs/RESTORE_DRILL_EVIDENCE_TEMPLATE.md`: arquivo restaurado, horário do backup, tempo de restauração, commit implantado e resultado de smoke test.
- Configurar destino externo de backup, preferencialmente S3-compatible, ou documentar formalmente o risco de manter apenas backup local.
- Testar restauração de backup `.gpg` com `BACKUP_ENCRYPTION_KEY` real.

### P0 — CI/CD

- Confirmar GitHub Actions verde em `main`.
- Confirmar que o job `Security — Secret Scan` passa no CI.
- Rodar `./scripts/release-candidate-check.sh` na branch/tag de release candidate.
- Configurar segredos do ambiente `production`: `SSH_PRIVATE_KEY`, `SERVER_HOST`, `SERVER_USER`, `SERVER_PATH` e `DOMAIN`.
- Configurar smoke autenticado se houver conta de teste: `SMOKE_SUPERADMIN_USER`, `SMOKE_SUPERADMIN_PASSWORD`, `SMOKE_TENANT_SLUG`.
- Validar que `./scripts/prod-preflight.sh` passa no servidor com o `.env` real.

### P0 — Banco e migrações

- Rodar `flask --app app db upgrade` no ambiente de staging/produção antes do tráfego real.
- Confirmar que a versão de migration aparece em `/health`.
- Criar procedimento de rollback de migration para mudanças destrutivas futuras.

## Pendências P1

- Configurar monitoramento externo de uptime para `/`, `/health` e `/api/v1/auth/tenants`.
- Configurar scraper de `/metrics` com `Authorization: Bearer <token super_admin>`.
- Definir rotação periódica dos tokens usados por monitoramento.
- Configurar Sentry para backend/frontend se houver DSN definitivo.
- Configurar SMTP real e testar fluxo de recuperação de senha ponta a ponta.
- Definir política de retenção de logs e backups.
- Fazer teste de carga leve nos fluxos de dashboard, login, upload e importação.
- Revisar LGPD: base legal, consentimento, retenção, acesso administrativo e processo de exclusão/correção.

## Pendências P2

- Resolver vulnerabilidade moderada transitiva do Expo (`uuid <11.1.1`) quando houver caminho de upgrade seguro.
- Elevar cobertura automatizada nas áreas de IA, comunicação, billing e relatórios.
- Adicionar MFA para super-admin.
- Criar painel administrativo para status de filas, jobs e últimos backups.
- Automatizar restore drill periódico.

## Gates de go/no-go

Go-live permitido somente se:
- CI `main` estiver verde;
- `prod-preflight.sh` passar no servidor;
- `docker compose -f docker-compose.prod.yml config --quiet` passar com `.env` real;
- deploy subir com `--scale worker=3`;
- `/health` retornar banco e Redis `ok`;
- smoke de frontend, tenant discovery, login real e `/metrics` autenticado passar;
- primeiro backup criptografado for criado e validado;
- restore drill tiver sido concluído com sucesso;
- credencial SSH exposta tiver sido rotacionada;
- rollback tiver sido testado ou documentado com responsável e janela de atuação.

No-go automático se:
- qualquer segredo real aparecer no Git;
- backup criptografado falhar;
- Redis estiver indisponível em produção;
- migrations falharem;
- CI reportar vulnerabilidade alta/crítica sem exceção aprovada;
- smoke autenticado falhar.

## Sequência recomendada

### Dia 0 — Preparação

1. Rotacionar credenciais expostas.
2. Revisar `.env` real com `scripts/prod-preflight.sh`.
3. Configurar segredos GitHub Actions.
4. Confirmar CI verde.

### Dia 1 — Staging/Drill

1. Subir ambiente limpo com compose de produção.
2. Executar migrations.
3. Rodar `BASE_URL=https://staging.example.com ./scripts/production-http-smoke.sh`.
4. Criar backup criptografado.
5. Restaurar backup em ambiente limpo.
6. Registrar evidências do drill.

### Dia 2 — Produção piloto

1. Executar deploy manual via GitHub Actions.
2. Validar `/`, `/health`, tenant discovery, login e fila RQ com `scripts/smoke-rq-worker.sh` e `scripts/production-http-smoke.sh`.
3. Confirmar primeiro backup criptografado.
4. Ativar monitoramento externo.
5. Liberar acesso para grupo piloto.

### Semana 1 — Acompanhamento

1. Revisar logs diariamente.
2. Conferir backups diários e espaço em disco.
3. Revisar erros Sentry/servidor.
4. Registrar feedback dos usuários piloto.
5. Decidir expansão ou nova rodada de correções.

## Critérios para produção ampla

- Piloto sem incidentes P0 por pelo menos 5 dias úteis.
- Restore drill repetível e documentado.
- Monitoramento e alertas operacionais funcionando.
- Responsáveis definidos para incidentes, backup, deploy e suporte.
- Plano de comunicação com escolas/usuários aprovado.
