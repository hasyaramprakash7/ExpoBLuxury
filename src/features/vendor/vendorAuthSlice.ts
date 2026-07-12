// src/features/vendor/vendorAuthSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Vendor } from "../../types/models";
import api from "../../userScreens/utils/api";
import * as SecureStore from 'expo-secure-store';
import { registerForPushNotificationsAsync } from '../../userScreens/utils/NotificationHelper';

const getVendorToken = () => AsyncStorage.getItem("vendorToken");

interface AuthState {
    vendor: Vendor | null;
    token: string | null;
    allVendors: Vendor[];
    nearbyVendors: Vendor[]; // 🔥 ADDED: State for nearby H3 vendors
    loading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    conversations: any[];
}

// --- STANDARD REGISTER ---
export const registerVendor = createAsyncThunk<
    { vendor: Vendor; token: string },
    FormData,
    { rejectValue: string }
>(
    "vendorAuth/registerVendor",
    async (formData: FormData, { rejectWithValue }) => {
        try {
            const pushToken = await registerForPushNotificationsAsync();
            if (pushToken) formData.append('pushToken', pushToken);

            const res = await api.post(`/vendors/register`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            await AsyncStorage.setItem("vendorToken", res.data.token);
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));

            await SecureStore.deleteItemAsync("deliveryBoyToken");
            await AsyncStorage.removeItem("token");

            return { vendor: res.data.vendor, token: res.data.token };
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Registration failed");
        }
    }
);

// --- OTP REGISTER ---
export const registerVendorWithOtp = createAsyncThunk<
    { vendor: Vendor; token: string },
    FormData,
    { rejectValue: string }
>(
    "vendorAuth/registerVendorWithOtp",
    async (formData: FormData, { rejectWithValue }) => {
        try {
            const pushToken = await registerForPushNotificationsAsync();
            if (pushToken) formData.append('pushToken', pushToken);

            const res = await api.post(`/vendors/register-with-otp`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            await AsyncStorage.setItem("vendorToken", res.data.token);
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));

            await SecureStore.deleteItemAsync("deliveryBoyToken");
            await AsyncStorage.removeItem("token");

            return { vendor: res.data.vendor, token: res.data.token };
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "OTP Registration failed");
        }
    }
);

// --- STANDARD LOGIN ---
export const loginVendor = createAsyncThunk<
    { vendor: Vendor; token: string },
    { identifier: string; password: string },
    { rejectValue: string }
>(
    "vendorAuth/loginVendor",
    async ({ identifier, password }: { identifier: string; password: string }, { rejectWithValue }) => {
        try {
            const pushToken = await registerForPushNotificationsAsync();

            const res = await api.post(`/vendors/login`, { identifier, password, pushToken });
            await AsyncStorage.setItem("vendorToken", res.data.token);
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));

            await SecureStore.deleteItemAsync("deliveryBoyToken");
            await AsyncStorage.removeItem("token");

            return { vendor: res.data.vendor, token: res.data.token };
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Login failed");
        }
    }
);

// --- OTP LOGIN ---
export const loginVendorWithOtp = createAsyncThunk<
    { vendor: Vendor; token: string },
    { phone: string; otp: string },
    { rejectValue: string }
