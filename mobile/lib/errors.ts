import axios from 'axios';

import { API_BASE_URL } from './api';

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const serverMessage = error.response?.data?.error;
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }

    if (error.code === 'ECONNABORTED') {
      return `Tempo esgotado ao conectar ao servidor (${API_BASE_URL}). Verifique se o backend local esta rodando.`;
    }

    if (!error.response) {
      return `Nao foi possivel conectar ao servidor (${API_BASE_URL}). Verifique a URL da API, o backend local e a rede usada no teste.`;
    }

    if (error.response.status >= 500) {
      return 'O servidor respondeu com erro interno. Verifique o backend local e tente novamente.';
    }
  }

  return fallback;
}
