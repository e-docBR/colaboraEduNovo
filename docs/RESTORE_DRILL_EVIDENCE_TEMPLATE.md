# Evidência de Restore Drill

Use uma cópia deste template para cada simulação real de restauração.

## Identificação

- Data do drill:
- Responsável:
- Ambiente:
- Commit implantado:
- Janela executada:

## Backup restaurado

- Arquivo:
- Origem: local / S3 / outro
- Tamanho:
- Data/hora do backup:
- Criptografado com GPG: sim / não
- Validação do arquivo:
  - `gpg --decrypt`: passou / falhou / não aplicável
  - `gzip -t`: passou / falhou

## Restauração

- Comando usado:
- Banco alvo:
- Início:
- Fim:
- Duração total:
- Migrações executadas:
- Versão Alembic após restore:

## Smoke pós-restore

- `GET /`: passou / falhou
- `GET /health`: passou / falhou
- Banco em `/health`: ok / falhou
- Redis em `/health`: ok / falhou
- `GET /api/v1/auth/tenants`: passou / falhou
- Login real: passou / falhou / não aplicável
- Fila RQ: passou / falhou

## Amostras de dados

- Total de tenants:
- Total de usuários:
- Total de alunos:
- Total de turmas:
- Total de notas:

## Achados

- Problemas encontrados:
- Correções aplicadas:
- Riscos remanescentes:

## Decisão

- Resultado: aprovado / reprovado
- Aprovador:
- Próxima data planejada:
