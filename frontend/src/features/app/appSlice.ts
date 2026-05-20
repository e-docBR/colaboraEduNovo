import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const YEAR_KEY = "colabora.app.academicYearId";

interface AppState {
    academicYearId: number | null;
    tenantId: number | null;
}

const initialState: AppState = {
    academicYearId: (() => {
        const stored = sessionStorage.getItem(YEAR_KEY);
        return stored ? Number(stored) : null;
    })(),
    tenantId: null,
};

const appSlice = createSlice({
    name: "app",
    initialState,
    reducers: {
        setAcademicYearId: (state, action: PayloadAction<number | null>) => {
            state.academicYearId = action.payload;
            if (action.payload != null) {
                sessionStorage.setItem(YEAR_KEY, String(action.payload));
            } else {
                sessionStorage.removeItem(YEAR_KEY);
            }
        },
        setTenantId: (state, action: PayloadAction<number | null>) => {
            state.tenantId = action.payload;
        },
    },
});

export const { setAcademicYearId, setTenantId } = appSlice.actions;
export const appReducer = appSlice.reducer;
