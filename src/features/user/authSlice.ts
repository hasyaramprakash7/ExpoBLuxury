// src/features/user/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../config/config';
import {
  registerForPushNotificationsAsync,
  unregisterPushToken,
} from '../../userScreens/utils/NotificationHelper';
import { getActiveToken } from '../../utils/getActiveToken';
import { setActiveRole, clearActiveRole } from '../session/sessionSlice';

interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  phone: string;
  role?: 'user' | 'vendor' | 'admin';
  profilePic?: string | null;
  token: string;
  pushToken?: string;
}

export interface RegisteredContact {
  dbId: string;
  name: string;
  phone: string;
  role: 'User' | 'Vendor';
  image?: string;
}

export interface AppConfigData {
  latestAndroidVersion: string;
  latestIOSVersion: string;
  forceUpdate: boolean;
}

interface AuthState {
  user: User | null;
  allUsers: User[];
  registeredContacts: RegisteredContact[];
  appConfig: AppConfigData | null;
  loading: boolean;
  isSendingInvite: boolean;
  isSyncingContacts: boolean;
  error: string | null;
}

interface LoginCredentials {
  identifier: string;
  password: string;
}

// ─────────────────────────────────────────────────────────────
// Helper — register push AFTER login using the real userId
// ─────────────────────────────────────────────────────────────
const registerPushAfterLogin = async (payload: any) => {
  try {
    const uid = payload?._id || payload?.id || payload?.user?._id;
    if (!uid) {
      console.warn('⚠️ registerPushAfterLogin: no userId in payload');
      return;
    }
    console.log('🔔 Post-login push registration for userId:', uid);
    await registerForPushNotificationsAsync(String(uid), 'user');
  } catch (e) {
    console.warn('⚠️ Post-login push registration failed (non-fatal):', e);
  }
};

// ─────────────────────────────────────────────────────────────
// Helper — wipe any previous USER session so a new phone number
// can never inherit the previous phone's account.
// (Vendor session is left untouched.)
// ─────────────────────────────────────────────────────────────
const clearPreviousUserSession = async (dispatch: any) => {
  try {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
  } catch (e) {
    console.warn('⚠️ Failed to clear previous user session:', e);
  }
  dispatch(setUser(null));
};

export const fetchAppConfig = createAsyncThunk(
  'auth/fetchAppConfig',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${config.apiUrl}/auth/app-version`);
      return res.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to check app version.'
      );
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (
    { identifier, password }: LoginCredentials,
    { dispatch, rejectWithValue }
  ) => {
    // ✅ Wipe the previous user session FIRST, before any network call.
    await clearPreviousUserSession(dispatch);

    try {
      // 1) Get device-level Expo token
      const pushToken = await registerForPushNotificationsAsync();

      // 2) Login
      const res = await axios.post(`${config.apiUrl}/auth/login`, {
        identifier,
        password,
        pushToken,
      });
      const token = res.data.token;
      await AsyncStorage.setItem('token', token);

      // 3) Fetch full profile
      const profileRes = await axios.get(`${config.apiUrl}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = { ...profileRes.data.user, token };
      await AsyncStorage.setItem('user', JSON.stringify(user));

      // 4) Register push token against REAL userId + role='user'
      await registerPushAfterLogin(user);

      // ✅ Lock the active role to the freshly-logged-in user
      dispatch(setActiveRole('user'));

      return user;
    } catch (err: any) {
      // Never leave partial data behind on failure
      await AsyncStorage.removeItem('user').catch(() => {});
      await AsyncStorage.removeItem('token').catch(() => {});
      dispatch(setUser(null));
      return rejectWithValue(err.response?.data?.message || 'Login failed.');
    }
  }
);

export const loginWithOtp = createAsyncThunk(
  'auth/loginWithOtp',
  async (
    { phone, otp }: { phone: string; otp: string },
    { dispatch, rejectWithValue }
  ) => {
    // ✅ Wipe the previous user session FIRST.
    await clearPreviousUserSession(dispatch);

    try {
      const pushToken = await registerForPushNotificationsAsync();

      const res = await axios.post(`${config.apiUrl}/auth/login-with-otp`, {
        phone,
        otp,
        pushToken,
      });
      const token = res.data.token;
      await AsyncStorage.setItem('token', token);

      const user = { ...res.data.user, token };
      await AsyncStorage.setItem('user', JSON.stringify(user));

      await registerPushAfterLogin(user);

      // ✅ Lock the active role
      dispatch(setActiveRole('user'));

      return user;
    } catch (err: any) {
      await AsyncStorage.removeItem('user').catch(() => {});
      await AsyncStorage.removeItem('token').catch(() => {});
      dispatch(setUser(null));
      return rejectWithValue(
        err.response?.data?.message || 'OTP Login failed.'
      );
    }
  }
);

