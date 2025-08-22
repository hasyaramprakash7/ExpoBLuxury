import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../config/config'; // API URL config

// --- Interface Definitions ---
interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: {
    latitude?: number;
    longitude?: number;
    pincode: string;
    state: string;
    district: string;
    country: string;
  };
  token: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface LoginCredentials {
  identifier: string; // Can be email or phone
  password: string;
}

// --- Async Thunks for API Interaction ---

// Handles user login by sending identifier (email/phone) and password.
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ identifier, password }: LoginCredentials, { rejectWithValue }) => {
    try {
      // 1. Post credentials to the login endpoint
      const res = await axios.post(`${config.apiUrl}/auth/login`, { identifier, password });
      const token = res.data.token;
      await AsyncStorage.setItem('token', token);

      // 2. Use the received token to fetch the full user profile
      const profileRes = await axios.get(`${config.apiUrl}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 3. Combine profile data with the token and store in state/storage
      const user = { ...profileRes.data.user, token };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
      return rejectWithValue(errorMessage);
    }
  }
);

// Fetches user profile if a token exists in storage (for session persistence).
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
      await AsyncStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err: any) {
      // If token is invalid or expired, clear storage
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('token');
      return rejectWithValue(err.response?.data?.message || 'Session expired. Please log in again.');
    }
  }
);

// Updates the user's profile data on the server.
export const updateUserProfile = createAsyncThunk(
  'auth/updateUserProfile',
  async (formData: Partial<User>, { getState, rejectWithValue }) => {
    try {
      const token = (getState() as { auth: AuthState }).auth.user?.token;
      if (!token) return rejectWithValue('Authentication token not found.');

      const res = await axios.put(`${config.apiUrl}/auth/update`, formData, {
        headers: {
          'Content-Type': 'application/json',
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


// --- Initial State ---
const initialState: AuthState = {
  user: null, // User data will be loaded asynchronously from storage or API
  loading: false,
  error: null,
};


// --- Auth Slice Definition ---
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Manually set user data in the state
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    // Clear user session data from state and async storage
    logout: (state) => {
      state.user = null;
      state.error = null;
      state.loading = false;
      AsyncStorage.removeItem('user');
      AsyncStorage.removeItem('token');
    },
  },
  extraReducers: (builder) => {
    builder
      // Login Lifecycle
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
      // Fetch Profile Lifecycle (for app startup)
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.user = null; // Clear user on auth failure
      })
      // Update Profile Lifecycle
      .addCase(updateUserProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateUserProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload; // Update state with the new user data
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setUser, logout } = authSlice.actions;
export default authSlice.reducer;
