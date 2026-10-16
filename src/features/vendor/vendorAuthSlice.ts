// src/features/vendor/vendorAuthSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vendor } from '../../types/models';
import api from '../../userScreens/utils/api';
import * as SecureStore from 'expo-secure-store';
import {
  registerForPushNotificationsAsync,
  unregisterPushToken,
} from '../../userScreens/utils/NotificationHelper';
import { dedupeRequest } from '../../utils/requestDedupe';
import { setActiveRole, clearActiveRole } from '../session/sessionSlice';

const getVendorToken = () => AsyncStorage.getItem('vendorToken');

export interface VendorWithSubscription extends Vendor {
  subscriptionStatus?:
    | 'inactive'
    | 'trial'
    | 'active'
    | 'expired'
    | 'cancelled'
    | 'pending';
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

// ============ AUTH THUNKS (login/register) ============
export const loginVendor = createAsyncThunk<
  { vendor: Vendor; token: string },
  { identifier: string; password: string },
  { rejectValue: string }
>(
  'vendorAuth/loginVendor',
  async ({ identifier, password }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post(`/vendors/login`, { identifier, password });
      const vendor = res.data.vendor;
      const token = res.data.token;
      await AsyncStorage.setItem('vendorToken', token);
      await AsyncStorage.setItem('vendor', JSON.stringify(vendor));
      if (vendor._id) {
        await registerForPushNotificationsAsync(vendor._id, 'vendor');
      }
      await SecureStore.deleteItemAsync('deliveryBoyToken');
      dispatch(setActiveRole('vendor'));
      return { vendor, token };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Login failed');
    }
  }
);

export const loginVendorWithOtp = createAsyncThunk<
  { vendor: Vendor; token: string },
  { phone: string; otp: string },
  { rejectValue: string }
>(
  'vendorAuth/loginVendorWithOtp',
  async ({ phone, otp }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post(`/vendors/login-with-otp`, { phone, otp });
      const vendor = res.data.vendor;
      const token = res.data.token;
      await AsyncStorage.setItem('vendorToken', token);
      await AsyncStorage.setItem('vendor', JSON.stringify(vendor));
      if (vendor._id) {
        await registerForPushNotificationsAsync(vendor._id, 'vendor');
      }
      await SecureStore.deleteItemAsync('deliveryBoyToken');
      dispatch(setActiveRole('vendor'));
      return { vendor, token };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'OTP Login failed');
    }
  }
);

export const registerVendor = createAsyncThunk<
  { vendor: Vendor; token: string },
  FormData,
  { rejectValue: string }
>(
  'vendorAuth/registerVendor',
  async (formData, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post(`/vendors/register`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const vendor = res.data.vendor;
      const token = res.data.token;
      await AsyncStorage.setItem('vendorToken', token);
      await AsyncStorage.setItem('vendor', JSON.stringify(vendor));
      if (vendor._id) {
        await registerForPushNotificationsAsync(vendor._id, 'vendor');
      }
      await SecureStore.deleteItemAsync('deliveryBoyToken');
      dispatch(setActiveRole('vendor'));
      return { vendor, token };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Registration failed'
      );
    }
  }
);

export const registerVendorWithOtp = createAsyncThunk<
  { vendor: Vendor; token: string },
  FormData,
  { rejectValue: string }
>(
  'vendorAuth/registerVendorWithOtp',
  async (formData, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.post(`/vendors/register-with-otp`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const vendor = res.data.vendor;
      const token = res.data.token;
      await AsyncStorage.setItem('vendorToken', token);
      await AsyncStorage.setItem('vendor', JSON.stringify(vendor));
      if (vendor._id) {
        await registerForPushNotificationsAsync(vendor._id, 'vendor');
      }
      await SecureStore.deleteItemAsync('deliveryBoyToken');
      dispatch(setActiveRole('vendor'));
      return { vendor, token };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'OTP Registration failed'
      );
    }
  }
);

