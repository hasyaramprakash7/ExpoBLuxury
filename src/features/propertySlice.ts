// features/propertySlice.ts
import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import { RootState } from '../app/store';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import appConfig from '../../src/config/config';
import { Vendor } from '../../src/types/models';

const API_BASE_URL = `${appConfig.apiUrl}/v1/properties`;

// --- Types ---
export interface AreaOption {
  _id?: string;
  optionName: string;
  superBuiltUpSqFt: number;
  carpetAreaSqFt?: number;
  priceCr: number;
  ratePerSqFt: number;
  govtChargesIncluded: boolean;
  floorPlanImage?: string;
}

export interface CostBreakup {
  feeName: string;
  amount: number;
  currency?: string;
  isOneTime?: boolean;
  description?: string;
}

export interface PropertyLocation {
  address?: string;
  locality: string;
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  mapUrl?: string;
  coordinates?: { type: 'Point'; coordinates: number[] };
  h3Index?: string;
}

export interface PropertyConfiguration {
  bhk: string;
  bathrooms?: number;
  balconies?: number;
  totalFloors: number;
  propertyFloor?: number;
  carParkingAvailable: boolean;
  furnishingStatus?: 'Unfurnished' | 'Semi-Furnished' | 'Fully Furnished';
  facing?: 'North' | 'South' | 'East' | 'West' | 'North-East' | 'North-West' | 'South-East' | 'South-West';
  ownershipType?: 'Freehold' | 'Leasehold' | 'Co-operative Society';
}

export interface PropertyVendor {
  vendorId: string;
  name: string;
  shopName?: string;
  phone?: string;
  shopImage?: string;
  isApproved?: boolean;
}

export interface Property {
  _id: string;
  title: string;
  propertyType: 'Independent House/Villa' | 'Apartment' | 'Plot' | 'Commercial' | 'Penthouse' | 'Studio';
  status: 'New Launch' | 'Under Construction' | 'Ready to Move' | 'Resale';
  websiteUrl?: string;
  virtualTourUrl?: string;
  registrationId?: string;
  maintenanceCharges?: number;
  additionalCosts?: CostBreakup[];
  location: PropertyLocation;
  priceUnit?: 'Lakhs' | 'Crores';
  minPriceValue?: number;
  maxPriceValue?: number;
  minPriceCr: number;
  maxPriceCr: number;
  configuration: PropertyConfiguration;
  areaOptions: AreaOption[];
  amenities?: string[];
  projectHighlights?: string[];
  tags?: string[];
  possessionDate: Date | string;
  builtYear?: number;
  images: string[];
  contactedCount: number;
  vendor: PropertyVendor;
  isActive?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// State with vendors
interface PropertyState {
  properties: Property[];
  currentProperty: Property | null;
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  vendors: Vendor[];
  vendorsLoading: boolean;
  vendorsError: string | null;
}

// --- Helpers ---
const getToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem('vendorToken');
    return token;
  } catch {
    return null;
  }
};

const buildFormData = (payload: any): FormData => {
  const formData = new FormData();
  
  // Debug: Log all payload keys
  console.log('📦 Building FormData from payload keys:', Object.keys(payload));
  
  Object.keys(payload).forEach((key) => {
    if (key === 'images') {
      if (Array.isArray(payload.images) && payload.images.length > 0) {
        payload.images.forEach((file: any, index: number) => {
          let mimeType = file.type || 'image/jpeg';
          if (mimeType === 'image') mimeType = 'image/jpeg';
          let fileUri = file.uri;
          if (Platform.OS === 'android' && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
            fileUri = `file://${fileUri}`;
          }
          const fileObj = {
            uri: fileUri,
            name: file.name || `image_${index}.jpg`,
            type: mimeType,
          };
          console.log(`📎 Appending image ${index}:`, fileObj);
          formData.append('images', fileObj as any);
        });
      }
    } else if (payload[key] !== null && payload[key] !== undefined) {
      let value = payload[key];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      console.log(`📎 Appending ${key}:`, value);
      formData.append(key, String(value));
    }
  });
  
  return formData;
};

// --- Thunk arguments ---
interface FetchPropertiesArgs {
  page?: number;
  limit?: number;
  vendorId?: string;
  q?: string;
  city?: string;
  state?: string;
  locality?: string;
  pincode?: string;
  propertyType?: string;
  status?: string;
  bhk?: string;
  minPrice?: number;
  maxPrice?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  h3Index?: string;
  sort?: string;
}

interface FetchPropertiesResponse {
  data: Property[];
  page: number;
  total: number;
}

// --- PUBLIC THUNKS (no token required) ---
export const fetchProperties = createAsyncThunk<
  FetchPropertiesResponse,
  FetchPropertiesArgs | void,
  { rejectValue: string }