>(
    "vendorAuth/loginVendorWithOtp",
    async ({ phone, otp }: { phone: string; otp: string }, { rejectWithValue }) => {
        try {
            const pushToken = await registerForPushNotificationsAsync();

            const res = await api.post(`/vendors/login-with-otp`, { phone, otp, pushToken });
            await AsyncStorage.setItem("vendorToken", res.data.token);
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));

            await SecureStore.deleteItemAsync("deliveryBoyToken");
            await AsyncStorage.removeItem("token");

            return { vendor: res.data.vendor, token: res.data.token };
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "OTP Login failed");
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
        try {
            const token = await getVendorToken();
            if (!token) {
                await AsyncStorage.removeItem("vendor");
                await AsyncStorage.removeItem("vendorToken");
                return rejectWithValue("No vendor token found");
            }

            const res = await api.get(`/vendors/profile`);
            const vendor = res.data.vendor;

            const currentPushToken = await registerForPushNotificationsAsync();
            if (currentPushToken && vendor.pushToken !== currentPushToken) {
                api.put(`/vendors/update-push-token`, { pushToken: currentPushToken })
                    .catch(e => console.log("Failed to update push token in background", e));
            }

            await AsyncStorage.setItem("vendor", JSON.stringify(vendor));
            return { vendor, token };
        } catch (err: any) {
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
        try {
            const token = await getVendorToken();
            if (!token) return rejectWithValue("No token found");

            const res = await api.put(`/vendors/update`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
            return { vendor: res.data.vendor, token };
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Vendor profile update failed");
        }
    }
);

export const toggleVendorStatus = createAsyncThunk<
    { currentStatus: boolean },
    boolean,
    { rejectValue: string }
>(
    "vendorAuth/toggleVendorStatus",
    async (isOnline: boolean, { rejectWithValue }) => {
        try {
            const token = await getVendorToken();
            if (!token) return rejectWithValue("No token found");

            const res = await api.put(`/vendors/status`, { isOnline });
            const currentVendorString = await AsyncStorage.getItem("vendor");
            if (currentVendorString) {
                const currentVendor = JSON.parse(currentVendorString);
                currentVendor.isOnline = res.data.currentStatus;
                await AsyncStorage.setItem("vendor", JSON.stringify(currentVendor));
            }
            return res.data;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Vendor status update failed");
        }
    }
);

export const fetchAllVendors = createAsyncThunk<
    Vendor[],
    void,
    { rejectValue: string }
>(
    "vendorAuth/fetchAllVendors",
    async (_, { rejectWithValue }) => {
        try {
            const res = await api.get(`/vendors/all`);
            return res.data.vendors;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Failed to fetch all vendors");
        }
    }
);

// 🔥 NEW: Fetch Nearby Vendors using H3
export const fetchNearbyVendors = createAsyncThunk<
    Vendor[],
    { lat: number; lng: number },
    { rejectValue: string }
>(
    "vendorAuth/fetchNearbyVendors",
    async ({ lat, lng }, { rejectWithValue }) => {
        try {
            const res = await api.get(`/vendors/nearby?lat=${lat}&lng=${lng}`);
            return res.data.vendors; // Array of nearby vendors with pre-calculated distance
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Failed to fetch nearby vendors");
        }
    }
);

export const fetchVendorConversations = createAsyncThunk<
    any[],
    void,
    { rejectValue: string }
>(
    "vendorAuth/fetchVendorConversations",
    async (_, { rejectWithValue }) => {
        try {
            const token = await getVendorToken();
            if (!token) return rejectWithValue("No vendor token found");
            const res = await api.get(`/vendors/conversations`);
            return res.data.conversations;
        } catch (err: any) {
            return rejectWithValue(err.response?.data?.message || "Failed to fetch conversations");
        }
    }
);

// 🔥 NEW: Async Logout Thunk
export const logoutVendor = createAsyncThunk(
    "vendorAuth/logoutVendor",
    async (_, { rejectWithValue }) => {
        try {
            // Tell backend to set vendor offline
            await api.post(`/vendors/logout`).catch(() => console.log("Failed to set offline"));
            // Tell backend to remove push token so notifications stop
            await api.post(`/auth/remove-push-token`).catch(() => console.log("Failed to remove push token"));
        } catch (error) {
            console.error("Logout cleanup error", error);
        } finally {
            // ALWAYS wipe local storage even if API fails
            await AsyncStorage.removeItem("vendorToken");
            await AsyncStorage.removeItem("vendor");
            await SecureStore.deleteItemAsync("deliveryBoyToken");
            await AsyncStorage.removeItem("token");
        }
        return true;
    }
);

