# Frontend — Plataforma Boletins Frei

SPA React + Vite para operação administrativa e acadêmica.

## Setup
Instale dependências com devDependencies incluídas. Sem isso, `tsc`, `vite` e `eslint` não ficam disponíveis localmente.

```bash
cd frontend
npm install --include=dev
```

## Execução
```bash
npm run dev
```

## Validação
```bash
make validate-frontend
```

O projeto depende dos binários locais em `frontend/node_modules/.bin`. Se `npm run lint` cair num ESLint global ou `npm run build` disser `tsc: not found`, a instalação está incompleta.

O repositório agora também tem fallback em workspace temporário via `make validate-frontend`, útil quando `node_modules` local estiver com ownership incorreto ou incompleto.

## Auth/Cookies
O web usa `credentials: "include"` e espera o refresh token no cookie HttpOnly emitido pelo backend.
