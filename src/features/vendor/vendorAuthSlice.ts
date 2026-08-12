// src/features/vendor/vendorAuthSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Vendor } from "../../types/models";
import api from "../../userScreens/utils/api";
import * as SecureStore from 'expo-secure-store';
import { registerForPushNotificationsAsync } from '../../userScreens/utils/NotificationHelper';

const getVendorToken = () => AsyncStorage.getItem("vendorToken");

export interface VendorWithSubscription extends Vendor {
  subscriptionStatus?: 'inactive' | 'trial' | 'active' | 'expired' | 'cancelled' | 'pending';
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  razorpayCustomerId?: string | null;
  razorpaySubscriptionId?: string | null;
  lastPaymentDate?: string | null;
  nextPaymentDate?: string | null;
}

interface AuthState {
  vendor: VendorWithSubscription | null;
  token: string | null;
  allVendors: VendorWithSubscription[];
  nearbyVendors: VendorWithSubscription[];
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  conversations: any[];
  subscriptionStatus: string | null;
  trialEndDate: string | null;
}

// =====================================================================
// EXISTING THUNKS (no changes)
// =====================================================================

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

export const loginVendor = createAsyncThunk<
  { vendor: Vendor; token: string },
  { identifier: string; password: string },
  { rejectValue: string }
