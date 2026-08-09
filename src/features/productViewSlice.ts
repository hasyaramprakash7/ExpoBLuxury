import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../app/store';
import config from '../config/config';

const API_BASE = `${config.apiUrl}/product-views`;

export interface ProductView {
  _id: string;
  productId: string;
  productType: 'Property' | 'Rental';
  vendorId: string;
  viewerUserId: string;
  viewerName: string;
  viewerPhone: string;
  viewedAt: string;
  product?: {
    _id: string;
    title: string;
    images?: string[];
    minPriceCr?: number;
    maxPriceCr?: number;
    monthlyRent?: number;
    propertyType?: string;
    rentalType?: string;
  };
}

interface ProductViewState {
  views: ProductView[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

const initialState: ProductViewState = {
  views: [],
  loading: false,
  error: null,
  page: 1,
  totalPages: 1,
  hasMore: true,
};

// Thunks
export const fetchVendorViews = createAsyncThunk<
  { views: ProductView[]; total: number; page: number; totalPages: number },
  { vendorId: string; page?: number; limit?: number },
  { rejectValue: string }
>('productViews/fetchVendorViews', async ({ vendorId, page = 1, limit = 20 }, { rejectWithValue }) => {
  try {
    const res = await axios.get(`${API_BASE}/vendor/${vendorId}?page=${page}&limit=${limit}`);
    console.log('✅ Fetched views:', res.data);
    return {
      views: res.data.data,
      total: res.data.total,
      page: res.data.page,
      totalPages: res.data.totalPages,
    };
  } catch (error: any) {
    console.error('❌ fetchVendorViews error:', error.response?.data || error.message);
    return rejectWithValue(error.response?.data?.error || 'Failed to fetch product views.');
  }
});

export const recordProductView = createAsyncThunk<
  void,
  { productId: string; productType: 'Property' | 'Rental'; viewerUserId: string; viewerName: string; viewerPhone: string; vendorId: string },
  { rejectValue: string }
>('productViews/record', async (payload, { rejectWithValue }) => {
  try {
    await axios.post(`${API_BASE}/record`, payload);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.error || 'Failed to record view.');
  }
});

const productViewSlice = createSlice({
  name: 'productViews',
  initialState,
  reducers: {
    clearViews: (state) => {
      state.views = [];
      state.page = 1;
      state.totalPages = 1;
      state.hasMore = true;
    },
    resetError: (state) => {
      state.error = null;
    },
    addView: (state, action: PayloadAction<ProductView>) => {
      if (!state.views.some(v => v._id === action.payload._id)) {
        state.views = [action.payload, ...state.views];
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendorViews.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorViews.fulfilled, (state, action) => {
        state.loading = false;
        const { views, total, page, totalPages } = action.payload;
        if (page === 1) {
          state.views = views;
        } else {
          state.views = [...state.views, ...views];
        }
        state.page = page;
        state.totalPages = totalPages;
        state.hasMore = state.views.length < total;
      })
      .addCase(fetchVendorViews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearViews, resetError, addView } = productViewSlice.actions;
export default productViewSlice.reducer;