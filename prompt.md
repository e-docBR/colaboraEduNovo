PROMPT PARA REDESENHO COMPLETO DO SISTEMA DE BOLETINS - VERSÃO 2.0
📋 CONTEXTO E ANÁLISE DO SISTEMA ATUAL
Sistema Existente
O Sistema de Boletins do Colégio Frei Ronaldo é uma aplicação web Flask que gerencia e analisa o desempenho acadêmico dos alunos através da extração automatizada de dados de boletins em PDF.
Stack Tecnológico Atual
•	Backend: Python 3.12 + Flask 2.3.2
•	Banco de Dados: SQLite com WAL mode
•	Frontend: HTML5, CSS3, JavaScript (Vanilla), Bootstrap 5.3
•	Processamento PDF: pdfplumber
•	Gráficos: Chart.js, ECharts
•	Segurança: Flask-WTF (CSRF), Flask-Limiter, Werkzeug Security
Funcionalidades Principais Atuais
1.	Autenticação e Autorização
•	Sistema de login com sessões
•	Múltiplos perfis: admin, professor, coordenação, direção, orientação, secretaria, aluno
•	Controle de acesso baseado em roles
2.	Gestão de Dados Acadêmicos
•	Importação automatizada de boletins PDF (modo incremental e rebuild)
•	Extração de dados: matrícula, nome, turma, turno, disciplinas, notas (trimestre 1, 2, 3), faltas, situação
•	Normalização de disciplinas (ex: PORTUGUES → LINGUA PORTUGUESA)
•	Gestão de alunos, turmas e notas
•	Edição de notas (apenas administradores)
3.	Análise e Relatórios
•	Dashboard com KPIs (total alunos, turmas, média geral)
•	Gráficos comparativos entre trimestres
•	Gráficos automatizados por filtros
•	Relatórios: turmas com mais faltas, melhores médias, melhores/piores alunos, disciplinas com mais notas baixas
•	Identificação de alunos em risco (notas < 15)
•	Ata de resultado final por turma
•	Comparação de trimestres
4.	Exportação
•	Formatos: CSV, Excel (XLSX), PDF
•	Exportação de relatórios e listagens
5.	API REST
•	Endpoints para métricas, relatórios, gráficos
•	Autenticação baseada em sessão
Estrutura de Dados Atual
sql
-- Tabela de Alunos
alunos (
id INTEGER PRIMARY KEY,
matricula TEXT UNIQUE,
nome TEXT,
turma TEXT,
turno TEXT
)

-- Tabela de Notas
notas (
id INTEGER PRIMARY KEY,
aluno_id INTEGER,
disciplina TEXT,
disciplina_normalizada TEXT,
trimestre1 REAL,
trimestre2 REAL,
trimestre3 REAL,
total REAL,
faltas INTEGER,
situacao TEXT,
FOREIGN KEY (aluno_id) REFERENCES alunos(id)
)

