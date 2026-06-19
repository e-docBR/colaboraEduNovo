# Referência da API — ColaboraEdu

## Base URL

```
https://{seu-dominio}/api/v1
```

Em desenvolvimento: `http://localhost:5000/api/v1`

Endpoint de observabilidade fora do prefixo versionado:
- `GET /metrics` expõe métricas Prometheus e requer JWT com papel `super_admin`.

---

## Autenticação

A API usa JWT Bearer tokens. Inclua o header em todas as requisições autenticadas:

```
Authorization: Bearer {access_token}
```

O `access_token` expira em 30 minutos. Use `POST /auth/refresh` para renová-lo silenciosamente. No cliente web, o refresh token fica em cookie HttpOnly `rt`; no cliente mobile/nativo, ele é retornado no body e pode ser enviado no body ou em `Authorization`.

---

## Endpoints

### Autenticação

#### `POST /auth/login`

Autentica um usuário e retorna tokens JWT.

**Público** (não requer autenticação)

**Body:**
```json
{
  "username": "admin",
  "password": "SenhaSegura123",
  "tenant_slug": "escola-central"
}
```

> `tenant_slug` é opcional para super-admin (login sem tenant).

**Resposta 200 — web:**
```json
{
  "access_token": "eyJ...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "tenant_id": 1,
    "must_change_password": false
  }
}
```

> No web, o backend também define o cookie HttpOnly `rt` em `/api/v1/auth`.

