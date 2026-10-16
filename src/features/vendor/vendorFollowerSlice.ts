// src/features/vendor/vendorFollowerSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../userScreens/utils/api';

export const fetchVendorFollowers = createAsyncThunk<
  { vendorId: string; followers: any[] },
  { vendorId: string; page?: number; limit?: number },
  { rejectValue: string }
>(
  'vendorFollower/fetchFollowers',
  async ({ vendorId, page = 1, limit = 50 }, { rejectWithValue }) => {
    try {
      const res = await api.get(
        `/vendors/followers/${vendorId}?page=${page}&limit=${limit}`
      );
      const list = res.data?.data || res.data?.followers || [];
      return { vendorId, followers: Array.isArray(list) ? list : [] };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch vendor followers'
      );
    }
  }
);

export const fetchVendorFollowing = createAsyncThunk<
  { vendorId: string; following: any[] },
  { vendorId: string; page?: number; limit?: number },
  { rejectValue: string }
>(
  'vendorFollower/fetchFollowing',
  async ({ vendorId, page = 1, limit = 50 }, { rejectWithValue }) => {
    try {
      const res = await api.get(
        `/vendors/following/${vendorId}?page=${page}&limit=${limit}`
      );
      const list = res.data?.data || res.data?.following || [];
      return { vendorId, following: Array.isArray(list) ? list : [] };
    } catch (err: any) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch vendor following'
      );
    }
  }
);

export const toggleVendorFollow = createAsyncThunk<
  { targetVendorId: string; following: boolean; followersCount?: number },
  string,
  { rejectValue: string }
>('vendorFollower/toggleFollow', async (targetVendorId, { rejectWithValue }) => {
  try {
    const res = await api.post(`/vendors/follow/${targetVendorId}`, {});
    const body = res.data?.data || res.data || {};
    const following =
      typeof body.following === 'boolean'
        ? body.following
        : typeof body.isFollowing === 'boolean'
        ? body.isFollowing
        : typeof body.followed === 'boolean'
        ? body.followed
        : true;
    return {
      targetVendorId,
      following,
      followersCount:
        typeof body.followersCount === 'number' ? body.followersCount : undefined,
    };
  } catch (err: any) {
    return rejectWithValue(
      err.response?.data?.message || 'Failed to toggle follow'
    );
  }
});

interface VendorFollowerState {
  followers: Record<string, any[]>;
  following: Record<string, any[]>;
  followingMap: Record<string, boolean>;
  loading: boolean;
  error: string | null;
}

const initialState: VendorFollowerState = {
  followers: {},
  following: {},
  followingMap: {},
  loading: false,
  error: null,
};

const vendorFollowerSlice = createSlice({
  name: 'vendorFollower',
  initialState,
  reducers: {
    clearVendorFollowers: (state) => {
      state.followers = {};
      state.following = {};
      state.followingMap = {};
      state.loading = false;
      state.error = null;
    },
    setVendorFollowingMap: (
      state,
      action: { payload: Record<string, boolean> }
    ) => {
      state.followingMap = { ...state.followingMap, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendorFollowers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorFollowers.fulfilled, (state, action) => {
        state.loading = false;
        state.followers[action.payload.vendorId] = action.payload.followers;
      })
      .addCase(fetchVendorFollowers.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to fetch followers';
      })

      .addCase(fetchVendorFollowing.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorFollowing.fulfilled, (state, action) => {
        state.loading = false;
        state.following[action.payload.vendorId] = action.payload.following;
      })
      .addCase(fetchVendorFollowing.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to fetch following';
      })

      .addCase(toggleVendorFollow.fulfilled, (state, action) => {
        state.followingMap[action.payload.targetVendorId] =
          action.payload.following;
      });
  },
});

export const { clearVendorFollowers, setVendorFollowingMap } =
  vendorFollowerSlice.actions;

export const vendorFollowerReducer = vendorFollowerSlice.reducer;