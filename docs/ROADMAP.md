# Roadmap de Desenvolvimento — Plataforma Boletins Frei

Este documento descreve o plano de continuidade para o desenvolvimento do sistema, focando na finalização da Fase 5 e consolidação da Fase 6.

## 🟢 Status Atual (Janeiro 2026)
- **Fase 1-3 (Core):** Completo (Login, Alunos, Turmas, Notas, Dashboards básicos).
- **Fase 4 (Comunicação):** Completo (Comunicados, Portal do Aluno).
- **Fase 5 (Avançado/IA):** Parcial.
  - *Backend:* Serviços de IA (`ai_chat.py`, `ai_predictor.py`) implementados.
  - *Frontend:* Dashboard do Professor implementado.
  - *Frontend:* **Data Chatbot (IA) pendente de implementação visual.**
- **Fase 6 (Correções/Adm):** Em andamento.
  - Ocorrências Disciplinares implementadas.
  - Edição de notas e logs de auditoria (backend/frontend básico).

---

## 🚀 Próximos Passos (Prioridade)

### 1. Implementação do Data Chatbot (Frontend)
**Objetivo:** Permitir que coordenadores e direção façam perguntas em linguagem natural sobre os dados da escola.
- [x] Criar componente `ChatInterface` (janela flutuante ou página dedicada).
- [x] Integrar com endpoint de IA do backend (serviço `ai_chat.py`).
- [x] Adicionar botão de acesso rápido no Header ou Sidebar.
- [x] Implementar visualização de respostas (texto, tabelas simples).

### 2. Validação e Ajustes do Modelo de Risco
**Objetivo:** Garantir que a predição de risco (`ai_predictor.py`) esteja visível e útil.
- [ ] Verificar exibição de alertas de risco no `TeacherDashboard`.
- [ ] Adicionar feedback visual nos cards de alunos com alto risco de reprovação.
- [ ] Testar retreinamento automático do modelo (`train_risk_model`).

### 3. Refinamento de Ocorrências e Comunicados
**Objetivo:** Polimento final das funcionalidades de comunicação.
- [ ] Testar fluxo de criação de ocorrências por professores.
- [ ] Verificar visualização de ocorrências no portal do aluno (`MeuBoletim`).
- [ ] Garantir que comunicados lidos/não lidos funcionem corretamente.

### 4. Auditoria e Segurança (Fase 6)
**Objetivo:** Ferramentas para administração segura.
- [x] Criar visualização de logs de auditoria no frontend (quem alterou qual nota).
- [ ] Reforçar validações de permissão para edição de notas (apenas Admin/Secretaria).

---

## 📅 Cronograma Sugerido

| Semana | Foco | Tarefas Chave |
| :--- | :--- | :--- |
| **Atual** | **IA & Chatbot** | Criar UI do Chatbot, Integrar API, Teste E2E da IA. |
| **Próxima** | **Risco & Dash** | Polir `TeacherDashboard`, Validar Modelo de Risco. |
| **Seguinte** | **Auditoria** | Tela de Logs, Refinamento de permissões. |
| **Futuro** | **V3.0** | App Mobile nativo, Integração com WhatsApp. |
