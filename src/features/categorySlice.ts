// src/features/categorySlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../userScreens/utils/api';

export interface Category {
  _id: string;
  name: string;
  icon?: string;
  image?: string;
  order: number;
  isActive: boolean;
  parentCategory?: string | null;
}

interface CategoryState {
  categories: Category[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoryState = {
  categories: [],
  loading: false,
  error: null,
};

export const fetchCategories = createAsyncThunk(
  'categories/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/categories');
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch categories');
    }
  }
);

// Support FormData for image upload
export const createCategory = createAsyncThunk(
  'categories/create',
  async (data: FormData | { name: string; icon?: string; order?: number; isActive?: boolean }, { rejectWithValue }) => {
    try {
      const isFormData = data instanceof FormData;
      const res = await api.post('/categories', data, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      });
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create category');
    }
  }
);

export const updateCategory = createAsyncThunk(
  'categories/update',
  async ({ id, data }: { id: string; data: FormData | Partial<Category> }, { rejectWithValue }) => {
    try {
      const isFormData = data instanceof FormData;
      const res = await api.put(`/categories/${id}`, data, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      });
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update category');
    }
  }
);

export const deleteCategory = createAsyncThunk(
  'categories/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.delete(`/categories/${id}`);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete category');
    }
  }
);

const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.categories = [action.payload, ...state.categories];
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const index = state.categories.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.categories[index] = action.payload;
        }
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.categories = state.categories.filter(c => c._id !== action.payload);
      });
  },
});

export default categorySlice.reducer;