-- Tabela de Usuários
usuarios (
id INTEGER PRIMARY KEY,
username TEXT UNIQUE,
password_hash TEXT,
is_admin BOOLEAN,
role TEXT,
aluno_id INTEGER,
must_change_password BOOLEAN
)
Análise dos Boletins PDF (Baseado nos arquivos fornecidos)
Os boletins contêm:
•	Dados do aluno: nome, matrícula, turma, turno
•	Componentes curriculares com notas por trimestre
•	Total de faltas
•	Situação final (APR/REP/EMC)
•	Layout padronizado com cabeçalho e rodapé
________________________________________
🎯 OBJETIVO DO REDESENHO
Desenvolver uma versão moderna, elegante e profissional do sistema, mantendo TODA A LÓGICA DE NEGÓCIO existente, mas com foco em:
1.	Frontend Moderno e Elegante
•	Dashboard interativo com visualização de dados em tempo real
•	Sidebar esquerda para navegação
•	Gráficos interativos e visuais
•	Cards informativos e responsivos
•	Design profissional e contemporâneo
2.	Tecnologias de Frontend Modernas
•	Framework JavaScript moderno (React, Vue.js ou Next.js)
•	Biblioteca de componentes UI (Material-UI, Ant Design, Tailwind UI)
•	Bibliotecas de gráficos avançadas (Recharts, D3.js, Victory)
•	Gerenciamento de estado (Redux, Zustand, Pinia)
•	Roteamento moderno (React Router, Vue Router)
3.	Manutenção da Lógica de Extração de PDFs
•	PRESERVAR COMPLETAMENTE o sistema de extração de PDFs
•	Manter o script importar_boletins.py funcionando
•	Garantir compatibilidade com os PDFs existentes
•	Focar na alimentação do banco de dados
________________________________________
🏗️ ARQUITETURA PROPOSTA
Opção 1: Arquitetura Monolítica Moderna (Recomendada)
┌─────────────────────────────────────────────────────────┐
│ FRONTEND MODERNO │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ React/ │ │ Material- │ │ Recharts/ │ │
│ │ Vue/ │ │ UI / │ │ D3.js / │ │
│ │ Next.js │ │ Ant Design │ │ Victory │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────┘
↕ API REST
┌─────────────────────────────────────────────────────────┐
│ BACKEND FLASK │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Flask │ │ SQLite │ │ pdfplumber │ │
│ │ (API) │ │ (DB) │ │ (PDF) │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────┘
Opção 2: Arquitetura Separada (Frontend + Backend)
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (Porta 3000) │
│ - React/Vue/Next.js │
│ - Material-UI / Ant Design / Tailwind │
│ - Recharts / D3.js / Victory │
│ - Redux / Zustand / Pinia │
└─────────────────────────────────────────────────────────┘
↕ HTTP/REST
┌─────────────────────────────────────────────────────────┐
│ BACKEND (Porta 5000) │
│ - Flask (API REST pura) │
│ - SQLite (Banco de dados) │
│ - pdfplumber (Extração de PDFs) │
│ - Flask-CORS (CORS habilitado) │
└─────────────────────────────────────────────────────────┘
________________________________________
🎨 ESPECIFICAÇÕES DO FRONTEND - DETALHAMENTO TÉCNICO
1. Dashboard Principal
Localização: Página inicial após login
Componentes:
•	Header Superior:
•	Logo da escola (com ícone)
•	Nome do usuário e perfil
•	Notificações (sino com contador)
•	Menu de usuário (dropdown)
•	Toggle de tema claro/escuro
•	Botão de logout
•	Sidebar Esquerda:
•	Ícone e nome do sistema
•	Menu de navegação colapsável:
•	🏠 Dashboard
•	👥 Alunos
•	📚 Turmas
•	📝 Notas
•	📊 Gráficos
•	📈 Relatórios
•	👤 Usuários (apenas admin)
•	⚙️ Configurações (apenas admin)
•	Indicador de página ativa
•	Versão do sistema (rodapé da sidebar)
•	Área de Conteúdo:
•	Cards de Métricas (Topo):
•	Total de Alunos (com variação %)
•	Total de Turmas
•	Média Geral
•	Alunos em Risco (notas < 15)
•	Total de Faltas
•	Taxa de Aprovação
•	Gráficos Principais:
•	Gráfico de linha: Evolução das médias por trimestre
•	Gráfico de pizza: Distribuição de aprovações/reprovações
•	Gráfico de barras: Top 5 disciplinas com mais notas baixas
•	Gráfico de radar: Comparação de desempenho por turno
•	Tabela de Alunos em Risco:
•	Nome, Turma, Disciplina, Nota, Ações
•	Paginação (10 itens por página)
•	Filtros por turno e turma
•	Exportação para Excel/PDF
•	Atividades Recentes:
•	Timeline de últimas importações
•	Últimas edições de notas
•	Últimos acessos
2. Página de Alunos
Componentes:
•	Filtros Superiores:
•	Busca por nome/matrícula (com debounce)
•	Filtro por turno (dropdown)
•	Filtro por turma (dropdown)
•	Botão "Novo Aluno" (apenas admin)
•	Botão "Importar PDFs" (apenas admin)
•	Listagem:
•	Cards responsivos ou tabela (toggle de visualização)
•	Cada card/aluno mostra:
•	Foto (avatar com iniciais)
•	Nome completo
•	Matrícula
•	Turma
•	Média geral
•	Status (aprovado/em risco/reprovado)
•	Badge de alertas
•	Paginação
•	Ordenação por colunas
•	Ações:
•	Ver detalhes
•	Editar (apenas admin)
•	Ver boletim
•	Exportar boletim
3. Página de Turmas
Componentes:
•	Visão em Grid:
•	Card para cada turma
•	Informações no card:
•	Nome da turma
•	Turno
•	Total de alunos
•	Média da turma
•	Gráfico de pizza (aprovados/reprovados)
•	Progress bar de frequência
•	Filtros por turno
•	Detalhes da Turma (Modal ou Página):
•	Lista de alunos da turma
•	Gráficos de desempenho
•	Comparação com outras turmas
•	Exportação de relatórios
4. Página de Notas
Componentes:
•	Filtros:
•	Turno
•	Turma
•	Disciplina
•	Trimestre
•	Tabela de Notas:
•	Aluno | Disciplina | T1 | T2 | T3 | Total | Faltas | Situação | Ações
•	Edição inline (apenas admin)
•	Validação de notas (0-20)
•	Histórico de alterações
•	Paginação
•	Estatísticas:
•	Média por disciplina
•	Média por turma
•	Distribuição de notas
•	Gráfico de dispersão
5. Página de Gráficos
Componentes:
•	Seletor de Tipo de Gráfico:
•	Comparação de Trimestres
•	Gráficos Automatizados
•	Evolução Temporal
•	Comparação de Turmas
•	Comparação de Disciplinas
•	Filtros:
•	Turno
•	Turma
•	Disciplina
•	Período
•	Visualização:
•	Gráfico interativo (zoom, pan, tooltip)
•	Legenda clicável
•	Download de imagem (PNG, SVG)
•	Exportação de dados (CSV, JSON)
6. Página de Relatórios
Componentes:
•	Lista de Relatórios Disponíveis:
•	Turmas com mais faltas
•	Turmas com melhores médias
•	Melhores alunos
•	Piores alunos
•	Disciplinas com mais notas baixas
•	Top alunos faltosos
•	Alunos em perigo de reprovação
•	Ata de resultado final
•	Para Cada Relatório:
•	Filtros específicos
•	Visualização em tabela
•	Gráficos complementares
•	Exportação (PDF, Excel, CSV)
•	Compartilhamento
7. Página de Usuários (Admin)
Componentes:
•	Listagem de Usuários:
•	Tabela com: Nome, Username, Perfil, Status, Ações
•	Busca por nome/username
•	Filtros por perfil
•	Formulário de Novo Usuário:
•	Modal ou página dedicada
•	Campos: Nome, Username, Senha, Perfil, Aluno vinculado (se aplicável)
•	Validação de campos
•	Edição de Usuário:
•	Alteração de perfil
•	Reset de senha
•	Ativação/desativação
8. Página de Configurações (Admin)
Componentes:
•	Importação de PDFs:
•	Upload de arquivos PDF (drag and drop)
•	Seleção de modo (incremental/rebuild)
•	Progress bar
•	Log de importação
•	Histórico de importações
•	Configurações Gerais:
•	Limite de notas baixas
•	Período letivo
•	Configurações de backup
•	Configurações de exportação
9. Sistema de Login
Componentes:
•	Tela de Login:
•	Formulário centralizado
•	Campos: Username, Senha
•	Checkbox "Lembrar-me"
•	Link "Esqueci minha senha"
•	Validação em tempo real
•	Mensagens de erro amigáveis
•	Redirecionamento Pós-Login:
•	Baseado no perfil do usuário
•	Admin → Dashboard
•	Professor/Coordenador → Dashboard
•	Aluno → Boletim pessoal
________________________________________
🛠️ TECNOLOGIAS RECOMENDADAS
Stack Frontend Sugerida
Opção A: React (Recomendada)
"framework": "React 18+",
"build_tool": "Vite",
"ui_library": "Material-UI (MUI) v5 ou Ant Design",
"charts": "Recharts ou Victory",
"state_management": "Redux Toolkit ou Zustand",
"routing": "React Router v6",
"http_client": "Axios",
"forms": "React Hook Form + Yup",
"styling": "Emotion (MUI) ou Tailwind CSS",
"icons": "@mui/icons-material ou @ant-design/icons"
}
Opção B: Vue.js
"framework": "Vue 3 (Composition API)",
"build_tool": "Vite",
"ui_library": "Vuetify 3 ou Ant Design Vue",
"charts": "ECharts Vue ou Chart.js",
"state_management": "Pinia",
"routing": "Vue Router 4",
"http_client": "Axios",
"forms": "VeeValidate + Yup",
"styling": "Tailwind CSS",
"icons": "@mdi/font ou @ant-design/icons-vue"
}
Opção C: Next.js
"framework": "Next.js 14+ (App Router)",
"ui_library": "shadcn/ui ou Material-UI",
"charts": "Recharts ou Tremor",
"state_management": "Zustand ou Redux Toolkit",
"routing": "Next.js App Router",
"http_client": "Axios ou fetch API",
"forms": "React Hook Form + Zod",
"styling": "Tailwind CSS",
"icons": "lucide-react"
}
Bibliotecas de Gráficos Recomendadas
1.	Recharts (React)
•	Gráficos declarativos
•	Responsivo
•	Fácil customização
•	Boa documentação
2.	Victory (React)
•	Gráficos animados
•	Muito customizável
•	Boa para dashboards
3.	ECharts (Universal)
•	Gráficos interativos avançados
•	3D e animações
•	Excelente performance
4.	D3.js (Universal)
•	Máxima flexibilidade
•	Gráficos customizados
•	Curva de aprendizado maior
5.	Chart.js (Universal)
•	Simples e leve
•	Boa para gráficos básicos
Bibliotecas de Componentes UI Recomendadas
1.	Material-UI (MUI) - React
•	Componentes Material Design
•	Muito completa
•	Boa documentação
2.	Ant Design - React/Vue
•	Componentes enterprise
•	Muitos componentes prontos
•	Excelente para dashboards
3.	shadcn/ui - React
•	Componentes acessíveis
•	Customizável
•	Baseado em Radix UI
4.	Vuetify - Vue
•	Material Design para Vue
•	Muito completa
________________________________________
🎨 DESIGN E UX - ESPECIFICAÇÕES DETALHADAS
Paleta de Cores Sugerida
/* Tema Claro */
--primary: #1976d2; /* Azul principal */
--secondary: #9c27b0; /* Roxo secundário */
--success: #2e7d32; /* Verde sucesso */
--warning: #ed6c02; /* Laranja alerta */
--error: #d32f2f; /* Vermelho erro */
--info: #0288d1; /* Azul info */
--background: #f5f5f5; /* Fundo claro */
--surface: #ffffff; /* Superfície */
--text-primary: #212121; /* Texto principal */
--text-secondary: #757575; /* Texto secundário */

