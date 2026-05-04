import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import AsyncStorage from "@react-native-async-storage/async-storage";
import appConfig from '../../src/config/config'; 

// Base URL for property API calls
const API_BASE_URL = `${appConfig.apiUrl}/v1/properties`;

// --- Type Definitions (Strictly Synced with Backend Schema) ---

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
    coordinates?: { type: 'Point'; coordinates: number[] }; // [lng, lat]
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

// 🔥 UPGRADE: Added Pagination Fields 🔥
interface PropertyState {
    properties: Property[];
    currentProperty: Property | null;
    loading: boolean;
    error: string | null;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
}

// --- Helper Functions ---
const getToken = async (): Promise<string | null> => {
    try {
        return await AsyncStorage.getItem("vendorToken");
    } catch (e) {
        return null;
    }
};

const getAuthHeaders = (token: string, isFormData = false) => ({
    headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': isFormData ? 'multipart/form-data' : 'application/json', 
    },
});

// --- Async Thunks (CRUD & GEO Operations) ---

// 🔥 UPGRADE: Now accepts page and limit arguments for Infinite Scrolling 🔥
interface FetchPropertiesArgs {
    vendorId?: string;
    page?: number;
    limit?: number;
}

interface FetchPropertiesResponse {
    data: Property[];
    page: number;
    total: number;
}

export const fetchProperties = createAsyncThunk<FetchPropertiesResponse, FetchPropertiesArgs | void, { rejectValue: string }>(
    'property/fetchAll',
    async (args, { rejectWithValue }) => {
        try {
            const page = args?.page || 1;
            const limit = args?.limit || 10;
            let url = `${API_BASE_URL}?page=${page}&limit=${limit}`;

            if (args?.vendorId) {
                url += `&vendor.vendorId=${args.vendorId}`;
            }

            const response = await axios.get<{ data: Property[], page: number, total: number }>(url);
            return {
                data: response.data.data,
                page: response.data.page || page,
                total: response.data.total || 0
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch properties.");
        }
    }
);

export const fetchPropertiesWithinRadius = createAsyncThunk<Property[], { lat: number; lng: number; distance: number }, { rejectValue: string }>(
    'property/fetchRadius',
    async ({ lat, lng, distance }, { rejectWithValue }) => {
        try {
            const response = await axios.get<{ data: Property[] }>(`${API_BASE_URL}/radius/${lat}/${lng}/${distance}`);
            return response.data.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch nearby properties.");
        }
    }
);

export const fetchPropertiesByH3 = createAsyncThunk<Property[], string, { rejectValue: string }>(
    'property/fetchH3',
    async (h3Index, { rejectWithValue }) => {
        try {
            const response = await axios.get<{ data: Property[] }>(`${API_BASE_URL}/h3/${h3Index}`);
            return response.data.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch properties in this area.");
        }
    }
);

export const fetchPropertyById = createAsyncThunk<Property, string, { rejectValue: string }>(
    'property/fetchById',
    async (propertyId, { rejectWithValue }) => {
        try {
            const response = await axios.get<{ data: Property }>(`${API_BASE_URL}/${propertyId}`);
            return response.data.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to fetch property details.");
        }
    }
);

export const createProperty = createAsyncThunk<Property, FormData, { rejectValue: string }>(
    'property/create',
    async (formData, { rejectWithValue }) => {
        try {
            const token = await getToken();
            if (!token) return rejectWithValue("Authentication token not found.");
            
            const config = getAuthHeaders(token, true); 
            const response = await axios.post<{ data: Property }>(API_BASE_URL, formData, config);
            return response.data.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to create property.");
        }
    }
);

export const updateProperty = createAsyncThunk<Property, { id: string; formData: FormData }, { rejectValue: string }>(
    'property/update',
    async ({ id, formData }, { rejectWithValue }) => {
        try {
            const token = await getToken();
            if (!token) return rejectWithValue("Authentication token not found.");

            const config = getAuthHeaders(token, true); 
            const response = await axios.patch<{ data: Property }>(`${API_BASE_URL}/${id}`, formData, config);
            return response.data.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to update property.");
        }
    }
);

export const deleteProperty = createAsyncThunk<string, string, { rejectValue: string }>(
    'property/delete',
    async (propertyId, { rejectWithValue }) => {
        try {
            const token = await getToken();
            if (!token) return rejectWithValue("Authentication token not found.");
            
            const config = getAuthHeaders(token);
            await axios.delete(`${API_BASE_URL}/${propertyId}`, config);
            return propertyId;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || "Failed to delete property.");
        }
    }
);

