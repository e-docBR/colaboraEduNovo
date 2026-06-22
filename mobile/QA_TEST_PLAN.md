# Plano de Testes — ColaboraEdu Família Android

## Objetivo

Validar a primeira versão Android para alunos e responsáveis antes de liberar
teste interno/fechado na Play Store.

## Ambientes

- Desenvolvimento local: `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1`
- Staging/homologação: usar URL pública de API de testes
- Produção: somente após autorização explícita

## Checagens automatizadas antes do teste manual

- `npm ls react-native --prefix mobile`
- `make validate-mobile`
- `npm run lint --prefix mobile`
- `npx expo config --type public`
- `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1 EXPO_PUBLIC_TENANT_SLUG=colegio-frei-ronaldo npx expo export --platform android --output-dir /tmp/colaboraedu-mobile-export`

O comando `npm ls react-native --prefix mobile` deve mostrar somente
`react-native@0.81.5`. Se aparecer outra versão aninhada, especialmente
`0.86.x`, o bundle Android pode falhar.

## Massa mínima de teste

- 1 usuário `aluno` com senha temporária.
- 1 usuário `aluno` com senha já alterada.
- 1 usuário `responsavel` no padrão `resp_<matricula>`.
- 1 usuário administrativo para confirmar bloqueio.
- 1 aluno sem notas.
- 1 aluno com notas, faltas, comunicados e ocorrências.

## Roteiro obrigatório

### Login e Segurança

- Entrar com usuário aluno e senha temporária.
- Confirmar redirecionamento para troca de senha.
- Trocar senha usando regra forte: 8 caracteres, maiúscula, número e especial.
- Sair e entrar novamente com a nova senha.
- Tentar entrar como professor/admin e confirmar bloqueio.
- Fechar o app, abrir novamente e confirmar sessão restaurada.
- Simular sessão expirada e confirmar retorno ao login.

### Portal do Aluno

- Confirmar que o aluno vê somente os próprios dados.
- Conferir nome, matrícula, turma, turno e média geral.
- Conferir boletim com disciplinas, trimestres, total, faltas e situação.
- Confirmar estado vazio quando não houver notas.
- Confirmar que rotas antigas `/aluno/:id` redirecionam para início.

### Portal do Responsável

- Entrar com `resp_<matricula>`.
- Confirmar que aparece apenas o estudante vinculado.
- Conferir boletim, registros e comunicados do filho.
- Confirmar que comunicados não lidos aparecem como novos.
- Abrir comunicado e confirmar marcação como lido quando a API aceitar.

### Registros

- Validar lista vazia de comunicados.
- Validar lista com comunicados.
- Validar lista vazia de ocorrências.
- Validar ocorrência aberta e resolvida.
- Conferir exibição de `observacao_pais` quando existir.

### Conectividade

- Abrir o app sem internet.
- Tentar atualizar telas sem conexão.
- Reativar internet e puxar para atualizar.
- Testar em Wi-Fi e rede móvel.

## Aparelhos mínimos

- Android pequeno, tela de até 6".
- Android médio/grande, tela acima de 6".
- Preferir pelo menos um aparelho com Android 10 ou 11 e outro com Android atual.

## Critérios de aprovação

- Nenhum perfil administrativo acessa o app família.
- Aluno e responsável não acessam dados de outros estudantes.
- Todas as telas principais carregam com dados e sem dados.
- O app retorna ao login em sessão expirada.
- O APK/AAB não aponta para localhost.
- Não há erro TypeScript em `make validate-mobile`.
