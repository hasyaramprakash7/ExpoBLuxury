// src/features/adSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../userScreens/utils/api';

export interface Ad {
  _id: string;
  title: string;
  image: string;
  link: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isProductAd: boolean; // NEW
  createdAt: string;
}

interface AdState {
  ads: Ad[];
  loading: boolean;
  error: string | null;
  activeAds: Ad[];
}

const initialState: AdState = {
  ads: [],
  loading: false,
  error: null,
  activeAds: [],
};

// ---------- Thunks ----------
export const fetchAds = createAsyncThunk(
  'ads/fetchAll',
  async (params?: { isActive?: boolean }, { rejectWithValue }) => {
    try {
      let url = '/ads';
      if (params?.isActive !== undefined) {
        url += `?isActive=${params.isActive}`;
      }
      const res = await api.get(url);
      return res.data?.data || [];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch ads');
    }
  }
);

export const fetchActiveAds = createAsyncThunk(
  'ads/fetchActive',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/ads/active');
      const data = res.data?.data || [];
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch active ads');
    }
  }
);

// createAd and updateAd now expect FormData with 'isProductAd' appended
export const createAd = createAsyncThunk(
  'ads/create',
  async (data: FormData, { rejectWithValue }) => {
    try {
      const res = await api.post('/ads', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data?.data || null;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create ad');
    }
  }
);

export const updateAd = createAsyncThunk(
  'ads/update',
  async ({ id, data }: { id: string; data: FormData }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/ads/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data?.data || null;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update ad');
    }
  }
);

export const deleteAd = createAsyncThunk(
  'ads/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/ads/${id}`);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete ad');
    }
  }
);

export const toggleAdStatus = createAsyncThunk(
  'ads/toggleStatus',
  async ({ id, isActive }: { id: string; isActive: boolean }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/ads/${id}/toggle`, { isActive });
      return res.data?.data || null;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to toggle ad status');
    }
  }
);

// ---------- Slice ----------
const adSlice = createSlice({
  name: 'ads',
  initialState,
  reducers: {
    clearAds: (state) => {
      state.ads = [];
      state.activeAds = [];
      state.loading = false;
      state.error = null;
    },
    resetAds: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // fetchAds
      .addCase(fetchAds.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAds.fulfilled, (state, action) => {
        state.loading = false;
        state.ads = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchAds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.ads = [];
      })

      // fetchActiveAds
      .addCase(fetchActiveAds.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveAds.fulfilled, (state, action) => {
        state.loading = false;
        state.activeAds = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchActiveAds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.activeAds = [];
      })

      // createAd
      .addCase(createAd.fulfilled, (state, action) => {
        if (action.payload) {
          state.ads = [action.payload, ...state.ads];
          const now = new Date();
          const start = new Date(action.payload.startDate);
          const end = new Date(action.payload.endDate);
          if (action.payload.isActive && start <= now && end >= now) {
            state.activeAds = [action.payload, ...state.activeAds];
          }
        }
      })

      // updateAd
      .addCase(updateAd.fulfilled, (state, action) => {
        if (action.payload) {
          const updateAdInArray = (arr: Ad[]) => {
            const idx = arr.findIndex(a => a?._id === action.payload._id);
            if (idx !== -1) arr[idx] = action.payload;
          };
          updateAdInArray(state.ads);
          updateAdInArray(state.activeAds);
        }
      })

      // deleteAd
      .addCase(deleteAd.fulfilled, (state, action) => {
        const id = action.payload;
        state.ads = state.ads.filter(a => a?._id !== id);
        state.activeAds = state.activeAds.filter(a => a?._id !== id);
      })

      // toggleAdStatus
      .addCase(toggleAdStatus.fulfilled, (state, action) => {
        if (action.payload) {
          const update = (arr: Ad[]) => {
            const idx = arr.findIndex(a => a?._id === action.payload._id);
            if (idx !== -1) arr[idx] = action.payload;
          };
          update(state.ads);
          const activeIdx = state.activeAds.findIndex(a => a?._id === action.payload._id);
          if (activeIdx !== -1) {
            if (action.payload.isActive) {
              state.activeAds[activeIdx] = action.payload;
            } else {
              state.activeAds = state.activeAds.filter(a => a?._id !== action.payload._id);
            }
          } else if (action.payload.isActive) {
            state.activeAds = [action.payload, ...state.activeAds];
          }
        }
      });
  },
});

// ---------- Selectors ----------
export const selectAllAds = (state: RootState) => state.ads.ads;
export const selectActiveAds = (state: RootState) => state.ads.activeAds;
export const selectAdsLoading = (state: RootState) => state.ads.loading;
export const selectAdsError = (state: RootState) => state.ads.error;

// Optional: separate selectors for product ads and generic ads
export const selectProductAds = (state: RootState) =>
  state.ads.activeAds.filter(ad => ad.isProductAd);
export const selectGenericAds = (state: RootState) =>
  state.ads.activeAds.filter(ad => !ad.isProductAd);

export const { clearAds, resetAds } = adSlice.actions;
export default adSlice.reducer;