export const fetchVendorProfile = createAsyncThunk<
  { vendor: Vendor; token: string },
  void,
  { rejectValue: { message: string; status?: number; isAuthError: boolean } }
>('vendorAuth/fetchVendorProfile', async (_, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token || token === 'null') {
      return rejectWithValue({
        message: 'No vendor token found',
        status: 401,
        isAuthError: true,
      });
    }
    const res = await api.get(`/vendors/profile`);
    const vendor = res.data.vendor;
    if (vendor._id) {
      await registerForPushNotificationsAsync(vendor._id, 'vendor');
    }
    await AsyncStorage.setItem('vendor', JSON.stringify(vendor));
    return { vendor, token };
  } catch (err: any) {
    const status = err?.response?.status;
    const isAuthError = status === 401 || status === 403;
    return rejectWithValue({
      message:
        err.response?.data?.message || 'Failed to fetch vendor profile',
      status,
      isAuthError,
    });
  }
});

export const updateVendorProfile = createAsyncThunk<
  { vendor: Vendor; token: string },
  FormData,
  { rejectValue: string }
>('vendorAuth/updateVendorProfile', async (formData, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token) return rejectWithValue('No token found');
    const res = await api.put(`/vendors/update`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await AsyncStorage.setItem('vendor', JSON.stringify(res.data.vendor));
    return { vendor: res.data.vendor, token };
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Vendor profile update failed'
    );
  }
});

export const toggleVendorStatus = createAsyncThunk<
  { currentStatus: boolean },
  boolean,
  { rejectValue: string }
>('vendorAuth/toggleVendorStatus', async (isOnline, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token) return rejectWithValue('No token found');
    const res = await api.put(`/vendors/status`, { isOnline });
    const currentVendorString = await AsyncStorage.getItem('vendor');
    if (currentVendorString) {
      const currentVendor = JSON.parse(currentVendorString);
      currentVendor.isOnline = res.data.currentStatus;
      await AsyncStorage.setItem('vendor', JSON.stringify(currentVendor));
    }
    return res.data;
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Vendor status update failed'
    );
  }
});

export const fetchAllVendors = createAsyncThunk<
  Vendor[],
  void,
  { rejectValue: string }
>('vendorAuth/fetchAllVendors', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get(`/vendors/all`);
    return res.data.vendors;
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Failed to fetch all vendors'
    );
  }
});

export const fetchNearbyVendors = createAsyncThunk<
  Vendor[],
  { lat: number; lng: number },
  { rejectValue: string }
>('vendorAuth/fetchNearbyVendors', async ({ lat, lng }, { rejectWithValue }) => {
  try {
    const res = await api.get(`/vendors/nearby?lat=${lat}&lng=${lng}`);
    return res.data.vendors;
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Failed to fetch nearby vendors'
    );
  }
});

export const fetchVendorConversations = createAsyncThunk<
  any[],
  void,
  { rejectValue: string }
>('vendorAuth/fetchVendorConversations', async (_, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token) return rejectWithValue('No vendor token found');
    const res = await api.get(`/vendors/conversations`);
    return res.data.conversations;
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Failed to fetch conversations'
    );
  }
});

// ============ REHYDRATE FROM DISK ============
export const rehydrateVendorAuth = createAsyncThunk<
  { vendor: VendorWithSubscription | null; token: string | null }
>('vendorAuth/rehydrateVendorAuth', async () => {
  const [rawToken, rawVendor] = await Promise.all([
    AsyncStorage.getItem('vendorToken'),
    AsyncStorage.getItem('vendor'),
  ]);

  let vendor: VendorWithSubscription | null = null;
  if (rawVendor && rawVendor !== 'null') {
    try {
      vendor = JSON.parse(rawVendor);
    } catch {
      vendor = null;
    }
  }

  const token = rawToken && rawToken !== 'null' ? rawToken : null;
  console.log('[vendorAuth/rehydrate] token:', !!token, '| vendor:', !!vendor);
  return { vendor, token };
});

