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
make mobile-build-preview
```

Esse comando executa typecheck, preflight da API/tenant reais, checagem local de
prontidão Play Store, valida login EAS e então inicia o build `preview`.

Para gerar AAB de Play Store após homologação:

```bash
make mobile-build-production
```

O AAB deve ser gerado somente depois de o APK `preview` estar aprovado em teste
manual. O alvo `mobile-build-production` usa o perfil EAS `production`, que gera
`app-bundle` para envio ao Google Play Console.

## Checagem local de prontidão

Antes de abrir uma nova versão na loja, rode:

```bash
make mobile-store-readiness
```

Ela confere nome, slug, pacote Android, versão, scripts de build, ambiente EAS
de produção e imagens declaradas em `app.json`.

Status atual conhecido:

- Configuração Android/EAS: OK.
- API real e tenant: OK via `make mobile-release-preflight`.
- Ícone/splash/adaptive icon: dimensões OK, mas os arquivos estão com extensão
  `.png` e conteúdo JPEG. O APK já foi gerado assim, porém antes da publicação
  final é recomendado substituir por PNG real mantendo a mesma identidade visual.

## Checklist antes do teste fechado

Use o roteiro detalhado em [QA_TEST_PLAN.md](./QA_TEST_PLAN.md).

## Materiais necessários para a loja

- Ícone final PNG em alta resolução.
- Adaptive icon PNG.
- Splash icon PNG.
- Screenshots de login, início, boletim, registros e perfil.
- Política de privacidade publicada em URL pública.
- Conta Google Play Console.
- Lista de testadores internos/fechados.

## Sequência recomendada agora

1. Rodar `make mobile-build-preview`.
2. Instalar o APK em pelo menos dois aparelhos Android.
3. Preencher evidências do roteiro de [QA_TEST_PLAN.md](./QA_TEST_PLAN.md).
4. Corrigir qualquer problema visual ou funcional encontrado.
5. Substituir imagens `.png` que ainda estejam codificadas como JPEG.
6. Rodar `make mobile-build-production`.
7. Enviar o AAB para a trilha de teste interno no Play Console.

## Documentos relacionados

- [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md)
- [STORE_LISTING.md](./STORE_LISTING.md)
- [PRIVACY_POLICY_DRAFT.md](./PRIVACY_POLICY_DRAFT.md)
