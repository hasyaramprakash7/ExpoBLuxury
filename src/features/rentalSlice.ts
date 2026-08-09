// features/rentalSlice.ts
import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { RootState } from '../app/store';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../src/config/config';

const API_BASE_URL = `${appConfig.apiUrl}/v1/rentals`;

// --- Types ---
export interface RentalLocation {
  city: string;
  locality: string;
  state: string;
  pincode: string;
  coordinates?: { type: 'Point'; coordinates: number[] };
}

export interface RentalVendor {
  vendorId: string;
  name: string;
  contact: string;
}

export interface Rental {
  _id: string;
  title: string;
  description?: string;
  rentalType: 'PG' | 'Hotel' | 'Apartment' | 'Villa' | 'Hostel' | 'Guest House';
  monthlyRent: number;
  deposit: number;
  maintenanceCharges: number;
  isAvailable: boolean;
  availableFrom: Date | string;
  amenities: string[];
  images: string[];
  location: RentalLocation;
  vendor: RentalVendor;
  h3Index?: string;
  maxGuests?: number;
  bedrooms?: number;
  bathrooms?: number;
  contactedCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ✅ ADDED: Filter interface
export interface RentalFilters {
  rentalType: string;
  minRent: number | null;
  maxRent: number | null;
  city: string;
  state: string;
  locality: string;
  pincode: string;
  isAvailable: boolean;
}

interface RentalState {
  rentals: Rental[];
  currentRental: Rental | null;
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  searchQuery: string;
  filters: RentalFilters;
}

// --- Helpers ---
const getToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('vendorToken');
    console.log('🔑 Retrieved token:', token ? '✅ present' : '❌ missing');
    return token;
  } catch (e) {
    console.error('❌ Error reading token:', e);
    return null;
  }
};

const buildFormData = (payload: any): FormData => {
  const formData = new FormData();
  console.log('📦 Building FormData from payload keys:', Object.keys(payload));

  Object.keys(payload).forEach((key) => {
    if (key === 'images') {
      if (Array.isArray(payload.images) && payload.images.length > 0) {
        console.log(`🖼️ Appending ${payload.images.length} images`);
        payload.images.forEach((file: any, index: number) => {
          let mimeType = file.type || 'image/jpeg';
          if (mimeType === 'image') mimeType = 'image/jpeg';
          const fileObj = {
            uri: file.uri,
            name: file.name || `image_${index}.jpg`,
            type: mimeType,
          };
          console.log(`  📎 Image ${index + 1}:`, fileObj);
          formData.append('images', fileObj as any);
        });
      } else {
        console.log('⚠️ No images to append');
      }
    } else if (payload[key] !== null && payload[key] !== undefined) {
      let value = payload[key];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
        console.log(`📝 Appending ${key} as JSON string`);
      } else {
        console.log(`📝 Appending ${key}:`, value);
      }
      formData.append(key, String(value));
    }
  });

  return formData;
};

// --- Thunks ---
interface FetchRentalsArgs {
  page?: number;
  limit?: number;
  q?: string;
  city?: string;
  state?: string;
  locality?: string;
  pincode?: string;
  rentalType?: string;
  isAvailable?: boolean;
  minRent?: number;
  maxRent?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  h3Index?: string;
  sort?: string;
}

interface FetchRentalsResponse {
  data: Rental[];
  page: number;
  total: number;
}

// ✅ fetchRentals - PUBLIC endpoint
export const fetchRentals = createAsyncThunk<
  FetchRentalsResponse,
  FetchRentalsArgs | void,
  { rejectValue: string }