// ============ LOGOUT ============
export const logoutVendor = createAsyncThunk(
  'vendorAuth/logoutVendor',
  async (_, { getState, dispatch }) => {
    const state = getState() as { vendorAuth: AuthState };
    try {
      const vendorId = state.vendorAuth.vendor?._id;
      const expoToken = await AsyncStorage.getItem('expoPushToken');

      if (vendorId && expoToken) {
        try {
          await unregisterPushToken(String(vendorId), expoToken, 'vendor');
        } catch (e) {
          console.warn('⚠️ [logoutVendor] unregisterPushToken failed:', e);
        }
      }
      await api.post(`/vendors/logout`).catch(() => {});
    } catch (error) {
      console.warn('⚠️ logoutVendor request failed:', error);
    }

    await AsyncStorage.removeItem('vendorToken');
    await AsyncStorage.removeItem('vendor');
    await SecureStore.deleteItemAsync('deliveryBoyToken');

    const userToken = await AsyncStorage.getItem('token');
    if (userToken) {
      dispatch(setActiveRole('user'));
    } else {
      dispatch(clearActiveRole());
    }
    return true;
  }
);

// ============ SUBSCRIPTION THUNKS ============
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
>('vendorAuth/fetchSubscriptionStatus', async (_, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token) return rejectWithValue('No token found');
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
    return rejectWithValue(
      err.response?.data?.message || 'Failed to fetch subscription'
    );
  }
});

export const startFreeTrial = createAsyncThunk<
  { trialEndDate: string },
  void,
  { rejectValue: string }
>('vendorAuth/startFreeTrial', async (_, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token) return rejectWithValue('No token found');
    const res = await api.post(`/subscription/start-trial`);
    return { trialEndDate: res.data.trialEnd };
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Failed to start trial'
    );
  }
});

export const createPaidSubscription = createAsyncThunk<
  { subscriptionId: string; shortUrl: string },
  void,
  { rejectValue: string }
>('vendorAuth/createPaidSubscription', async (_, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token) return rejectWithValue('No token found');
    const res = await api.post(`/subscription/subscribe`);
    return {
      subscriptionId: res.data.subscriptionId,
      shortUrl: res.data.shortUrl,
    };
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Failed to create subscription'
    );
  }
});

export const cancelSubscription = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>('vendorAuth/cancelSubscription', async (_, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token) return rejectWithValue('No token found');
    await api.post(`/subscription/cancel`);
    return;
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Cancellation failed');
  }
});

export const verifySubscription = createAsyncThunk<
  { subscriptionStatus: string; razorpayStatus: string },
  void,
  { rejectValue: string }
>('vendorAuth/verifySubscription', async (_, { rejectWithValue }) => {
  try {
    const token = await getVendorToken();
    if (!token) return rejectWithValue('No token found');
    const res = await api.post(`/subscription/verify-subscription`);
    return {
      subscriptionStatus: res.data.subscriptionStatus,
      razorpayStatus: res.data.razorpayStatus,
    };
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Verification failed');
  }
});

export const fetchVendorStats = createAsyncThunk<
  { totalViews: number; totalCalls: number; totalLeads: number },
  void,
  { rejectValue: string }
>('vendorAuth/fetchVendorStats', async (_, { rejectWithValue }) => {
  try {
    const token = await AsyncStorage.getItem('vendorToken');
    if (!token) return rejectWithValue('No token found');
    const res = await api.get(`/vendors/profile`);
    return {
      totalViews: res.data.vendor.totalViews || 0,
      totalCalls: res.data.vendor.totalCalls || 0,
      totalLeads: res.data.vendor.totalLeads || 0,
    };
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Failed to fetch stats'
    );
  }
});

export const searchDirectoryVendors = createAsyncThunk<
  Vendor[],
  {
    lat?: number;
    lng?: number;
    q?: string;
    category?: string;
    minRating?: number;
    premium?: boolean;
    page?: number;
    limit?: number;
    radius?: number;
  },
  { rejectValue: string }
