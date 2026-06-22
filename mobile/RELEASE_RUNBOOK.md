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

4. Confirmar configuração Expo:

```bash
cd mobile
npx expo config --type public
```

5. Conferir no resultado:

- `name`: ColaboraEdu Família
- `slug`: colaboraedu-familia
- `android.package`: cloud.colaboraedu.familia
- `android.versionCode`: número maior que a versão já enviada à Play Store

6. Confirmar export Android local antes do APK:

```bash
cd mobile
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1 EXPO_PUBLIC_TENANT_SLUG=colegio-frei-ronaldo npx expo export --platform android --output-dir /tmp/colaboraedu-mobile-export
```

## 2. Configurar ambiente EAS

Preview/staging:

```bash
cd mobile
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://SUA_API_STAGING/api/v1
```

Produção, somente quando autorizado:

```bash
cd mobile
npx eas-cli env:create --environment production --name EXPO_PUBLIC_API_URL --value https://gestao.colaboraedu.cloud/api/v1
```

## 3. APK interno para teste manual

```bash
cd mobile
npm run build:android:preview
```

Após o build:

- Baixar o APK no painel EAS.
- Instalar em pelo menos dois celulares.
- Executar o roteiro de `QA_TEST_PLAN.md`.
- Registrar evidências: aparelho, Android, usuário testado, resultado e prints.

## 4. AAB para Play Store

Antes de gerar AAB:

- QA aprovado.
- URL de API confirmada.
- Política de privacidade publicada.
- Screenshots prontos.
- Conta Play Console disponível.

Gerar AAB:

```bash
cd mobile
npm run build:android:production
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
