// src/features/reviewSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../userScreens/utils/api';
import { RootState } from '../app/store';

export interface Review {
  _id: string;
  vendor: string;
  user: { _id: string; name: string; profilePic?: string };
  rating: number;
  comment: string;
  images?: string[];
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReviewState {
  reviews: Review[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  hasMore: boolean;
}

const initialState: ReviewState = {
  reviews: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  hasMore: true,
};

export const fetchVendorReviews = createAsyncThunk(
  'reviews/fetchByVendor',
  async ({ vendorId, page = 1, limit = 10 }: { vendorId: string; page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/reviews/vendor/${vendorId}?page=${page}&limit=${limit}`);
      return res.data; // { status, results, total, page, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch reviews');
    }
  }
);

export const createReview = createAsyncThunk(
  'reviews/create',
  async (payload: { vendorId: string; rating: number; comment: string; images?: string[]; isVerified?: boolean }, { rejectWithValue }) => {
    try {
      const res = await api.post('/reviews', payload);
      return res.data.data; // the new review
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to submit review');
    }
  }
);

const reviewSlice = createSlice({
  name: 'reviews',
  initialState,
  reducers: {
    clearReviews: (state) => {
      state.reviews = [];
      state.page = 1;
      state.hasMore = true;
      state.total = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendorReviews.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorReviews.fulfilled, (state, action) => {
        state.loading = false;
        const { data, page, total } = action.payload;
        if (page === 1) {
          state.reviews = data;
        } else {
          state.reviews = [...state.reviews, ...data];
        }
        state.page = page;
        state.total = total;
        state.hasMore = state.reviews.length < total;
      })
      .addCase(fetchVendorReviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createReview.fulfilled, (state, action) => {
        state.reviews = [action.payload, ...state.reviews];
        state.total += 1;
      });
  },
});

export const { clearReviews } = reviewSlice.actions;
export default reviewSlice.reducer;