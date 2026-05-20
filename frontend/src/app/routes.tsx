import { createBrowserRouter, redirect } from "react-router-dom";
import { lazy, Suspense } from "react";
import { CircularProgress, Box } from "@mui/material";
import { ErrorBoundary } from "../components/ErrorBoundary";

import { DashboardLayout } from "../layouts/DashboardLayout";
import { LoginPage } from "../features/auth/LoginPage";
import { ChangePasswordPage } from "../features/auth/ChangePasswordPage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage";
import { LandingPage } from "../features/landing/LandingPage";
import { store } from "./store";
import { setCredentials, logout } from "../features/auth/authSlice";
import { setTenantId } from "../features/app/appSlice";

// Lazily loaded authenticated routes — split per route for smaller initial bundle
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const TeacherDashboard = lazy(() => import("../features/dashboard/TeacherDashboard").then(m => ({ default: m.TeacherDashboard })));
const BulkInterventionPage = lazy(() => import("../features/dashboard/BulkInterventionPage").then(m => ({ default: m.BulkInterventionPage })));
const AlunosPage = lazy(() => import("../features/alunos/AlunosPage").then(m => ({ default: m.AlunosPage })));
const AlunoDetailPage = lazy(() => import("../features/alunos/AlunoDetailPage").then(m => ({ default: m.AlunoDetailPage })));
const ArchivedAlunosPage = lazy(() => import("../features/alunos/ArchivedAlunosPage").then(m => ({ default: m.ArchivedAlunosPage })));
const MeuBoletimPage = lazy(() => import("../features/alunos/MeuBoletimPage").then(m => ({ default: m.MeuBoletimPage })));
const TurmasPage = lazy(() => import("../features/turmas/TurmasPage").then(m => ({ default: m.TurmasPage })));
const TurmaDetailPage = lazy(() => import("../features/turmas/TurmaDetailPage").then(m => ({ default: m.TurmaDetailPage })));
const NotasPage = lazy(() => import("../features/notas/NotasPage").then(m => ({ default: m.NotasPage })));
const GraficosPage = lazy(() => import("../features/graficos/GraficosPage").then(m => ({ default: m.GraficosPage })));
const RelatoriosPage = lazy(() => import("../features/relatorios/RelatoriosPage").then(m => ({ default: m.RelatoriosPage })));
const RelatorioDetailPage = lazy(() => import("../features/relatorios/RelatorioDetailPage").then(m => ({ default: m.RelatorioDetailPage })));
const UploadsPage = lazy(() => import("../features/uploads/UploadsPage").then(m => ({ default: m.UploadsPage })));
const UsuariosPage = lazy(() => import("../features/usuarios/UsuariosPage").then(m => ({ default: m.UsuariosPage })));
const AuditLogsPage = lazy(() => import("../features/usuarios/AuditLogsPage").then(m => ({ default: m.AuditLogsPage })));
const ComunicadosPage = lazy(() => import("../features/comunicados/ComunicadosPage").then(m => ({ default: m.ComunicadosPage })));
const OcorrenciasPage = lazy(() => import("../features/ocorrencias/OcorrenciasPage").then(m => ({ default: m.OcorrenciasPage })));
const TenantsPage = lazy(() => import("../features/super-admin/TenantsPage").then(m => ({ default: m.TenantsPage })));
const PortalResponsavelPage = lazy(() => import("../features/responsavel/PortalResponsavelPage").then(m => ({ default: m.PortalResponsavelPage })));
const AISettingsPage = lazy(() => import("../features/ai-chat/AISettingsPage"));

const PageLoader = () => (
  <Box display="flex" alignItems="center" justifyContent="center" minHeight={300}>
    <CircularProgress size={36} />
  </Box>
);

const wrap = (element: React.ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>{element}</Suspense>
  </ErrorBoundary>
);

