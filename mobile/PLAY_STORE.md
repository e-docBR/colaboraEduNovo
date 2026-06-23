# Play Store — ColaboraEdu Família

## Identidade

- Nome do app: ColaboraEdu Família
- Pacote Android: `cloud.colaboraedu.familia`
- Público inicial: alunos e responsáveis do Colégio Frei Ronaldo
- Distribuição inicial: teste interno/fechado

## Descrição curta

Acompanhe boletim, faltas, ocorrências e comunicados escolares pelo celular.

## Descrição completa

O ColaboraEdu Família aproxima escola, estudantes e responsáveis. Pelo aplicativo,
alunos e famílias podem consultar boletim escolar, faltas, ocorrências, recados
e informações importantes da vida escolar.

O acesso é individual e protegido por senha. No primeiro acesso, usuários com
senha temporária devem criar uma nova senha.

## Configuração de build

Os perfis EAS já declaram as variáveis públicas usadas no build:

- `EXPO_PUBLIC_API_URL=https://gestao.colaboraedu.cloud/api/v1`
- `EXPO_PUBLIC_TENANT_SLUG=colegio-frei-ronaldo`

O perfil `preview` gera APK para instalação manual/teste interno com dados reais.
O perfil `production` gera AAB para envio à Play Store, também apontando para a
API oficial. Não promover para público aberto antes do QA fechado.

Validação feita em produção:

- `https://gestao.colaboraedu.cloud/health` retornou `status=ok`.
- `/api/v1/auth/tenants` retornou `Colégio Frei Ronaldo` com slug
  `colegio-frei-ronaldo`.

Para build de teste interno em APK:

```bash
npm run build:android:preview
```

Para gerar AAB de Play Store após homologação:

```bash
npm run build:android:production
```

## Checklist antes do teste fechado

Use o roteiro detalhado em [QA_TEST_PLAN.md](./QA_TEST_PLAN.md).

## Materiais necessários para a loja

- Ícone final em alta resolução.
- Screenshots de login, início, boletim, registros e perfil.
- Política de privacidade publicada em URL pública.
- Conta Google Play Console.
- Lista de testadores internos/fechados.

## Documentos relacionados

- [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md)
- [STORE_LISTING.md](./STORE_LISTING.md)
- [PRIVACY_POLICY_DRAFT.md](./PRIVACY_POLICY_DRAFT.md)
