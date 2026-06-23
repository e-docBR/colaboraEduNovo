# Mobile — ColaboraEdu Família

Cliente Expo/React Native para acesso mobile de alunos e responsáveis.

O app é focado em acompanhamento familiar: boletim, faltas, ocorrências,
comunicados e perfil. Perfis administrativos devem continuar usando o painel web.

## Setup
```bash
cd mobile
npm install --include=dev
cp .env.example .env
```

Configure `EXPO_PUBLIC_API_URL` para a API local/staging antes de testar. A URL
muda conforme o lugar onde o app será aberto:

### Navegador no Windows acessando Metro no WSL

Use o IP do WSL, porque `10.0.2.2` é específico do emulador Android:

```bash
hostname -I
```

Exemplo:

```env
EXPO_PUBLIC_API_URL=http://172.24.6.186:5000/api/v1
EXPO_PUBLIC_TENANT_SLUG=default
```

### Emulador Android do Android Studio

Para emulador Android apontando para backend local:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1
EXPO_PUBLIC_TENANT_SLUG=default
```

### Celular físico na mesma rede

Use o IP acessível do computador/WSL na rede:

```env
EXPO_PUBLIC_API_URL=http://IP_DA_MAQUINA:5000/api/v1
EXPO_PUBLIC_TENANT_SLUG=default
```

## Execução
```bash
npm run start
```

Para navegador/emulador/celular:

```bash
EXPO_PUBLIC_API_URL=http://URL_CORRETA:5000/api/v1 EXPO_PUBLIC_TENANT_SLUG=default npm run start -- --host lan
```

## Build Android

O app não deve ser publicado apontando para localhost. Configure
`EXPO_PUBLIC_API_URL` via `.env` local ou EAS antes de gerar builds.

```bash
npm run build:android:preview
npm run build:android:production
```

Veja o checklist de publicação em [PLAY_STORE.md](./PLAY_STORE.md).
Para o processo completo, use [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md).

## Validação
```bash
make validate-mobile
```

Se `mobile/node_modules` ainda não existir, o script de validação monta uma cópia temporária e instala as dependências só para typecheck.
O roteiro manual de homologação está em [QA_TEST_PLAN.md](./QA_TEST_PLAN.md).

Smoke test local da API usada pelo app família:

```bash
docker compose up -d postgres redis
make backend
scripts/mobile_family_smoke.py
```

Credenciais locais usadas pelo smoke:

- Aluno: `aluno900001` / `900001`
- Responsável: `resp_900001` / `900001`

## Auth
- O app envia `X-Client-Platform: mobile`.
- Login usa `/api/v1/auth/login`.
- Listagem pública de tenants usa `/api/v1/auth/tenants`.
- Refresh usa `Authorization: Bearer <refresh_token>`.
- Troca de senha temporária usa `/api/v1/auth/change-password`.
- `aluno` consulta `/api/v1/alunos/me`.
- `responsavel` consulta `/api/v1/responsavel/meu-filho`.
