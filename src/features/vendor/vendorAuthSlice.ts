// src/features/vendor/vendorAuthSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Vendor } from "../../types/models"; // Import Vendor from shared types
import api from "../../../utils/api"; // Use the configured API instance
import * as SecureStore from 'expo-secure-store';

// --- Helper to get token ---
const getVendorToken = () => AsyncStorage.getItem("vendorToken");

// --- Type Definitions ---
// Define the AuthState for this slice
interface AuthState {
    vendor: Vendor | null;
    token: string | null; // Keep token in state for immediate access if needed
    allVendors: Vendor[]; // Crucial: This holds the list of ALL vendors
    loading: boolean; // Main loading indicator for auth/profile actions
    error: string | null;
    isAuthenticated: boolean; // Indicates if *a* vendor is logged in
    conversations: any[]; // NEW: Add conversations to the state
}

// --- Async Thunks ---

export const registerVendor = createAsyncThunk<
    { vendor: Vendor; token: string }, // Payload type
    FormData, // Argument type
    { rejectValue: string }
>(
    "vendorAuth/registerVendor",
    async (formData: FormData, { rejectWithValue }) => {
        console.log("registerVendor: Attempting registration...");
        try {
            // Use 'api' instance, it will handle baseURL automatically
            const res = await api.post(`/vendors/register`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            await AsyncStorage.setItem("vendorToken", res.data.token);
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
            // --- FIX: Clear other tokens on successful vendor registration ---
            await SecureStore.deleteItemAsync("deliveryBoyToken");
            await AsyncStorage.removeItem("token");

            console.log("registerVendor: Registration successful!");
            return { vendor: res.data.vendor, token: res.data.token };
        } catch (err: any) {
            console.error("registerVendor: Registration failed:", err.response?.data || err.message);
            return rejectWithValue(err.response?.data?.message || "Registration failed");
        }
    }
);

export const loginVendor = createAsyncThunk<
    { vendor: Vendor; token: string },
    { identifier: string; password: string },
    { rejectValue: string }
>(
    "vendorAuth/loginVendor",
    async ({ identifier, password }: { identifier: string; password: string }, { rejectWithValue }) => {
        console.log(`loginVendor: Attempting login for identifier: ${identifier}`);
        try {
            // Use 'api' instance
            const res = await api.post(`/vendors/login`, { identifier, password });
            await AsyncStorage.setItem("vendorToken", res.data.token);
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
            // --- FIX: Clear other tokens on successful vendor login ---
            await SecureStore.deleteItemAsync("deliveryBoyToken");
            await AsyncStorage.removeItem("token");
            
            console.log("loginVendor: Login successful!");
            return { vendor: res.data.vendor, token: res.data.token };
        } catch (err: any) {
            console.error("loginVendor: Login failed:", err.response?.data || err.message);
            return rejectWithValue(err.response?.data?.message || "Login failed");
        }
    }
);

export const fetchVendorProfile = createAsyncThunk<
    { vendor: Vendor; token: string },
    void,
    { rejectValue: string }
>(
    "vendorAuth/fetchVendorProfile",
    async (_, { rejectWithValue }) => {
        console.log("fetchVendorProfile: Attempting to fetch profile...");
        try {
            const token = await getVendorToken();
            if (!token) {
                console.warn("fetchVendorProfile: No vendor token found, clearing local storage.");
                await AsyncStorage.removeItem("vendor");
                await AsyncStorage.removeItem("vendorToken");
                return rejectWithValue("No vendor token found");
            }
            // Use 'api' instance. Interceptor handles token.
            const res = await api.get(`/vendors/profile`);
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
            console.log("fetchVendorProfile: Profile fetched successfully.");
            return { vendor: res.data.vendor, token };
        } catch (err: any) {
            console.error("fetchVendorProfile: Failed to fetch profile:", err.response?.data || err.message);
            // On error, clear potentially invalid token/profile
            await AsyncStorage.removeItem("vendor");
            await AsyncStorage.removeItem("vendorToken");
            return rejectWithValue(err.response?.data?.message || "Failed to fetch vendor profile");
        }
    }
);

export const updateVendorProfile = createAsyncThunk<
    { vendor: Vendor; token: string },
    FormData,
    { rejectValue: string }
>(
    "vendorAuth/updateVendorProfile",
    async (formData: FormData, { rejectWithValue }) => {
        console.log("updateVendorProfile: Attempting to update profile...");
        try {
            const token = await getVendorToken();
            if (!token) {
                console.warn("updateVendorProfile: No token found for update.");
                return rejectWithValue("No token found");
            }
            // Use 'api' instance
            const res = await api.put(`/vendors/update`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
            console.log("updateVendorProfile: Profile updated successfully!");
            return { vendor: res.data.vendor, token };
        } catch (err: any) {
            console.error("updateVendorProfile: Profile update failed:", err.response?.data || err.message);
            return rejectWithValue(err.response?.data?.message || "Vendor profile update failed");
        }
    }
);

export const toggleVendorStatus = createAsyncThunk<
    { currentStatus: boolean }, // Assuming backend returns { currentStatus: boolean }
    boolean, // Argument is the new status to set
    { rejectValue: string }
>(
    "vendorAuth/toggleVendorStatus",
    async (isOnline: boolean, { rejectWithValue }) => {
        console.log(`toggleVendorStatus: Attempting to set status to ${isOnline ? "Online" : "Offline"}...`);
        try {
            const token = await getVendorToken();
            if (!token) {
                console.warn("toggleVendorStatus: No token found for status toggle.");
                return rejectWithValue("No token found");
            }
            // Use 'api' instance
            const res = await api.put(`/vendors/status`, { isOnline });
            // Update local storage to reflect the new status
            const currentVendorString = await AsyncStorage.getItem("vendor");
            if (currentVendorString) {
                const currentVendor = JSON.parse(currentVendorString);
                currentVendor.isOnline = res.data.currentStatus;
                await AsyncStorage.setItem("vendor", JSON.stringify(currentVendor));
            }
            console.log("toggleVendorStatus: Status updated successfully to", res.data.currentStatus);
            return res.data;
        } catch (err: any) {
            console.error("toggleVendorStatus: Status update failed:", err.response?.data || err.message);
            return rejectWithValue(err.response?.data?.message || "Vendor status update failed");
        }
    }
);

export const fetchAllVendors = createAsyncThunk<
    Vendor[], // Array of all vendors
    void,
    { rejectValue: string }
>(
    "vendorAuth/fetchAllVendors",
    async (_, { rejectWithValue }) => {
        console.log("fetchAllVendors: Attempting to fetch all vendors...");
        try {
            // Use 'api' instance
            const res = await api.get(`/vendors/all`); // Adjust API endpoint if different
            console.log("fetchAllVendors: All vendors fetched successfully.");
            return res.data.vendors; // Assuming your backend returns { vendors: [...] }
        } catch (err: any) {
            console.error("fetchAllVendors: Failed to fetch all vendors:", err.response?.data || err.message);
            return rejectWithValue(err.response?.data?.message || "Failed to fetch all vendors");
        }
    }
);

// NEW: Fetch vendor's chat conversations
export const fetchVendorConversations = createAsyncThunk<
    any[], // Array of conversations
    void,
    { rejectValue: string }
>(
    "vendorAuth/fetchVendorConversations",
    async (_, { rejectWithValue }) => {
        console.log("fetchVendorConversations: Attempting to fetch conversations...");
        try {
            const token = await getVendorToken();
            if (!token) {
                return rejectWithValue("No vendor token found");
            }
            const res = await api.get(`/vendors/conversations`);
            console.log("fetchVendorConversations: Conversations fetched successfully.");
            return res.data.conversations;
        } catch (err: any) {
            console.error("fetchVendorConversations: Failed to fetch conversations:", err.response?.data || err.message);
            return rejectWithValue(err.response?.data?.message || "Failed to fetch conversations");
        }
    }
);


const initialState: AuthState = {
    vendor: null,
    token: null,
    allVendors: [],
    loading: false,
    error: null,
    isAuthenticated: false,
    conversations: [], // Initialize the new state property
};

const vendorAuthSlice = createSlice({
    name: "vendorAuth",
    initialState,
    reducers: {
        setVendor: (state, action: { payload: { vendor: Vendor, token: string } | null }) => {
            console.log("setVendor reducer: Setting vendor data.");
            if (action.payload) {
                state.vendor = action.payload.vendor;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            } else {
                state.vendor = null;
                state.token = null;
                state.isAuthenticated = false;
            }
        },
        logoutVendor: (state) => {
            console.log("logoutVendor reducer: Logging out vendor, clearing state and storage.");
            state.vendor = null;
            state.token = null;
            state.isAuthenticated = false;
            // Clear all tokens on logout
            AsyncStorage.removeItem("vendorToken");
            AsyncStorage.removeItem("vendor");
            SecureStore.deleteItemAsync("deliveryBoyToken");
            AsyncStorage.removeItem("token");
        },
        clearVendorError: (state) => {
            console.log("clearVendorError reducer: Clearing error state.");
            state.error = null;
        },
        clearAllVendors: (state) => {
            console.log("clearAllVendors reducer: Clearing all vendors list.");
            state.allVendors = [];
        }
    },
    extraReducers: builder => {
        builder
            // Register Vendor
            .addCase(registerVendor.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(registerVendor.fulfilled, (state, action) => {
                state.loading = false;
                state.vendor = action.payload.vendor;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(registerVendor.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Registration failed";
                state.isAuthenticated = false;
            })
            // Login Vendor
            .addCase(loginVendor.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginVendor.fulfilled, (state, action) => {
                state.loading = false;
                state.vendor = action.payload.vendor;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(loginVendor.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Login failed";
                state.isAuthenticated = false;
            })
            // Fetch Vendor Profile
            .addCase(fetchVendorProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchVendorProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.vendor = action.payload.vendor;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(fetchVendorProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Failed to fetch profile";
                state.vendor = null; // Clear vendor data on failed fetch
                state.token = null;
                state.isAuthenticated = false;
            })
            // Update Vendor Profile
            .addCase(updateVendorProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateVendorProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.vendor = action.payload.vendor; // Update current vendor in state
            })
            .addCase(updateVendorProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Update failed";
            })
            // Toggle Vendor Status
            .addCase(toggleVendorStatus.pending, (state) => {
                state.loading = true; // Optional: Show loading indicator for status toggle
                state.error = null;
            })
            .addCase(toggleVendorStatus.fulfilled, (state, action) => {
                state.loading = false;
                if (state.vendor) {
                    state.vendor.isOnline = action.payload.currentStatus; // Directly update isOnline
                }
            })
            .addCase(toggleVendorStatus.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Status update failed";
            })
            // Fetch All Vendors
            .addCase(fetchAllVendors.pending, (state) => {
                state.error = null;
            })
            .addCase(fetchAllVendors.fulfilled, (state, action) => {
                state.allVendors = action.payload; // Populate the allVendors array
            })
            .addCase(fetchAllVendors.rejected, (state, action) => {
                state.error = action.payload ?? "Failed to fetch all vendors";
                state.allVendors = [];
            })
            // NEW: Fetch Vendor Conversations
            .addCase(fetchVendorConversations.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchVendorConversations.fulfilled, (state, action) => {
                state.loading = false;
                state.conversations = action.payload; // Populate the conversations array
            })
            .addCase(fetchVendorConversations.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Failed to fetch conversations";
                state.conversations = [];
            });
    },
});

export const { logoutVendor, clearVendorError, setVendor, clearAllVendors } = vendorAuthSlice.actions;
export const vendorAuthReducer = vendorAuthSlice.reducer;