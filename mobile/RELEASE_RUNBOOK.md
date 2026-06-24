# Runbook de Release Android — ColaboraEdu Família

## 1. Preparação

1. Confirmar workspace limpo:

```bash
git status --short
```

2. Confirmar que existe apenas uma versão do React Native:

```bash
npm ls react-native --prefix mobile
```

O resultado esperado é somente `react-native@0.81.5`. Não seguir com build se
aparecer `react-native@0.86.x` aninhado.

3. Validar TypeScript do app:

```bash
make validate-mobile
```

4. Validar API oficial e tenant de produção:

```bash
make mobile-release-preflight
```

5. Confirmar configuração Android/Play Store:

```bash
make mobile-store-readiness
```

A checagem pode emitir avisos sem bloquear o build. Antes da publicação final,
tratar avisos relacionados a assets de loja, especialmente arquivos `.png` que
estejam codificados como JPEG.

6. Confirmar configuração Expo:

```bash
cd mobile
npx expo config --type public
```

7. Conferir no resultado:

- `name`: ColaboraEdu Família
- `slug`: colaboraedu-familia
- `android.package`: cloud.colaboraedu.familia
- `android.versionCode`: número maior que a versão já enviada à Play Store

8. Confirmar export Android local antes do APK:

```bash
cd mobile
EXPO_PUBLIC_API_URL=https://gestao.colaboraedu.cloud/api/v1 EXPO_PUBLIC_TENANT_SLUG=colegio-frei-ronaldo npx expo export --platform android --output-dir /tmp/colaboraedu-mobile-export
```

## 2. Configurar ambiente EAS

Os perfis `preview` e `production` em `eas.json` já apontam para a API oficial:

- `EXPO_PUBLIC_API_URL=https://gestao.colaboraedu.cloud/api/v1`
- `EXPO_PUBLIC_TENANT_SLUG=colegio-frei-ronaldo`

Use `preview` para APK interno com dados reais. Use `production` apenas para AAB
de Play Store depois do QA aprovado.

Antes do build, confirme:

```bash
curl https://gestao.colaboraedu.cloud/health
curl https://gestao.colaboraedu.cloud/api/v1/auth/tenants
```

O tenant esperado é `Colégio Frei Ronaldo` com slug `colegio-frei-ronaldo`.

## 3. APK interno para teste manual

### Login Expo/EAS no WSL

No WSL, o login por navegador pode travar porque o callback `localhost` abre no
Windows. O caminho mais estável é usar um token de acesso Expo:

1. Acesse `https://expo.dev/accounts/[sua-conta]/settings/access-tokens`.
2. Crie um token para build, por exemplo `colaboraedu-wsl-build`.
3. No terminal do WSL, exporte o token somente para a sessão atual:

```bash
export EXPO_TOKEN=seu_token_aqui
npx eas-cli whoami
```

O comando `whoami` precisa mostrar o usuário/organização Expo antes de seguir.

```bash
cd mobile
npm run build:android:preview
```

Ou, a partir da raiz do projeto, use o alvo completo:

```bash
make mobile-build-preview
```

Após o build:

- Baixar o APK no painel EAS.
- Instalar em pelo menos dois celulares.
- Executar o roteiro de `QA_TEST_PLAN.md`.
- Registrar evidências: aparelho, Android, usuário testado, resultado e prints.
- Confirmar no app que a escola padrão é `Colégio Frei Ronaldo`.
- Confirmar login com usuário real de aluno e responsável.

## 4. AAB para Play Store

Antes de gerar AAB:

- QA aprovado.
- URL de API confirmada.
- Política de privacidade publicada.
- Screenshots prontos.
- Conta Play Console disponível.

Gerar AAB:

```bash
make mobile-build-production
```

## 5. Teste interno/fechado na Play Store

1. Entrar no Google Play Console.
2. Criar app com o pacote `cloud.colaboraedu.familia`.
3. Enviar o AAB.
4. Selecionar trilha `Teste interno` ou `Teste fechado`.
5. Adicionar testadores autorizados.
6. Usar metadados de `STORE_LISTING.md`.
7. Publicar somente para testadores.

## 6. Critérios para promover publicação

- Pelo menos dois aparelhos testados.
- Login de aluno aprovado.
- Login de responsável aprovado.
- Troca de senha aprovada.
- Perfis administrativos bloqueados.
- Boletim, registros e perfil aprovados.
- Nenhuma falha de privacidade ou acesso indevido.

## 7. Rollback

Se houver erro crítico no teste fechado:

- Suspender nova distribuição da versão no Play Console.
- Corrigir localmente.
- Incrementar `android.versionCode` em `app.json`.
- Gerar novo AAB.
- Reenviar para a mesma trilha de teste.