const initialState: AuthState = {
    vendor: null,
    token: null,
    allVendors: [],
    nearbyVendors: [], // Initialize empty array
    loading: false,
    error: null,
    isAuthenticated: false,
    conversations: [],
};

const vendorAuthSlice = createSlice({
    name: "vendorAuth",
    initialState,
    reducers: {
        setVendor: (state, action: { payload: { vendor: Vendor, token: string } | null }) => {
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
        clearVendorError: (state) => {
            state.error = null;
        },
        clearAllVendors: (state) => {
            state.allVendors = [];
        },
        clearNearbyVendors: (state) => { // Optional utility to clear nearby search
            state.nearbyVendors = [];
        }
    },
    extraReducers: builder => {
        builder
            // Register
            .addCase(registerVendor.pending, (state) => { state.loading = true; state.error = null; })
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
            // OTP Register
            .addCase(registerVendorWithOtp.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(registerVendorWithOtp.fulfilled, (state, action) => {
                state.loading = false;
                state.vendor = action.payload.vendor;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(registerVendorWithOtp.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "OTP Registration failed";
                state.isAuthenticated = false;
            })
            // Login
            .addCase(loginVendor.pending, (state) => { state.loading = true; state.error = null; })
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
            // OTP Login
            .addCase(loginVendorWithOtp.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(loginVendorWithOtp.fulfilled, (state, action) => {
                state.loading = false;
                state.vendor = action.payload.vendor;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(loginVendorWithOtp.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "OTP Login failed";
                state.isAuthenticated = false;
            })
            // Fetch Profile
            .addCase(fetchVendorProfile.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchVendorProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.vendor = action.payload.vendor;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(fetchVendorProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Failed to fetch profile";
                state.vendor = null;
                state.token = null;
                state.isAuthenticated = false;
            })
            // Update Profile
            .addCase(updateVendorProfile.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(updateVendorProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.vendor = action.payload.vendor;
            })
            .addCase(updateVendorProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Update failed";
            })
            // Toggle Status
            .addCase(toggleVendorStatus.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(toggleVendorStatus.fulfilled, (state, action) => {
                state.loading = false;
                if (state.vendor) {
                    state.vendor.isOnline = action.payload.currentStatus;
                }
            })
            .addCase(toggleVendorStatus.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Status update failed";
            })
            // Fetch All Vendors
            .addCase(fetchAllVendors.pending, (state) => { state.error = null; })
            .addCase(fetchAllVendors.fulfilled, (state, action) => {
                state.allVendors = action.payload;
            })
            .addCase(fetchAllVendors.rejected, (state, action) => {
                state.error = action.payload ?? "Failed to fetch all vendors";
                state.allVendors = [];
            })
            // 🔥 Fetch Nearby Vendors
            .addCase(fetchNearbyVendors.pending, (state) => { state.error = null; state.loading = true; })
            .addCase(fetchNearbyVendors.fulfilled, (state, action) => {
                state.nearbyVendors = action.payload;
                state.loading = false;
            })
            .addCase(fetchNearbyVendors.rejected, (state, action) => {
                state.error = action.payload ?? "Failed to fetch nearby vendors";
                state.nearbyVendors = [];
                state.loading = false;
            })
            // Fetch Conversations
            .addCase(fetchVendorConversations.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchVendorConversations.fulfilled, (state, action) => {
                state.loading = false;
                state.conversations = action.payload;
            })
            .addCase(fetchVendorConversations.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? "Failed to fetch conversations";
                state.conversations = [];
            })
            // Async Logout 
            .addCase(logoutVendor.fulfilled, (state) => {
                state.vendor = null;
                state.token = null;
                state.isAuthenticated = false;
                state.conversations = [];
                state.nearbyVendors = [];
                state.allVendors = [];
                state.error = null;
            });
    },
});

export const { clearVendorError, setVendor, clearAllVendors, clearNearbyVendors } = vendorAuthSlice.actions;
export const vendorAuthReducer = vendorAuthSlice.reducer;