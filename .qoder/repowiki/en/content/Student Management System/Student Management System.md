# Student Management System

<cite>
**Referenced Files in This Document**
- [aluno.py](file://backend/app/models/aluno.py)
- [aluno.py](file://backend/app/schemas/aluno.py)
- [aluno_repository.py](file://backend/app/repositories/aluno_repository.py)
- [aluno_service.py](file://backend/app/services/aluno_service.py)
- [alunos.py](file://backend/app/api/v1/alunos.py)
- [base.py](file://backend/app/repositories/base.py)
- [base_mixin.py](file://backend/app/models/base_mixin.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [ocorrencia.py](file://backend/app/schemas/ocorrencia.py)
- [ocorrencia_repository.py](file://backend/app/repositories/ocorrencia_repository.py)
- [turmas.py](file://backend/app/api/v1/turmas.py)
- [turma_service.py](file://backend/app/services/turma_service.py)
- [AlunosPage.tsx](file://frontend/src/features/alunos/AlunosPage.tsx)
- [AlunoForm.tsx](file://frontend/src/features/alunos/AlunoForm.tsx)
- [AlunoDetailPage.tsx](file://frontend/src/features/alunos/AlunoDetailPage.tsx)
- [MeuBoletimPage.tsx](file://frontend/src/features/alunos/MeuBoletimPage.tsx)
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
This document explains the Student Management System within the platform, focusing on student record lifecycle, personal data handling, enrollment processes, and portal functionality. It covers the complete CRUD operations, data validation, integration with academic tracking (grades), and connections to disciplinary records. Administrators will find practical guidance for managing students, while developers gain technical depth for extending or integrating features.

## Project Structure
The student management system spans backend API endpoints, services, repositories, SQLAlchemy models, Pydantic schemas, and frontend pages. The backend follows a layered architecture:
- API layer: Flask blueprints expose endpoints for listing, retrieving, creating, updating, and deleting students, plus PDF generation.
- Service layer: Orchestrates business logic, pagination, filtering, and computed averages.
- Repository layer: Encapsulates database queries and persistence.
- Model layer: SQLAlchemy ORM models define entities and relationships.
- Schema layer: Pydantic models validate and serialize request/response payloads.
- Frontend: React pages provide search, filtering, forms, and report generation.

```mermaid
graph TB
subgraph "Frontend"
AP["AlunosPage.tsx"]
AF["AlunoForm.tsx"]
AD["AlunoDetailPage.tsx"]
MB["MeuBoletimPage.tsx"]
end
subgraph "Backend API"
EP["alunos.py"]
end
subgraph "Services"
AS["aluno_service.py"]
TS["turma_service.py"]
end
subgraph "Repositories"
AR["aluno_repository.py"]
BR["base_repository.py"]
OR["ocorrencia_repository.py"]
end
subgraph "Models & Schemas"
AM["aluno.py (model)"]
NS["nota.py (model)"]
OS["ocorrencia.py (model)"]
ASch["aluno.py (schemas)"]
OSch["ocorrencia.py (schema)"]
TY["turmas.py (endpoint)"]
end
AP --> EP
AF --> EP
AD --> EP
MB --> EP
EP --> AS
AS --> AR
AR --> BR
AS --> AM
AM --> NS
AM --> OS
AD --> OS
MB --> OS
EP --> TS
TS --> NS
EP --> OSch
EP --> ASch
```

**Diagram sources**
- [alunos.py:12-148](file://backend/app/api/v1/alunos.py#L12-L148)
- [aluno_service.py:15-156](file://backend/app/services/aluno_service.py#L15-L156)
- [aluno_repository.py:8-105](file://backend/app/repositories/aluno_repository.py#L8-L105)
- [base.py:7-41](file://backend/app/repositories/base.py#L7-L41)
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [ocorrencia.py:9-45](file://backend/app/models/ocorrencia.py#L9-L45)
- [aluno.py:18-85](file://backend/app/schemas/aluno.py#L18-L85)
- [ocorrencia.py:5-36](file://backend/app/schemas/ocorrencia.py#L5-L36)
- [turmas.py:11-42](file://backend/app/api/v1/turmas.py#L11-L42)
- [turma_service.py:16-128](file://backend/app/services/turma_service.py#L16-L128)
- [AlunosPage.tsx:51-341](file://frontend/src/features/alunos/AlunosPage.tsx#L51-L341)
- [AlunoForm.tsx:14-293](file://frontend/src/features/alunos/AlunoForm.tsx#L14-L293)
- [AlunoDetailPage.tsx:95-485](file://frontend/src/features/alunos/AlunoDetailPage.tsx#L95-L485)
- [MeuBoletimPage.tsx:49-278](file://frontend/src/features/alunos/MeuBoletimPage.tsx#L49-L278)

**Section sources**
- [alunos.py:12-148](file://backend/app/api/v1/alunos.py#L12-L148)
- [aluno_service.py:15-156](file://backend/app/services/aluno_service.py#L15-L156)
- [aluno_repository.py:8-105](file://backend/app/repositories/aluno_repository.py#L8-L105)
- [base.py:7-41](file://backend/app/repositories/base.py#L7-L41)
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [ocorrencia.py:9-45](file://backend/app/models/ocorrencia.py#L9-L45)
- [aluno.py:18-85](file://backend/app/schemas/aluno.py#L18-L85)
- [ocorrencia.py:5-36](file://backend/app/schemas/ocorrencia.py#L5-L36)
- [turmas.py:11-42](file://backend/app/api/v1/turmas.py#L11-L42)
- [turma_service.py:16-128](file://backend/app/services/turma_service.py#L16-L128)
- [AlunosPage.tsx:51-341](file://frontend/src/features/alunos/AlunosPage.tsx#L51-L341)
- [AlunoForm.tsx:14-293](file://frontend/src/features/alunos/AlunoForm.tsx#L14-L293)
- [AlunoDetailPage.tsx:95-485](file://frontend/src/features/alunos/AlunoDetailPage.tsx#L95-L485)
- [MeuBoletimPage.tsx:49-278](file://frontend/src/features/alunos/MeuBoletimPage.tsx#L49-L278)

## Core Components
- Student entity: Core attributes include registration number, name, class, shift, status, and extensive personal data fields. It maintains relationships to grades and user accounts.
- Academic records: Grades are stored per subject with trimester scores, totals, absences, and status. Aggregations are computed per student.
- Disciplinary records: Offenses are linked to students with severity levels, actions taken, and notification status.
- Service orchestration: Handles pagination, filtering, computed averages, and PDF generation.
- API endpoints: Provide secure access with role-based permissions, input validation, and tenant/year scoping.

**Section sources**
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [ocorrencia.py:9-45](file://backend/app/models/ocorrencia.py#L9-L45)
- [aluno_service.py:15-156](file://backend/app/services/aluno_service.py#L15-L156)
- [alunos.py:15-148](file://backend/app/api/v1/alunos.py#L15-L148)

## Architecture Overview
The system enforces multitenancy and academic year scoping via a shared mixin. Requests are authenticated and authorized, then routed to services that query repositories and models. Results are validated by Pydantic schemas and returned to clients. Frontend pages consume the API for listing, filtering, editing, and generating reports.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "alunos.py"
participant Service as "AlunoService"
participant Repo as "AlunoRepository"
participant DB as "SQLAlchemy"
Client->>API : GET /alunos?page&per_page&turno&turma&q
API->>Service : list_alunos(page, per_page, filters)
Service->>Repo : get_paginated_with_average(...)
Repo->>DB : SELECT ... JOIN ... GROUP BY ...
DB-->>Repo : Results + Count
Repo-->>Service : List[Tuple[Aluno, float, int]], total
Service->>Service : Build AlunoListSchema items
Service-->>API : AlunoPaginatedResponse
API-->>Client : JSON { items, meta }
```

**Diagram sources**
- [alunos.py:18-41](file://backend/app/api/v1/alunos.py#L18-L41)
- [aluno_service.py:20-61](file://backend/app/services/aluno_service.py#L20-L61)
- [aluno_repository.py:12-74](file://backend/app/repositories/aluno_repository.py#L12-L74)

**Section sources**
- [alunos.py:18-41](file://backend/app/api/v1/alunos.py#L18-L41)
- [aluno_service.py:20-61](file://backend/app/services/aluno_service.py#L20-L61)
- [aluno_repository.py:12-74](file://backend/app/repositories/aluno_repository.py#L12-L74)

## Detailed Component Analysis

### Student Entity and Relationships
The student entity encapsulates core and personal data, and connects to academic and user domains.

```mermaid
classDiagram
class Aluno {
+int id
+string matricula
+string nome
+string turma
+string turno
+string status
+string sexo
+string data_nascimento
+string naturalidade
+string zona
+string endereco
+string filiacao
+string telefones
+string cpf
+string nis
+string inep
+string situacao_anterior
+string email
}
class Nota {
+int id
+int aluno_id
+string disciplina
+float trimestre1
+float trimestre2
+float trimestre3
+float total
+int faltas
+string situacao
}
class Usuario {
+int id
+string username
+string email
+int? aluno_id
}
Aluno "1" <-- "many" Nota : "back_populates"
Aluno "1" <-- "1" Usuario : "back_populates"
```

**Diagram sources**
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [aluno.py:8-30](file://backend/app/models/usuario.py#L8-L30)

**Section sources**
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [aluno.py:8-30](file://backend/app/models/usuario.py#L8-L30)

### Academic Records Integration
Grades are aggregated per student for lists and detailed views. The repository computes averages and sums of absences, applying tenant and academic year scoping.

```mermaid
flowchart TD
Start(["Repository Query"]) --> BuildAvg["Build AVG(total) per aluno"]
BuildAvg --> SumAbs["Build SUM(faltas) per aluno"]
SumAbs --> FilterTenant{"Tenant filter?"}
FilterTenant --> |Yes| ApplyTenant["Apply tenant_id filter"]
FilterTenant --> |No| SkipTenant["Skip tenant filter"]
ApplyTenant --> FilterYear{"Year filter?"}
SkipTenant --> FilterYear
FilterYear --> |Yes| ApplyYear["Apply academic_year_id filter"]
FilterYear --> |No| SkipYear["Skip year filter"]
ApplyYear --> Order["ORDER BY nome"]
SkipYear --> Order
Order --> Paginate["OFFSET/LIMIT"]
Paginate --> End(["Return (Aluno, media, faltas)"])
```

**Diagram sources**
- [aluno_repository.py:12-74](file://backend/app/repositories/aluno_repository.py#L12-L74)

**Section sources**
- [aluno_repository.py:12-74](file://backend/app/repositories/aluno_repository.py#L12-L74)
- [turma_service.py:48-102](file://backend/app/services/turma_service.py#L48-L102)

### Disciplinary Records Integration
Disciplinary records are associated with students and can be filtered by tenant and academic year. The schema exposes display-friendly fields and supports creation with optional notifications.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "Ocorrencia endpoints"
participant Service as "OcorrenciaService"
participant Repo as "OcorrenciaRepository"
participant DB as "SQLAlchemy"
Client->>API : GET /ocorrencias?aluno_id
API->>Service : list_filtered(aluno_id)
Service->>Repo : list_filtered(...)
Repo->>DB : SELECT ... ORDER BY data_registro DESC
DB-->>Repo : List<Ocorrencia>
Repo-->>Service : List<Ocorrencia>
Service-->>API : List<OcorrenciaSchema>
API-->>Client : JSON
```

**Diagram sources**
- [ocorrencia_repository.py:12-27](file://backend/app/repositories/ocorrencia_repository.py#L12-L27)
- [ocorrencia.py:5-36](file://backend/app/schemas/ocorrencia.py#L5-L36)

**Section sources**
- [ocorrencia.py:9-45](file://backend/app/models/ocorrencia.py#L9-L45)
- [ocorrencia.py:5-36](file://backend/app/schemas/ocorrencia.py#L5-L36)
- [ocorrencia_repository.py:12-27](file://backend/app/repositories/ocorrencia_repository.py#L12-L27)

### Student CRUD Workflows

#### Create Student
- Endpoint: POST /api/v1/alunos
- Validation: Pydantic AlunoCreate schema
- Persistence: Repository creates Aluno, service logs action
- Response: AlunoListSchema

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "POST /alunos"
participant Service as "AlunoService"
participant Repo as "AlunoRepository"
participant DB as "SQLAlchemy"
Client->>API : JSON {matricula,nome,turma,turno,...}
API->>API : Validate with AlunoCreate
API->>Service : create_aluno(payload)
Service->>Repo : create(data)
Repo->>DB : INSERT alunos
DB-->>Repo : Aluno instance
Repo-->>Service : Aluno
Service-->>API : AlunoListSchema
API-->>Client : 201 JSON
```

**Diagram sources**
- [alunos.py:66-78](file://backend/app/api/v1/alunos.py#L66-L78)
- [aluno_service.py:95-105](file://backend/app/services/aluno_service.py#L95-L105)
- [aluno_repository.py:19-24](file://backend/app/repositories/aluno_repository.py#L19-L24)

**Section sources**
- [alunos.py:66-78](file://backend/app/api/v1/alunos.py#L66-L78)
- [aluno_service.py:95-105](file://backend/app/services/aluno_service.py#L95-L105)
- [aluno_repository.py:19-24](file://backend/app/repositories/aluno_repository.py#L19-L24)

#### Update Student
- Endpoint: PATCH /api/v1/alunos/{id}
- Validation: Pydantic AlunoUpdate schema
- Persistence: Repository updates fields, service logs action
- Response: AlunoListSchema or 404

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "PATCH /alunos/ : id"
participant Service as "AlunoService"
participant Repo as "AlunoRepository"
participant DB as "SQLAlchemy"
Client->>API : JSON {partial fields}
API->>API : Validate with AlunoUpdate
API->>Service : update_aluno(id, data)
Service->>Repo : get(id)
Repo->>DB : SELECT alunos WHERE id=?
DB-->>Repo : Aluno or NULL
alt Found
Service->>Repo : update(aluno, data)
Repo->>DB : UPDATE alunos SET ...
DB-->>Repo : Updated Aluno
Repo-->>Service : Updated Aluno
Service-->>API : AlunoListSchema
API-->>Client : 200 JSON
else Not Found
Service-->>API : None
API-->>Client : 404 JSON
end
```

**Diagram sources**
- [alunos.py:83-97](file://backend/app/api/v1/alunos.py#L83-L97)
- [aluno_service.py:107-122](file://backend/app/services/aluno_service.py#L107-L122)
- [aluno_repository.py:26-32](file://backend/app/repositories/aluno_repository.py#L26-L32)

**Section sources**
- [alunos.py:83-97](file://backend/app/api/v1/alunos.py#L83-L97)
- [aluno_service.py:107-122](file://backend/app/services/aluno_service.py#L107-L122)
- [aluno_repository.py:26-32](file://backend/app/repositories/aluno_repository.py#L26-L32)

#### Delete Student
- Endpoint: DELETE /api/v1/alunos/{id}
- Cascade: Grades are deleted via CASCADE on aluno_id
- Response: 204 No Content or 404 Not Found

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "DELETE /alunos/ : id"
participant Service as "AlunoService"
participant Repo as "AlunoRepository"
participant DB as "SQLAlchemy"
Client->>API : DELETE
API->>Service : delete_aluno(id)
Service->>Repo : delete(id)
Repo->>DB : DELETE FROM alunos WHERE id=?
DB-->>Repo : Rows affected
Repo-->>Service : bool
alt Success
Service-->>API : True
API-->>Client : 204
else Not Found
Service-->>API : False
API-->>Client : 404 JSON
end
```

**Diagram sources**
- [alunos.py:99-109](file://backend/app/api/v1/alunos.py#L99-L109)
- [aluno_service.py:124-128](file://backend/app/services/aluno_service.py#L124-L128)
- [aluno_repository.py:34-40](file://backend/app/repositories/aluno_repository.py#L34-L40)

**Section sources**
- [alunos.py:99-109](file://backend/app/api/v1/alunos.py#L99-L109)
- [aluno_service.py:124-128](file://backend/app/services/aluno_service.py#L124-L128)
- [aluno_repository.py:34-40](file://backend/app/repositories/aluno_repository.py#L34-L40)

### Portal Functionality and Search
- Listing and Filtering: Students can be filtered by shift, class, and free-text search across name, registration number, and class. Pagination is supported.
- Detail View: Retrieves student details, average grade, absence count, and ordered grades.
- Personal Data: Extensive personal fields are exposed in detail and editable via forms.
- Reports: PDF generation endpoint produces a transcript-like document for a given student.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "GET /alunos/ : id"
participant Service as "AlunoService"
participant Repo as "AlunoRepository"
participant DB as "SQLAlchemy"
Client->>API : GET /alunos/ : id
API->>Service : get_aluno_details(id)
Service->>Repo : get_with_notes(id)
Repo->>DB : SELECT aluno, AVG(total), SUM(faltas)
DB-->>Repo : (Aluno, media, notas)
Repo-->>Service : (Aluno, media, notas)
Service-->>API : AlunoDetailSchema
API-->>Client : JSON
```

**Diagram sources**
- [alunos.py:43-61](file://backend/app/api/v1/alunos.py#L43-L61)
- [aluno_service.py:63-93](file://backend/app/services/aluno_service.py#L63-L93)
- [aluno_repository.py:76-104](file://backend/app/repositories/aluno_repository.py#L76-L104)

**Section sources**
- [alunos.py:18-61](file://backend/app/api/v1/alunos.py#L18-L61)
- [aluno_service.py:20-93](file://backend/app/services/aluno_service.py#L20-L93)
- [aluno_repository.py:12-104](file://backend/app/repositories/aluno_repository.py#L12-L104)

### Enrollment and Class Integration
- Class lookup: Teachers/coordinators can list classes and retrieve enrolled students per class.
- Academic aggregation: Class detail view aggregates student grades and calculates class-level averages and statuses.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "GET /turmas/ : turma/alunos"
participant Service as "TurmaService"
participant Repo as "TurmaRepository"
participant DB as "SQLAlchemy"
Client->>API : GET /turmas/ : turma/alunos
API->>Service : get_turma_detail(turma_nome)
Service->>Repo : get_alunos_by_turma(turma)
Repo->>DB : SELECT alunos WHERE turma=...
DB-->>Repo : List[Aluno]
Service->>Repo : get_notas_for_alunos(aluno_ids)
Repo->>DB : SELECT notas WHERE aluno_id IN (...)
DB-->>Repo : List[Nota]
Repo-->>Service : Notas grouped by aluno
Service-->>API : TurmaDetailResponse
API-->>Client : JSON
```

**Diagram sources**
- [turmas.py:24-39](file://backend/app/api/v1/turmas.py#L24-L39)
- [turma_service.py:48-102](file://backend/app/services/turma_service.py#L48-L102)

**Section sources**
- [turmas.py:24-39](file://backend/app/api/v1/turmas.py#L24-L39)
- [turma_service.py:48-102](file://backend/app/services/turma_service.py#L48-L102)

### Frontend Pages and User Interactions
- Student listing: Supports search, shift/class filters, and pagination; displays average and absences.
- Student form: Captures basic and personal data; masks phone numbers; handles create/update.
- Student detail: Shows grades table, personal info, and AI insights; allows PDF download.
- My Transcript: Self-service page for students to view and download transcripts; integrates with disciplinary and announcements.

```mermaid
graph TB
LP["AlunosPage.tsx"] --> API["/api/v1/alunos"]
LF["AlunoForm.tsx"] --> API
LD["AlunoDetailPage.tsx"] --> API
MB["MeuBoletimPage.tsx"] --> API
API --> Svc["AlunoService"]
Svc --> Repo["AlunoRepository"]
```

**Diagram sources**
- [AlunosPage.tsx:51-341](file://frontend/src/features/alunos/AlunosPage.tsx#L51-L341)
- [AlunoForm.tsx:14-293](file://frontend/src/features/alunos/AlunoForm.tsx#L14-L293)
- [AlunoDetailPage.tsx:95-485](file://frontend/src/features/alunos/AlunoDetailPage.tsx#L95-L485)
- [MeuBoletimPage.tsx:49-278](file://frontend/src/features/alunos/MeuBoletimPage.tsx#L49-L278)
- [alunos.py:18-148](file://backend/app/api/v1/alunos.py#L18-L148)

**Section sources**
- [AlunosPage.tsx:51-341](file://frontend/src/features/alunos/AlunosPage.tsx#L51-L341)
- [AlunoForm.tsx:14-293](file://frontend/src/features/alunos/AlunoForm.tsx#L14-L293)
- [AlunoDetailPage.tsx:95-485](file://frontend/src/features/alunos/AlunoDetailPage.tsx#L95-L485)
- [MeuBoletimPage.tsx:49-278](file://frontend/src/features/alunos/MeuBoletimPage.tsx#L49-L278)

## Dependency Analysis
- Multitenancy and academic year scoping: Implemented via TenantYearMixin applied to student, grades, and disciplinary models.
- Cohesion: Services encapsulate business logic; repositories isolate persistence; schemas validate inputs/outputs.
- Coupling: API depends on services; services depend on repositories; repositories depend on SQLAlchemy models.
- External integrations: PDF generation uses HTML rendering and PDF conversion; JWT-based authentication and role checks.

```mermaid
graph LR
Mix["TenantYearMixin"] --> AM["Aluno model"]
Mix --> NM["Nota model"]
Mix --> OM["Ocorrencia model"]
API["alunos.py"] --> SVC["AlunoService"]
SVC --> REP["AlunoRepository"]
REP --> AM
REP --> NM
REP --> OM
API --> TS["TurmaService"]
TS --> NM
```

**Diagram sources**
- [base_mixin.py:4-22](file://backend/app/models/base_mixin.py#L4-L22)
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [ocorrencia.py:9-45](file://backend/app/models/ocorrencia.py#L9-L45)
- [alunos.py:12-148](file://backend/app/api/v1/alunos.py#L12-L148)
- [aluno_service.py:15-156](file://backend/app/services/aluno_service.py#L15-L156)
- [aluno_repository.py:8-105](file://backend/app/repositories/aluno_repository.py#L8-L105)
- [turma_service.py:16-128](file://backend/app/services/turma_service.py#L16-L128)

**Section sources**
- [base_mixin.py:4-22](file://backend/app/models/base_mixin.py#L4-L22)
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [ocorrencia.py:9-45](file://backend/app/models/ocorrencia.py#L9-L45)
- [alunos.py:12-148](file://backend/app/api/v1/alunos.py#L12-L148)
- [aluno_service.py:15-156](file://backend/app/services/aluno_service.py#L15-L156)
- [aluno_repository.py:8-105](file://backend/app/repositories/aluno_repository.py#L8-L105)
- [turma_service.py:16-128](file://backend/app/services/turma_service.py#L16-L128)

## Performance Considerations
- Pagination limits: API enforces maximum items per page to prevent heavy loads.
- Aggregation queries: Repository groups by student and joins with grades to compute averages and absences efficiently.
- Tenant/year scoping: Filters reduce result sets early in queries.
- Frontend caching: Queries are configured to refetch on focus/mount to keep data fresh without excessive polling.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Authentication errors: Ensure JWT bearer token is present and roles include permitted roles for the endpoint.
- Authorization errors: Student-only users can only access their own profile; cross-check claims and ID.
- Validation errors: Verify request payloads conform to AlunoCreate/AlunoUpdate schemas; server returns structured error details.
- Not found errors: Deleting or updating a non-existent student returns 404; confirm IDs and tenant/year context.
- PDF generation failures: Confirm the student exists and the tenant/year context is set; check server logs for rendering issues.

**Section sources**
- [alunos.py:46-51](file://backend/app/api/v1/alunos.py#L46-L51)
- [alunos.py:68-72](file://backend/app/api/v1/alunos.py#L68-L72)
- [alunos.py:95-97](file://backend/app/api/v1/alunos.py#L95-L97)
- [alunos.py:121-122](file://backend/app/api/v1/alunos.py#L121-L122)

## Conclusion
The Student Management System provides a robust, secure, and scalable foundation for student lifecycle management. It integrates academic tracking and disciplinary records while offering intuitive administrative and student-facing portals. The layered architecture, strong validation, and tenant/year scoping support reliable operations across diverse environments.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API Endpoints Summary
- GET /api/v1/alunos: List students with pagination and filters
- GET /api/v1/alunos/{id}: Retrieve student detail
- POST /api/v1/alunos: Create student
- PATCH /api/v1/alunos/{id}: Update student
- DELETE /api/v1/alunos/{id}: Delete student
- GET /api/v1/alunos/{id}/boletim/pdf: Download transcript PDF

**Section sources**
- [alunos.py:15-148](file://backend/app/api/v1/alunos.py#L15-L148)

### Data Validation Rules
- Required fields: Registration number, name, class, shift
- Optional fields: Personal data, contact, identifiers, previous year status
- Phone masking: Frontend applies formatting for Brazilian phone numbers

**Section sources**
- [aluno.py:59-80](file://backend/app/schemas/aluno.py#L59-L80)
- [AlunoForm.tsx:28-60](file://frontend/src/features/alunos/AlunoForm.tsx#L28-L60)

### Common Use Cases
- Student search: Use query parameter q to search by name, registration number, or class
- Bulk operations: Use class listing to export student rosters; integrate with external tools
- Data import/export: Use class endpoints to retrieve student lists; combine with grade data for reporting

**Section sources**
- [alunos.py:20-27](file://backend/app/api/v1/alunos.py#L20-L27)
- [turmas.py:24-39](file://backend/app/api/v1/turmas.py#L24-L39)