# Mobile — Plataforma Boletins Frei

Cliente Expo/React Native para acesso mobile.

## Setup
```bash
cd mobile
npm install --include=dev
```

## Execução
```bash
npm run start
```

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
