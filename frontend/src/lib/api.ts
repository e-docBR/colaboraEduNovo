import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";

import type { RootState } from "../app/store";
import { setCredentials, logout } from "../features/auth/authSlice";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export interface ChatResponse {
  text: string;
  type: "text" | "table" | "chart";
  data?: any;
  chart_config?: any;
}


type DashboardKpis = {
  total_alunos: number;
  total_turmas: number;
  media_geral: number;
  alunos_em_risco: number;
  ocorrencias_abertas: number;
  comunicados_recentes: number;
};

export type PublicTenant = {
  id: number;
  name: string;
  slug: string;
};

type LoginRequest = {
  username: string;
  password: string;
  tenant_slug?: string;
};

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    username: string;
    role?: string;
    is_admin?: boolean;
    aluno_id?: number | null;
    photo_url?: string;
    must_change_password?: boolean;
    tenant_id?: number | null;
    tenant_name?: string;
  };
};

export type UsuarioAccount = {
  id: number;
  username: string;
  role?: string;
  is_admin: boolean;
  aluno_id?: number | null;
  photo_url?: string;
  must_change_password: boolean;
  aluno?: {
    id: number;
    nome: string;
    matricula: string;
    turma: string;
    turno: string;
  } | null;
};

type ListUsuariosResponse = {
  items: UsuarioAccount[];
  meta: {
    page: number;
    per_page: number;
    total: number;
  };
};

type ListUsuariosParams = {
  page?: number;
  per_page?: number;
  q?: string;
  role?: string;
};

type CreateUsuarioPayload = {
  username: string;
  password: string;
  role?: string;
  is_admin?: boolean;
  aluno_id?: number | null;
  must_change_password?: boolean;
};

type UpdateUsuarioPayload = {
  id: number;
  username?: string;
  password?: string;
  role?: string;
  is_admin?: boolean;
  aluno_id?: number | null;
  must_change_password?: boolean;
};

export type NotaResumo = {
  id: number;
  disciplina: string;
  trimestre1?: number | null;
  trimestre2?: number | null;
  trimestre3?: number | null;
  total?: number | null;
  faltas?: number | null;
  situacao?: string | null;
  aluno?: {
    id: number;
    nome: string;
    turma: string;
    turno: string;
    status?: string | null;
  } | null;
};

type ListNotasResponse = {
  items: NotaResumo[];
  total: number;
};

type ListNotasParams = {
  turma?: string;
  turno?: string;
  disciplina?: string;
};

type NotasFiltrosResponse = {
  disciplinas: string[];
};

export type AlunoSummary = {
  id: number;
  nome: string;
  matricula: string;
  turma: string;
  turno: string;
  media?: number | null;
  faltas?: number | null;
  media_faltas?: number | null;
  status?: string | null;
  sexo?: string | null;
  data_nascimento?: string | null;
  naturalidade?: string | null;
  zona?: string | null;
  endereco?: string | null;
  filiacao?: string | null;
  telefones?: string | null;
  cpf?: string | null;
  nis?: string | null;
  inep?: string | null;
  situacao_anterior?: string | null;
  email?: string | null;
  email_responsavel?: string | null;
  telefone_responsavel?: string | null;
  senha_inicial?: string | null;
  is_archived?: boolean;
  deleted_at?: string | null;
};


export type AlunoNota = {
  id: number;
  disciplina: string;
  trimestre1?: number | null;
  trimestre2?: number | null;
  trimestre3?: number | null;
  total?: number | null;
  faltas?: number | null;
  situacao?: string | null;
};

export type AlunoDetail = AlunoSummary & {
  notas: AlunoNota[];
};

type ListAlunosParams = {
  page?: number;
  per_page?: number;
  q?: string;
  turno?: string;
  turma?: string;
};

