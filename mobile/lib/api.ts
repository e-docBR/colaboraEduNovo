/**
 * Centralized API client for ColaboraEdu mobile.
 * Injects JWT token automatically and handles 401 responses.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

// Use the local emulator URL only for development. Production builds must define
// the public API explicitly to avoid shipping an app pointed at localhost.
const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL;

if (process.env.NODE_ENV === 'production' && !configuredBaseUrl) {
  throw new Error('EXPO_PUBLIC_API_URL é obrigatório em builds de produção.');
}

const BASE_URL = configuredBaseUrl ?? 'http://10.0.2.2:5000/api/v1';
export const API_BASE_URL = BASE_URL;
export const DEFAULT_TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile',
  },
});

// Request interceptor: attach JWT from secure storage
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: auto refresh token on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (refreshToken) {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
              'X-Client-Platform': 'mobile',
            }
          });
          if (res.status === 200) {
            await SecureStore.setItemAsync('access_token', res.data.access_token);
            if (res.data.refresh_token) {
              await SecureStore.setItemAsync('refresh_token', res.data.refresh_token);
            }
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        await SecureStore.deleteItemAsync('user_data');
        await SecureStore.deleteItemAsync('last_active');
        router.replace('/(auth)/login');
      }
    }
    return Promise.reject(error);
  },
);

// --- Auth ---
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  user: {
    id: number;
    username: string; // Changed from nome to username
    email?: string;  // Sometimes missing in backend
    role: string;    // Changed from roles[] to role
    tenant_id: number;
    tenant_name: string;
    aluno_id?: number | null;
    must_change_password?: boolean;
  };
}

export interface PublicTenant {
  id: number;
  name: string;
  slug: string;
}

export const authApi = {
  listTenants: () => apiClient.get<PublicTenant[]>('/auth/tenants'),
  login: (username: string, password: string, tenantSlug?: string) =>
    apiClient.post<LoginResponse>('/auth/login', {
      username,
      password,
      tenant_slug: tenantSlug ?? DEFAULT_TENANT_SLUG,
    }, {
      headers: { 'X-Client-Platform': 'mobile' }
    }), // Backend expects username
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<LoginResponse>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }, {
      headers: { 'X-Client-Platform': 'mobile' }
    }),
  me: () => apiClient.get<LoginResponse['user']>('/usuarios/me'), // Fixed endpoint
};

export const logoutRequest = async (accessToken?: string | null, refreshToken?: string | null) => {
  if (!accessToken) return;
  await axios.post(
    `${BASE_URL}/auth/logout`,
    refreshToken ? { refresh_token: refreshToken } : {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Client-Platform': 'mobile',
      },
    },
  );
};

// --- Alunos ---
export interface Aluno {
  id: number;
  nome: string;
  matricula?: string;
  turma: string;
  turno: string;
  academic_year_id: number;
  media?: number | null;
  faltas?: number | null;
  max_pts?: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    pages?: number;
  };
}

export const alunosApi = {
  list: (params?: { turma?: string; turno?: string; page?: number; per_page?: number; q?: string }) =>
    apiClient.get<PaginatedResponse<Aluno>>('/alunos', { params }),
  get: (id: number) => apiClient.get<Aluno>(`/alunos/${id}`),
};

// --- Aluno Detail ---
export interface AlunoNota {
  id: number;
  disciplina: string;
  trimestre1?: number | null;
  trimestre2?: number | null;
  trimestre3?: number | null;
  total?: number | null;
  faltas?: number | null;
  situacao?: string | null;
}

export interface AlunoDetail extends Aluno {
  matricula?: string;
  media?: number | null;
  faltas?: number | null;
  max_pts?: number | null;
  risk_score?: number | null;
  risk_status?: string | null;
  notas: AlunoNota[];
}

export const alunoDetailApi = {
  get: (id: number) => apiClient.get<AlunoDetail>(`/alunos/${id}`),
};

export interface ResponsavelOcorrencia {
  id: number;
  tipo: string;
  descricao: string;
  resolvida: boolean;
  data_registro: string;
  gravidade?: string | null;
  observacao_pais?: string | null;
}

export interface ResponsavelComunicado {
  id: number;
  titulo: string;
  conteudo: string;
  data_envio: string | null;
  lido: boolean;
}

export interface ResponsavelPortalResponse {
  aluno: AlunoDetail;
  ocorrencias: ResponsavelOcorrencia[];
  comunicados: ResponsavelComunicado[];
}

export const familyApi = {
  getMeuAluno: () => apiClient.get<AlunoDetail>('/alunos/me'),
  getMeuFilho: () => apiClient.get<ResponsavelPortalResponse>('/responsavel/meu-filho'),
};

// --- Comunicados ---
export interface Comunicado {
  id: number;
  titulo: string;
  conteudo: string;
  autor: string;
  data_envio: string;
  is_read?: boolean;
  target_type?: string;
  arquivado?: boolean;
}

export const comunicadosApi = {
  list: (params?: { page?: number; per_page?: number }) =>
    apiClient.get<{ items: Comunicado[]; meta: { total: number; page: number; per_page: number } }>(
      '/comunicados',
      { params },
    ),
  markRead: (id: number) => apiClient.post(`/comunicados/${id}/read`),
};

// --- Ocorrências ---
export interface Ocorrencia {
  id: number;
  tipo: string;
  descricao: string;
  resolvida: boolean;
  data_registro: string;
  aluno_nome: string;
  autor_nome: string;
  gravidade?: string;
  acao_tomada?: string;
}

export const ocorrenciasApi = {
  listByAluno: (alunoId: number) =>
    apiClient.get<PaginatedResponse<Ocorrencia>>('/ocorrencias', { params: { aluno_id: alunoId } }),
};

// --- Dashboard ---
export interface DashboardSummary {
  total_alunos: number;
  total_turmas: number;
  media_geral: number;
  alunos_em_risco: number;
  ocorrencias_abertas?: number;
  comunicados_recentes?: number;
}

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>('/dashboard/kpis'),
};