>(
  "vendorAuth/loginVendor",
  async ({ identifier, password }, { rejectWithValue }) => {
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

export const loginVendorWithOtp = createAsyncThunk<
  { vendor: Vendor; token: string },
  { phone: string; otp: string },
  { rejectValue: string }
>(
  "vendorAuth/loginVendorWithOtp",
  async ({ phone, otp }, { rejectWithValue }) => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      const res = await api.post(`/vendors/login-with-otp`, { phone, otp, pushToken });
      const vendor = res.data.vendor;
      if (vendor._id && pushToken) {
        await registerForPushNotificationsAsync(vendor._id);
      }
      await AsyncStorage.setItem("vendorToken", res.data.token);
      await AsyncStorage.setItem("vendor", JSON.stringify(vendor));
      await SecureStore.deleteItemAsync("deliveryBoyToken");
      await AsyncStorage.removeItem("token");
      return { vendor, token: res.data.token };
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
      const currentPushToken = await registerForPushNotificationsAsync(vendor._id);
      if (currentPushToken && vendor.pushToken !== currentPushToken) {
        api.put(`/vendors/update-push-token`, { pushToken: currentPushToken })
          .catch(e => console.log("Failed to update push token", e));
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

export const fetchNearbyVendors = createAsyncThunk<
  Vendor[],
  { lat: number; lng: number },
  { rejectValue: string }
>(
  "vendorAuth/fetchNearbyVendors",
  async ({ lat, lng }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/vendors/nearby?lat=${lat}&lng=${lng}`);
      return res.data.vendors;
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

export const logoutVendor = createAsyncThunk(
  "vendorAuth/logoutVendor",
  async (_, { rejectWithValue }) => {
    try {
      await api.post(`/vendors/logout`).catch(() => console.log("Failed to set offline"));
      await api.post(`/auth/remove-push-token`).catch(() => console.log("Failed to remove push token"));
    } catch (error) {
      console.error("Logout cleanup error", error);
    } finally {
      await AsyncStorage.removeItem("vendorToken");
      await AsyncStorage.removeItem("vendor");
      await SecureStore.deleteItemAsync("deliveryBoyToken");
      await AsyncStorage.removeItem("token");
    }
    return true;
  }
);

// =====================================================================
// SUBSCRIPTION THUNKS
// =====================================================================

export const fetchSubscriptionStatus = createAsyncThunk<
  {
    status: string;
    trialEndDate: string | null;
    startDate: string | null;
    endDate: string | null;
    subscriptionId: string | null;
  },
  void,
  { rejectValue: string }
>(
  "vendorAuth/fetchSubscriptionStatus",
  async (_, { rejectWithValue }) => {
    try {
      const token = await getVendorToken();
      if (!token) return rejectWithValue("No token found");
      const res = await api.get(`/subscription/status`);
      const data = res.data.subscription;
      return {
        status: data.subscriptionStatus,
        trialEndDate: data.trialEndDate || null,
        startDate: data.subscriptionStartDate || null,
        endDate: data.subscriptionEndDate || null,
        subscriptionId: data.razorpaySubscriptionId || null,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch subscription");
    }
  }
);

export const startFreeTrial = createAsyncThunk<
  { trialEndDate: string },
  void,
  { rejectValue: string }
>(
  "vendorAuth/startFreeTrial",
  async (_, { rejectWithValue }) => {
    try {
      const token = await getVendorToken();
      if (!token) return rejectWithValue("No token found");
      const res = await api.post(`/subscription/start-trial`);
      return { trialEndDate: res.data.trialEnd };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to start trial");
    }
  }
);

export const createPaidSubscription = createAsyncThunk<
  { subscriptionId: string; shortUrl: string },
  void,
  { rejectValue: string }
>(
  "vendorAuth/createPaidSubscription",
  async (_, { rejectWithValue }) => {
    try {
      const token = await getVendorToken();
      if (!token) return rejectWithValue("No token found");
      const res = await api.post(`/subscription/subscribe`);
      return {
        subscriptionId: res.data.subscriptionId,
        shortUrl: res.data.shortUrl,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to create subscription");
    }
  }
);

export const cancelSubscription = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>(
  "vendorAuth/cancelSubscription",
  async (_, { rejectWithValue }) => {
    try {
      const token = await getVendorToken();
      if (!token) return rejectWithValue("No token found");
      await api.post(`/subscription/cancel`);
      return;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Cancellation failed");
    }
  }
);

// ============================================================
// 🔥 NEW: Manual verification thunk (calls /verify-subscription)
// ============================================================
export const verifySubscription = createAsyncThunk<
  {
    subscriptionStatus: string;
    razorpayStatus: string;
  },
  void,
  { rejectValue: string }
>(
  "vendorAuth/verifySubscription",
  async (_, { rejectWithValue }) => {
    try {
      const token = await getVendorToken();
      if (!token) return rejectWithValue("No token found");
      const res = await api.post(`/subscription/verify-subscription`);
      return {
        subscriptionStatus: res.data.subscriptionStatus,
        razorpayStatus: res.data.razorpayStatus,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Verification failed");
    }
  }
);

// =====================================================================
// INITIAL STATE
// =====================================================================

const initialState: AuthState = {
  vendor: null,
  token: null,
  allVendors: [],
  nearbyVendors: [],
  loading: false,
  error: null,
  isAuthenticated: false,
  conversations: [],
  subscriptionStatus: null,
  trialEndDate: null,
};

// =====================================================================
// SLICE
// =====================================================================

const vendorAuthSlice = createSlice({
  name: "vendorAuth",
  initialState,
  reducers: {
    setVendor: (state, action: { payload: { vendor: VendorWithSubscription; token: string } | null }) => {
      if (action.payload) {
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus = action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      } else {
        state.vendor = null;
        state.token = null;
        state.isAuthenticated = false;
        state.subscriptionStatus = null;
        state.trialEndDate = null;
      }
    },
    clearVendorError: (state) => { state.error = null; },
    clearAllVendors: (state) => { state.allVendors = []; },
    clearNearbyVendors: (state) => { state.nearbyVendors = []; },
    updateSubscriptionStatus: (state, action: { payload: { status: string; trialEndDate?: string } }) => {
      if (state.vendor) {
        state.vendor.subscriptionStatus = action.payload.status;
        if (action.payload.trialEndDate) state.vendor.trialEndDate = action.payload.trialEndDate;
        state.subscriptionStatus = action.payload.status;
        state.trialEndDate = action.payload.trialEndDate || state.trialEndDate;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerVendor.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus = action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(registerVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Registration failed";
        state.isAuthenticated = false;
      })
      .addCase(registerVendorWithOtp.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerVendorWithOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus = action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(registerVendorWithOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "OTP Registration failed";
        state.isAuthenticated = false;
      })
      .addCase(loginVendor.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus = action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(loginVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Login failed";
        state.isAuthenticated = false;
      })
      .addCase(loginVendorWithOtp.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginVendorWithOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus = action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(loginVendorWithOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "OTP Login failed";
        state.isAuthenticated = false;
      })
      .addCase(fetchVendorProfile.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchVendorProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus = action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(fetchVendorProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to fetch profile";
        state.vendor = null;
        state.token = null;
        state.isAuthenticated = false;
        state.subscriptionStatus = null;
        state.trialEndDate = null;
      })
      .addCase(updateVendorProfile.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateVendorProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.subscriptionStatus = action.payload.vendor.subscriptionStatus || state.subscriptionStatus;
        state.trialEndDate = action.payload.vendor.trialEndDate || state.trialEndDate;
      })
      .addCase(updateVendorProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Update failed";
      })
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
      .addCase(fetchAllVendors.pending, (state) => { state.error = null; })
      .addCase(fetchAllVendors.fulfilled, (state, action) => {
        state.allVendors = action.payload;
      })
      .addCase(fetchAllVendors.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to fetch all vendors";
        state.allVendors = [];
      })
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
      .addCase(logoutVendor.fulfilled, (state) => {
        state.vendor = null;
        state.token = null;
        state.isAuthenticated = false;
        state.conversations = [];
        state.nearbyVendors = [];
        state.allVendors = [];
        state.error = null;
        state.subscriptionStatus = null;
        state.trialEndDate = null;
      })
      // Subscription thunks
      .addCase(fetchSubscriptionStatus.fulfilled, (state, action) => {
        state.subscriptionStatus = action.payload.status;
        state.trialEndDate = action.payload.trialEndDate;
        if (state.vendor) {
          state.vendor.subscriptionStatus = action.payload.status;
          state.vendor.trialEndDate = action.payload.trialEndDate;
          state.vendor.subscriptionStartDate = action.payload.startDate;
          state.vendor.subscriptionEndDate = action.payload.endDate;
          state.vendor.razorpaySubscriptionId = action.payload.subscriptionId;
        }
      })
      .addCase(startFreeTrial.fulfilled, (state, action) => {
        state.subscriptionStatus = 'trial';
        state.trialEndDate = action.payload.trialEndDate;
        if (state.vendor) {
          state.vendor.subscriptionStatus = 'trial';
          state.vendor.trialEndDate = action.payload.trialEndDate;
        }
      })
      .addCase(createPaidSubscription.fulfilled, (state, action) => {
        state.subscriptionStatus = 'pending';
        if (state.vendor) {
          state.vendor.subscriptionStatus = 'pending';
          state.vendor.razorpaySubscriptionId = action.payload.subscriptionId;
        }
      })
      .addCase(cancelSubscription.fulfilled, (state) => {
        state.subscriptionStatus = 'cancelled';
        if (state.vendor) {
          state.vendor.subscriptionStatus = 'cancelled';
        }
      })
      // 🔥 New: verifySubscription
      .addCase(verifySubscription.fulfilled, (state, action) => {
        const newStatus = action.payload.subscriptionStatus;
        state.subscriptionStatus = newStatus;
        if (state.vendor) {
          state.vendor.subscriptionStatus = newStatus;
        }
        // Optionally update other fields if returned
      })
      .addCase(verifySubscription.rejected, (state, action) => {
        state.error = action.payload || "Verification failed";
      });
  },
});

export const {
  clearVendorError,
  setVendor,
  clearAllVendors,
  clearNearbyVendors,
  updateSubscriptionStatus,
} = vendorAuthSlice.actions;

export const vendorAuthReducer = vendorAuthSlice.reducer;