>('rental/fetchAll', async (args, { rejectWithValue }) => {
  try {
    const page = args?.page || 1;
    const limit = args?.limit || 10;
    const params: any = { page, limit };
    if (args?.q) params.q = args.q;
    if (args?.city) params.city = args.city;
    if (args?.state) params.state = args.state;
    if (args?.locality) params.locality = args.locality;
    if (args?.pincode) params.pincode = args.pincode;
    if (args?.rentalType) params.rentalType = args.rentalType;
    if (args?.isAvailable !== undefined) params.isAvailable = String(args.isAvailable);
    if (args?.minRent) params.minRent = args.minRent;
    if (args?.maxRent) params.maxRent = args.maxRent;
    if (args?.lat && args?.lng) {
      params.lat = args.lat;
      params.lng = args.lng;
      params.radius = args.radius || 5;
    }
    if (args?.h3Index) params.h3Index = args.h3Index;
    if (args?.sort) params.sort = args.sort;

    console.log(`🌐 Fetching rentals with params:`, params);

    const response = await axios.get<{ data: Rental[]; page: number; total: number }>(
      API_BASE_URL,
      { params }
    );
    console.log(`✅ Fetched ${response.data.data.length} rentals, total ${response.data.total}`);
    return {
      data: response.data.data,
      page: response.data.page || page,
      total: response.data.total || 0,
    };
  } catch (error: any) {
    console.error('❌ fetchRentals error:', error.response?.data || error.message);
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch rentals.');
  }
});

export const fetchRentalById = createAsyncThunk<
  Rental,
  string,
  { rejectValue: string }
>('rental/fetchById', async (id, { rejectWithValue }) => {
  try {
    console.log(`🔍 Fetching rental by ID: ${id}`);
    const response = await axios.get<{ data: Rental }>(`${API_BASE_URL}/${id}`);
    console.log(`✅ Rental fetched: ${response.data.data.title}`);
    return response.data.data;
  } catch (error: any) {
    console.error('❌ fetchRentalById error:', error.response?.data || error.message);
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch rental.');
  }
});

export const createRental = createAsyncThunk<
  Rental,
  any,
  { rejectValue: string }
