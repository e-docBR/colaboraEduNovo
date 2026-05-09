# Frontend — Plataforma Boletins Frei

SPA em React + Vite inspirada nas especificações de `prompt.md`. Inclui layout com sidebar, dashboard de KPIs e páginas stub para Alunos, Turmas, Notas, Gráficos, Relatórios e Login.

## Scripts
```bash
pnpm install   # ou npm/yarn
pnpm dev       # inicia em http://localhost:5173
pnpm build     # build de produção
pnpm preview   # preview do build
```

> **Importante:** para que o login funcione fora do `pnpm dev` (onde o proxy do Vite encaminha `/api` para o Flask), informe a URL real do backend em um `.env`:

```
cp .env.example .env
# edite conforme necessário
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Com isso o bundle em `dist/` apontará diretamente para o Flask e o POST `/auth/login` não retornará `ERR_CONNECTION_REFUSED`.

## Estrutura
```
src/
  app/         # router, store
  components/  # navegação, widgets compartilhados
  features/    # páginas por domínio
  layouts/     # shells e templates
  theme/       # tokens e tema MUI
```

## Funcionalidades
- **Dashboard**: KPIs e gráficos de desempenho.
- **Perfil**: Alteração de senha e upload de foto de perfil.
- **Gestão**: Visualização de alunos, turmas e notas.

## Próximos Passos
- Conectar RTK Query aos endpoints Flask.
- Implementar guardas reais de autenticação.
- Alimentar dashboards com dados da API.
- Completar formulários e fluxos CRUD.
```
