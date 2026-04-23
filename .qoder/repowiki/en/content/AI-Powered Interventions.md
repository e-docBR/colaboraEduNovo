# AI-Powered Interventions

<cite>
**Referenced Files in This Document**
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [ai.py](file://backend/app/api/v1/ai.py)
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [config.py](file://backend/app/core/config.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [comunicado.py](file://backend/app/models/comunicado.py)
- [AIInterventionBoard.tsx](file://frontend/src/features/dashboard/AIInterventionBoard.tsx)
- [test_intervention.py](file://backend/test_intervention.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the AI-powered interventions subsystem of the platform. It covers how the system performs risk assessment, generates pedagogical recommendations, and integrates with external communication channels. It also documents the AI chat engine that interprets natural language queries into actionable analytics and intervention insights, and how these insights connect to student academic records, disciplinary history, and communication patterns. The goal is to make the AI features accessible to educators while providing developers with sufficient technical depth to customize algorithms, extend capabilities, and integrate external AI services.

## Project Structure
The AI interventions feature spans backend services, models, API endpoints, and a frontend dashboard widget. The backend orchestrates:
- Risk modeling and prediction
- Pedagogical intervention generation
- Natural language query processing and analytics
- Communication delivery (email and WhatsApp)
- Frontend dashboard rendering of AI-generated interventions

```mermaid
graph TB
subgraph "Frontend"
AIB["AIInterventionBoard.tsx"]
end
subgraph "Backend API"
API["ai.py"]
end
subgraph "Services"
ISR["intervention_service.py"]
APC["ai_predictor.py"]
AIC["ai_chat.py"]
COM["communication_service.py"]
end
subgraph "Models"
ALU["aluno.py"]
NOT["nota.py"]
OCC["ocorrencia.py"]
COMD["comunicado.py"]
end
subgraph "Config"
CFG["config.py"]
end
AIB --> API
API --> ISR
API --> APC
AIC --> ISR
AIC --> ALU
AIC --> NOT
AIC --> OCC
AIC --> COMD
ISR --> ALU
ISR --> NOT
APC --> ALU
APC --> NOT
COM --> CFG
```

**Diagram sources**
- [AIInterventionBoard.tsx](file://frontend/src/features/dashboard/AIInterventionBoard.tsx)
- [ai.py](file://backend/app/api/v1/ai.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [comunicado.py](file://backend/app/models/comunicado.py)
- [config.py](file://backend/app/core/config.py)

**Section sources**
- [AIInterventionBoard.tsx](file://frontend/src/features/dashboard/AIInterventionBoard.tsx)
- [ai.py](file://backend/app/api/v1/ai.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [comunicado.py](file://backend/app/models/comunicado.py)
- [config.py](file://backend/app/core/config.py)

## Core Components
- PedagogicalInterventionService: Computes risk-based interventions from academic and attendance data, categorizes subjects, and produces prioritized recommendations.
- Risk predictor: Trains a logistic regression model to estimate failure risk and returns a risk score with factor breakdowns.
- AI Analyst Engine: Interprets natural language queries into analytics, charts, lists, and pedagogical intervention suggestions.
- Communication Service: Sends notifications via email and WhatsApp using configured external APIs.
- API endpoints: Expose single-student and bulk intervention generation, plus AI chat analytics.
- Frontend dashboard widget: Renders AI-generated interventions in a responsive grid with priority indicators.

**Section sources**
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [ai.py](file://backend/app/api/v1/ai.py)
- [AIInterventionBoard.tsx](file://frontend/src/features/dashboard/AIInterventionBoard.tsx)

## Architecture Overview
The AI interventions architecture combines deterministic heuristics with machine learning risk modeling and natural language understanding. Data flows from student records (academic scores, absences, statuses) into intervention logic and risk predictors, which feed both API endpoints and the AI chat engine. Results are surfaced to the frontend dashboard and can trigger automated communications.

```mermaid
sequenceDiagram
participant FE as "Frontend Widget"
participant API as "AI API (ai.py)"
participant ISR as "Intervention Service"
participant APC as "Risk Predictor"
participant DB as "Database"
FE->>API : "GET /ai/bulk-interventions"
API->>ISR : "analyze_student(student_id)"
ISR->>DB : "select Nota by aluno_id"
DB-->>ISR : "grades and absences"
ISR-->>API : "interventions and stats"
API-->>FE : "results"
FE->>API : "GET /ai/interventions/{aluno_id}"
API->>APC : "predict_risk(aluno_id)"
APC->>DB : "aggregate grades and absences"
DB-->>APC : "features"
APC-->>API : "risk score and factors"
API-->>FE : "risk + interventions"
```

**Diagram sources**
- [ai.py](file://backend/app/api/v1/ai.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)

## Detailed Component Analysis

### Risk Assessment Algorithms
The risk predictor trains a logistic regression model to classify students at risk of failure based on:
- Mean score across subjects
- Number of failing grades
- Total absences

Training and prediction logic:
- Training aggregates per-student features and labels a student as risky if they meet heuristic thresholds (e.g., multiple failing grades or excessive absences).
- Prediction computes a risk probability given the same features and returns a categorized risk level and contributing factors.

```mermaid
flowchart TD
Start(["Start"]) --> Load["Load student records"]
Load --> Features["Compute features:<br/>mean_score, low_grades, faltas"]
Features --> Train{"Has data?"}
Train --> |No| Warn["Log warning and skip training"]
Train --> |Yes| Fit["Fit logistic regression"]
Fit --> Save["Save model to disk"]
Save --> End(["End"])
subgraph "Prediction"
PStart(["Predict for student"]) --> PFeatures["Extract features"]
PFeatures --> PMatch{"Model exists?"}
PMatch --> |No| PTrain["Train model"]
PMatch --> |Yes| PProb["Compute risk probability"]
PTrain --> PProb
PProb --> PLevel["Map to risk level"]
PLevel --> PEnd(["Return score + factors"])
end
```

**Diagram sources**
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)

**Section sources**
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)

### Intervention Recommendations Engine
The intervention service analyzes a student’s academic record and attendance to produce:
- Subject category clustering (e.g., exact sciences, humanities, languages)
- Low-performing subjects and category-wise risk
- Attendance-based alerts
- Emergency, behavioral, academic, and maintenance recommendations
- Global risk classification and statistics

```mermaid
flowchart TD
S(["Start analyze_student"]) --> LoadA["Load student and grades"]
LoadA --> HasGrades{"Any grades?"}
HasGrades --> |No| Insuf["Return insufficient data"]
HasGrades --> |Yes| Loop["Iterate grades"]
Loop --> Score["Accumulate totals and counts"]
Score --> Cat["Map discipline to category"]
Cat --> Alerts{"Flags detected?"}
Alerts --> |Attendance high| Att["Add behavioral intervention"]
Alerts --> |Category risk| Acad["Add academic support intervention"]
Alerts --> |Subject very low| Emerg["Add emergency intervention"]
Alerts --> |None| Maint["Add maintenance intervention"]
Att --> Stats["Compute stats and global risk"]
Acad --> Stats
Emerg --> Stats
Maint --> Stats
Stats --> Done(["Return analysis"])
```

**Diagram sources**
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)

**Section sources**
- [intervention_service.py](file://backend/app/services/intervention_service.py)

### Pedagogical Analysis Capabilities
The AI Analyst Engine interprets natural language queries into actionable analytics:
- Intent detection via regex patterns for charts, risk lists, counts, faults, best students, performance comparisons, hardest subjects, status distributions, notices, occurrences, student lookups, dropout radar, missing grades, and pedagogical interventions.
- Filters extraction for class, grade level, shift, trimester, and student name.
- SQL-backed analytics with joins across students, grades, notices, and occurrences.
- Responses formatted as text, tables, or charts with metadata for the frontend.

```mermaid
sequenceDiagram
participant User as "User"
participant AIC as "AI Analyst Engine"
participant DB as "Database"
participant ISR as "Intervention Service"
User->>AIC : "Message"
AIC->>AIC : "Extract filters and intent"
alt Risky students
AIC->>DB : "Query students below threshold"
DB-->>AIC : "Results"
else Pedagogical intervention
AIC->>ISR : "analyze_student(aluno_id)"
ISR-->>AIC : "interventions"
else Notices/Occurrences
AIC->>DB : "Query notices/occurrences"
DB-->>AIC : "Results"
end
AIC-->>User : "Formatted response (text/table/chart)"
```

**Diagram sources**
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [comunicado.py](file://backend/app/models/comunicado.py)

**Section sources**
- [ai_chat.py](file://backend/app/services/ai_chat.py)

### Integration with External AI Services and Prompt Engineering
Current implementation uses local heuristics and ML models. To integrate external AI services:
- Define a unified interface for AI providers (e.g., OpenAI, Claude, Azure OpenAI) with standardized prompts and response parsing.
- Implement a provider-agnostic adapter that accepts structured inputs (student profile, historical data) and returns structured outputs (risk score, recommendations, action items).
- Apply prompt engineering patterns:
  - Role and persona definition for educators
  - Step-by-step reasoning blocks
  - Structured output schemas (JSON) for downstream processing
  - Safety guards against prompt injection and policy violations
- Add caching and fallback strategies to handle latency and outages.

[No sources needed since this section provides general guidance]

### Response Processing and Delivery
- Risk predictor returns a numeric score and categorical status with contributing factors.
- Intervention service returns prioritized actions with impact categories and descriptions.
- AI chat engine formats analytics into text, tables, or charts with chart configurations.
- Communication service supports email and WhatsApp delivery using configured credentials and endpoints.

```mermaid
classDiagram
class RiskPredictor {
+train_risk_model(session)
+predict_risk(aluno_id, session) dict
}
class InterventionService {
+get_subject_category(disciplina) str
+analyze_student(session, aluno_id) dict
}
class AIAnalystEngine {
+process_query(message) AIResponse
+_analyze_interventions(session, filters) AIResponse
}
class CommunicationService {
+send_email(to_email, subject, body) bool
+send_whatsapp(phone, message) bool
}
RiskPredictor --> Aluno : "reads"
RiskPredictor --> Nota : "reads"
InterventionService --> Aluno : "reads"
InterventionService --> Nota : "reads"
AIAnalystEngine --> InterventionService : "calls"
AIAnalystEngine --> Aluno : "reads"
AIAnalystEngine --> Nota : "reads"
AIAnalystEngine --> Ocorrencia : "reads"
AIAnalystEngine --> Comunicado : "reads"
CommunicationService --> Settings : "uses"
```

**Diagram sources**
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [comunicado.py](file://backend/app/models/comunicado.py)
- [config.py](file://backend/app/core/config.py)

**Section sources**
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [config.py](file://backend/app/core/config.py)

### API Workflows and Examples
- Single student interventions: GET /ai/interventions/{aluno_id}
- Bulk interventions: POST /ai/bulk-interventions with student_ids array
- AI chat analytics: Natural language queries processed by AI Analyst Engine

Concrete examples from the codebase:
- Single student analysis endpoint returns interventions and stats for a given aluno_id.
- Bulk endpoint iterates student IDs, invokes the intervention service, and returns aggregated results.
- AI chat engine routes messages to specific analyzers and returns formatted responses.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "ai.py"
participant ISR as "intervention_service.py"
Client->>API : "GET /ai/interventions/{aluno_id}"
API->>ISR : "analyze_student(session, aluno_id)"
ISR-->>API : "analysis"
API-->>Client : "JSON response"
Client->>API : "POST /ai/bulk-interventions {student_ids}"
API->>ISR : "analyze_student for each ID"
ISR-->>API : "analysis[]"
API-->>Client : "{count, results}"
```

**Diagram sources**
- [ai.py](file://backend/app/api/v1/ai.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)

**Section sources**
- [ai.py](file://backend/app/api/v1/ai.py)
- [test_intervention.py](file://backend/test_intervention.py)

### Frontend Integration and Visualization
The AI Intervention Board fetches bulk interventions and renders them as cards with:
- Priority indicators (high/medium/low)
- Titles and descriptions of recommended actions
- Student name and avatar
- Responsive grid layout

```mermaid
sequenceDiagram
participant Widget as "AIInterventionBoard.tsx"
participant API as "ai.py"
participant ISR as "intervention_service.py"
Widget->>API : "useGetBulkInterventionsMutation({student_ids})"
API->>ISR : "analyze_student for each"
ISR-->>API : "interventions"
API-->>Widget : "results"
Widget->>Widget : "render cards with priority badges"
```

**Diagram sources**
- [AIInterventionBoard.tsx](file://frontend/src/features/dashboard/AIInterventionBoard.tsx)
- [ai.py](file://backend/app/api/v1/ai.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)

**Section sources**
- [AIInterventionBoard.tsx](file://frontend/src/features/dashboard/AIInterventionBoard.tsx)

## Dependency Analysis
- Data models: Aluno, Nota, Ocorrencia, Comunicado form the foundation for analytics and intervention logic.
- Services depend on SQLAlchemy ORM to query and aggregate data.
- API endpoints depend on services and enforce role-based access.
- Communication service depends on configuration settings for external API endpoints.

```mermaid
graph LR
API["ai.py"] --> ISR["intervention_service.py"]
API --> APC["ai_predictor.py"]
ISR --> ALU["aluno.py"]
ISR --> NOT["nota.py"]
APC --> ALU
APC --> NOT
AIC["ai_chat.py"] --> ISR
AIC --> ALU
AIC --> NOT
AIC --> OCC["ocorrencia.py"]
AIC --> COMD["comunicado.py"]
COM["communication_service.py"] --> CFG["config.py"]
```

**Diagram sources**
- [ai.py](file://backend/app/api/v1/ai.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [comunicado.py](file://backend/app/models/comunicado.py)
- [config.py](file://backend/app/core/config.py)

**Section sources**
- [ai.py](file://backend/app/api/v1/ai.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [ai_chat.py](file://backend/app/services/ai_chat.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [comunicado.py](file://backend/app/models/comunicado.py)
- [config.py](file://backend/app/core/config.py)

## Performance Considerations
- Minimize repeated scans by aggregating data per student during training and prediction.
- Use database indexes on frequently filtered columns (e.g., aluno_id, turma, turno).
- Cache trained models and invalidate on schema changes.
- Batch operations for bulk interventions to reduce round trips.
- Limit result sets for analytics to avoid heavy queries.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Model not found: The risk predictor automatically trains a model if none exists. Verify training logs and data availability.
- Empty or insufficient data: Intervention service returns a “DADOS_INSUFICIENTES” status when no grades are present.
- Permission errors: API endpoints require JWT and appropriate roles (admin, coordenador, professor).
- Communication failures: Check SMTP and WhatsApp configuration settings and network connectivity.

**Section sources**
- [ai_predictor.py](file://backend/app/services/ai_predictor.py)
- [intervention_service.py](file://backend/app/services/intervention_service.py)
- [ai.py](file://backend/app/api/v1/ai.py)
- [communication_service.py](file://backend/app/services/communication_service.py)
- [config.py](file://backend/app/core/config.py)

## Conclusion
The AI-powered interventions subsystem combines local heuristics, a lightweight ML risk model, and a natural language analytics engine to deliver actionable insights for educators. By connecting academic records, attendance, and behavioral data, it enables early warning systems, personalized recommendations, and intervention tracking. The modular architecture allows straightforward extension to external AI services and robust integration with communication channels.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Data Relationships Overview
```mermaid
erDiagram
ALUNO {
int id PK
string matricula
string nome
string turma
string turno
}
NOTA {
int id PK
int aluno_id FK
string disciplina
float trimestre1
float trimestre2
float trimestre3
float total
int faltas
string situacao
}
OCORRENCIA {
int id PK
int aluno_id FK
string tipo
string descricao
string gravidade
datetime data_registro
}
COMUNICADO {
int id PK
int autor_id FK
string titulo
text conteudo
datetime data_envio
string target_type
string target_value
}
ALUNO ||--o{ NOTA : "has many"
ALUNO ||--o{ OCORRENCIA : "has many"
USUARIO ||--o{ OCORRENCIA : "author"
USUARIO ||--o{ COMUNICADO : "author"
```

**Diagram sources**
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [comunicado.py](file://backend/app/models/comunicado.py)