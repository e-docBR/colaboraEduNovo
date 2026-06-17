# Evidência de Restore Drill - 2026-06-17

## Identificação

- Data do drill: 2026-06-17
- Responsável: suporte / Codex
- Ambiente: servidor de produção piloto, restauração em Postgres temporário isolado
- Commit implantado: `a12a916` com ajustes operacionais aplicados no servidor; correções versionadas no commit local de estabilização de produção
- Janela executada: 12:39-12:41 America/Sao_Paulo

## Backup restaurado

- Arquivo: `/backups/backup_20260617_152558.sql.gz.gpg`
- Origem: volume local Docker `colaboraedunovo_pgbackups`
- Tamanho: 5117 bytes
- Data/hora do backup: 2026-06-17 15:25:58 UTC
- Criptografado com GPG: sim, AES256
- Validação do arquivo:
  - `gpg --decrypt`: passou
  - `gzip -t`: passou por descompressão no pipeline de restore

## Restauração

- Comando usado: restore em container temporário `postgres:15-alpine`, descriptografando pelo container `pgbackup` e restaurando via `psql`
- Banco alvo: Postgres temporário `colabora_restore_postgres`
- Início: 2026-06-17T12:40:38-03:00
- Duração total: 1 segundo para carga SQL
- Migrações executadas: não aplicável; backup já continha schema migrado
- Versão Alembic após restore: `464576e87da1`

## Smoke pós-restore

- `GET /`: passou no ambiente piloto público
- `GET /health`: passou no ambiente piloto público
- Banco em `/health`: ok
- Redis em `/health`: ok
- `GET /api/v1/auth/tenants`: passou no ambiente piloto público
- Login real: não aplicável; credenciais de `super_admin` não fornecidas para o smoke autenticado
- Fila RQ: passou com job real na fila `default`

## Amostras de dados

- Total de tenants: 1
- Total de usuários: 0
- Total de alunos: 0
- Total de turmas: tabela não presente no backup inicial
- Total de notas: não coletado

## Achados

- Problemas encontrados:
  - O primeiro restore temporário precisou aguardar o restart final do entrypoint oficial do Postgres.
  - O restore em banco limpo precisa criar previamente os roles usados pelo dump para evitar erros de ownership.
- Correções aplicadas:
  - Restore drill repetido aguardando `select 1` no banco final.
  - Roles temporárias criadas antes da restauração.
- Riscos remanescentes:
  - Backup externo S3-compatible ainda não configurado.
  - Smoke autenticado ainda pendente.
  - Restore drill com aplicação completa apontando para banco restaurado ainda não executado.

## Decisão

- Resultado: aprovado para piloto controlado
- Aprovador: pendente
- Próxima data planejada: antes da produção ampla
