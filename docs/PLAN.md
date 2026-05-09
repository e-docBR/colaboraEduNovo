# Plano de Inteligência de Dados - ColaboraFREI

## 🟡 Visão Geral
O objetivo é elevar a capacidade analítica da plataforma, transitando de **relatórios descritivos** (o que aconteceu?) para **análises diagnósticas e preditivas** (por que aconteceu e quem precisa de ajuda?).

## 📊 1. Novos Relatórios de Inteligência (Reports)

### A. Radar de Abandono Escolar (Preditivo)
- **Objetivo**: Identificar alunos com alta probabilidade de evasão.
- **Métrica**: Combinação de Faltas Consecutivas (>3 dias) + Queda de Rendimento (>20% entre trimestres).
- **Ação**: Gerar lista prioritária para contato da Assistência Social.

### B. Comparativo de Eficiência por Disciplina (Diagnóstico)
- **Objetivo**: Entender disparidades no ensino.
- **Visualização**: Gráfico de barras divergentes.
- **Dados**: Média da Turma vs Média Geral da Escola na mesma disciplina.
- **Insight**: Identifica se uma nota baixa é pontual de um aluno ou sistêmica da turma/professor.

### C. Top Movers (Tendência)
- **Objetivo**: Reconhecer esforço e alertar declínio rápido.
- **Dados**: Alunos com maior variação positiva (Growth) e negativa (Drop) no último mês.

## 📈 2. Novos Gráficos Avançados (Charts)

### A. Curva de Gauss da Escola (Bell Curve)
- **Tipo**: Area Chart.
- **Insight**: Visualizar se a distribuição de notas da escola segue a normalidade ou se está achatada (muita reprovação ou muita facilidade).

### B. Correlação: Assiduidade vs Desempenho (Scatter Plot Real)
- **Tipo**: Scatter Plot (Dispersão).
- **Eixos**: Y = Média Geral, X = % Frequência.
- **Quadrantes**: 
  - Alta Frequência/Alta Nota (Modelos)
  - Baixa Frequência/Baixa Nota (Risco Evasão) -> **Foco de Intervenção**
  - Alta Frequência/Baixa Nota (Dificuldade de Aprendizagem) -> **Foco Pedagógico**

### C. Evolução Comparativa de Turnos
- **Tipo**: Multi-Line Chart.
- **Insight**: Comparar performance Matutino vs Vespertino ao longo dos 3 trimestres.

## 🛠️ Plano de Implementação

### Fase 1: Estrutura & Tipos
- [ ] Atualizar `features/relatorios/config.ts` com novas definições.
- [ ] Atualizar `features/graficos/config.ts` com novos tipos de gráficos.

### Fase 2: Componentes Visuais
- [ ] Implementar componentes Recharts para `AreaChart` (Gauss) e melhoria no `ScatterChart`.
- [ ] Criar "Trend Chips" para mostrar variação (▲ 2.5) nas tabelas.

### Fase 3: Integração de Dados
- [ ] Criar seletores (selectors) no Redux para derivar esses dados complexos no frontend (evitando sobrecarga no backend temporariamente).

## 📋 Status Atual
- **Documento Criado**: 25/01/2026
- **Status**: Aguardando Aprovação
