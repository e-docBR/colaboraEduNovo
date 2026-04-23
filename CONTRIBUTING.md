# Guia de Contribuição — ColaboraEdu

## Pré-requisitos

- Python 3.12+
- Node.js 18+
- Docker + Docker Compose
- Git

---

## Ambiente de Desenvolvimento

```bash
# Clone o repositório
git clone <repository-url>
cd colaboraEdu

# Configure o ambiente
cp .env.example .env
# Edite .env com valores de desenvolvimento (FLASK_ENV=development)

# Inicie os serviços
docker-compose up -d

# Inicialize o banco e crie dados de demo
docker-compose exec backend flask --app app init-db
docker-compose exec backend flask --app app seed-demo
```

### Backend (sem Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
flask --app app run --debug
```

### Frontend (sem Docker)

```bash
cd frontend
npm install
npm run dev
```

---

## Estrutura de Branches

| Branch | Descrição |
|--------|-----------|
| `main` | Código em produção — nunca commitar diretamente |
| `develop` | Branch de integração (opcional) |
| `feature/nome` | Nova funcionalidade |
| `fix/nome` | Correção de bug |
| `hotfix/nome` | Correção urgente em produção |

```bash
# Criar branch de feature
git checkout -b feature/importacao-csv

# Criar branch de fix
git checkout -b fix/calculo-media-notas
```

---

## Padrões de Código

### Backend (Python)

- Siga PEP 8 (use `ruff` ou `black` para formatação)
- Type hints em todas as funções públicas
- Use Pydantic v2 para validação de entrada (`@bp.post` recebe schema Pydantic)
- Não exponha detalhes de erros internos na API (mensagens genéricas para o cliente)
- Não adicione `try/except Exception` sem re-raise ou log
- Rate limit em todos os endpoints que aceitam dados não autenticados

```python
# Bom: usa schema Pydantic, role check explícito
@bp.post("/ocorrencias")
@jwt_required()
def criar_ocorrencia():
    data = OcorrenciaCreate.model_validate(request.get_json())
    require_roles(["admin", "professor"])
    ...

# Evite: validação manual, erros expostos
@bp.post("/ocorrencias")
def criar_ocorrencia():
    data = request.json
    try:
        ...
    except Exception as e:
        return {"error": str(e)}, 500  # nunca faça isso
```

### Frontend (TypeScript/React)

- Componentes funcionais com hooks
- Estado global: use Redux Toolkit apenas para estado que precisa ser compartilhado entre muitas telas (auth, tenant); prefira estado local (`useState`) para UI
- Chamadas de API: sempre via RTK Query (nunca `fetch` ou `axios` diretamente)
- Não usar `any` sem justificativa
- MUI para todos os componentes de UI — não adicionar outras libs de componentes

```typescript
// Bom: usa RTK Query, tipado
const { data, isLoading } = useGetAlunosQuery({ page: 1 });

// Evite: fetch direto
const [data, setData] = useState([]);
useEffect(() => {
  fetch('/api/v1/alunos').then(r => r.json()).then(setData);
}, []);
```

### Commits

Use mensagens descritivas em português ou inglês:

```
feat: adicionar importação de alunos via CSV
fix: corrigir cálculo de média quando trimestre é null
chore: atualizar dependência do Flask para 3.1
docs: documentar endpoint de recuperação de senha
refactor: extrair lógica de notificação para service
```

---

## Segurança

Antes de submeter código, verifique:

- Nenhum secret, senha ou chave privada nos commits
- Inputs de usuário validados via Pydantic (backend) antes de usar
- Queries passam pelo ORM (nunca SQL raw com interpolação de strings)
- Novos endpoints têm `@jwt_required()` e checagem de roles quando necessário
- Endpoints públicos são adicionados ao conjunto `PUBLIC_ENDPOINTS` em `api/v1/__init__.py`
- Rate limit em endpoints que aceitam dados sem autenticação

---

## Migrations de Banco

Ao alterar modelos SQLAlchemy:

```bash
# Gerar migration automaticamente
docker-compose exec backend flask --app app db migrate -m "descricao da mudanca"

# Revisar o arquivo gerado em migrations/versions/
# Verificar se o downgrade() está correto

# Aplicar
docker-compose exec backend flask --app app db upgrade
```

Nunca modifique migrations já aplicadas em produção.

---

## Testes

```bash
# Backend
cd backend
source .venv/bin/activate
pytest

# Frontend (type check)
cd frontend
npm run type-check
```

Ao adicionar funcionalidade, inclua ao menos um teste de integração para o endpoint principal.

---

## Pull Requests

1. Certifique-se de que os testes passam
2. Certifique-se de que o TypeScript compila sem erros (`npm run type-check`)
3. Abra o PR contra `main` (ou `develop` se existir)
4. Descreva o que muda e por quê
5. Inclua screenshots para mudanças visuais
6. Referencie issues relacionadas (`Closes #123`)

### Checklist do PR

- [ ] Código segue os padrões da base existente
- [ ] Nenhuma credencial ou secret no código
- [ ] Migrations geradas e testadas (se alterou modelos)
- [ ] Testes passando
- [ ] TypeScript sem erros
- [ ] CHANGELOG.md atualizado (se for funcionalidade ou bugfix relevante)

---

## Dúvidas?

Abra uma issue no repositório ou contate a equipe em suporte@colaboraedu.com.