export const fetchAllUsers = createAsyncThunk(
  'auth/fetchAllUsers',
  async (_, { getState, rejectWithValue }) => {
    try {
      // ✅ FIXED: await the async token resolver
      const token = await getActiveToken(getState() as any);
      if (!token) return rejectWithValue('Authentication token not found.');

      const res = await axios.get(`${config.apiUrl}/auth/all-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.users;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch users.'
      );
    }
  }
);

export const fetchUserProfile = createAsyncThunk(
  'auth/fetchUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return rejectWithValue('No token found, please log in.');

      const res = await axios.get(`${config.apiUrl}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = { ...res.data.user, token };

      // Re-register push token for the logged-in user (cold start)
      try {
        const uid = user?._id || user?.id;
        if (uid) {
          const currentPushToken = await registerForPushNotificationsAsync(
            String(uid),
            'user'
          );
          if (currentPushToken && user.pushToken !== currentPushToken) {
            axios
              .put(
                `${config.apiUrl}/auth/update-push-token`,
                { pushToken: currentPushToken },
                { headers: { Authorization: `Bearer ${token}` } }
              )
              .catch((e) =>
                console.log('Failed to update push token in background', e)
              );
          }
        }
      } catch (e) {
        console.warn('⚠️ fetchUserProfile push registration failed:', e);
      }

      await AsyncStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      return rejectWithValue({
        message:
          err.response?.data?.message ||
          'Session expired. Please log in again.',
        status: err.response?.status,
      });
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async (formData: FormData, { getState, rejectWithValue }) => {
    try {
      let token = (getState() as any).auth.user?.token;
      if (!token) token = (await AsyncStorage.getItem('token')) || '';
      if (!token) return rejectWithValue('Authentication token not found.');

      const res = await axios.put(`${config.apiUrl}/auth/update`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      const updatedUser = { ...res.data.user, token };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Update failed.');
    }
  }
);

export const sendSmsInvites = createAsyncThunk(
  'auth/sendSmsInvites',
  async (contacts: string[], { getState, rejectWithValue }) => {
    try {
      // ✅ FIXED: await the async token resolver
      const token = await getActiveToken(getState() as any);
      if (!token) return rejectWithValue('Authentication token not found.');

      const res = await axios.post(
        `${config.apiUrl}/auth/send-invites`,
        { contacts },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to send invites.'
      );
    }
  }
);

export const syncContacts = createAsyncThunk(
  'auth/syncContacts',
  async (phoneNumbers: string[], { getState, rejectWithValue }) => {
    try {
      // ✅ FIXED: await the async token resolver
      const token = await getActiveToken(getState() as any);
      if (!token) return rejectWithValue('Authentication token not found.');

      const res = await axios.post(
        `${config.apiUrl}/auth/sync-contacts`,
        { phoneNumbers },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data.registeredContacts;
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to sync contacts.'
      );
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState, dispatch }) => {
    const state = getState() as any;
    try {
      const token =
        state.auth.user?.token ||
        (await AsyncStorage.getItem('token')) ||
        '';

      if (token) {
        const expoToken = await AsyncStorage.getItem('expoPushToken');
        const userId = state.auth.user?._id || state.auth.user?.id;
        if (userId && expoToken) {
          await unregisterPushToken(String(userId), expoToken, 'user').catch(
            () => {}
          );
        }
        await axios
          .post(
            `${config.apiUrl}/auth/remove-push-token`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => {});
      }
    } catch (error) {
      console.error('Failed to remove push token during logout', error);
    } finally {
      // Only clear the USER session. Device-level expoPushToken stays.
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');

      const vendorToken = await AsyncStorage.getItem('vendorToken');
      if (vendorToken) {
        dispatch(setActiveRole('vendor'));
      } else {
        dispatch(clearActiveRole());
      }
    }
    return true;
  }
);

const initialState: AuthState = {
  user: null,
  allUsers: [],
  registeredContacts: [],
  appConfig: null,
  loading: false,
  isSendingInvite: false,
  isSyncingContacts: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // ✅ Allow null so we can hard-reset the user on new login / logout
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    // ✅ Explicit hard-clear used by the 401 interceptor
    clearUser: (state) => {
      state.user = null;
      state.allUsers = [];
      state.registeredContacts = [];
      state.error = null;
      state.loading = false;
      state.isSendingInvite = false;
      state.isSyncingContacts = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppConfig.fulfilled, (state, action) => {
        state.appConfig = action.payload;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(loginWithOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithOtp.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(loginWithOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(
        fetchAllUsers.fulfilled,
        (state, action: PayloadAction<User[]>) => {
          state.loading = false;
          state.allUsers = action.payload;
        }
      )
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(
        fetchUserProfile.fulfilled,
        (state, action: PayloadAction<User>) => {
          state.loading = false;
          state.user = action.payload;
        }
      )
      .addCase(fetchUserProfile.rejected, (state, action: any) => {
        state.loading = false;
        const status = action.payload?.status;

        if (status === 401) {
          state.error = action.payload?.message as string;
          state.user = null;
          AsyncStorage.removeItem('user');
          AsyncStorage.removeItem('token');
        } else {
          state.error = 'Network error: Using cached profile.';
        }
      })
      .addCase(updateUserProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(
        updateUserProfile.fulfilled,
        (state, action: PayloadAction<User>) => {
          state.loading = false;
          state.user = action.payload;
        }
      )
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(sendSmsInvites.pending, (state) => {
        state.isSendingInvite = true;
        state.error = null;
      })
      .addCase(sendSmsInvites.fulfilled, (state) => {
        state.isSendingInvite = false;
      })
      .addCase(sendSmsInvites.rejected, (state, action) => {
        state.isSendingInvite = false;
        state.error = action.payload as string;
      })
      .addCase(syncContacts.pending, (state) => {
        state.isSyncingContacts = true;
        state.error = null;
      })
      .addCase(syncContacts.fulfilled, (state, action) => {
        state.isSyncingContacts = false;
        state.registeredContacts = action.payload;
      })
      .addCase(syncContacts.rejected, (state, action) => {
        state.isSyncingContacts = false;
        state.error = action.payload as string;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.allUsers = [];
        state.registeredContacts = [];
        state.error = null;
        state.loading = false;
        state.isSendingInvite = false;
        state.isSyncingContacts = false;
      });
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;