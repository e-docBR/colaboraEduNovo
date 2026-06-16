import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { logout } from "../auth/authSlice";

const YEAR_KEY = "colabora.app.academicYearId";
const TENANT_KEY = "colabora.app.tenantId";

const readNumberFromSession = (key: string): number | null => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
};

const writeNumberToSession = (key: string, value: number | null) => {
    if (typeof window === "undefined") return;
    if (value != null) {
        sessionStorage.setItem(key, String(value));
    } else {
        sessionStorage.removeItem(key);
    }
};

interface AppState {
    academicYearId: number | null;
    tenantId: number | null;
}

const initialState: AppState = {
    academicYearId: readNumberFromSession(YEAR_KEY),
    tenantId: readNumberFromSession(TENANT_KEY),
};

const appSlice = createSlice({
    name: "app",
    initialState,
    reducers: {
        setAcademicYearId: (state, action: PayloadAction<number | null>) => {
            state.academicYearId = action.payload;
            writeNumberToSession(YEAR_KEY, action.payload);
        },
        setTenantId: (state, action: PayloadAction<number | null>) => {
            state.tenantId = action.payload;
            writeNumberToSession(TENANT_KEY, action.payload);
        },
    },
    extraReducers: (builder) => {
        builder.addCase(logout, (state) => {
            state.academicYearId = null;
            state.tenantId = null;
            writeNumberToSession(YEAR_KEY, null);
            writeNumberToSession(TENANT_KEY, null);
        });
    },
});

export const { setAcademicYearId, setTenantId } = appSlice.actions;
export const appReducer = appSlice.reducer;
