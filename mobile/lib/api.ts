/**
 * Centralized API client for ColaboraEdu mobile.
 * Injects JWT token automatically and handles 401 responses.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Use the local network IP for development; replace with production URL for release builds.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:5000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
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
            headers: { Authorization: `Bearer ${refreshToken}` }
          });
          if (res.status === 200) {
            await SecureStore.setItemAsync('access_token', res.data.access_token);
            await SecureStore.setItemAsync('refresh_token', res.data.refresh_token);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        await SecureStore.deleteItemAsync('user_data');
      }
    }
    return Promise.reject(error);
  },
);

// --- Auth ---
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    username: string; // Changed from nome to username
    email?: string;  // Sometimes missing in backend
    role: string;    // Changed from roles[] to role
    tenant_id: number;
    tenant_name: string;
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { username: email, password }), // Backend expects username
  me: () => apiClient.get<LoginResponse['user']>('/usuarios/me'), // Fixed endpoint
};

// --- Alunos ---
export interface Aluno {
  id: number;
  nome: string;
  turma: string;
  turno: string;
  academic_year_id: number;
}

export const alunosApi = {
  list: (params?: { turma?: string; turno?: string; offset?: number; limit?: number; search?: string }) =>
    apiClient.get<Aluno[]>('/alunos', { params }),
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
  risk_score?: number | null;
  risk_status?: string | null;
  notas: AlunoNota[];
}

export const alunoDetailApi = {
  get: (id: number) => apiClient.get<AlunoDetail>(`/alunos/${id}`),
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
    apiClient.get<Ocorrencia[]>('/ocorrencias', { params: { aluno_id: alunoId } }),
};

// --- Dashboard ---
export interface DashboardSummary {
  total_alunos: number;
  total_turmas: number;
  media_geral: number;
  alunos_risco: number;
}

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>('/dashboard/summary'),
};
