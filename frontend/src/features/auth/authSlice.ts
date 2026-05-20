import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  accessToken?: string;
  // refreshToken removido — agora armazenado como HttpOnly cookie pelo backend,
  // inacessível ao JS mesmo em caso de XSS.
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

const authSlice = createSlice({
  name: "auth",
  initialState: {
    accessToken: undefined,
    user: undefined,
  } as AuthState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ access_token: string; user: AuthState["user"] }>
    ) => {
      state.accessToken = action.payload.access_token;
      state.user = action.payload.user;
    },
    logout: (state) => {
      state.accessToken = undefined;
      state.user = undefined;
      // O cookie HttpOnly "rt" é limpo pelo backend no endpoint /auth/logout
    },
    updateUser: (state, action: PayloadAction<AuthState["user"] | undefined>) => {
      state.user = action.payload;
    }
  }
});

export const { setCredentials, logout, updateUser } = authSlice.actions;
export const authReducer = authSlice.reducer;
