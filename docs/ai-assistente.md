# Assistente de IA Educacional — ColaboraEdu

> Documentação técnica do módulo de IA (commit `12b52c9`)

---

## Visão Geral

O assistente de IA é um chatbot analítico integrado ao dashboard, capaz de gerar relatórios, gráficos e tabelas com dados reais da instituição de ensino. Funciona em dois modos:

| Modo | Quando | Comportamento |
|------|--------|---------------|
| **Regras** | Sem LLM configurado | Respostas template baseadas em queries SQL |
| **Híbrido** | Com LLM ativo | Dados do banco + análise contextual gerada pelo LLM |

---

## Arquitetura

```
ChatWidget (frontend)
    │
    └─ POST /api/v1/chat
           │
           └─ ai_chat.py (AIAnalystEngine)
                  │
                  ├─ Detecção de intenção (regex)
                  ├─ Extração de filtros (turma, turno, trimestre, aluno)
                  ├─ Query ao banco de dados (scoped por tenant_id)
                  └─ [Opcional] llm_provider.py → LLM externo
```

---

## Controle de Acesso

O assistente é visível **apenas** para os seguintes perfis:

| Role | Acesso |
|------|--------|
| `super_admin` | ✅ |
| `admin` | ✅ |
| `diretor` | ✅ |
| `coordenador` | ✅ |
| `orientador` | ✅ |
| `professor` | ❌ |
| `aluno` | ❌ |
| `responsavel` | ❌ |

A restrição é aplicada em **três camadas**:
1. Backend: `@require_roles(*AI_CHAT_ROLES)` no endpoint `/chat`
2. Frontend: `ChatWidget` verifica `user.role` antes de renderizar
3. Sidebar: item "Config. Assistente IA" só aparece para `admin`/`super_admin`

---

## Nome do Assistente (por Instituição)

O nome é resolvido na seguinte ordem de prioridade:

```
1. ai_name configurado pelo admin (ex: "Prof. Robson")
2. "AI " + primeira palavra do nome do tenant (ex: "AI Colégio")
3. Fallback: "AI ColaboraEdu"
```

Cada tenant tem configuração **independente**. O ChatWidget busca o nome via:
```
GET /api/v1/ai-settings/info
→ { ai_name: "AI Marista", llm_active: true, tenant_name: "Marista" }
```

---

## 30 Relatórios Disponíveis

### 📊 Desempenho (7)
| Comando de exemplo | Tipo |
|--------------------|------|
| "Gráfico de médias por turma" | Gráfico de barras |
| "Ranking das turmas" | Tabela |
| "Comparativo por turno" | Gráfico de barras |
| "Desempenho por disciplina" | Gráfico de barras |
| "Evolução trimestral da turma 7A" | Gráfico de barras |
| "Distribuição de notas" | Gráfico de pizza |
| "Situação escolar dos alunos" | Gráfico de pizza |

### 👥 Alunos (9)
| Comando de exemplo | Tipo |
|--------------------|------|
| "Alunos em risco" | Tabela |
| "Melhores alunos" | Tabela |
| "Alunos em recuperação" | Tabela |
| "Alunos reprovados" | Tabela |
| "Radar de abandono escolar" | Tabela |
| "Perfil do aluno João Silva" | Texto + Tabela |
| "Evolução trimestral da Maria" | Tabela |
| "Quantos alunos temos?" | Texto + Tabela |
| "Quantos alunos por turma?" | Gráfico de barras |

### 📅 Frequência (2)
| Comando de exemplo | Tipo |
|--------------------|------|
| "Alunos com mais faltas" | Gráfico de barras |
| "Alunos com risco por infrequência" | Tabela |

### ⚖️ Ocorrências (4)
| Comando de exemplo | Tipo |
|--------------------|------|
| "Ocorrências por tipo" | Gráfico de barras |
| "Ocorrências recentes" | Tabela |
| "Ocorrências por gravidade" | Gráfico de pizza |
| "Ocorrências do aluno Pedro" | Tabela |

### 📢 Comunicados (2)
| Comando de exemplo | Tipo |
|--------------------|------|
| "Comunicados ativos" | Tabela |
| "Taxa de leitura dos comunicados" | Gráfico de barras |

### 🎓 Pedagógico (2)
| Comando de exemplo | Tipo |
|--------------------|------|
| "Intervenção pedagógica para Carlos" | Texto |
| "Quem precisa de intervenção urgente?" | Tabela |

### 🏫 Resumo (2)
| Comando de exemplo | Tipo |
|--------------------|------|
| "Visão geral da escola" | Tabela |
| "Perfil completo da turma 9B" | Tabela |

---

## Filtros Reconhecidos Automaticamente

O engine extrai filtros do texto naturalmente:

| Filtro | Exemplos reconhecidos |
|--------|-----------------------|
| Turma | "7A", "7º ANO A", "9B" |
| Turno | "matutino", "manhã", "tarde", "noturno" |
| Trimestre | "1º tri", "2 trimestre", "3º" |
| Aluno | "do aluno João", "perfil de Maria" |
| Disciplina | "matemática", "português", "física" |

**Exemplos com filtro:**
- *"Alunos em risco da turma 8A"*
- *"Gráfico de médias do turno vespertino no 2º tri"*
- *"Evolução trimestral do aluno Pedro"*

---

## Configuração do LLM

### Providers Suportados

| Provider | URL da API | Modelos Recomendados |
|----------|-----------|----------------------|
| **OpenAI** | api.openai.com | gpt-4o-mini *(econômico)*, gpt-4o |
| **Anthropic** | api.anthropic.com | claude-3-5-haiku *(rápido)*, claude-3-5-sonnet |
| **OpenRouter** | openrouter.ai/api/v1 | google/gemma-3-27b-it:free *(gratuito!)* |
| **Gemini** | generativelanguage.googleapis.com | gemini-1.5-flash |

> 💡 **Recomendação para começar:** OpenRouter com modelo gratuito (`google/gemma-3-27b-it:free` ou `meta-llama/llama-3.3-70b-instruct:free`) — sem custo e boa qualidade.

### Como Configurar (Admin)

1. No sidebar, clique em **Config. Assistente IA**
2. Escolha o provider clicando no chip correspondente
3. Selecione o modelo no dropdown
4. Cole a API key no campo (nunca exposta ao frontend após salvar)
5. Clique **Testar Conexão** para validar
6. Ative o toggle e clique **Salvar**

### Endpoints da API

```
GET    /api/v1/ai-settings        → Configuração atual (admin)
PUT    /api/v1/ai-settings        → Salvar configuração (admin)
POST   /api/v1/ai-settings/test   → Testar conexão LLM (admin)
DELETE /api/v1/ai-settings/key    → Remover API key (admin)
GET    /api/v1/ai-settings/info   → Nome e status do assistente (todos autenticados)
POST   /api/v1/chat               → Enviar mensagem ao assistente (roles permitidas)
```

---

## Banco de Dados

### Tabela `ai_configurations`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INT PK | — |
| `tenant_id` | INT FK UNIQUE | Uma config por instituição |
| `is_active` | BOOL | Ativa/desativa o LLM |
| `provider` | VARCHAR(50) | openai / anthropic / openrouter / gemini |
| `model_name` | VARCHAR(100) | ID do modelo |
| `api_key` | VARCHAR(512) | Chave cifrada em trânsito |
| `temperature` | FLOAT | 0.0–1.0 (padrão: 0.4) |
| `ai_name` | VARCHAR(100) | Nome personalizado do assistente |
| `system_prompt` | TEXT | Instruções extras para o LLM |

**Migration:** `a7b8c9d0e1f2_add_ai_config_name_temperature.py`

---

## Segurança

- **API key nunca retornada completa** — o endpoint GET retorna apenas `api_key_set: true/false`
- **Scoping por tenant** — todas as queries filtram por `tenant_id` do JWT
- **Sem acesso a dados entre tenants** — o LLM recebe apenas o contexto do tenant autenticado
- **Roles verificadas em dupla camada** — backend (decorator) + frontend (render guard)

---

## Arquivos Modificados

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── __init__.py          ← registra ai_settings blueprint
│   │   ├── ai_settings.py       ← NOVO: CRUD configuração IA
│   │   └── chat.py              ← roles restritas + tenant_id
│   ├── core/
│   │   └── roles.py             ← AI_CHAT_ROLES adicionado
│   ├── models/
│   │   └── ai_configuration.py  ← ai_name, temperature, display_name()
│   └── services/
│       ├── ai_chat.py           ← REESCRITO: 30 intents + LLM hybrid
│       └── llm_provider.py      ← NOVO: abstração HTTP para 4 providers
└── migrations/versions/
    └── a7b8c9d0e1f2_*.py        ← NOVO: migration

frontend/src/
├── app/routes.tsx               ← rota /app/admin/ia
├── components/navigation/
│   └── Sidebar.tsx              ← item "Config. Assistente IA"
├── features/ai-chat/
│   ├── AISettingsPage.tsx       ← NOVO: painel admin
│   └── ChatWidget.tsx           ← nome dinâmico, role guard, UX melhorada
└── lib/api.ts                   ← 5 novos hooks RTK Query
```

---

## Deploy em Produção

Após `git pull` no servidor:

```bash
# 1. Rodar migration
docker compose -f docker-compose.prod.yml exec backend \
  flask db upgrade

# 2. Reiniciar backend
docker compose -f docker-compose.prod.yml up -d --no-deps backend

# 3. Rebuild frontend
docker compose -f docker-compose.prod.yml up -d --no-deps --build frontend
```

> ⚠️ Após usar um PAT para deploy, revogue-o em https://github.com/settings/tokens e gere um novo imediatamente.
