import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../config/config';
import { registerForPushNotificationsAsync } from '../../userScreens/utils/NotificationHelper';

// 🔥 UPDATED: Removed the embedded 'address' object to match the new normalized backend.
// Addresses are now correctly handled globally by the locationSlice.
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

export const fetchAppConfig = createAsyncThunk(
  'auth/fetchAppConfig',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${config.apiUrl}/auth/app-version`);
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to check app version.');
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ identifier, password }: LoginCredentials, { rejectWithValue }) => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      const res = await axios.post(`${config.apiUrl}/auth/login`, { identifier, password, pushToken });
      const token = res.data.token;
      await AsyncStorage.setItem('token', token);

      const profileRes = await axios.get(`${config.apiUrl}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = { ...profileRes.data.user, token };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Login failed.');
    }
  }
);

export const loginWithOtp = createAsyncThunk(
  'auth/loginWithOtp',
  async ({ phone, otp }: { phone: string; otp: string }, { rejectWithValue }) => {
    try {
      const pushToken = await registerForPushNotificationsAsync();
      const res = await axios.post(`${config.apiUrl}/auth/login-with-otp`, { phone, otp, pushToken });
      const token = res.data.token;
      await AsyncStorage.setItem('token', token);

      const user = { ...res.data.user, token };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'OTP Login failed.');
    }
  }
);

export const fetchAllUsers = createAsyncThunk(
  'auth/fetchAllUsers',
  async (_, { getState, rejectWithValue }) => {
    try {
      let token = (getState() as any).auth.user?.token || (getState() as any).vendorAuth?.token;
      if (!token) {
        token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('vendorToken')) || '';
      }
      if (!token) return rejectWithValue('Authentication token not found.');

      const res = await axios.get(`${config.apiUrl}/auth/all-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.users;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch users.');
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

      const currentPushToken = await registerForPushNotificationsAsync();
      if (currentPushToken && user.pushToken !== currentPushToken) {
        axios.put(`${config.apiUrl}/auth/update-push-token`, { pushToken: currentPushToken }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(e => console.log("Failed to update push token in background", e));
      }

      await AsyncStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      return rejectWithValue({
        message: err.response?.data?.message || 'Session expired. Please log in again.',
        status: err.response?.status
      });
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async (formData: FormData, { getState, rejectWithValue }) => {
    try {
      let token = (getState() as { auth: AuthState }).auth.user?.token;
      if (!token) token = await AsyncStorage.getItem('token') || '';
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
      let token = (getState() as any).auth.user?.token || (getState() as any).vendorAuth?.token;
      if (!token) token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('vendorToken')) || '';
      if (!token) return rejectWithValue('Authentication token not found.');

      const res = await axios.post(`${config.apiUrl}/auth/send-invites`, { contacts }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to send invites.');
    }
  }
);

export const syncContacts = createAsyncThunk(
  'auth/syncContacts',
  async (phoneNumbers: string[], { getState, rejectWithValue }) => {
    try {
      let token = (getState() as any).auth.user?.token || (getState() as any).vendorAuth?.token;
      if (!token) token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('vendorToken')) || '';
      if (!token) return rejectWithValue('Authentication token not found.');

      const res = await axios.post(`${config.apiUrl}/auth/sync-contacts`, { phoneNumbers }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data.registeredContacts;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to sync contacts.');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState }) => {
    try {
      let token = (getState() as { auth: AuthState }).auth.user?.token;
      if (!token) token = await AsyncStorage.getItem('token') || '';

      if (token) {
        await axios.post(`${config.apiUrl}/auth/remove-push-token`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error("Failed to remove push token during logout", error);
    } finally {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
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
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppConfig.fulfilled, (state, action) => {
        state.appConfig = action.payload;
      })
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(loginWithOtp.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginWithOtp.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(loginWithOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAllUsers.pending, (state) => { state.loading = true; })
      .addCase(fetchAllUsers.fulfilled, (state, action: PayloadAction<User[]>) => {
        state.loading = false;
        state.allUsers = action.payload;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchUserProfile.pending, (state) => { state.loading = true; })
      .addCase(fetchUserProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
      })
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
      .addCase(updateUserProfile.pending, (state) => { state.loading = true; })
      .addCase(updateUserProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
      })
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

export const { setUser } = authSlice.actions;
export default authSlice.reducer;