**Resposta 200 — mobile/nativo (`X-Client-Platform: mobile`):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "tenant_id": 1,
    "must_change_password": false
  }
}
```

**Erros:** `401` credenciais inválidas, `422` dados inválidos

---

#### `POST /auth/refresh`

Renova o access token usando o refresh token e rotaciona o refresh token usado.

**Web:** envie a requisição com credenciais/cookies para que o cookie HttpOnly `rt` seja usado.

**Mobile/nativo:** envie `{ "refresh_token": "eyJ..." }` no body ou `Authorization: Bearer {refresh_token}` com o header `X-Client-Platform: mobile`.

**Resposta 200:**
```json
{
  "access_token": "eyJ...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

> No web, a resposta também atualiza o cookie HttpOnly `rt`. No mobile/nativo, a resposta inclui um novo `refresh_token`.

**Erros:** `401` token inválido ou revogado

---

#### `POST /auth/logout`

Revoga os tokens do usuário atual (adiciona ao blocklist Redis).

**Autenticado**

**Resposta 200 — web:**
```json
{
  "access_token": "eyJ...",
  "user": {
    "id": 1,
    "username": "resp_57411",
    "role": "responsavel",
    "tenant_id": 1,
    "must_change_password": false
  }
}
```

> A sessão anterior é revogada e o backend emite uma nova sessão. No web, o cookie
> HttpOnly `rt` também é atualizado. No mobile/nativo, a resposta inclui
> `refresh_token`.

---

#### `POST /auth/change-password`

Altera a senha do usuário autenticado.

**Autenticado** | Rate limit: 5 por hora

**Body:**
```json
{
  "current_password": "SenhaAtual123",
  "new_password": "NovaSenha456"
}
```

> Nova senha: mínimo 8 chars, 1 maiúscula, 1 número e 1 caractere especial.

**Resposta:** `204 No Content`

---

#### `POST /auth/forgot-password`

Envia e-mail de recuperação de senha.

**Público** | Rate limit: 5 por hora

**Body:**
```json
{
  "email": "usuario@escola.com.br",
  "tenant_slug": "escola-central"
}
```

> `tenant_slug` é obrigatório para evitar redefinir a conta errada quando o mesmo e-mail existe em mais de uma escola.

**Resposta 200** (sempre, sem revelar se o e-mail existe):
```json
{"message": "Se o e-mail estiver cadastrado, você receberá um link em breve."}
```

---

#### `POST /auth/reset-password`

Redefine a senha usando o token recebido por e-mail.

**Público** | Rate limit: 10 por hora

**Body:**
```json
{
  "token": "abc123...",
  "new_password": "NovaSenha456"
}
```

**Resposta 200:**
```json
{"message": "Senha redefinida com sucesso. Faça login com a nova senha."}
```

**Erros:** `400` token inválido ou expirado

---

#### `GET /auth/tenants`

Lista escolas disponíveis para o seletor de login.

**Público**

**Resposta 200:**
```json
[
  {"id": 1, "slug": "escola-central", "name": "Escola Central"},
  {"id": 2, "slug": "escola-norte", "name": "Escola Norte"}
]
```

---

### Usuários

#### `GET /usuarios/me`

Retorna o perfil do usuário autenticado.

**Autenticado**

**Resposta 200:**
```json
{
  "id": 1,
  "username": "professor1",
  "email": "prof@escola.com.br",
  "role": "professor",
  "tenant_id": 1,
  "must_change_password": false,
  "tenant": {
    "id": 1,
    "slug": "escola-central",
    "nome": "Escola Central"
  }
}
```

---

#### `GET /usuarios`

Lista usuários da escola atual.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor`

**Query params:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| `page` | int | Página (padrão: 1) |
| `per_page` | int | Por página (padrão: 20, máx: 200) |
| `q` | string | Busca por username/email |

**Resposta 200:**
```json
{
  "items": [{ "id": 1, "username": "...", "role": "..." }],
  "meta": { "page": 1, "per_page": 20, "total": 45 }
}
```

---

#### `POST /usuarios`

Cria um novo usuário.

**Autenticado** | Roles: `admin`

**Body:**
```json
{
  "username": "professor2",
  "email": "prof2@escola.com.br",
  "password": "SenhaSegura123",
  "role": "professor"
}
```

---

#### `PATCH /usuarios/{id}`

Atualiza dados de um usuário.

**Autenticado** | Roles: `admin` (outros usuários) ou próprio usuário (apenas alguns campos)

---

#### `DELETE /usuarios/{id}`

Remove um usuário.

**Autenticado** | Roles: `admin`

---

### Alunos

#### `GET /alunos`

Lista alunos da escola/ano letivo atual.

**Autenticado**

**Query params:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| `page` | int | Página (padrão: 1) |
| `per_page` | int | Por página (padrão: 20) |
| `q` | string | Busca por nome ou matrícula |
| `turma` | string | Filtrar por turma (ex: `7A`) |
| `turno` | string | Filtrar por turno |

**Resposta 200:**
```json
{
  "items": [
    {
      "id": 1,
      "nome": "João Silva",
      "matricula": "2026001",
      "turma": "7º A",
      "serie": "7",
      "turno": "Manhã",
      "media": 72.5,
      "status_especial": null
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 150 }
}
```

---

#### `GET /alunos/{id}`

Retorna detalhes completos de um aluno (incluindo notas e ocorrências).

**Autenticado**

---

#### `POST /alunos`

Cria um novo aluno.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor`, `orientador`

---

#### `PATCH /alunos/{id}`

Atualiza dados de um aluno.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor`, `orientador`

---

#### `DELETE /alunos/{id}`

Remove um aluno.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor`

---

#### `GET /alunos/{id}/boletim`

Gera o boletim em PDF do aluno.

**Autenticado**

**Resposta:** `application/pdf`

---

### Notas

#### `GET /notas`

Lista notas do ano letivo atual.

**Autenticado**

**Query params:** `aluno_id`, `turma`, `disciplina`, `page`, `per_page`

**Resposta 200:**
```json
{
  "items": [
    {
      "id": 1,
      "aluno_id": 1,
      "aluno_nome": "João Silva",
      "disciplina": "Matemática",
      "trimestre1": 75.0,
      "trimestre2": 68.0,
      "trimestre3": null,
      "total": 71.5,
      "faltas": 3,
      "status": "REC"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 300 }
}
```

---

#### `PATCH /notas/{id}`

Atualiza uma nota (trimestres, faltas, status).

**Autenticado** | Roles: `admin`

**Body:**
```json
{
  "trimestre1": 80.0,
  "trimestre2": 72.0,
  "faltas": 2
}
```

> O campo `total` é calculado automaticamente como média dos trimestres preenchidos. `null` se nenhum trimestre tiver nota.

---

### Turmas

#### `GET /turmas`

Lista turmas com contagem de alunos e média.

**Autenticado**

**Resposta 200:**
```json
[
  {
    "nome": "7º A",
    "serie": "7",
    "turno": "Manhã",
    "total_alunos": 32,
    "media_geral": 68.4
  }
]
```

---

### Ocorrências

#### `GET /ocorrencias`

Lista ocorrências disciplinares.

**Autenticado**

**Query params:** `aluno_id`, `tipo`, `page`, `per_page`

---

#### `POST /ocorrencias`

Registra uma nova ocorrência.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor`, `orientador`, `professor`

**Body:**
```json
{
  "aluno_id": 1,
  "tipo": "advertencia",
  "severidade": "MEDIA",
  "descricao": "Comportamento inadequado em sala",
  "acoes_tomadas": "Conversa com o aluno",
  "instrucoes_responsavel": "Comparecer à escola"
}
```

> `severidade`: `LEVE`, `MEDIA`, `GRAVE`, `GRAVISSIMA`
> `tipo`: `advertencia`, `elogio`, `suspensao`

---

#### `PATCH /ocorrencias/{id}`

Atualiza uma ocorrência.

**Autenticado** | Apenas autor ou roles de gestão

---

#### `DELETE /ocorrencias/{id}`

Remove uma ocorrência.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor`

---

### Comunicados

#### `GET /comunicados`

Lista comunicados do mural.

**Autenticado**

**Query params:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| `page` | int | Página (padrão: 1) |
| `per_page` | int | Por página (padrão: 20) |

**Resposta 200:**
```json
{
  "items": [
    {
      "id": 1,
      "titulo": "Reunião de pais",
      "conteudo": "...",
      "tipo_destinatario": "escola",
      "turma_id": null,
      "aluno_id": null,
      "fixado": true,
      "data_criacao": "2026-04-10T10:00:00",
      "autor": { "id": 1, "username": "direcao" },
      "lido": false
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 5 }
}
```

---

#### `POST /comunicados`

Cria um novo comunicado.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor`, `orientador`, `professor`

**Body:**
```json
{
  "titulo": "Aviso importante",
  "conteudo": "Texto do comunicado...",
  "tipo_destinatario": "turma",
  "turma_id": "7A",
  "fixado": false
}
```

> `tipo_destinatario`: `escola` (todos), `turma`, `aluno`

---

#### `PATCH /comunicados/{id}`

Atualiza um comunicado.

**Autenticado** | Professores: apenas seus próprios comunicados. Gestores: qualquer.

---

#### `DELETE /comunicados/{id}`

Remove um comunicado.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor` ou autor

---

#### `POST /comunicados/{id}/leitura`

Marca um comunicado como lido.

**Autenticado**

---

### Exportações

#### `GET /exports/comunicados-acesso`

Gera um arquivo DOCX por turma com uma carta de acesso para cada
aluno/responsável.

**Autenticado** | Roles: `admin`, `super_admin`, `coordenador`, `diretor`, `orientador`

**Query params:**
| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `turma` | Sim | Nome exato da turma, por exemplo `6/7 I` |

**Efeito colateral de segurança:** para cada aluno ativo da turma, o sistema cria ou
reaproveita o usuário `resp_<matricula>`, gera uma nova senha temporária, atualiza
`password_hash`, marca `must_change_password=true` e ativa a conta.

**Resposta 200:**
- `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `Content-Disposition: attachment; filename="comunicados_acesso_<turma>.docx"`

**Erros:** `400` turma ausente, `403` perfil sem permissão, `404` turma sem alunos ativos.

---

### Relatórios

#### `GET /relatorios`

Lista relatórios disponíveis com metadados.

**Autenticado**

---

#### `GET /relatorios/{slug}`

Retorna os dados de um relatório específico.

**Autenticado**

**Slugs disponíveis:**
| Slug | Descrição |
|------|-----------|
| `radar-abandono` | Alunos com alto risco de evasão |
| `top-movers` | Alunos com maior variação de desempenho |
| `eficiencia-docente` | Comparativo de médias por disciplina |
| `distribuicao-status` | Distribuição de aprovados/reprovados |

**Query params:** `turno`, `serie`, `turma`, `disciplina`

---

### Gráficos

#### `GET /graficos/{tipo}`

Retorna dados formatados para gráficos.

**Autenticado**

**Tipos:**
| Tipo | Descrição |
|------|-----------|
| `distribuicao-notas` | Histograma de notas |
| `media-por-disciplina` | Média geral por disciplina |
| `evolucao-trimestral` | Evolução das médias por trimestre |
| `distribuicao-gauss` | Curva de distribuição normal |
| `correlacao-freq-notas` | Correlação frequência vs notas |
| `heatmap-turmas` | Heatmap de desempenho por turma |

---

### Uploads (Ingestão de PDF)

#### `POST /uploads`

Faz upload de um PDF de boletim para ingestão automática.

**Autenticado** | Roles: `admin`, `coordenador`

**Content-Type:** `multipart/form-data`

**Body:**
```
file: <arquivo.pdf>
```

**Resposta 202:**
```json
{
  "job_id": "abc123",
  "message": "Processamento iniciado em background"
}
```

---

#### `GET /uploads`

Lista uploads e status de processamento.

**Autenticado**

---

### IA — Intervenções

#### `POST /ia/analisar-aluno`

Analisa um aluno e gera sugestão de intervenção.

**Autenticado** | Roles: `admin`, `coordenador`, `diretor`, `orientador`, `professor`

**Body:**
```json
{
  "aluno_id": 1
}
```

**Resposta 200:**
```json
{
  "aluno_id": 1,
  "aluno_nome": "João Silva",
  "priority": "HIGH",
  "summary": "Aluno com média abaixo de 50 em 3 disciplinas...",
  "suggested_actions": ["Contato com responsável", "Reforço em Matemática"]
}
```

> `priority`: `HIGH`, `MEDIUM`, `LOW`

---

#### `POST /ia/chat`

Chat com o assistente de IA da escola.

**Autenticado**

**Body:**
```json
{
  "message": "Quais alunos estão em risco na turma 7A?"
}
```

---

### Audit Logs

#### `GET /audit-logs`

Lista o log de auditoria.

**Autenticado** | Roles: `admin`, `super_admin`

**Query params:** `page`, `per_page`, `usuario_id`, `entidade`, `data_inicio`, `data_fim`

**Resposta 200:**
```json
{
  "items": [
    {
      "id": 1,
      "usuario": "admin",
      "acao": "UPDATE",
      "entidade": "nota",
      "entidade_id": 42,
      "detalhes": { "trimestre1": { "antes": 60, "depois": 75 } },
      "timestamp": "2026-04-10T14:30:00"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 120 }
}
```

---

### Super-Admin (apenas `super_admin`)

#### `GET /super-admin/tenants`

Lista todas as escolas cadastradas.

---

#### `POST /super-admin/tenants`

Cria uma nova escola.

**Body:**
```json
{
  "nome": "Escola Municipal X",
  "slug": "escola-x",
  "domain": "escolax.com.br"
}
```

---

#### `PATCH /super-admin/tenants/{id}`

Atualiza dados de uma escola.

---

#### `DELETE /super-admin/tenants/{id}`

Desativa uma escola.

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `400` | Requisição inválida (dados malformados) |
| `401` | Não autenticado ou token expirado/revogado |
| `403` | Sem permissão para este recurso |
| `404` | Recurso não encontrado |
| `422` | Erro de validação (dados incorretos) |
| `429` | Rate limit excedido |
| `500` | Erro interno do servidor |

### Formato de Erro

```json
{
  "error": "Mensagem de erro legível"
}
```

Para erros de validação (422):
```json
{
  "error": "Erro de validação",
  "details": [
    { "field": "password", "message": "Senha deve ter pelo menos 8 caracteres" }
  ]
}
```

---

## Multi-Tenancy

O tenant é resolvido automaticamente a partir do JWT. Para chamadas de super-admin que precisam operar em um tenant específico, inclua:

```
X-Tenant-ID: {tenant_id}
```

ou use o parâmetro `tenant_slug` nos endpoints que suportam.