>('property/fetchAll', async (args, { rejectWithValue }) => {
  try {
    const page = args?.page || 1;
    const limit = args?.limit || 10;
    const params: any = { page, limit };
    if (args?.vendorId) params['vendor.vendorId'] = args.vendorId;
    if (args?.q) params.q = args.q;
    if (args?.city) params.city = args.city;
    if (args?.state) params.state = args.state;
    if (args?.locality) params.locality = args.locality;
    if (args?.pincode) params.pincode = args.pincode;
    if (args?.propertyType) params.propertyType = args.propertyType;
    if (args?.status) params.status = args.status;
    if (args?.bhk) params.bhk = args.bhk;
    if (args?.minPrice) params.minPrice = args.minPrice;
    if (args?.maxPrice) params.maxPrice = args.maxPrice;
    if (args?.lat && args?.lng) {
      params.lat = args.lat;
      params.lng = args.lng;
      params.radius = args.radius || 5;
    }
    if (args?.h3Index) params.h3Index = args.h3Index;
    if (args?.sort) params.sort = args.sort;

    const token = await getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await axios.get<{ data: Property[]; page: number; total: number }>(
      API_BASE_URL,
      { headers, params }
    );
    return {
      data: response.data.data,
      page: response.data.page || page,
      total: response.data.total || 0,
    };
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch properties.');
  }
});

export const fetchPropertiesWithinRadius = createAsyncThunk<
  Property[],
  { lat: number; lng: number; distance: number },
  { rejectValue: string }
>('property/fetchRadius', async ({ lat, lng, distance }, { rejectWithValue }) => {
  try {
    const token = await getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.get<{ data: Property[] }>(
      `${API_BASE_URL}/radius/${lat}/${lng}/${distance}`,
      { headers }
    );
    return response.data.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch nearby properties.');
  }
});

export const fetchPropertiesByH3 = createAsyncThunk<
  Property[],
  string,
  { rejectValue: string }
>('property/fetchH3', async (h3Index, { rejectWithValue }) => {
  try {
    const token = await getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.get<{ data: Property[] }>(
      `${API_BASE_URL}/h3/${h3Index}`,
      { headers }
    );
    return response.data.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch properties in this area.');
  }
});

export const fetchPropertyById = createAsyncThunk<
  Property,
  string,
  { rejectValue: string }
>('property/fetchById', async (propertyId, { rejectWithValue }) => {
  try {
    const token = await getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.get<{ data: Property }>(
      `${API_BASE_URL}/${propertyId}`,
      { headers }
    );
    return response.data.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch property details.');
  }
});

// --- PROTECTED THUNKS (require token) ---
export const createProperty = createAsyncThunk<
  Property,
  any,
  { rejectValue: string }
