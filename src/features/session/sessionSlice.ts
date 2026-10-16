// src/features/session/sessionSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Role = 'user' | 'vendor' | 'deliveryBoy' | 'admin';

interface SessionState {
  activeRole: Role | null;
}

const initialState: SessionState = {
  activeRole: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setActiveRole: (state, action: PayloadAction<Role>) => {
      state.activeRole = action.payload;
    },
    clearActiveRole: (state) => {
      state.activeRole = null;
    },
  },
});

export const { setActiveRole, clearActiveRole } = sessionSlice.actions;
export default sessionSlice.reducer;