type ListAlunosResponse = {
  items: AlunoSummary[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
};

export type TurmaSummary = {
  turma: string;
  turno: string;
  total_alunos: number;
  media?: number | null;
  faltas_medias?: number | null;
  slug?: string;
};

type ListTurmasResponse = {
  items: TurmaSummary[];
  total: number;
};

type TurmaAlunosResponse = {
  turma: string;
  turno: string;
  total: number;
  alunos: Array<
    AlunoSummary & {
      situacao?: string | null;
      notas: Array<{
        disciplina: string;
        trimestre1?: number | null;
        trimestre2?: number | null;
        trimestre3?: number | null;
        total?: number | null;
        faltas?: number | null;
        situacao?: string | null;
      }>;
    }
  >;
};

type UploadBoletimPayload = {
  file: File;
  turno: string;
  turma: string;
};

type UploadBoletimResponse = {
  filename: string;
  status: string;
  job_id: string;
  turno: string;
  turma: string;
};

export type MeuFilhoResponse = {
  aluno: AlunoDetail;
  ocorrencias: {
    id: number;
    tipo: string;
    descricao: string;
    data_registro: string | null;
    resolvida: boolean;
    observacao_pais?: string | null;
    gravidade?: string | null;
  }[];
  comunicados: {
    id: number;
    titulo: string;
    conteudo: string;
    data_envio: string | null;
    lido: boolean;
  }[];
};

export type CsvImportResponse = {
  status: string;
  job_id: string;
  rows_queued: number;
  parse_errors: { row: number; field: string; message: string }[];
};

type RelatorioSummaryItem = {
  label: string;
  value: string | number;
  color?: "primary" | "secondary" | "success" | "warning" | "danger" | "info";
};

type RelatorioSummary = {
  main?: RelatorioSummaryItem;
  secondary?: RelatorioSummaryItem;
  extra?: RelatorioSummaryItem;
};

type RelatorioResponse = {
  relatorio: string;
  summary?: RelatorioSummary;
  dados: Array<Record<string, unknown>>;
};

export type RelatorioQueryArgs = {
  slug: string;
  turno?: string;
  serie?: string;
  turma?: string;
  disciplina?: string;
};

export type JobStatusResponse = {
  /** Status strings returned by python-rq: queued | started | finished | failed | deferred | stopped */
  status: 'queued' | 'started' | 'finished' | 'failed' | 'deferred' | 'stopped';
  result?: {
    count: number;
    logs: string[];
    year: string;
  };
  error?: string;
  progress?: number;
  job_id?: string;
  enqueued_at?: string;
  started_at?: string;
  ended_at?: string;
  meta?: Record<string, unknown>;
};

export type AuditLog = {
  id: number;
  action: string;
  user: string;
  target: string;
  timestamp: string;
  details?: Record<string, unknown>;
};

type AuditLogParams = {
  page?: number;
  per_page?: number;
  action?: string;
  target_type?: string;
  user?: string;
};

type AuditLogResponse = {
  items: AuditLog[];
  total: number;
  page: number;
  per_page: number;
};

export type Tenant = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  domain?: string;
  created_at?: string;
  academic_years?: Array<{ id: number; label: string; is_current: boolean }>;
  plano?: string;
  plano_ativo?: boolean;
  plano_expira_em?: string | null;
};

export type BillingStatusResponse = {
  plano: string;
  plano_ativo: boolean;
  plano_expira_em: string | null;
  has_subscription: boolean;
};

export type BillingCheckoutResponse = {
  url: string;
  type: "checkout" | "portal";
};

export type AlunoUpdatePayload = { id: number } & Partial<AlunoSummary>;

export type GraficoResponse<T = Record<string, unknown>> = {
  slug: string;
  dados: T[];
};

export type GraficoQueryArgs = {
  slug: string;
  turno?: string;
  serie?: string;
  turma?: string;
  trimestre?: string;
  disciplina?: string;
};

export type RiskPrediction = {
  score: number;
  status: "ALTO" | "MEDIO" | "BAIXO" | "ERRO";
  factors?: {
    media_geral: number;
    disciplinas_abaixo_60: number;
    total_faltas: number;
  };
};

export type Intervention = {
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "ACADEMIC" | "BEHAVIORAL" | "EMERGENCY" | "MAINTENANCE";
  title: string;
  description: string;
  impact: string;
};