// --- Initial State and Slice Definition ---

const initialState: PropertyState = {
    properties: [],
    currentProperty: null,
    loading: false,
    error: null,
    currentPage: 1,
    totalPages: 1,
    hasMore: true,
};

const propertySlice = createSlice({
    name: "property",
    initialState,
    reducers: {
        clearError: (state) => { state.error = null; },
        resetPropertyState: (state) => {
            state.properties = [];
            state.currentProperty = null;
            state.loading = false;
            state.error = null;
            state.currentPage = 1;
            state.totalPages = 1;
            state.hasMore = true;
        },
    },
    extraReducers: (builder) => {
        builder
            // --- Standard Fetches (WITH PAGINATION) ---
            .addCase(fetchProperties.pending, (state) => { 
                state.loading = true; 
                state.error = null; 
            })
            .addCase(fetchProperties.fulfilled, (state, action: PayloadAction<FetchPropertiesResponse>) => {
                state.loading = false;
                const { data, page, total } = action.payload;

                // If page is 1, replace the list (pull-to-refresh). If > 1, append to the list (infinite scroll)
                if (page === 1) {
                    state.properties = data;
                } else {
                    // Prevent duplicates in case React Native triggers the scroll end twice
                    const existingIds = new Set(state.properties.map(p => p._id));
                    const newProperties = data.filter(p => !existingIds.has(p._id));
                    state.properties = [...state.properties, ...newProperties];
                }

                state.currentPage = page;
                state.totalPages = Math.ceil(total / 10); // Assuming limit is 10
                state.hasMore = state.properties.length < total;
            })
            .addCase(fetchProperties.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            
            // 🔥 GEO Fetches (Reset pagination since these return flat arrays) 🔥
            .addCase(fetchPropertiesWithinRadius.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchPropertiesWithinRadius.fulfilled, (state, action: PayloadAction<Property[]>) => {
                state.loading = false;
                state.properties = action.payload;
                state.hasMore = false; // Disable infinite scroll for radius
            })
            .addCase(fetchPropertiesWithinRadius.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            
            .addCase(fetchPropertiesByH3.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchPropertiesByH3.fulfilled, (state, action: PayloadAction<Property[]>) => {
                state.loading = false;
                state.properties = action.payload;
                state.hasMore = false; // Disable infinite scroll for H3
            })
            .addCase(fetchPropertiesByH3.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            // --- Single Property ---
            .addCase(fetchPropertyById.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchPropertyById.fulfilled, (state, action: PayloadAction<Property>) => {
                state.loading = false;
                state.currentProperty = action.payload;
            })
            .addCase(fetchPropertyById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            // --- Create ---
            .addCase(createProperty.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createProperty.fulfilled, (state, action: PayloadAction<Property>) => {
                state.loading = false;
                state.error = null;
                // Add new property to the top of the list
                state.properties.unshift(action.payload); 
            })
            .addCase(createProperty.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            // --- Update ---
            .addCase(updateProperty.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(updateProperty.fulfilled, (state, action: PayloadAction<Property>) => {
                state.loading = false;
                state.error = null;
                const index = state.properties.findIndex(p => p._id === action.payload._id);
                if (index !== -1) {
                    state.properties[index] = action.payload;
                }
                if (state.currentProperty?._id === action.payload._id) {
                    state.currentProperty = action.payload;
                }
            })
            .addCase(updateProperty.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

            // --- Delete ---
            .addCase(deleteProperty.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(deleteProperty.fulfilled, (state, action: PayloadAction<string>) => {
                state.loading = false;
                const deletedId = action.payload;
                state.properties = state.properties.filter(p => p._id !== deletedId);
                if (state.currentProperty?._id === deletedId) { state.currentProperty = null; }
            })
            .addCase(deleteProperty.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearError, resetPropertyState } = propertySlice.actions;
export default propertySlice.reducer;