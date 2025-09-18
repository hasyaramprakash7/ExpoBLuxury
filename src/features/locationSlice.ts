import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  location: null,
  loading: false,
  error: null,
};

const locationSlice = createSlice({
  name: "location",
  initialState,
  reducers: {
    fetchLocationStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchLocationSuccess(state, action) {
      state.loading = false;
      state.location = action.payload;
    },
    fetchLocationFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const { fetchLocationStart, fetchLocationSuccess, fetchLocationFailure } =
  locationSlice.actions;

export default locationSlice.reducer;