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
  directoryVendors: VendorWithSubscription[];
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  conversations: any[];
  subscriptionStatus: string | null;
  trialEndDate: string | null;
}

// =====================================================================
// EXISTING THUNKS (with debug logs)
// =====================================================================

export const registerVendor = createAsyncThunk<
  { vendor: Vendor; token: string },
  FormData,
  { rejectValue: string }
>(
  "vendorAuth/registerVendor",
  async (formData: FormData, { rejectWithValue }) => {
    console.log('📝 [registerVendor] Starting registration...');
    try {
      const pushToken = await registerForPushNotificationsAsync();
      console.log('📱 [registerVendor] Push token:', pushToken);
      if (pushToken) formData.append('pushToken', pushToken);

      console.log('📤 [registerVendor] Sending FormData:');
      for (const pair of (formData as any)._parts) {
        console.log(`  ${pair[0]}: ${pair[1]?.uri || pair[1]}`);
      }

      const res = await api.post(`/vendors/register`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log('✅ [registerVendor] Response:', res.data);

      await AsyncStorage.setItem("vendorToken", res.data.token);
      await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
      await SecureStore.deleteItemAsync("deliveryBoyToken");
      await AsyncStorage.removeItem("token");
      return { vendor: res.data.vendor, token: res.data.token };
    } catch (err: any) {
      console.error('❌ [registerVendor] Error:', err.response?.data || err.message);
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
    console.log('📝 [registerVendorWithOtp] Starting OTP registration...');
    try {
      const pushToken = await registerForPushNotificationsAsync();
      console.log('📱 [registerVendorWithOtp] Push token:', pushToken);
      if (pushToken) formData.append('pushToken', pushToken);

      console.log('📤 [registerVendorWithOtp] Sending FormData:');
      for (const pair of (formData as any)._parts) {
        console.log(`  ${pair[0]}: ${pair[1]?.uri || pair[1]}`);
      }

      const res = await api.post(`/vendors/register-with-otp`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log('✅ [registerVendorWithOtp] Response:', res.data);

      await AsyncStorage.setItem("vendorToken", res.data.token);
      await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
      await SecureStore.deleteItemAsync("deliveryBoyToken");
      await AsyncStorage.removeItem("token");
      return { vendor: res.data.vendor, token: res.data.token };
    } catch (err: any) {
      console.error('❌ [registerVendorWithOtp] Error:', err.response?.data || err.message);
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
    console.log('🔐 [loginVendor] Logging in with:', identifier);
    try {
      const pushToken = await registerForPushNotificationsAsync();
      console.log('📱 [loginVendor] Push token:', pushToken);
      const res = await api.post(`/vendors/login`, { identifier, password, pushToken });
      console.log('✅ [loginVendor] Response:', res.data);
      await AsyncStorage.setItem("vendorToken", res.data.token);
      await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
      await SecureStore.deleteItemAsync("deliveryBoyToken");
      await AsyncStorage.removeItem("token");
      return { vendor: res.data.vendor, token: res.data.token };
    } catch (err: any) {
      console.error('❌ [loginVendor] Error:', err.response?.data || err.message);
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
    console.log('🔐 [loginVendorWithOtp] Logging in with phone:', phone);
    try {
      const pushToken = await registerForPushNotificationsAsync();
      console.log('📱 [loginVendorWithOtp] Push token:', pushToken);
      const res = await api.post(`/vendors/login-with-otp`, { phone, otp, pushToken });
      console.log('✅ [loginVendorWithOtp] Response:', res.data);
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
      console.error('❌ [loginVendorWithOtp] Error:', err.response?.data || err.message);
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
    console.log('👤 [fetchVendorProfile] Fetching profile...');
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [fetchVendorProfile] No token found');
        await AsyncStorage.removeItem("vendor");
        await AsyncStorage.removeItem("vendorToken");
        return rejectWithValue("No vendor token found");
      }
      const res = await api.get(`/vendors/profile`);
      console.log('✅ [fetchVendorProfile] Response:', res.data);
      const vendor = res.data.vendor;
      const currentPushToken = await registerForPushNotificationsAsync(vendor._id);
      if (currentPushToken && vendor.pushToken !== currentPushToken) {
        api.put(`/vendors/update-push-token`, { pushToken: currentPushToken })
          .catch(e => console.log("Failed to update push token", e));
      }
      await AsyncStorage.setItem("vendor", JSON.stringify(vendor));
      return { vendor, token };
    } catch (err: any) {
      console.error('❌ [fetchVendorProfile] Error:', err.response?.data || err.message);
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
    console.log('✏️ [updateVendorProfile] Updating profile...');
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [updateVendorProfile] No token found');
        return rejectWithValue("No token found");
      }
      const res = await api.put(`/vendors/update`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log('✅ [updateVendorProfile] Response:', res.data);
      await AsyncStorage.setItem("vendor", JSON.stringify(res.data.vendor));
      return { vendor: res.data.vendor, token };
    } catch (err: any) {
      console.error('❌ [updateVendorProfile] Error:', err.response?.data || err.message);
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
    console.log('🔄 [toggleVendorStatus] Setting online status:', isOnline);
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [toggleVendorStatus] No token found');
        return rejectWithValue("No token found");
      }
      const res = await api.put(`/vendors/status`, { isOnline });
      console.log('✅ [toggleVendorStatus] Response:', res.data);
      const currentVendorString = await AsyncStorage.getItem("vendor");
      if (currentVendorString) {
        const currentVendor = JSON.parse(currentVendorString);
        currentVendor.isOnline = res.data.currentStatus;
        await AsyncStorage.setItem("vendor", JSON.stringify(currentVendor));
      }
      return res.data;
    } catch (err: any) {
      console.error('❌ [toggleVendorStatus] Error:', err.response?.data || err.message);
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
    console.log('📦 [fetchAllVendors] Fetching all vendors...');
    try {
      const res = await api.get(`/vendors/all`);
      console.log('✅ [fetchAllVendors] Found', res.data.vendors?.length, 'vendors');

      if (res.data.vendors && res.data.vendors.length > 0) {
        console.log('📍 [fetchAllVendors] Vendor locations:');
        res.data.vendors.forEach((v: any, index: number) => {
          console.log(`  ${index + 1}. ${v.shopName || v.name} - ${v.address?.city || v.address?.district || 'N/A'}, ${v.address?.state || 'N/A'} (${v.address?.latitude || 'N/A'}, ${v.address?.longitude || 'N/A'})`);
        });
      }
      return res.data.vendors;
    } catch (err: any) {
      console.error('❌ [fetchAllVendors] Error:', err.response?.data || err.message);
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
    console.log('📍 [fetchNearbyVendors] Fetching nearby vendors at:', lat, lng);
    try {
      const res = await api.get(`/vendors/nearby?lat=${lat}&lng=${lng}`);
      console.log('✅ [fetchNearbyVendors] Found', res.data.vendors?.length, 'vendors');

      if (res.data.vendors && res.data.vendors.length > 0) {
        console.log('📍 [fetchNearbyVendors] Nearby vendor details:');
        res.data.vendors.forEach((v: any, index: number) => {
          const distance = v.distance !== undefined ? v.distance.toFixed(2) : 'N/A';
          console.log(`  ${index + 1}. ${v.shopName || v.name} - ${distance}km away - ${v.address?.city || v.address?.district || 'N/A'}`);
        });
      } else {
        console.log('⚠️ [fetchNearbyVendors] No nearby vendors found within delivery range.');
      }
      return res.data.vendors;
    } catch (err: any) {
      console.error('❌ [fetchNearbyVendors] Error:', err.response?.data || err.message);
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
    console.log('💬 [fetchVendorConversations] Fetching conversations...');
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [fetchVendorConversations] No token found');
        return rejectWithValue("No vendor token found");
      }
      const res = await api.get(`/vendors/conversations`);
      console.log('✅ [fetchVendorConversations] Found', res.data.conversations?.length, 'conversations');
      return res.data.conversations;
    } catch (err: any) {
      console.error('❌ [fetchVendorConversations] Error:', err.response?.data || err.message);
      return rejectWithValue(err.response?.data?.message || "Failed to fetch conversations");
    }
  }
);

export const logoutVendor = createAsyncThunk(
  "vendorAuth/logoutVendor",
  async (_, { rejectWithValue }) => {
    console.log('🚪 [logoutVendor] Logging out...');
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
    console.log('📊 [fetchSubscriptionStatus] Fetching subscription status...');
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [fetchSubscriptionStatus] No token found');
        return rejectWithValue("No token found");
      }
      const res = await api.get(`/subscription/status`);
      console.log('✅ [fetchSubscriptionStatus] Response:', res.data);
      const data = res.data.subscription;
      return {
        status: data.subscriptionStatus,
        trialEndDate: data.trialEndDate || null,
        startDate: data.subscriptionStartDate || null,
        endDate: data.subscriptionEndDate || null,
        subscriptionId: data.razorpaySubscriptionId || null,
      };
    } catch (err: any) {
      console.error('❌ [fetchSubscriptionStatus] Error:', err.response?.data || err.message);
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
    console.log('🎯 [startFreeTrial] Starting free trial...');
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [startFreeTrial] No token found');
        return rejectWithValue("No token found");
      }
      const res = await api.post(`/subscription/start-trial`);
      console.log('✅ [startFreeTrial] Response:', res.data);
      return { trialEndDate: res.data.trialEnd };
    } catch (err: any) {
      console.error('❌ [startFreeTrial] Error:', err.response?.data || err.message);
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
    console.log('💰 [createPaidSubscription] Creating paid subscription...');
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [createPaidSubscription] No token found');
        return rejectWithValue("No token found");
      }
      const res = await api.post(`/subscription/subscribe`);
      console.log('✅ [createPaidSubscription] Response:', res.data);
      return {
        subscriptionId: res.data.subscriptionId,
        shortUrl: res.data.shortUrl,
      };
    } catch (err: any) {
      console.error('❌ [createPaidSubscription] Error:', err.response?.data || err.message);
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
    console.log('🚫 [cancelSubscription] Cancelling subscription...');
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [cancelSubscription] No token found');
        return rejectWithValue("No token found");
      }
      await api.post(`/subscription/cancel`);
      console.log('✅ [cancelSubscription] Cancelled');
      return;
    } catch (err: any) {
      console.error('❌ [cancelSubscription] Error:', err.response?.data || err.message);
      return rejectWithValue(err.response?.data?.message || "Cancellation failed");
    }
  }
);

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
    console.log('✅ [verifySubscription] Verifying subscription...');
    try {
      const token = await getVendorToken();
      if (!token) {
        console.warn('⚠️ [verifySubscription] No token found');
        return rejectWithValue("No token found");
      }
      const res = await api.post(`/subscription/verify-subscription`);
      console.log('✅ [verifySubscription] Response:', res.data);
      return {
        subscriptionStatus: res.data.subscriptionStatus,
        razorpayStatus: res.data.razorpayStatus,
      };
    } catch (err: any) {
      console.error('❌ [verifySubscription] Error:', err.response?.data || err.message);
      return rejectWithValue(err.response?.data?.message || "Verification failed");
    }
  }
);

