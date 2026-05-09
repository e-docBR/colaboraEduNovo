import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AppState {
    academicYearId: number | null;
    tenantId: number | null;
}

const initialState: AppState = {
    academicYearId: null,
    tenantId: null,
};

const appSlice = createSlice({
    name: "app",
    initialState,
    reducers: {
        setAcademicYearId: (state, action: PayloadAction<number | null>) => {
            state.academicYearId = action.payload;
        },
        setTenantId: (state, action: PayloadAction<number | null>) => {
            state.tenantId = action.payload;
        },
    },
});

export const { setAcademicYearId, setTenantId } = appSlice.actions;
export const appReducer = appSlice.reducer;
