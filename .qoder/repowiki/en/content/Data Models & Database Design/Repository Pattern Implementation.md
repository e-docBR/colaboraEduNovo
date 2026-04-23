# Repository Pattern Implementation

<cite>
**Referenced Files in This Document**
- [base.py](file://backend/app/repositories/base.py)
- [aluno_repository.py](file://backend/app/repositories/aluno_repository.py)
- [turma_repository.py](file://backend/app/repositories/turma_repository.py)
- [ocorrencia_repository.py](file://backend/app/repositories/ocorrencia_repository.py)
- [usuario_repository.py](file://backend/app/repositories/usuario_repository.py)
- [tenant_repository.py](file://backend/app/repositories/tenant_repository.py)
- [database.py](file://backend/app/core/database.py)
- [base_mixin.py](file://backend/app/models/base_mixin.py)
- [aluno.py](file://backend/app/models/aluno.py)
- [nota.py](file://backend/app/models/nota.py)
- [ocorrencia.py](file://backend/app/models/ocorrencia.py)
- [usuario.py](file://backend/app/models/usuario.py)
- [tenant.py](file://backend/app/models/tenant.py)
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

## Introduction
This document explains the repository pattern implementation in the backend’s data access layer. It covers the generic BaseRepository for common CRUD operations, tenant-aware filtering via SQLAlchemy events, and specialized repositories for each domain model. It also documents query composition, data transformation patterns, and how repositories integrate with services and middleware.

## Project Structure
The data access layer follows a layered architecture:
- Core database and tenant filtering live in the core module.
- Domain models define entities and tenant/year mixins.
- Repositories encapsulate persistence logic per model.
- Services orchestrate business workflows and depend on repositories.

```mermaid
graph TB
subgraph "Core"
DB["database.py<br/>SQLAlchemy engine, session, tenant filters"]
MIXIN["base_mixin.py<br/>TenantYearMixin"]
end
subgraph "Models"
ALUNO["aluno.py<br/>Aluno"]
NOTA["nota.py<br/>Nota"]
OCORR["ocorrencia.py<br/>Ocorrencia"]
USUARIO["usuario.py<br/>Usuario"]
TENANT["tenant.py<br/>Tenant"]
end
subgraph "Repositories"
BASE["base.py<br/>BaseRepository[T]"]
ALUNO_REPO["aluno_repository.py<br/>AlunoRepository"]
TURMA_REPO["turma_repository.py<br/>TurmaRepository"]
OCORR_REPO["ocorrencia_repository.py<br/>OcorrenciaRepository"]
USUARIO_REPO["usuario_repository.py<br/>UsuarioRepository"]
TENANT_REPO["tenant_repository.py<br/>TenantRepository"]
end
DB --> ALUNO
DB --> NOTA
DB --> OCORR
DB --> USUARIO
DB --> TENANT
MIXIN --> ALUNO
MIXIN --> NOTA
MIXIN --> OCORR
BASE --> ALUNO_REPO
BASE --> TURMA_REPO
BASE --> OCORR_REPO
BASE --> USUARIO_REPO
BASE --> TENANT_REPO
ALUNO_REPO --> ALUNO
ALUNO_REPO --> NOTA
TURMA_REPO --> ALUNO
TURMA_REPO --> NOTA
OCORR_REPO --> OCORR
USUARIO_REPO --> USUARIO
USUARIO_REPO --> ALUNO
TENANT_REPO --> TENANT
```

**Diagram sources**
- [database.py:1-130](file://backend/app/core/database.py#L1-L130)
- [base_mixin.py:1-22](file://backend/app/models/base_mixin.py#L1-L22)
- [base.py:1-41](file://backend/app/repositories/base.py#L1-L41)
- [aluno_repository.py:1-105](file://backend/app/repositories/aluno_repository.py#L1-L105)
- [turma_repository.py:1-101](file://backend/app/repositories/turma_repository.py#L1-L101)
- [ocorrencia_repository.py:1-27](file://backend/app/repositories/ocorrencia_repository.py#L1-L27)
- [usuario_repository.py:1-68](file://backend/app/repositories/usuario_repository.py#L1-L68)
- [tenant_repository.py:1-21](file://backend/app/repositories/tenant_repository.py#L1-L21)
- [aluno.py:1-36](file://backend/app/models/aluno.py#L1-L36)
- [nota.py:1-24](file://backend/app/models/nota.py#L1-L24)
- [ocorrencia.py:1-45](file://backend/app/models/ocorrencia.py#L1-L45)
- [usuario.py:1-30](file://backend/app/models/usuario.py#L1-L30)
- [tenant.py:1-22](file://backend/app/models/tenant.py#L1-L22)

**Section sources**
- [database.py:1-130](file://backend/app/core/database.py#L1-L130)
- [base_mixin.py:1-22](file://backend/app/models/base_mixin.py#L1-L22)
- [base.py:1-41](file://backend/app/repositories/base.py#L1-L41)

## Core Components
- BaseRepository[T]: Provides generic CRUD operations and leverages the SQLAlchemy session to persist changes. It supports type-safe operations through a generic type variable.
- Tenant-aware filtering: Implemented via a session event hook that appends tenant_id and academic_year_id conditions to SELECT statements automatically, based on Flask’s request context.

Key capabilities:
- Retrieve by ID, fetch paginated lists, create, update, and delete records.
- Automatic tenant and academic year scoping for queries through the session event hook.

**Section sources**
- [base.py:7-41](file://backend/app/repositories/base.py#L7-L41)
- [database.py:39-102](file://backend/app/core/database.py#L39-L102)

## Architecture Overview
The system enforces multitenancy and academic-year scoping at the SQL level during query execution. Repositories compose queries using SQLAlchemy’s ORM, while the core database module ensures tenant boundaries are respected.

```mermaid
sequenceDiagram
participant Client as "Caller"
participant Repo as "Repository Method"
participant DB as "SQLAlchemy Session"
participant Hook as "Session Event Hook"
participant Engine as "Database"
Client->>Repo : "Call method (e.g., get_all)"
Repo->>DB : "Build and execute query"
DB->>Hook : "do_orm_execute()"
Hook->>Hook : "Read tenant_id and academic_year_id from g"
Hook->>DB : "Add WHERE tenant_id=? AND academic_year_id=?"
DB->>Engine : "Execute filtered SQL"
Engine-->>DB : "Rows"
DB-->>Repo : "Results"
Repo-->>Client : "Typed results"
```

**Diagram sources**
- [database.py:39-102](file://backend/app/core/database.py#L39-L102)
- [base.py:12-17](file://backend/app/repositories/base.py#L12-L17)

## Detailed Component Analysis

### BaseRepository[T]
- Purpose: Generic CRUD for any SQLAlchemy-mapped model.
- Methods:
  - get(id): Load by primary key.
  - get_all(skip, limit): Paginated retrieval.
  - create(obj_in): Instantiate model and commit.
  - update(db_obj, obj_in): Bulk field updates and commit.
  - delete(id): Soft-deleted via ORM delete and commit.
- Notes:
  - Uses SQLAlchemy session for persistence.
  - Returns refreshed instances after create/update.

```mermaid
classDiagram
class BaseRepository~T~ {
+Session session
+Type~T~ model
+get(id) T?
+get_all(skip, limit) T[]
+create(obj_in) T
+update(db_obj, obj_in) T
+delete(id) bool
}
```

**Diagram sources**
- [base.py:7-41](file://backend/app/repositories/base.py#L7-L41)

**Section sources**
- [base.py:7-41](file://backend/app/repositories/base.py#L7-L41)

### Tenant-aware Filtering
- Mechanism: A session event hook inspects every SELECT statement and appends tenant and academic-year filters based on Flask’s request context.
- Behavior:
  - Skips filtering when tenant context is absent.
  - Applies tenant_id and academic_year_id conditions to matching models.
  - Allows opt-out via execution option for special queries.

```mermaid
flowchart TD
Start(["ORM Execute"]) --> CheckCtx["Check tenant_id and academic_year_id in g"]
CheckCtx --> HasCtx{"Context available?"}
HasCtx --> |No| Skip["Skip filtering"]
HasCtx --> |Yes| IsSelect{"Is SELECT?"}
IsSelect --> |No| Skip
IsSelect --> |Yes| FindTargets["Resolve target classes from mappers/froms"]
FindTargets --> HasTenant{"Model has tenant_id?"}
HasTenant --> |Yes| AddTenant["Add WHERE tenant_id = g.tenant_id"]
HasTenant --> |No| YearCheck
AddTenant --> YearCheck["Has academic_year_id and model has year column?"]
YearCheck --> |Yes| AddYear["Add WHERE academic_year_id = g.academic_year_id"]
YearCheck --> |No| Done
AddYear --> Done
Skip --> Done(["Return"])
```

**Diagram sources**
- [database.py:39-102](file://backend/app/core/database.py#L39-L102)

**Section sources**
- [database.py:39-102](file://backend/app/core/database.py#L39-L102)

### AlunoRepository
- Specialized queries:
  - Paginated aggregation with averages and absences, applying filters for shift, class, and text search.
  - Fetch student with aggregated grades and subject grades, enforcing tenant/year checks.
- Data transformation:
  - Returns tuples combining entities and computed aggregates.
  - Uses outer joins to include students without grades.

```mermaid
sequenceDiagram
participant Svc as "Service Layer"
participant AR as "AlunoRepository"
participant DB as "SQLAlchemy Session"
Svc->>AR : "get_paginated_with_average(page, per_page, filters)"
AR->>DB : "Build count/data queries with joins"
DB-->>AR : "Total and rows"
AR-->>Svc : "List[(Aluno, avg, sum)] and total"
Svc->>AR : "get_with_notes(aluno_id)"
AR->>DB : "Fetch Aluno and related Notas"
DB-->>AR : "Aluno, media, Notas"
AR-->>Svc : "Tuple result"
```

**Diagram sources**
- [aluno_repository.py:12-74](file://backend/app/repositories/aluno_repository.py#L12-L74)
- [aluno_repository.py:76-104](file://backend/app/repositories/aluno_repository.py#L76-L104)

**Section sources**
- [aluno_repository.py:8-105](file://backend/app/repositories/aluno_repository.py#L8-L105)

### TurmaRepository
- Specialized queries:
  - Class summaries aggregating counts, averages, and average absences.
  - Name resolution supporting exact and slug-based matches.
  - Student retrieval by class with tenant/year constraints.
  - Batch grade retrieval for a list of student IDs.
- Notes:
  - Uses explicit tenant/year filters in joins and queries.
  - Employs execution option to bypass automatic tenant filtering for controlled scenarios.

```mermaid
flowchart TD
A["get_summaries()"] --> B["Join Aluno and Nota"]
B --> C["Filter by tenant_id and academic_year_id"]
C --> D["Group by Aluno.turma"]
D --> E["Compute aggregates"]
E --> F["Return list of tuples"]
G["get_real_name()"] --> H["Direct match"]
H --> I{"Found?"}
I --> |Yes| J["Return name"]
I --> |No| K["Scan distinct names and slug match"]
K --> L["Return matched name or None"]
```

**Diagram sources**
- [turma_repository.py:16-54](file://backend/app/repositories/turma_repository.py#L16-L54)
- [turma_repository.py:56-79](file://backend/app/repositories/turma_repository.py#L56-L79)

**Section sources**
- [turma_repository.py:8-101](file://backend/app/repositories/turma_repository.py#L8-L101)

### OcorrenciaRepository
- Specialized queries:
  - Lists occurrences ordered by registration date, optionally filtered by student and tenant/year scopes.
- Notes:
  - Inherits generic CRUD from BaseRepository and adds filtering logic.

```mermaid
sequenceDiagram
participant Svc as "Service Layer"
participant OR as "OcorrenciaRepository"
participant DB as "SQLAlchemy Session"
Svc->>OR : "list_filtered(aluno_id optional)"
OR->>DB : "SELECT Ocorrencia ORDER BY data_registro DESC"
DB-->>OR : "List of Ocorrencia"
OR-->>Svc : "Filtered results"
```

**Diagram sources**
- [ocorrencia_repository.py:12-26](file://backend/app/repositories/ocorrencia_repository.py#L12-L26)

**Section sources**
- [ocorrencia_repository.py:8-27](file://backend/app/repositories/ocorrencia_repository.py#L8-L27)

### UsuarioRepository
- Specialized queries:
  - Username lookup and existence checks with optional exclusion by ID.
  - Filtered listing with joined loading of related student profile and pagination-aware counting.
- Notes:
  - Uses joined loading to reduce N+1 queries when accessing related student info.

```mermaid
classDiagram
class UsuarioRepository {
+get_by_username(username) Usuario?
+exists_username(username, exclude_id) bool
+list_filtered(skip, limit, query_text, role) (Usuario[], int)
}
UsuarioRepository --> BaseRepository~Usuario~
```

**Diagram sources**
- [usuario_repository.py:8-68](file://backend/app/repositories/usuario_repository.py#L8-L68)
- [base.py:7-41](file://backend/app/repositories/base.py#L7-L41)

**Section sources**
- [usuario_repository.py:8-68](file://backend/app/repositories/usuario_repository.py#L8-L68)

### TenantRepository
- Specialized queries:
  - Domain and slug lookups for tenant discovery.
- Notes:
  - Straightforward read-only repository leveraging BaseRepository.

```mermaid
classDiagram
class TenantRepository {
+get_by_domain(domain) Tenant?
+get_by_slug(slug) Tenant?
}
TenantRepository --> BaseRepository~Tenant~
```

**Diagram sources**
- [tenant_repository.py:8-21](file://backend/app/repositories/tenant_repository.py#L8-L21)
- [base.py:7-41](file://backend/app/repositories/base.py#L7-L41)

**Section sources**
- [tenant_repository.py:8-21](file://backend/app/repositories/tenant_repository.py#L8-L21)

### Model Layer and Tenant Scoping
- TenantYearMixin: Adds tenant_id and academic_year_id columns plus relationships to Tenant and AcademicYear, enabling consistent tenant and year scoping across entities.
- Models:
  - Aluno and Nota inherit tenant/year scoping.
  - Ocorrencia inherits tenant/year scoping and exposes a serialization helper.
  - Usuario and Tenant do not inherit the mixin; they rely on explicit tenant filters in repositories or dedicated tenant-scoped models.

```mermaid
classDiagram
class TenantYearMixin {
+tenant_id : int
+academic_year_id : int
+tenant()
+academic_year()
}
class Aluno {
+matricula : string
+nome : string
+turma : string
+turno : string
+notas : Nota[]
+usuario : Usuario
}
class Nota {
+disciplina : string
+trimestre1..3 : float
+total : float
+faltas : int
+aluno : Aluno
}
class Ocorrencia {
+tipo : string
+descricao : text
+gravidade : string
+data_registro : datetime
+to_dict() dict
}
class Usuario {
+username : string
+email : string
+role : string
+aluno_id : int
+tenant() : Tenant
}
class Tenant {
+name : string
+slug : string
+domain : string
+settings : dict
}
Aluno --|> TenantYearMixin
Nota --|> TenantYearMixin
Ocorrencia --|> TenantYearMixin
Usuario --> Tenant
Tenant --> Aluno
```

**Diagram sources**
- [base_mixin.py:4-22](file://backend/app/models/base_mixin.py#L4-L22)
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [ocorrencia.py:9-45](file://backend/app/models/ocorrencia.py#L9-L45)
- [usuario.py:8-30](file://backend/app/models/usuario.py#L8-L30)
- [tenant.py:7-22](file://backend/app/models/tenant.py#L7-L22)

**Section sources**
- [base_mixin.py:4-22](file://backend/app/models/base_mixin.py#L4-L22)
- [aluno.py:8-36](file://backend/app/models/aluno.py#L8-L36)
- [nota.py:9-24](file://backend/app/models/nota.py#L9-L24)
- [ocorrencia.py:9-45](file://backend/app/models/ocorrencia.py#L9-L45)
- [usuario.py:8-30](file://backend/app/models/usuario.py#L8-L30)
- [tenant.py:7-22](file://backend/app/models/tenant.py#L7-L22)

## Dependency Analysis
- Repositories depend on:
  - SQLAlchemy session for persistence and query execution.
  - Models for typed operations and relationships.
  - TenantYearMixin for tenant and academic-year scoping.
- Core database module depends on:
  - Flask’s request context (g) to enforce tenant filters.
  - SQLAlchemy events to intercept query execution.

```mermaid
graph LR
DB["database.py"] --> ALUNO["aluno.py"]
DB --> NOTA["nota.py"]
DB --> OCORR["ocorrencia.py"]
DB --> USUARIO["usuario.py"]
DB --> TENANT["tenant.py"]
MIXIN["base_mixin.py"] --> ALUNO
MIXIN --> NOTA
MIXIN --> OCORR
BASE["base.py"] --> ALUNO_REPO["aluno_repository.py"]
BASE --> TURMA_REPO["turma_repository.py"]
BASE --> OCORR_REPO["ocorrencia_repository.py"]
BASE --> USUARIO_REPO["usuario_repository.py"]
BASE --> TENANT_REPO["tenant_repository.py"]
```

**Diagram sources**
- [database.py:1-130](file://backend/app/core/database.py#L1-L130)
- [base_mixin.py:1-22](file://backend/app/models/base_mixin.py#L1-L22)
- [base.py:1-41](file://backend/app/repositories/base.py#L1-L41)
- [aluno_repository.py:1-105](file://backend/app/repositories/aluno_repository.py#L1-L105)
- [turma_repository.py:1-101](file://backend/app/repositories/turma_repository.py#L1-L101)
- [ocorrencia_repository.py:1-27](file://backend/app/repositories/ocorrencia_repository.py#L1-L27)
- [usuario_repository.py:1-68](file://backend/app/repositories/usuario_repository.py#L1-L68)
- [tenant_repository.py:1-21](file://backend/app/repositories/tenant_repository.py#L1-L21)
- [aluno.py:1-36](file://backend/app/models/aluno.py#L1-L36)
- [nota.py:1-24](file://backend/app/models/nota.py#L1-L24)
- [ocorrencia.py:1-45](file://backend/app/models/ocorrencia.py#L1-L45)
- [usuario.py:1-30](file://backend/app/models/usuario.py#L1-L30)
- [tenant.py:1-22](file://backend/app/models/tenant.py#L1-L22)

**Section sources**
- [database.py:1-130](file://backend/app/core/database.py#L1-L130)
- [base.py:1-41](file://backend/app/repositories/base.py#L1-L41)

## Performance Considerations
- Aggregation queries:
  - Prefer grouping and aggregation in a single pass; avoid multiple round-trips.
  - Use outer joins to include entities without related data when computing totals.
- Pagination:
  - Always compute total count before slicing to support accurate pagination metadata.
- Filtering:
  - Apply tenant and academic-year filters early in the query chain to minimize result sets.
- Loading strategies:
  - Use joined loads for frequently accessed related entities to prevent N+1 queries.
- Execution options:
  - Use execution option to bypass automatic tenant filtering for queries that intentionally require cross-tenant access.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Tenant filters not applied:
  - Ensure Flask request context provides tenant_id and academic_year_id.
  - Verify the session event hook executes for SELECT statements.
- Unexpected cross-tenant data:
  - Confirm models include tenant_id and academic_year_id columns via TenantYearMixin.
  - Review explicit filters in repositories for special cases.
- Slow aggregation queries:
  - Add appropriate indexes on tenant_id and academic_year_id.
  - Use grouped queries and avoid unnecessary joins.
- Transaction errors:
  - Wrap batch operations in a session scope to ensure atomicity and rollback on failure.

**Section sources**
- [database.py:39-102](file://backend/app/core/database.py#L39-L102)

## Conclusion
The repository pattern in this codebase centralizes persistence logic behind typed repositories, while tenant and academic-year scoping is enforced at the database level via a session event hook. Specialized repositories encapsulate domain-specific queries, transformations, and performance-conscious patterns, integrating cleanly with the service layer for maintainable, scalable data access.