/* Tema Escuro */
--primary-dark: #90caf9;
--secondary-dark: #ce93d8;
--success-dark: #81c784;
--warning-dark: #ffb74d;
--error-dark: #e57373;
--info-dark: #4fc3f7;
--background-dark: #121212;
--surface-dark: #1e1e1e;
--text-primary-dark: #ffffff;
--text-secondary-dark: #b0b0b0;
Tipografia
/* Fontes */
--font-family: 'Inter', 'Roboto', -apple-system, sans-serif;
--font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Tamanhos */
--font-size-xs: 0.75rem; /* 12px */
--font-size-sm: 0.875rem; /* 14px */
--font-size-base: 1rem; /* 16px */
--font-size-lg: 1.125rem; /* 18px */
--font-size-xl: 1.25rem; /* 20px */
--font-size-2xl: 1.5rem; /* 24px */
--font-size-3xl: 1.875rem; /* 30px */
--font-size-4xl: 2.25rem; /* 36px */

/* Pesos */
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
Espaçamento
--spacing-xs: 0.25rem; /* 4px */
--spacing-sm: 0.5rem; /* 8px */
--spacing-md: 1rem; /* 16px */
--spacing-lg: 1.5rem; /* 24px */
--spacing-xl: 2rem; /* 32px */
--spacing-2xl: 3rem; /* 48px */
--spacing-3xl: 4rem; /* 64px */
Breakpoints Responsivos
--breakpoint-xs: 0px; /* Extra small */
--breakpoint-sm: 600px; /* Small */
--breakpoint-md: 900px; /* Medium */
--breakpoint-lg: 1200px; /* Large */
--breakpoint-xl: 1536px; /* Extra large */
Componentes de Design
Cards
•	Sombra suave (elevation 1-8)
•	Border radius: 8px
•	Padding: 16px-24px
•	Hover effect: elevation +2
•	Transições suaves
Botões
•	Primary: fundo colorido, texto branco
•	Secondary: outline, borda colorida
•	Text: apenas texto, sem fundo
•	Tamanhos: small, medium, large
•	Estados: default, hover, active, disabled, loading
Inputs
•	Label flutuante
•	Placeholder sutil
•	Estados: default, focus, error, disabled
•	Mensagens de validação
•	Íconos de ação
Tabelas
•	Cabeçalho fixo ao rolar
•	Linhas zebradas
•	Hover em linhas
•	Ordenação clicável
•	Paginação integrada
Modais
•	Overlay escuro (opacidade 0.5)
•	Animação de entrada/saída
•	Fechar com ESC ou clique fora
•	Botões de ação no rodapé
________________________________________
🔧 BACKEND - MANUTENÇÃO DA LÓGICA
O que DEVE SER MANTIDO
1. Script de Importação de PDFs
python
# Arquivo: importar_boletins.py
# FUNCIONALIDADES A PRESERVAR:
- Extração de texto com pdfplumber
- Patterns regex para alunos e notas
- Normalização de disciplinas
- Modos incremental e rebuild
- Validação de dados
- Log de importação
2. Estrutura do Banco de Dados
sql
-- MANTER EXATAMENTE AS MESMAS TABELAS:
- alunos (id, matricula, nome, turma, turno)
- notas (id, aluno_id, disciplina, disciplina_normalizada, 
trimestre1, trimestre2, trimestre3, total, faltas, situacao)
- usuarios (id, username, password_hash, is_admin, role, 
aluno_id, must_change_password)
3. Lógica de Negócio
•	Cálculos de médias
•	Identificação de alunos em risco
•	Filtros por turno, turma, disciplina
•	Validação de notas (0-20)
•	Sistema de permissões
•	Autenticação e autorização
4. APIs Existentes
•	Manter todos os endpoints atuais
•	Adicionar CORS para comunicação com frontend
•	Manter autenticação por sessão ou migrar para JWT
Adaptações Necessárias
1. Flask como API REST Pura
python
# app.py - Adaptar para retornar apenas JSON
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Habilitar CORS

