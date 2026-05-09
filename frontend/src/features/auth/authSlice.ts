import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  accessToken?: string;
  refreshToken?: string;
  user?: {
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

const REFRESH_TOKEN_KEY = "colabora.auth.rt";

const initialState: AuthState = {
  accessToken: undefined,
  // Recupera refreshToken do sessionStorage para suportar silent refresh após F5
  refreshToken: typeof sessionStorage !== "undefined"
    ? (sessionStorage.getItem(REFRESH_TOKEN_KEY) ?? undefined)
    : undefined,
  user: undefined
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ access_token: string; refresh_token: string; user: AuthState["user"] }>
    ) => {
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
      state.user = action.payload.user;
      // Persiste refreshToken em sessionStorage para silent refresh após reload
      if (typeof sessionStorage !== "undefined" && action.payload.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, action.payload.refresh_token);
      }
    },
    logout: (state) => {
      state.accessToken = undefined;
      state.refreshToken = undefined;
      state.user = undefined;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    },
    updateUser: (state, action: PayloadAction<AuthState["user"] | undefined>) => {
      state.user = action.payload;
    }
  }
});

export const { setCredentials, logout, updateUser } = authSlice.actions;
export const authReducer = authSlice.reducer;