>('vendorAuth/searchDirectoryVendors', async (params, { rejectWithValue }) => {
  const latKey = params.lat !== undefined ? params.lat.toFixed(5) : '';
  const lngKey = params.lng !== undefined ? params.lng.toFixed(5) : '';
  const key = [
    'searchDirectoryVendors',
    latKey,
    lngKey,
    params.q || '',
    params.category || '',
    params.minRating ?? '',
    params.premium ? '1' : '0',
    params.page ?? '',
    params.limit ?? '',
    params.radius ?? 'def',
  ].join('|');

  return dedupeRequest(
    key,
    async () => {
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
        if (params.radius) query.append('radius', String(params.radius));

        const res = await api.get(`/vendors/directory?${query.toString()}`);
        return res.data.data || [];
      } catch (err: any) {
        return rejectWithValue(
          err.response?.data?.message || 'Failed to fetch directory vendors'
        );
      }
    },
    3000
  );
});

// ============ INITIAL STATE ============
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

// ============ SLICE ============
const vendorAuthSlice = createSlice({
  name: 'vendorAuth',
  initialState,
  reducers: {
    setVendor: (
      state,
      action: {
        payload: { vendor: VendorWithSubscription; token: string } | null;
      }
    ) => {
      if (action.payload) {
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus =
          action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      } else {
        state.vendor = null;
        state.token = null;
        state.isAuthenticated = false;
        state.subscriptionStatus = null;
        state.trialEndDate = null;
      }
    },

    // ✅ Used by the 401 interceptor to hard-clear the vendor session
    clearVendor: (state) => {
      state.vendor = null;
      state.token = null;
      state.isAuthenticated = false;
      state.subscriptionStatus = null;
      state.trialEndDate = null;
      state.conversations = [];
    },

    hydrateVendor: (
      state,
      action: PayloadAction<{
        vendor: VendorWithSubscription | null;
        token: string | null;
      }>
    ) => {
      const { vendor, token } = action.payload;
      if (vendor && token) {
        state.vendor = vendor;
        state.token = token;
        state.isAuthenticated = true;
        state.subscriptionStatus =
          vendor.subscriptionStatus || state.subscriptionStatus || 'inactive';
        state.trialEndDate = vendor.trialEndDate || state.trialEndDate || null;
      }
    },

    clearVendorError: (state) => {
      state.error = null;
    },
    clearAllVendors: (state) => {
      state.allVendors = [];
    },
    clearNearbyVendors: (state) => {
      state.nearbyVendors = [];
    },
    clearDirectoryVendors: (state) => {
      state.directoryVendors = [];
    },
    updateSubscriptionStatus: (
      state,
      action: { payload: { status: string; trialEndDate?: string } }
    ) => {
      if (state.vendor) {
        state.vendor.subscriptionStatus = action.payload.status;
        if (action.payload.trialEndDate)
          state.vendor.trialEndDate = action.payload.trialEndDate;
        state.subscriptionStatus = action.payload.status;
        state.trialEndDate = action.payload.trialEndDate || state.trialEndDate;
      }
    },
    updateVendorStats: (state, action) => {
      if (state.vendor) {
        state.vendor.totalViews = action.payload.totalViews;
        state.vendor.totalCalls = action.payload.totalCalls;
        state.vendor.totalLeads = action.payload.totalLeads;
        AsyncStorage.setItem('vendor', JSON.stringify(state.vendor)).catch(
          () => {}
        );
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // ── rehydrate reducer ──
      .addCase(rehydrateVendorAuth.fulfilled, (state, action) => {
        const { vendor, token } = action.payload;
        if (token) state.token = token;
        if (vendor) state.vendor = vendor;
        state.isAuthenticated = !!(token && vendor);
        state.subscriptionStatus =
          vendor?.subscriptionStatus ?? state.subscriptionStatus;
        state.trialEndDate = vendor?.trialEndDate ?? state.trialEndDate;
      })

      // ── everything else (unchanged from your original) ──
      .addCase(registerVendor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus =
          action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(registerVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Registration failed';
        state.isAuthenticated = false;
      })
      .addCase(registerVendorWithOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerVendorWithOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus =
          action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(registerVendorWithOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'OTP Registration failed';
        state.isAuthenticated = false;
      })
      .addCase(loginVendor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginVendor.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus =
          action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(loginVendor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Login failed';
        state.isAuthenticated = false;
      })
      .addCase(loginVendorWithOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginVendorWithOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus =
          action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(loginVendorWithOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'OTP Login failed';
        state.isAuthenticated = false;
      })
      .addCase(fetchVendorProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.subscriptionStatus =
          action.payload.vendor.subscriptionStatus || 'inactive';
        state.trialEndDate = action.payload.vendor.trialEndDate || null;
      })
      .addCase(fetchVendorProfile.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload as
          | { message: string; status?: number; isAuthError: boolean }
          | undefined;
        state.error = payload?.message ?? 'Failed to fetch profile';

        // ✅ Only wipe vendor on genuine auth failures.
        if (payload?.isAuthError) {
          state.vendor = null;
          state.token = null;
          state.isAuthenticated = false;
          state.subscriptionStatus = null;
          state.trialEndDate = null;
        }
      })
      .addCase(updateVendorProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateVendorProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.vendor = action.payload.vendor;
        state.subscriptionStatus =
          action.payload.vendor.subscriptionStatus || state.subscriptionStatus;
        state.trialEndDate =
          action.payload.vendor.trialEndDate || state.trialEndDate;
      })
      .addCase(updateVendorProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Update failed';
      })
      .addCase(toggleVendorStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleVendorStatus.fulfilled, (state, action) => {
        state.loading = false;
        if (state.vendor) state.vendor.isOnline = action.payload.currentStatus;
      })
      .addCase(toggleVendorStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Status update failed';
      })
      .addCase(fetchAllVendors.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchAllVendors.fulfilled, (state, action) => {
        state.allVendors = action.payload;
      })
      .addCase(fetchAllVendors.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to fetch all vendors';
        state.allVendors = [];
      })
      .addCase(fetchNearbyVendors.pending, (state) => {
        state.error = null;
        state.loading = true;
      })
      .addCase(fetchNearbyVendors.fulfilled, (state, action) => {
        state.nearbyVendors = action.payload;
        state.loading = false;
      })
      .addCase(fetchNearbyVendors.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to fetch nearby vendors';
        state.nearbyVendors = [];
        state.loading = false;
      })
      .addCase(fetchVendorConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchVendorConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch conversations';
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
        if (state.vendor) state.vendor.subscriptionStatus = 'cancelled';
      })
      .addCase(verifySubscription.fulfilled, (state, action) => {
        const newStatus = action.payload.subscriptionStatus;
        state.subscriptionStatus = newStatus;
        if (state.vendor) state.vendor.subscriptionStatus = newStatus;
      })
      .addCase(verifySubscription.rejected, (state, action) => {
        state.error = action.payload || 'Verification failed';
      })
      .addCase(fetchVendorStats.fulfilled, (state, action) => {
        if (state.vendor) {
          state.vendor.totalViews = action.payload.totalViews;
          state.vendor.totalCalls = action.payload.totalCalls;
          state.vendor.totalLeads = action.payload.totalLeads;
          AsyncStorage.setItem('vendor', JSON.stringify(state.vendor)).catch(
            () => {}
          );
        }
      })
      .addCase(searchDirectoryVendors.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchDirectoryVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.directoryVendors = action.payload;
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
  hydrateVendor,
  clearVendor,
  clearAllVendors,
  clearNearbyVendors,
  clearDirectoryVendors,
  updateSubscriptionStatus,
  updateVendorStats,
} = vendorAuthSlice.actions;

export const vendorAuthReducer = vendorAuthSlice.reducer;