>('property/create', async (payload, { rejectWithValue }) => {
  try {
    const token = await getToken();
    if (!token) return rejectWithValue('Authentication token not found.');
    const formData = buildFormData(payload);
    const response = await axios.post<{ data: Property }>(API_BASE_URL, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    return response.data.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create property.');
  }
});

export const updateProperty = createAsyncThunk<
  Property,
  { id: string; payload: any },
  { rejectValue: string }
>('property/update', async ({ id, payload }, { rejectWithValue }) => {
  try {
    console.log('🔄 [updateProperty] Thunk called with ID:', id);
    console.log('📦 Payload keys:', Object.keys(payload));
    
    const token = await getToken();
    if (!token) return rejectWithValue('Authentication token not found.');
    
    const formData = buildFormData(payload);
    
    console.log('📤 Sending update request to:', `${API_BASE_URL}/${id}`);
    
    const response = await axios.patch<{ data: Property }>(`${API_BASE_URL}/${id}`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
    
    console.log('✅ Update response received:', response.data.data._id);
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Update property error:', error.response?.data || error.message);
    return rejectWithValue(error.response?.data?.message || 'Failed to update property.');
  }
});

export const deleteProperty = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('property/delete', async (propertyId, { rejectWithValue }) => {
  try {
    const token = await getToken();
    if (!token) return rejectWithValue('Authentication token not found.');
    await axios.delete(`${API_BASE_URL}/${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return propertyId;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to delete property.');
  }
});

// --- VENDORS (public – returns empty array if no token) ---
export const fetchAllVendors = createAsyncThunk<
  Vendor[],
  void,
  { rejectValue: string }
>('property/fetchAllVendors', async (_, { rejectWithValue }) => {
  try {
    const token = await getToken();
    if (!token) {
      return [];
    }
    const response = await axios.get<{ vendors: Vendor[] }>(
      `${appConfig.apiUrl}/vendors/all`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.vendors;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch vendors.');
  }
});

// --- Initial State ---
const initialState: PropertyState = {
  properties: [],
  currentProperty: null,
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  hasMore: true,
  vendors: [],
  vendorsLoading: false,
  vendorsError: null,
};

// --- Slice ---
const propertySlice = createSlice({
  name: 'property',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetPropertyState: (state) => {
      Object.assign(state, initialState);
    },
    clearVendors: (state) => {
      state.vendors = [];
      state.vendorsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchProperties
      .addCase(fetchProperties.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProperties.fulfilled, (state, action: PayloadAction<FetchPropertiesResponse>) => {
        state.loading = false;
        const { data, page, total } = action.payload;
        if (page === 1) {
          state.properties = data;
        } else {
          const existingIds = new Set(state.properties.map((p) => p._id));
          const newProperties = data.filter((p) => !existingIds.has(p._id));
          state.properties = [...state.properties, ...newProperties];
        }
        state.currentPage = page;
        state.totalPages = Math.ceil(total / 10);
        state.hasMore = state.properties.length < total;
      })
      .addCase(fetchProperties.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchPropertiesWithinRadius
      .addCase(fetchPropertiesWithinRadius.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPropertiesWithinRadius.fulfilled, (state, action: PayloadAction<Property[]>) => {
        state.loading = false;
        state.properties = action.payload;
        state.hasMore = false;
      })
      .addCase(fetchPropertiesWithinRadius.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchPropertiesByH3
      .addCase(fetchPropertiesByH3.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPropertiesByH3.fulfilled, (state, action: PayloadAction<Property[]>) => {
        state.loading = false;
        state.properties = action.payload;
        state.hasMore = false;
      })
      .addCase(fetchPropertiesByH3.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchPropertyById
      .addCase(fetchPropertyById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPropertyById.fulfilled, (state, action: PayloadAction<Property>) => {
        state.loading = false;
        state.currentProperty = action.payload;
        console.log('✅ Current property updated:', action.payload._id);
        console.log('📋 Facing:', action.payload.configuration?.facing);
        console.log('📋 Registration ID:', action.payload.registrationId);
        console.log('📋 Maintenance:', action.payload.maintenanceCharges);
      })
      .addCase(fetchPropertyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createProperty
      .addCase(createProperty.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProperty.fulfilled, (state, action: PayloadAction<Property>) => {
        state.loading = false;
        state.properties.unshift(action.payload);
        console.log('✅ Property created:', action.payload._id);
      })
      .addCase(createProperty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // updateProperty - ✅ FIXED: Properly update the property in the list and currentProperty
      .addCase(updateProperty.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProperty.fulfilled, (state, action: PayloadAction<Property>) => {
        state.loading = false;
        const updatedProperty = action.payload;
        console.log('✅ Property updated in Redux:', updatedProperty._id);
        console.log('📋 Facing:', updatedProperty.configuration?.facing);
        console.log('📋 Registration ID:', updatedProperty.registrationId);
        console.log('📋 Maintenance:', updatedProperty.maintenanceCharges);
        
        // Update the property in the list
        const index = state.properties.findIndex((p) => p._id === updatedProperty._id);
        if (index !== -1) {
          state.properties[index] = updatedProperty;
          console.log('✅ Updated property in list at index:', index);
        } else {
          console.warn('⚠️ Property not found in list, adding it');
          state.properties.unshift(updatedProperty);
        }
        
        // Update currentProperty if it's the one being edited
        if (state.currentProperty?._id === updatedProperty._id) {
          state.currentProperty = updatedProperty;
          console.log('✅ Updated currentProperty');
        }
      })
      .addCase(updateProperty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.error('❌ Update rejected:', action.payload);
      })
      // deleteProperty
      .addCase(deleteProperty.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProperty.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        state.properties = state.properties.filter((p) => p._id !== action.payload);
        if (state.currentProperty?._id === action.payload) state.currentProperty = null;
        console.log('✅ Property deleted:', action.payload);
      })
      .addCase(deleteProperty.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchAllVendors
      .addCase(fetchAllVendors.pending, (state) => {
        state.vendorsLoading = true;
        state.vendorsError = null;
      })
      .addCase(fetchAllVendors.fulfilled, (state, action: PayloadAction<Vendor[]>) => {
        state.vendorsLoading = false;
        state.vendors = action.payload;
      })
      .addCase(fetchAllVendors.rejected, (state, action) => {
        state.vendorsLoading = false;
        state.vendorsError = action.payload as string;
        state.vendors = [];
      });
  },
});

export const { clearError, resetPropertyState, clearVendors } = propertySlice.actions;
export default propertySlice.reducer;

// --- Selectors ---
const selectPropertyState = (state: RootState) => state.property;

export const selectAllProperties = createSelector(
  [selectPropertyState],
  (state) => state.properties
);
export const selectCurrentProperty = createSelector(
  [selectPropertyState],
  (state) => state.currentProperty
);
export const selectPropertyLoading = createSelector(
  [selectPropertyState],
  (state) => state.loading
);
export const selectPropertyError = createSelector(
  [selectPropertyState],
  (state) => state.error
);
export const selectPropertyPagination = createSelector(
  [selectPropertyState],
  (state) => ({
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    hasMore: state.hasMore,
  })
);
export const selectAllVendors = createSelector(
  [selectPropertyState],
  (state) => state.vendors
);
export const selectVendorsLoading = createSelector(
  [selectPropertyState],
  (state) => state.vendorsLoading
);
export const selectVendorsError = createSelector(
  [selectPropertyState],
  (state) => state.vendorsError
);