export type StudentInterventionAnalysis = {
  aluno_id: number;
  aluno_nome: string;
  turma?: string;
  global_risk: "ALTO" | "MEDIO" | "BAIXO";
  interventions: Intervention[];
  stats: {
    total_faltas: number;
    disciplinas_abaixo_media: number;
  };
  status?: string;
};

const sanitizeParams = (params?: Record<string, string | number | boolean | undefined | null>) =>
  Object.fromEntries(
    Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== "" && value !== null)
  );

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState;
    const token = state.auth.accessToken;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const academicYearId = state.app.academicYearId;
    if (academicYearId) {
      headers.set("x-academic-year-id", academicYearId.toString());
    }

    const tenantId = state.app.tenantId;
    if (tenantId) {
      headers.set("X-Tenant-ID", tenantId.toString());
    }

    return headers;
  }
});

// Serializes concurrent refresh calls so only one /auth/refresh request fires at a time.
// Without this, 5 parallel 401s would each try to use the same single-use refresh token.
let refreshPromise: Promise<boolean> | null = null;

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 429) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise<void>((r) => setTimeout(r, 2 ** attempt * 1000));
      result = await rawBaseQuery(args, api, extraOptions);
      if (result.error?.status !== 429) break;
    }
    if (result.error?.status === 429) {
      return {
        error: {
          status: 429,
          data: { error: "Muitas tentativas. Aguarde alguns instantes e tente novamente." },
        } as FetchBaseQueryError,
      };
    }
  }

  if (result.error?.status === 401) {
    const state = api.getState() as RootState;
    const refreshToken = state.auth.refreshToken;

    if (refreshToken) {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const refreshResult = await rawBaseQuery(
              {
                url: "/auth/refresh",
                method: "POST",
                headers: { Authorization: `Bearer ${refreshToken}` }
              },
              api,
              extraOptions
            );

            if (refreshResult.data) {
              const data = refreshResult.data as { access_token: string; refresh_token: string };
              const currentState = api.getState() as RootState;
              api.dispatch(
                setCredentials({
                  access_token: data.access_token,
                  refresh_token: data.refresh_token,
                  user: currentState.auth.user
                })
              );
              return true;
            } else {
              api.dispatch(logout());
              return false;
            }
          } finally {
            refreshPromise = null;
          }
        })();
      }

      const refreshed = await refreshPromise;
      if (refreshed) {
        result = await rawBaseQuery(args, api, extraOptions);
      }
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: "boletinsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Dashboard", "Alunos", "Notas", "Uploads", "Turmas", "Usuarios", "Comunicados", "Ocorrencias", "Graficos"],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body
      })
    }),
    listPublicTenants: builder.query<PublicTenant[], void>({
      query: () => "/auth/tenants"
    }),
    getDashboardKpis: builder.query<DashboardKpis, void>({
      query: () => "/dashboard/kpis",
      providesTags: ["Dashboard"]
    }),
    getTeacherDashboard: builder.query<{ 
      distribution: Record<string, number>; 
      alerts: Array<{
        id: number;
        nome: string;
        turma: string;
        media: number;
        risk_score: number;
        risk_status: string;
      }>; 
      classes_count: number; 
      total_students: number; 
      global_average: number; 
    }, { q?: string; turno?: string; turma?: string } | void>({
      query: (params) => ({
        url: "/dashboard/professor",
        params: sanitizeParams(params ?? undefined)
      }),
      providesTags: ["Dashboard"]
    }),
    getAluno: builder.query<AlunoDetail, number | string>({
      query: (alunoId) => ({
        url: `/alunos/${alunoId}`
      }),
      providesTags: (_result, _error, alunoId) => [
        "Alunos",
        { type: "Alunos", id: Number(alunoId) },
        { type: "Alunos", id: String(alunoId) }
      ]
    }),
    getMyAluno: builder.query<AlunoDetail, void>({
      query: () => "/alunos/me",
      providesTags: ["Alunos"]
    }),
    getMeuFilho: builder.query<MeuFilhoResponse, void>({
      query: () => "/responsavel/meu-filho",
      providesTags: ["Alunos", "Ocorrencias", "Comunicados"]
    }),
    getAlunoOcorrenciasSummary: builder.query<{ tipo: string; total: number }[], number>({
      query: (alunoId) => `/alunos/${alunoId}/ocorrencias/summary`,
      providesTags: (_r, _e, alunoId) => [{ type: "Ocorrencias", id: alunoId }]
    }),
    listAlunos: builder.query<ListAlunosResponse, ListAlunosParams | void>({
      query: (params) => ({
        url: "/alunos",
        params: sanitizeParams(params ?? undefined)
      }),
      providesTags: ["Alunos"]
    }),
    listTurmas: builder.query<ListTurmasResponse, void>({
      query: () => ({
        url: "/turmas"
      }),
      providesTags: ["Turmas"]
    }),
    getTurmaAlunos: builder.query<TurmaAlunosResponse, string>({
      query: (slug) => ({
        url: `/turmas/${slug}/alunos`
      }),
      providesTags: (result, _error, slug) => ["Turmas", { type: "Turmas", id: slug }]
    }),
    updateTurma: builder.mutation<{ updated: number; turma: string }, { slug: string; nome: string; turno?: string }>({
      query: ({ slug, ...body }) => ({
        url: `/turmas/${slug}`,
        method: "PATCH",
        body
      }),
      invalidatesTags: ["Turmas", "Alunos", "Dashboard"]
    }),
    deleteTurma: builder.mutation<{ deleted: number }, string>({
      query: (slug) => ({
        url: `/turmas/${slug}`,
        method: "DELETE"
      }),
      invalidatesTags: ["Turmas", "Alunos", "Dashboard"]
    }),
    uploadBoletim: builder.mutation<UploadBoletimResponse, UploadBoletimPayload>({
      query: ({ file, turno, turma }) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("turno", turno);
        formData.append("turma", turma);

        return {
          url: "/uploads/pdf",
          method: "POST",
          body: formData
        };
      },
      invalidatesTags: ["Uploads", "Turmas", "Alunos", "Dashboard", "Notas"]
    }),
    uploadAlunosCsv: builder.mutation<CsvImportResponse, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return { url: "/uploads/csv/alunos", method: "POST", body: formData };
      },
      invalidatesTags: ["Alunos", "Dashboard", "Turmas"]
    }),
    getRelatorio: builder.query<RelatorioResponse, RelatorioQueryArgs>({
      query: ({ slug, ...params }) => ({
        url: `/relatorios/${slug}`,
        params: sanitizeParams(params)
      })
    }),
    getGrafico: builder.query<GraficoResponse, GraficoQueryArgs>({
      query: ({ slug, ...params }) => ({
        url: `/graficos/${slug}`,
        params: sanitizeParams(params)
      }),
      providesTags: (_result, _error, { slug }) => [{ type: "Graficos" as const, id: slug }]
    }),
    getJobStatus: builder.query<JobStatusResponse, string>({
      query: (jobId) => `/uploads/jobs/${jobId}`,
      keepUnusedDataFor: 0
    }),
    listNotas: builder.query<ListNotasResponse, ListNotasParams | void>({
      query: (params) => ({
        url: "/notas",
        params: sanitizeParams(params ?? undefined)
      }),
      providesTags: ["Notas"]
    }),
    updateNota: builder.mutation<NotaResumo, { id: number; trimestre1?: number | null; trimestre2?: number | null; trimestre3?: number | null; total?: number | null; faltas?: number | null; situacao?: string | null }>({
      query: ({ id, ...body }) => ({
        url: `/notas/${id}`,
        method: "PATCH",
        body
      }),
      invalidatesTags: (result) => ["Notas", { type: "Alunos", id: result?.aluno?.id }]
    }),
    getNotasFiltros: builder.query<NotasFiltrosResponse, void>({
      query: () => "/notas/filtros",
      providesTags: ["Notas"]
    }),
    changePassword: builder.mutation<void, { current_password: string; new_password: string }>({
      query: (body) => ({
        url: "/auth/change-password",
        method: "POST",
        body
      })
    }),
    forgotPassword: builder.mutation<{ message: string }, { email: string; tenant_slug: string }>({
      query: (body) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body
      })
    }),
    resetPassword: builder.mutation<{ message: string }, { token: string; new_password: string }>({
      query: (body) => ({
        url: "/auth/reset-password",
        method: "POST",
        body
      })
    }),
    uploadPhoto: builder.mutation<{ photo_url: string }, FormData>({
      query: (formData) => ({
        url: "/usuarios/me/photo",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Usuarios"]
    }),
    listUsuarios: builder.query<ListUsuariosResponse, ListUsuariosParams | void>({
      query: (params) => ({
        url: "/usuarios",
        params: sanitizeParams(params ?? undefined)
      }),
      providesTags: ["Usuarios"]
    }),
    createUsuario: builder.mutation<UsuarioAccount, CreateUsuarioPayload>({
      query: (body) => ({
        url: "/usuarios",
        method: "POST",
        body
      }),
      invalidatesTags: ["Usuarios"]
    }),
    updateUsuario: builder.mutation<UsuarioAccount, UpdateUsuarioPayload>({
      query: ({ id, ...body }) => ({
        url: `/usuarios/${id}`,
        method: "PATCH",
        body
      }),
      invalidatesTags: (result, _error, { id }) => ["Usuarios", { type: "Usuarios", id }]
    }),
    deleteUsuario: builder.mutation<void, number>({
      query: (id) => ({
        url: `/usuarios/${id}`,
        method: "DELETE"
      }),
      invalidatesTags: ["Usuarios"]
    }),
    getMe: builder.query<UsuarioAccount, void>({
      query: () => "/usuarios/me",
      providesTags: ["Usuarios"]
    }),
    listComunicados: builder.query<{ items: { id: number; titulo: string; conteudo: string; autor: string; data_envio: string; arquivado?: boolean; target_type?: string; target_value?: string; is_read?: boolean }[]; meta: { page: number; per_page: number; total: number } }, { page?: number; per_page?: number } | void>({
      query: (params) => ({
        url: "/comunicados",
        params: sanitizeParams(params ?? undefined)
      }),
      providesTags: ["Comunicados"]
    }),
    markComunicadoRead: builder.mutation<void, number>({
      query: (id) => ({
        url: `/comunicados/${id}/read`,
        method: "POST"
      }),
      invalidatesTags: ["Comunicados"]
    }),
    createComunicado: builder.mutation<{ message: string; id?: number }, { titulo: string; conteudo: string; target_type: string; target_value?: string; notificar_responsaveis?: boolean }>({
      query: (body) => ({
        url: "/comunicados",
        method: "POST",
        body
      }),
      invalidatesTags: ["Comunicados"]
    }),
    updateComunicado: builder.mutation<void, { id: number; titulo?: string; conteudo?: string; arquivado?: boolean }>({
      query: ({ id, ...body }) => ({
        url: `/comunicados/${id}`,
        method: "PATCH",
        body
      }),
      invalidatesTags: ["Comunicados"]
    }),
    deleteComunicado: builder.mutation<void, number>({
      query: (id) => ({
        url: `/comunicados/${id}`,
        method: "DELETE"
      }),
      invalidatesTags: ["Comunicados"]
    }),
    getComunicadoLeituras: builder.query<{ comunicado_id: number; titulo: string; total_leituras: number; leituras: { usuario_id: number; username: string; data_leitura: string }[] }, number>({
      query: (id) => `/comunicados/${id}/leituras`,
    }),
    listOcorrencias: builder.query<{ id: number; aluno_id: number; tipo: string; descricao: string; resolvida: boolean; data_registro: string; aluno_nome: string; autor_nome: string; notificacao_status?: string; observacao_pais?: string; gravidade?: string; acao_tomada?: string }[], { aluno_id?: string; date_from?: string; date_to?: string } | string | void>({
      query: (args) => ({
        url: "/ocorrencias",
        params: typeof args === "string" ? { aluno_id: args } : (args ?? undefined)
      }),
      transformResponse: (raw: any) => Array.isArray(raw) ? raw : (raw?.items ?? []),
      providesTags: ["Ocorrencias"]
    }),
    createOcorrencia: builder.mutation<void, { aluno_id: number; tipo: string; descricao: string; data_registro?: string; resolvida?: boolean; notificar_responsaveis?: boolean; observacao_pais?: string; gravidade?: string; acao_tomada?: string }>({
      query: (body) => ({
        url: "/ocorrencias",
        method: "POST",
        body
      }),
      invalidatesTags: ["Ocorrencias"]
    }),
    updateOcorrencia: builder.mutation<void, { id: number; tipo?: string; descricao?: string; resolvida?: boolean; data_registro?: string; observacao_pais?: string; gravidade?: string; acao_tomada?: string }>({
      query: ({ id, ...body }) => ({
        url: `/ocorrencias/${id}`,
        method: "PATCH",
        body
      }),
      invalidatesTags: ["Ocorrencias"]
    }),
    deleteOcorrencia: builder.mutation<void, number>({
      query: (id) => ({
        url: `/ocorrencias/${id}`,
        method: "DELETE"
      }),
      invalidatesTags: ["Ocorrencias"]
    }),
    renotificarOcorrencia: builder.mutation<{ message: string; status: string }, number>({
      query: (id) => ({
        url: `/ocorrencias/${id}/notificar`,
        method: "POST"
      }),
      invalidatesTags: ["Ocorrencias"]
    }),
    chat: builder.mutation<ChatResponse, { message: string }>({
      query: (body) => ({
        url: "/chat",
        method: "POST",
        body
      })
    }),

    listAuditLogs: builder.query<AuditLogResponse, AuditLogParams | void>({
      query: (params) => ({
        url: "/audit-logs",
        params: sanitizeParams(params ?? undefined)
      }),
      keepUnusedDataFor: 0
    }),
    createAluno: builder.mutation<AlunoSummary, Partial<AlunoSummary>>({
      query: (body) => ({
        url: "/alunos",
        method: "POST",
        body
      }),
      invalidatesTags: ["Alunos", "Dashboard", "Turmas"]
    }),
    updateAluno: builder.mutation<AlunoSummary, AlunoUpdatePayload>({
      query: ({ id, ...body }) => ({
        url: `/alunos/${id}`,
        method: "PATCH",
        body
      }),
      invalidatesTags: (_result, _error, { id }) => [
        "Alunos",
        { type: "Alunos", id: Number(id) },
        { type: "Alunos", id: String(id) },
        "Dashboard",
        "Turmas"
      ]
    }),
    deleteAluno: builder.mutation<void, number>({
      query: (id) => ({
        url: `/alunos/${id}`,
        method: "DELETE"
      }),
      invalidatesTags: ["Alunos", "Dashboard", "Turmas"]
    }),
    listArchivedAlunos: builder.query<ListAlunosResponse, { page?: number; per_page?: number; q?: string } | void>({
      query: (params) => ({
        url: "/alunos/archived",
        params: params ?? undefined
      }),
      providesTags: ["Alunos"]
    }),
    restoreAluno: builder.mutation<AlunoSummary, number>({
      query: (id) => ({
        url: `/alunos/${id}/restore`,
        method: "POST"
      }),
      invalidatesTags: ["Alunos", "Dashboard", "Turmas"]
    }),
    listAcademicYears: builder.query<{ id: number; label: string; is_current: boolean }[], void>({
      query: () => "/academic-years",
      providesTags: ["Dashboard"]
    }),

    // Super Admin Endpoints
    listTenants: builder.query<Tenant[], void>({
      query: () => "/admin/tenants",
      providesTags: ["Usuarios"] 
    }),
    createTenant: builder.mutation<void, { name: string; slug: string; initial_year: string; domain?: string; admin_email?: string; admin_password?: string }>({
      query: (body) => ({
        url: "/admin/tenants",
        method: "POST",
        body
      }),
      invalidatesTags: ["Usuarios"]
    }),
    addAcademicYearToTenant: builder.mutation<void, { tenantId: number; label: string; set_current?: boolean }>({
      query: ({ tenantId, ...body }) => ({
        url: `/admin/tenants/${tenantId}/years`,
        method: "POST",
        body
      }),
      invalidatesTags: ["Usuarios", "Dashboard"]
    }),
    updateTenant: builder.mutation<void, { id: number; name?: string; is_active?: boolean; domain?: string }>({
      query: ({ id, ...body }) => ({
        url: `/admin/tenants/${id}`,
        method: "PATCH",
        body
      }),
      invalidatesTags: ["Usuarios"]
    }),
    deleteTenant: builder.mutation<void, number>({
      query: (id) => ({
        url: `/admin/tenants/${id}`,
        method: "DELETE"
      }),
      invalidatesTags: ["Usuarios"]
    }),
    getInterventions: builder.query<StudentInterventionAnalysis, number | string>({
      query: (alunoId) => `/ai/interventions/${alunoId}`
    }),
    getStudentRisk: builder.query<RiskPrediction, number>({
      query: (alunoId) => `/ai/risk/${alunoId}`
    }),
    getBulkInterventions: builder.mutation<{ count: number; results: StudentInterventionAnalysis[] }, { student_ids: number[] }>({
      query: (body) => ({
        url: "/ai/bulk-interventions",
        method: "POST",
        body
      })
    }),
    getBillingStatus: builder.query<BillingStatusResponse, void>({
      query: () => "/billing/status",
      providesTags: ["Dashboard"]
    }),
    createBillingCheckout: builder.mutation<BillingCheckoutResponse, void>({
      query: () => ({
        url: "/billing/checkout",
        method: "POST"
      })
    })
  })
});