const requireAuth = async () => {
  const state = store.getState();

  if (!state.auth.accessToken) {
    // Tenta silent refresh usando o cookie HttpOnly "rt" — enviado automaticamente pelo browser.
    // Não há mais refreshToken no estado Redux (inacessível ao JS por design).
    try {
      const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";
      const res = await fetch(`${base}/auth/refresh`, {
        method: "POST",
        credentials: "include", // envia o cookie rt automaticamente
      });
      if (res.ok) {
        const data = await res.json() as { access_token: string; user?: { tenant_id?: number | null; must_change_password?: boolean } };
        store.dispatch(setCredentials({ access_token: data.access_token, user: data.user }));
        if (data.user?.tenant_id) store.dispatch(setTenantId(data.user.tenant_id));
        if (data.user?.must_change_password) throw redirect("/alterar-senha");
        return null;
      }
    } catch {
      // refresh falhou — continua para redirect de login
    }
    store.dispatch(logout());
    throw redirect("/login");
  }

  // Block access to the app until the user changes their temporary password
  if (state.auth.user?.must_change_password) {
    throw redirect("/alterar-senha");
  }
  return null;
};

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />
  },
  {
    path: "/relatorios/:slug?",
    loader: ({ params }) => {
      if (params.slug) {
        throw redirect(`/app/relatorios/${params.slug}`);
      }
      throw redirect(`/app/relatorios`);
    }
  },
  {
    path: "/alunos/:alunoId?",
    loader: ({ params }) => {
      if (params.alunoId) {
        throw redirect(`/app/alunos/${params.alunoId}`);
      }
      throw redirect(`/app/alunos`);
    }
  },
  {
    path: "/turmas/:turmaId?",
    loader: ({ params }) => {
      if (params.turmaId) {
        throw redirect(`/app/turmas/${params.turmaId}`);
      }
      throw redirect(`/app/turmas`);
    }
  },
  {
    path: "/app",
    loader: requireAuth,
    element: <DashboardLayout />,
    children: [
      { index: true, element: wrap(<DashboardPage />) },
      { path: "professor", element: wrap(<TeacherDashboard />) },
      { path: "alunos", element: wrap(<AlunosPage />) },
      { path: "alunos/arquivo", element: wrap(<ArchivedAlunosPage />) },
      { path: "alunos/:alunoId", element: wrap(<AlunoDetailPage />) },
      { path: "turmas", element: wrap(<TurmasPage />) },
      { path: "turmas/:turmaId", element: wrap(<TurmaDetailPage />) },
      { path: "notas", element: wrap(<NotasPage />) },
      { path: "graficos", element: wrap(<GraficosPage />) },
      { path: "relatorios", element: wrap(<RelatoriosPage />) },
      { path: "relatorios/:slug", element: wrap(<RelatorioDetailPage />) },
      { path: "uploads", element: wrap(<UploadsPage />) },
      { path: "usuarios", element: wrap(<UsuariosPage />) },
      { path: "audit-logs", element: wrap(<AuditLogsPage />) },
      { path: "comunicados", element: wrap(<ComunicadosPage />) },
      { path: "ocorrencias", element: wrap(<OcorrenciasPage />) },
      { path: "ia/intervencoes-em-lote", element: wrap(<BulkInterventionPage />) },
      { path: "meu-boletim", element: wrap(<MeuBoletimPage />) },
      { path: "portal-responsavel", element: wrap(<PortalResponsavelPage />) },
      { path: "admin/escolas", element: wrap(<TenantsPage />) },
      { path: "admin/ia", element: wrap(<AISettingsPage />) }
    ]
  },
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/login/aluno",
    element: <LoginPage />
  },
  {
    path: "/alterar-senha",
    element: <ChangePasswordPage />
  },
  {
    path: "/esqueci-senha",
    element: <ForgotPasswordPage />
  },
  {
    path: "/redefinir-senha",
    element: <ResetPasswordPage />
  }
]);