// =====================================================================
// 🔥 FETCH VENDOR STATS (for real-time updates)
// =====================================================================
export const fetchVendorStats = createAsyncThunk<
  { totalViews: number; totalCalls: number; totalLeads: number },
  void,
  { rejectValue: string }
>(
  "vendorAuth/fetchVendorStats",
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem("vendorToken");
      if (!token) {
        return rejectWithValue("No token found");
      }
      const res = await api.get(`/vendors/profile`);
      return {
        totalViews: res.data.vendor.totalViews || 0,
        totalCalls: res.data.vendor.totalCalls || 0,
        totalLeads: res.data.vendor.totalLeads || 0,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch stats");
    }
  }
);

// =====================================================================
// DIRECTORY SEARCH THUNK
// =====================================================================
export const searchDirectoryVendors = createAsyncThunk<
  Vendor[],
  { lat?: number; lng?: number; q?: string; category?: string; minRating?: number; premium?: boolean; page?: number; limit?: number },
  { rejectValue: string }
>(
  "vendorAuth/searchDirectoryVendors",
  async (params, { rejectWithValue }) => {
    console.log('🔍 [searchDirectoryVendors] Searching with params:', params);
    try {
      const query = new URLSearchParams();
      if (params.lat) query.append('lat', String(params.lat));
      if (params.lng) query.append('lng', String(params.lng));
      if (params.q) query.append('q', params.q);
      if (params.category) query.append('category', params.category);
      if (params.minRating) query.append('minRating', String(params.minRating));
      if (params.premium) query.append('premium', 'true');
      if (params.page) query.append('page', String(params.page));
      if (params.limit) query.append('limit', String(params.limit));

      console.log('🌐 [searchDirectoryVendors] URL:', `/vendors/directory?${query.toString()}`);
      const res = await api.get(`/vendors/directory?${query.toString()}`);

      const vendors = res.data.data || [];
      console.log('✅ [searchDirectoryVendors] Found', vendors.length, 'vendors');

      if (vendors.length > 0) {
        console.log('📍 [searchDirectoryVendors] Vendor details:');
        vendors.forEach((v: any, index: number) => {
          const distance = v.distance !== undefined ? v.distance.toFixed(2) : 'N/A';
          const isInRange = v.deliveryRange !== undefined ? (v.distance <= v.deliveryRange ? '✅ In Range' : '❌ Out of Range') : '❓ Unknown';
          console.log(`  ${index + 1}. ${v.shopName || v.name}`);
          console.log(`     📍 Location: ${v.address?.city || v.address?.district || 'N/A'}, ${v.address?.state || 'N/A'}`);
          console.log(`     📏 Distance: ${distance} km ${isInRange}`);
          console.log(`     🚚 Delivery Range: ${v.deliveryRange || 'N/A'} km`);
          console.log(`     📊 Rating: ${v.averageRating || 'N/A'} ⭐`);
          console.log(`     🏷️ Categories: ${v.categories?.join(', ') || 'N/A'}`);
        });

        const inRangeCount = vendors.filter((v: any) => v.distance !== undefined && v.deliveryRange !== undefined && v.distance <= v.deliveryRange).length;
        const outOfRangeCount = vendors.length - inRangeCount;
        console.log(`📊 [searchDirectoryVendors] Summary: ${vendors.length} total, ${inRangeCount} in range, ${outOfRangeCount} out of range`);
        console.log('🔍 [searchDirectoryVendors] First vendor fields:', Object.keys(vendors[0] || {}));
      } else {
        console.log('⚠️ [searchDirectoryVendors] No vendors found');
      }

      return vendors;
    } catch (err: any) {
      console.error('❌ [searchDirectoryVendors] Error:', err.response?.data || err.message);
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch directory vendors');
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
  directoryVendors: [],
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
      console.log('🔄 [setVendor] Setting vendor:', action.payload?.vendor?._id || 'null');
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
    clearDirectoryVendors: (state) => { state.directoryVendors = []; },
    updateSubscriptionStatus: (state, action: { payload: { status: string; trialEndDate?: string } }) => {
      console.log('🔄 [updateSubscriptionStatus] Updating subscription status:', action.payload);
      if (state.vendor) {
        state.vendor.subscriptionStatus = action.payload.status;
        if (action.payload.trialEndDate) state.vendor.trialEndDate = action.payload.trialEndDate;
        state.subscriptionStatus = action.payload.status;
        state.trialEndDate = action.payload.trialEndDate || state.trialEndDate;
      }
    },
    // 🔥 NEW: Update vendor stats directly in Redux
    updateVendorStats: (state, action) => {
      if (state.vendor) {
        state.vendor.totalViews = action.payload.totalViews;
        state.vendor.totalCalls = action.payload.totalCalls;
        state.vendor.totalLeads = action.payload.totalLeads;
        console.log('📊 [updateVendorStats] Updated vendor stats:', {
          totalViews: state.vendor.totalViews,
          totalCalls: state.vendor.totalCalls,
          totalLeads: state.vendor.totalLeads,
        });
        // Update AsyncStorage
        AsyncStorage.setItem("vendor", JSON.stringify(state.vendor)).catch(() => {});
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
        state.directoryVendors = [];
        state.error = null;
        state.subscriptionStatus = null;
        state.trialEndDate = null;
      })
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
      .addCase(verifySubscription.fulfilled, (state, action) => {
        const newStatus = action.payload.subscriptionStatus;
        state.subscriptionStatus = newStatus;
        if (state.vendor) {
          state.vendor.subscriptionStatus = newStatus;
        }
      })
      .addCase(verifySubscription.rejected, (state, action) => {
        state.error = action.payload || "Verification failed";
      })
      // 🔥 FIX: Update vendor stats when fetchVendorStats is fulfilled
      .addCase(fetchVendorStats.fulfilled, (state, action) => {
        if (state.vendor) {
          state.vendor.totalViews = action.payload.totalViews;
          state.vendor.totalCalls = action.payload.totalCalls;
          state.vendor.totalLeads = action.payload.totalLeads;
          console.log('📊 [fetchVendorStats] Updated vendor stats in Redux:', {
            totalViews: state.vendor.totalViews,
            totalCalls: state.vendor.totalCalls,
            totalLeads: state.vendor.totalLeads,
          });
          // Update AsyncStorage
          AsyncStorage.setItem("vendor", JSON.stringify(state.vendor)).catch(() => {});
        }
      })
      .addCase(searchDirectoryVendors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchDirectoryVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.directoryVendors = action.payload;
        console.log('📊 [Redux] directoryVendors updated with', action.payload?.length || 0, 'vendors');
      })
      .addCase(searchDirectoryVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.directoryVendors = [];
      });
  },
});

export const {
  clearVendorError,
  setVendor,
  clearAllVendors,
  clearNearbyVendors,
  clearDirectoryVendors,
  updateSubscriptionStatus,
  updateVendorStats, // 🔥 Export this
} = vendorAuthSlice.actions;

export const vendorAuthReducer = vendorAuthSlice.reducer;