# PLAN: Fix Corrupted Frontend Files

> **Goal**: Repair critical frontend files corrupted with unicode escape sequences (`\u003c`, `\u003e`) to restore system functionality.

## 🚨 Critical Situation Analysis
- **Symptoms**: Browser console showing 500 errors for `Sidebar.tsx`, `DashboardPage.tsx`, `AlunosPage.tsx`, `TurmasPage.tsx`.
- **Root Cause**: Previous edit operations inserted invalid unicode escapes instead of proper JSX syntax.
- **Impact**: Frontend fails to compile/render. Navigation and main features broken.

## 🛠️ Recovery Strategy

### Phase 1: File Restoration (High Priority)
Use `frontend-specialist` skills to rewrite files with correct, clean, modern React/MUI code.

- [ ] **Task 1: Repair `Sidebar.tsx`** (Navigation)
  - Restore compact design
  - Fix unicode escapes
  - Ensure correct imports

- [ ] **Task 2: Repair `DashboardPage.tsx`** (Home)
  - Restore KPI cards and Charts
  - Fix unicode escapes
  - Ensure modern teal/emerald palette

- [ ] **Task 3: Repair `AlunosPage.tsx`** (Students)
  - Restore 4-column grid
  - Fix unicode escapes
  - Ensure compact cards

- [ ] **Task 4: Repair `TurmasPage.tsx`** (Classes)
  - Restore class performance cards
  - Fix unicode escapes

### Phase 2: Verification
- [ ] Verify compilation (no 500 errors)
- [ ] Verify visual integrity (modern design preserved)
- [ ] Check navigation between repaired pages

## 🧑‍💻 Agent Assignments

| Task | Agent | Role |
|------|-------|------|
| Code Repair | `frontend-specialist` | Rewrite corrupted files with clean syntax |
| Verification | `orchestrator` | Confirm system stability |

---
**Status**: 🔴 PENDING EXECUTION