# Exemplo de rota adaptada
@app.route('/api/alunos', methods=['GET'])
@login_required
def api_alunos():
# Lógica existente
alunos = get_alunos_from_db()
# Retornar JSON ao invés de renderizar template
return jsonify({
'success': True,
'data': alunos,
'total': len(alunos)
})
2. Autenticação JWT (Opcional)
python
# Se optar por JWT ao invés de sessões
from flask_jwt_extended import JWTManager, create_access_token

app.config['JWT_SECRET_KEY'] = 'your-secret-key'
jwt = JWTManager(app)

@app.route('/api/login', methods=['POST'])
def login():
username = request.json.get('username')
password = request.json.get('password')
# Validar credenciais
user = authenticate_user(username, password)
if user:
access_token = create_access_token(identity=user['id'])
return jsonify({
'success': True,
'access_token': access_token,
'user': user
})
return jsonify({'success': False, 'message': 'Credenciais inválidas'}), 401
3. Endpoints de Upload de PDFs
python
@app.route('/api/importar-pdfs', methods=['POST'])
@admin_required
def api_importar_pdfs():
# Receber arquivos PDF do frontend
files = request.files.getlist('pdfs')
modo = request.form.get('modo', 'incremental')
# Processar PDFs
resultados = []
for file in files:
try:
# Salvar arquivo temporariamente
filepath = f'/tmp/{file.filename}'
file.save(filepath)
# Processar com lógica existente
resultado = processar_pdf(filepath)
resultados.append(resultado)
except Exception as e:
resultados.append({'erro': str(e)})
return jsonify({
'success': True,
'resultados': resultados
})
________________________________________
📦 ESTRUTURA DE PROJETO SUGERIDA
Opção 1: Monolito com Frontend Integrado
boletim-conselho-v2/
├── backend/
│ ├── app.py # Flask app principal
│ ├── config.py # Configurações
│ ├── models.py # Modelos de dados
│ ├── routes/
│ │ ├── auth.py # Rotas de autenticação
│ │ ├── alunos.py # Rotas de alunos
│ │ ├── notas.py # Rotas de notas
│ │ ├── graficos.py # Rotas de gráficos
│ │ └── relatorios.py # Rotas de relatórios
│ ├── services/
│ │ ├── pdf_service.py # Serviço de PDF
│ │ ├── auth_service.py # Serviço de autenticação
│ │ └── analytics_service.py # Serviço de análises
│ ├── utils/
│ │ ├── validators.py # Validadores
│ │ └── helpers.py # Funções auxiliares
│ └── importar_boletins.py # Script de importação (MANTIDO)
├── frontend/
│ ├── public/
│ │ ├── index.html
│ │ └── favicon.ico
│ ├── src/
│ │ ├── components/ # Componentes reutilizáveis
│ │ │ ├── common/
│ │ │ │ ├── Button.tsx
│ │ │ │ ├── Card.tsx
│ │ │ │ ├── Input.tsx
│ │ │ │ └── Modal.tsx
│ │ │ ├── layout/
│ │ │ │ ├── Sidebar.tsx
│ │ │ │ ├── Header.tsx
│ │ │ │ └── Footer.tsx
│ │ │ └── charts/
│ │ │ ├── LineChart.tsx
│ │ │ ├── BarChart.tsx
│ │ │ └── PieChart.tsx
│ │ ├── pages/ # Páginas
│ │ │ ├── Dashboard.tsx
│ │ │ ├── Alunos.tsx
│ │ │ ├── Turmas.tsx
│ │ │ ├── Notas.tsx
│ │ │ ├── Graficos.tsx
│ │ │ ├── Relatorios.tsx
│ │ │ ├── Usuarios.tsx
│ │ │ ├── Login.tsx
│ │ │ └── Configuracoes.tsx
│ │ ├── services/ # Serviços de API
│ │ │ ├── api.ts
│ │ │ ├── auth.service.ts
│ │ │ ├── alunos.service.ts
│ │ │ └── notas.service.ts
│ │ ├── store/ # Gerenciamento de estado
│ │ │ ├── slices/
│ │ │ │ ├── auth.slice.ts
│ │ │ │ └── data.slice.ts
│ │ │ └── index.ts
│ │ ├── hooks/ # Custom hooks
│ │ │ ├── useAuth.ts
│ │ │ └── useData.ts
│ │ ├── utils/ # Utilitários
│ │ │ ├── formatters.ts
│ │ │ └── validators.ts
│ │ ├── styles/ # Estilos globais
│ │ │ ├── theme.ts
│ │ │ └── globals.css
│ │ ├── App.tsx # Componente raiz
│ │ ├── main.tsx # Entry point
│ │ └── router.tsx # Configuração de rotas
│ ├── package.json
│ └── vite.config.ts
├── database/
│ └── boletins.db # Banco de dados SQLite
├── uploads/ # PDFs temporários
├── logs/ # Logs da aplicação
├── requirements.txt # Dependências Python
├── .env.example # Exemplo de variáveis de ambiente
├── .gitignore
├── README.md
└── docker-compose.yml # Docker (opcional)
Opção 2: Frontend e Backend Separados
boletim-conselho-v2/
├── backend/ # Repositório separado
│ ├── app.py
│ ├── requirements.txt
│ └── ...
└── frontend/ # Repositório separado
├── src/
├── package.json
└── ...
________________________________________
🚀 PLANO DE IMPLEMENTAÇÃO
Fase 1: Setup e Configuração (Semana 1)
•	Escolher stack de frontend (React/Vue/Next.js)
•	Configurar projeto frontend (Vite/Next.js)
•	Instalar dependências (UI library, charts, state management)
•	Configurar roteamento
•	Configurar tema e variáveis CSS
•	Adaptar backend para API REST
•	Configurar CORS
•	Testar comunicação frontend-backend
Fase 2: Autenticação e Layout Base (Semana 2)
•	Implementar tela de login
•	Implementar sistema de autenticação (JWT ou sessão)
•	Criar componente de Sidebar
•	Criar componente de Header
•	Criar layout base (com sidebar e header)
•	Implementar roteamento protegido
•	Implementar redirecionamento por perfil
•	Testar fluxo de autenticação completo
Fase 3: Dashboard (Semana 3-4)
•	Criar componentes de Cards de métricas
•	Implementar gráficos principais (linha, pizza, barras, radar)
•	Criar API de métricas do dashboard
•	Implementar filtros do dashboard
•	Implementar tabela de alunos em risco
•	Implementar timeline de atividades recentes
•	Adicionar animações e transições
•	Testar responsividade
Fase 4: Páginas de Gestão (Semana 5-6)
•	Implementar página de Alunos
•	Listagem com cards/tabela
•	Filtros e busca
•	Paginação
•	Modal de detalhes
•	Implementar página de Turmas
•	Grid de turmas
•	Filtros por turno
•	Modal de detalhes
•	Implementar página de Notas
•	Tabela de notas
•	Filtros avançados
•	Edição inline
•	Validação
Fase 5: Gráficos e Relatórios (Semana 7-8)
•	Implementar página de Gráficos
•	Seletor de tipo de gráfico
•	Filtros dinâmicos
•	Gráficos interativos
•	Exportação
•	Implementar página de Relatórios
•	Lista de relatórios
•	Visualização de cada relatório
•	Exportação (PDF, Excel, CSV)
•	Criar APIs de gráficos e relatórios
Fase 6: Gestão de Usuários e Configurações (Semana 9)
•	Implementar página de Usuários (admin)
•	Listagem
•	Formulário de criação
•	Edição
•	Exclusão
•	Implementar página de Configurações (admin)
•	Importação de PDFs
•	Configurações gerais
•	Backup
Fase 7: Melhorias e Otimizações (Semana 10)
•	Implementar tema claro/escuro
•	Otimizar performance
•	Lazy loading
•	Code splitting
•	Memoização
•	Implementar loading states
•	Implementar error handling
•	Melhorar responsividade mobile
•	Adicionar animações
Fase 8: Testes e Deploy (Semana 11-12)
•	Testes unitários (frontend)
•	Testes de integração
•	Testes E2E
•	Testes de performance
•	Correção de bugs
•	Documentação
•	Deploy em produção
•	Monitoramento
________________________________________
✅ CHECKLIST DE ENTREGA
Funcionalidades Obrigatórias
•	Sistema de login funcional
•	Sidebar com navegação
•	Dashboard com métricas e gráficos
•	Página de alunos com listagem e filtros
•	Página de turmas
•	Página de notas com edição
•	Página de gráficos interativos
•	Página de relatórios com exportação
•	Página de usuários (admin)
•	Página de configurações com importação de PDFs
•	Sistema de permissões por perfil
•	Tema claro/escuro
•	Responsividade mobile
•	Todas as APIs funcionando
Qualidade de Código
•	Código limpo e bem documentado
•	Componentes reutilizáveis
•	Separação de responsabilidades
•	Tratamento de erros
•	Loading states
•	Validação de formulários
•	TypeScript (se aplicável)
Performance
•	Carregamento inicial < 3s
•	Gráficos renderizam em < 1s
•	Navegação fluida
•	Sem memory leaks
•	Otimização de imagens
•	Lazy loading implementado
UX/UI
•	Design moderno e elegante
•	Animações suaves
•	Feedback visual claro
•	Mensagens de erro amigáveis
•	Acessibilidade (WCAG 2.1)
•	Consistência visual
Segurança
•	Autenticação segura
•	Proteção CSRF
•	Validação de inputs
•	Sanitização de dados
•	Rate limiting
•	Headers de segurança
Documentação
•	README completo
•	Documentação de APIs
•	Guia de instalação
•	Guia de desenvolvimento
•	Comentários no código
•	Diagramas de arquitetura
________________________________________
📝 NOTAS IMPORTANTES
Preservação da Lógica de Extração de PDFs
CRÍTICO: O sistema de extração de PDFs deve ser mantido exatamente como está, apenas adaptado para receber arquivos via API ao invés de processar arquivos locais.
Compatibilidade
•	Manter compatibilidade com o banco de dados existente
•	Não quebrar funcionalidades existentes
•	Permitir migração gradual
Performance
•	Priorizar performance do frontend
•	Otimizar queries do backend
•	Implementar cache onde apropriado
Escalabilidade
•	Arquitetura preparada para crescimento
•	Código modular e reutilizável
•	Documentação completa
Manutenibilidade
•	Código limpo e bem estruturado
•	Testes automatizados
•	Documentação atualizada
________________________________________
🎯 RESULTADO ESPERADO
Ao final do desenvolvimento, o sistema deve:
1.	Manter toda a funcionalidade existente de extração e processamento de PDFs
2.	Apresentar uma interface moderna, elegante e profissional com dashboard interativo
3.	Oferecer excelente experiência do usuário com navegação intuitiva e feedback visual
4.	Ser totalmente responsivo funcionando perfeitamente em mobile, tablet e desktop
5.	Ter performance otimizada com carregamento rápido e navegação fluida
6.	Ser fácil de manter e expandir com código limpo e bem documentado
________________________________________
📞 SUPORTE E DÚVIDAS
Durante o desenvolvimento, em caso de dúvidas sobre:
•	Lógica de negócio: Consultar código atual e documentação
•	Estrutura de dados: Verificar schema do banco de dados
•	Processamento de PDFs: Analisar importar_boletins.py
•	APIs existentes: Consultar API.md e código em app.py
________________________________________
Desenvolvido com ❤️ para o Colégio Frei Ronaldo
Versão: 2.0
Data: Janeiro 2025
________________________________________
📁 ARQUIVOS DE BOLETINS ANALISADOS
Os seguintes arquivos de boletins foram analisados para garantir compatibilidade:
•	2472182d-1971-4d33-bc6f-42a618c831cd.pdf - Boletins de 6º ano
•	09b236d6-5b77-426c-8be2-2a353be6f0fb.pdf - Boletins de 7º ano
•	79403b26-7db4-4725-97b8-545563e3002d.pdf - Boletins de 8º ano
•	ac4d8e28-1d28-4c14-8310-f3079da4e800.pdf - Boletins de 6º ano (vespertino)
•	fe68ea6e-1012-46f3-acde-310685115089.pdf - Boletins de 7º ano (vespertino)
•	469b76be-1ee1-4f66-b0ab-a7b75ffbe978.pdf - Boletins de 8º ano (vespertino)
•	e9b72d08-178c-4989-ac2d-4f3fb12aaff7.pdf - Boletins de 9º ano
•	f21bb907-3dcc-4a4f-8113-85200bdca5df.pdf - Boletins de 6º ano (EJA)
Formato padrão identificado:
•	Cabeçalho com dados da escola
•	Seção de dados do aluno
•	Tabela de componentes curriculares
•	Notas por trimestre
•	Total de faltas
•	Situação final
•	Assinaturas
