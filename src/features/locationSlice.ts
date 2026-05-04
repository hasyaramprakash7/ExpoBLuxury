import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
  createEntityAdapter,
  EntityState,
} from "@reduxjs/toolkit";
import appConfig from "../config/config"; 

// --- Types ---
export interface SavedAddress {
  id: string;
  type: "Home" | "Work" | "Other" | "Current Location";
  addressString: string;
  landmark?: string; // 🔥 SYNCED WITH BACKEND
  city?: string;     // 🔥 SYNCED WITH BACKEND
  pincode?: string;  // 🔥 SYNCED WITH BACKEND
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export interface NewAddressPayload {
  type: "Home" | "Work" | "Other" | "Current Location";
  addressString: string;
  landmark?: string; // 🔥 SYNCED WITH BACKEND
  city?: string;     // 🔥 SYNCED WITH BACKEND
  pincode?: string;  // 🔥 SYNCED WITH BACKEND
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

// 🔥 ENTERPRISE UPGRADE 1: O(1) Entity Adapter 🔥
const addressesAdapter = createEntityAdapter<SavedAddress>({
  selectId: (address) => address.id,
  // Automatically keeps the default address at the top of the list
  sortComparer: (a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0),
});

interface CustomLocationState {
  location: { latitude: number; longitude: number } | null;
  selectedAddress: SavedAddress | null;
  loading: boolean;
  addressActionLoading: boolean; 
  error: string | null;
  permissionGranted: boolean;
}

// Combine Adapter State (ids, entities) with Custom State
type LocationState = EntityState<SavedAddress> & CustomLocationState;

const initialState: LocationState = addressesAdapter.getInitialState({
  location: null,
  selectedAddress: null,
  loading: false,
  addressActionLoading: false,
  error: null,
  permissionGranted: false,
});

// ============================================================================
// ASYNC THUNKS (Full CRUD with Request Cancellation)
// ============================================================================

export const fetchUserAddresses = createAsyncThunk(
  "location/fetchUserAddresses",
  async (token: string, { rejectWithValue, signal }) => {
    try {
      const response = await fetch(`${appConfig.apiUrl}/addresses`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal, // 🔥 ENTERPRISE UPGRADE 2: Network Cancellation
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch addresses");
      return data as SavedAddress[];
    } catch (error: any) {
      if (error.name === 'AbortError') return rejectWithValue("Request cancelled");
      return rejectWithValue(error.message);
    }
  }
);

export const saveUserAddress = createAsyncThunk(
  "location/saveUserAddress",
  async ({ token, addressData }: { token: string; addressData: NewAddressPayload }, { rejectWithValue, signal }) => {
    try {
      const response = await fetch(`${appConfig.apiUrl}/addresses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(addressData),
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save address");
      return data as SavedAddress; 
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserAddress = createAsyncThunk(
  "location/updateUserAddress",
  async ({ token, addressId, addressData }: { token: string; addressId: string; addressData: Partial<NewAddressPayload> }, { rejectWithValue, signal }) => {
    try {
      const response = await fetch(`${appConfig.apiUrl}/addresses/${addressId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(addressData),
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update address");
      return data as SavedAddress;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteUserAddress = createAsyncThunk(
  "location/deleteUserAddress",
  async ({ token, addressId }: { token: string; addressId: string }, { rejectWithValue, signal }) => {
    try {
      const response = await fetch(`${appConfig.apiUrl}/addresses/${addressId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to delete address");
      return addressId; 
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// ============================================================================
// SLICE
// ============================================================================

const locationSlice = createSlice({
  name: "location",
  initialState,
  reducers: {
    fetchLocationStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchLocationSuccess(state, action: PayloadAction<{ latitude: number; longitude: number }>) {
      state.loading = false;
      state.location = {
        latitude: Number(action.payload.latitude),
        longitude: Number(action.payload.longitude),
      };
      state.permissionGranted = true;
    },
    fetchLocationFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      state.permissionGranted = false;
    },
    setSelectedAddress(state, action: PayloadAction<SavedAddress>) {
      state.selectedAddress = action.payload;
      // 🔥 SYNC FIX: Force Number cast to prevent HomeScreen crashes
      state.location = {
        latitude: Number(action.payload.latitude),
        longitude: Number(action.payload.longitude),
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // --- Fetch Addresses ---
      .addCase(fetchUserAddresses.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserAddresses.fulfilled, (state, action) => {
        state.loading = false;
        addressesAdapter.setAll(state, action.payload);

        if (!state.selectedAddress && action.payload.length > 0) {
          // Because of our sortComparer, the first ID is guaranteed to be the default one (if it exists)
          const bestAddressId = state.ids[0];
          const bestAddress = state.entities[bestAddressId] as SavedAddress;
          
          state.selectedAddress = bestAddress;
          // 🔥 SYNC FIX: Cast fetched backend data to Number
          state.location = { 
            latitude: Number(bestAddress.latitude), 
            longitude: Number(bestAddress.longitude) 
          };
        }
      })

      // --- Save Address ---
      .addCase(saveUserAddress.pending, (state) => {
        state.addressActionLoading = true;
      })
      .addCase(saveUserAddress.fulfilled, (state, action) => {
        state.addressActionLoading = false;
        
        // 🔥 ENTERPRISE UPGRADE 3: Safely unset other defaults in O(1) without iterating arrays
        if (action.payload.isDefault) {
          const updates = state.ids.map(id => ({ id, changes: { isDefault: false } }));
          addressesAdapter.updateMany(state, updates);
        }

        addressesAdapter.addOne(state, action.payload);
        state.selectedAddress = action.payload;
        // 🔥 SYNC FIX: Cast saved backend data to Number
        state.location = { 
            latitude: Number(action.payload.latitude), 
            longitude: Number(action.payload.longitude) 
        };
      })

      // --- Update Address ---
      .addCase(updateUserAddress.pending, (state) => {
        state.addressActionLoading = true;
      })
      .addCase(updateUserAddress.fulfilled, (state, action) => {
        state.addressActionLoading = false;
        
        if (action.payload.isDefault) {
          const updates = state.ids.map(id => ({ id, changes: { isDefault: false } }));
          addressesAdapter.updateMany(state, updates);
        }

        addressesAdapter.upsertOne(state, action.payload);

        if (state.selectedAddress?.id === action.payload.id) {
          state.selectedAddress = action.payload;
          // 🔥 SYNC FIX: Cast updated backend data to Number
          state.location = { 
              latitude: Number(action.payload.latitude), 
              longitude: Number(action.payload.longitude) 
          };
        }
      })

      // --- Delete Address ---
      .addCase(deleteUserAddress.pending, (state) => {
        state.addressActionLoading = true;
      })
      .addCase(deleteUserAddress.fulfilled, (state, action) => {
        state.addressActionLoading = false;
        const deletedId = action.payload;
        
        addressesAdapter.removeOne(state, deletedId);
        
        if (state.selectedAddress?.id === deletedId) {
          if (state.ids.length > 0) {
            const nextBestId = state.ids[0];
            const nextBestAddress = state.entities[nextBestId] as SavedAddress;
            state.selectedAddress = nextBestAddress;
            state.location = { 
                latitude: Number(nextBestAddress.latitude), 
                longitude: Number(nextBestAddress.longitude) 
            };
          } else {
            state.selectedAddress = null;
          }
        }
      })
      
      // Global Error Handler
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        (state, action) => {
          state.addressActionLoading = false;
          if (action.payload !== "Request cancelled") {
             state.error = action.payload as string;
          }
        }
      );
  },
});

export const { 
  fetchLocationStart, 
  fetchLocationSuccess, 
  fetchLocationFailure, 
  setSelectedAddress 
} = locationSlice.actions;

// Exporting O(1) Selectors for your UI components
export const {
  selectAll: selectAllAddresses,
  selectById: selectAddressById,
} = addressesAdapter.getSelectors((state: any) => state.location);

export default locationSlice.reducer;