>('rental/create', async (payload, { rejectWithValue }) => {
  try {
    console.log('➕ Creating new rental...');
    const token = await getToken();
    if (!token) return rejectWithValue('Authentication required.');

    const formData = buildFormData(payload);
    console.log('🌐 Sending POST to:', API_BASE_URL);

    const response = await axios.post<{ data: Rental }>(API_BASE_URL, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    console.log('✅ Rental created:', response.data.data);
    return response.data.data;
  } catch (error: any) {
    console.error('❌ createRental error:', error.response?.data || error.message);
    return rejectWithValue(error.response?.data?.message || 'Failed to create rental.');
  }
});

export const updateRental = createAsyncThunk<
  Rental,
  { id: string; payload: any },
  { rejectValue: string }
>('rental/update', async ({ id, payload }, { rejectWithValue }) => {
  try {
    console.log(`✏️ Updating rental ${id}...`);
    const token = await getToken();
    if (!token) return rejectWithValue('Authentication required.');

    const formData = buildFormData(payload);
    console.log(`🌐 Sending PATCH to: ${API_BASE_URL}/${id}`);

    const response = await axios.patch<{ data: Rental }>(`${API_BASE_URL}/${id}`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    console.log('✅ Rental updated:', response.data.data);
    return response.data.data;
  } catch (error: any) {
    console.error('❌ updateRental error:', error.response?.data || error.message);
    return rejectWithValue(error.response?.data?.message || 'Failed to update rental.');
  }
});

export const deleteRental = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('rental/delete', async (id, { rejectWithValue }) => {
  try {
    console.log(`🗑️ Deleting rental ${id}...`);
    const token = await getToken();
    if (!token) return rejectWithValue('Authentication required.');

    await axios.delete(`${API_BASE_URL}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`✅ Rental ${id} deleted.`);
    return id;
  } catch (error: any) {
    console.error('❌ deleteRental error:', error.response?.data || error.message);
    return rejectWithValue(error.response?.data?.message || 'Failed to delete rental.');
  }
});

// ✅ NEW: Search rentals with Elasticsearch-style query
export const searchRentals = createAsyncThunk<
  FetchRentalsResponse,
  { query: string; page?: number; limit?: number },
  { rejectValue: string }
>('rental/search', async ({ query, page = 1, limit = 10 }, { rejectWithValue }) => {
  try {
    console.log(`🔍 Searching rentals with query: "${query}"`);
    const params: any = { 
      page, 
      limit,
      q: query,
    };
    
    const response = await axios.get<{ data: Rental[]; page: number; total: number }>(
      API_BASE_URL,
      { params }
    );
    console.log(`✅ Search found ${response.data.data.length} rentals`);
    return {
      data: response.data.data,
      page: response.data.page || page,
      total: response.data.total || 0,
    };
  } catch (error: any) {
    console.error('❌ searchRentals error:', error.response?.data || error.message);
    return rejectWithValue(error.response?.data?.message || 'Failed to search rentals.');
  }
});

// ✅ NEW: Get pincode details for auto-fill
export const getPincodeDetails = createAsyncThunk<
  { city: string; state: string; locality: string },
  string,
  { rejectValue: string }
>('rental/getPincodeDetails', async (pincode, { rejectWithValue }) => {
  try {
    console.log(`📍 Fetching details for pincode: ${pincode}`);
    // Use a pincode API
    const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
    if (response.data && response.data[0]?.Status === 'Success') {
      const postOffice = response.data[0].PostOffice[0];
      return {
        city: postOffice.District || postOffice.Region || '',
        state: postOffice.State || '',
        locality: postOffice.Name || postOffice.Block || '',
      };
    }
    return rejectWithValue('Invalid pincode or no data found.');
  } catch (error: any) {
    console.error('❌ getPincodeDetails error:', error.response?.data || error.message);
    return rejectWithValue('Failed to fetch pincode details.');
  }
});

// --- Initial State ---
const initialState: RentalState = {
  rentals: [],
  currentRental: null,
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  hasMore: true,
  searchQuery: '',
  filters: {
    rentalType: '',
    minRent: null,
    maxRent: null,
    city: '',
    state: '',
    locality: '',
    pincode: '',
    isAvailable: true,
  },
};

// --- Slice ---
const rentalSlice = createSlice({
  name: 'rental',
  initialState,
  reducers: {
    clearRentalError: (state) => {
      state.error = null;
    },
    resetRentalState: (state) => {
      Object.assign(state, initialState);
    },
    // ✅ NEW: Set search query
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    // ✅ NEW: Set filters
    setFilters: (state, action: PayloadAction<Partial<RentalFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    // ✅ NEW: Clear all filters
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.searchQuery = '';
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchRentals
      .addCase(fetchRentals.pending, (state) => {
        state.loading = true;
        state.error = null;
        console.log('⏳ fetchRentals pending');
      })
      .addCase(fetchRentals.fulfilled, (state, action: PayloadAction<FetchRentalsResponse>) => {
        state.loading = false;
        const { data, page, total } = action.payload;
        if (page === 1) {
          state.rentals = data;
          console.log(`✅ fetchRentals fulfilled: page 1, ${data.length} rentals`);
        } else {
          const existingIds = new Set(state.rentals.map((r) => r._id));
          const newRentals = data.filter((r) => !existingIds.has(r._id));
          state.rentals = [...state.rentals, ...newRentals];
          console.log(`✅ fetchRentals fulfilled: added ${newRentals.length} new rentals, total ${state.rentals.length}`);
        }
        state.currentPage = page;
        state.totalPages = Math.ceil(total / 10);
        state.hasMore = state.rentals.length < total;
      })
      .addCase(fetchRentals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.log('❌ fetchRentals rejected:', action.payload);
      })
      // searchRentals
      .addCase(searchRentals.pending, (state) => {
        state.loading = true;
        state.error = null;
        console.log('⏳ searchRentals pending');
      })
      .addCase(searchRentals.fulfilled, (state, action: PayloadAction<FetchRentalsResponse>) => {
        state.loading = false;
        state.rentals = action.payload.data;
        state.currentPage = action.payload.page;
        state.totalPages = Math.ceil(action.payload.total / 10);
        state.hasMore = state.rentals.length < action.payload.total;
        console.log(`✅ searchRentals fulfilled: ${state.rentals.length} results`);
      })
      .addCase(searchRentals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.log('❌ searchRentals rejected:', action.payload);
      })
      // fetchRentalById
      .addCase(fetchRentalById.pending, (state) => {
        state.loading = true;
        state.error = null;
        console.log('⏳ fetchRentalById pending');
      })
      .addCase(fetchRentalById.fulfilled, (state, action: PayloadAction<Rental>) => {
        state.loading = false;
        state.currentRental = action.payload;
        console.log(`✅ fetchRentalById fulfilled: ${action.payload.title}`);
      })
      .addCase(fetchRentalById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.log('❌ fetchRentalById rejected:', action.payload);
      })
      // createRental
      .addCase(createRental.pending, (state) => {
        state.loading = true;
        state.error = null;
        console.log('⏳ createRental pending');
      })
      .addCase(createRental.fulfilled, (state, action: PayloadAction<Rental>) => {
        state.loading = false;
        state.rentals.unshift(action.payload);
        console.log(`✅ createRental fulfilled: ${action.payload.title}`);
      })
      .addCase(createRental.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.log('❌ createRental rejected:', action.payload);
      })
      // updateRental
      .addCase(updateRental.pending, (state) => {
        state.loading = true;
        state.error = null;
        console.log('⏳ updateRental pending');
      })
      .addCase(updateRental.fulfilled, (state, action: PayloadAction<Rental>) => {
        state.loading = false;
        const index = state.rentals.findIndex((r) => r._id === action.payload._id);
        if (index !== -1) state.rentals[index] = action.payload;
        if (state.currentRental?._id === action.payload._id) state.currentRental = action.payload;
        console.log(`✅ updateRental fulfilled: ${action.payload.title}`);
      })
      .addCase(updateRental.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.log('❌ updateRental rejected:', action.payload);
      })
      // deleteRental
      .addCase(deleteRental.pending, (state) => {
        state.loading = true;
        state.error = null;
        console.log('⏳ deleteRental pending');
      })
      .addCase(deleteRental.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.rentals = state.rentals.filter((r) => r._id !== action.payload);
        if (state.currentRental?._id === action.payload) state.currentRental = null;
        console.log(`✅ deleteRental fulfilled: ${action.payload}`);
      })
      .addCase(deleteRental.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.log('❌ deleteRental rejected:', action.payload);
      });
  },
});

// ✅ EXPORT ALL ACTIONS
export const { 
  clearRentalError, 
  resetRentalState,
  setSearchQuery,
  setFilters,
  clearFilters,
} = rentalSlice.actions;

export default rentalSlice.reducer;

// --- Selectors ---
const selectRentalState = (state: RootState) => state.rental;

export const selectAllRentals = createSelector(
  [selectRentalState],
  (state) => state.rentals
);

export const selectCurrentRental = createSelector(
  [selectRentalState],
  (state) => state.currentRental
);

export const selectRentalLoading = createSelector(
  [selectRentalState],
  (state) => state.loading
);

export const selectRentalError = createSelector(
  [selectRentalState],
  (state) => state.error
);

export const selectRentalPagination = createSelector(
  [selectRentalState],
  (state) => ({
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    hasMore: state.hasMore,
  })
);

// ✅ NEW SELECTORS
export const selectFilters = createSelector(
  [selectRentalState],
  (state) => state.filters
);

export const selectSearchQuery = createSelector(
  [selectRentalState],
  (state) => state.searchQuery
);