export const {
  useLoginMutation,
  useListPublicTenantsQuery,
  useGetDashboardKpisQuery,
  useGetTeacherDashboardQuery,
  useGetAlunoQuery,
  useGetMyAlunoQuery,
  useGetMeuFilhoQuery,
  useGetAlunoOcorrenciasSummaryQuery,
  useListAlunosQuery,
  useListTurmasQuery,
  useGetTurmaAlunosQuery,
  useUpdateTurmaMutation,
  useDeleteTurmaMutation,
  useUploadBoletimMutation,
  useGetRelatorioQuery,
  useGetGraficoQuery,
  useGetJobStatusQuery,
  useListNotasQuery,
  useUpdateNotaMutation,
  useGetNotasFiltrosQuery,
  useChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useUploadPhotoMutation,
  useListUsuariosQuery,
  useCreateUsuarioMutation,
  useUpdateUsuarioMutation,
  useDeleteUsuarioMutation,
  useGetMeQuery,
  useListComunicadosQuery,
  useMarkComunicadoReadMutation,
  useCreateComunicadoMutation,
  useUpdateComunicadoMutation,
  useDeleteComunicadoMutation,
  useGetComunicadoLeiturasQuery,
  useListOcorrenciasQuery,
  useCreateOcorrenciaMutation,
  useUpdateOcorrenciaMutation,
  useDeleteOcorrenciaMutation,
  useRenotificarOcorrenciaMutation,
  useChatMutation,
  useListAuditLogsQuery,
  useCreateAlunoMutation,
  useUpdateAlunoMutation,
  useDeleteAlunoMutation,
  useListArchivedAlunosQuery,
  useRestoreAlunoMutation,
  useUploadAlunosCsvMutation,
  useListAcademicYearsQuery,
  useListTenantsQuery,
  useCreateTenantMutation,
  useAddAcademicYearToTenantMutation,
  useUpdateTenantMutation,
  useDeleteTenantMutation,
  useGetInterventionsQuery,
  useGetStudentRiskQuery,
  useGetBulkInterventionsMutation,
  useGetBillingStatusQuery,
  useCreateBillingCheckoutMutation
} = api;
