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

Configure `EXPO_PUBLIC_API_URL` para a API local/staging antes de testar. Para
emulador Android apontando para backend local, use:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1
```

## Execução
```bash
npm run start
```

## Build Android

O app não deve ser publicado apontando para localhost. Configure
`EXPO_PUBLIC_API_URL` via `.env` local ou EAS antes de gerar builds.

```bash
npm run build:android:preview
npm run build:android:production
```

Veja o checklist de publicação em [PLAY_STORE.md](./PLAY_STORE.md).

## Validação
```bash
make validate-mobile
```

Se `mobile/node_modules` ainda não existir, o script de validação monta uma cópia temporária e instala as dependências só para typecheck.

## Auth
- O app envia `X-Client-Platform: mobile`.
- Login usa `/api/v1/auth/login`.
- Listagem pública de tenants usa `/api/v1/auth/tenants`.
- Refresh usa `Authorization: Bearer <refresh_token>`.
- Troca de senha temporária usa `/api/v1/auth/change-password`.
- `aluno` consulta `/api/v1/alunos/me`.
- `responsavel` consulta `/api/v1/responsavel/meu-filho`.
