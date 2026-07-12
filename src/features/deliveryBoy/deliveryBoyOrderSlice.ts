// src/features/delivery/deliveryBoySlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import api from "../../userScreens/utils/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Order } from "../orders/orderSlice";
import { registerForPushNotificationsAsync } from '../../userScreens/utils/NotificationHelper'; // 🔥 ADDED

export interface DeliveryBoy {
  _id: string;
  name: string;
  email: string;
  phone: string;
  shopName?: string;
  shopImage?: string;
  businessType?: string;
  vehicleNo?: string;
  licenseNo?: string;
  address: {
    latitude?: number;
    longitude?: number;
    pincode: string;
    state: string;
    district: string;
    country: string;
  };
  isApproved: boolean;
  isAvailable: boolean;
  assignedOrders: string[];
  pushToken?: string; // 🔥 ADDED
}

interface DeliveryBoyState {
  deliveryBoy: DeliveryBoy | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  allDeliveryBoys: Omit<DeliveryBoy, 'email' | 'password'>[];
  assignedOrders: Order[];
}

const getDeliveryBoyToken = async () => {
  try {
    const token = await AsyncStorage.getItem("deliveryBoyToken");
    return token && token !== "null" ? token : null;
  } catch (error) {
    console.error("Failed to get deliveryBoyToken from AsyncStorage", error);
    return null;
  }
};

export const registerDeliveryBoy = createAsyncThunk<
  { deliveryBoy: DeliveryBoy; token: string },
  FormData,
  { rejectValue: string }
>(
  "deliveryBoy/registerDeliveryBoy",
  async (formData, { rejectWithValue }) => {
    try {
      // 🔥 GET PUSH TOKEN AND APPEND TO FORMDATA
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) formData.append('pushToken', pushToken);

      const res = await api.post("/deliveryboy/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const token = res.data.token;
      await AsyncStorage.setItem("deliveryBoyToken", token);

      const profileRes = await api.get("/deliveryboy/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        deliveryBoy: profileRes.data.deliveryBoy,
        token,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Registration failed");
    }
  }
);

export const loginDeliveryBoy = createAsyncThunk<
  { deliveryBoy: DeliveryBoy; token: string },
  { email: string; password: string },
  { rejectValue: string }
>(
  "deliveryBoy/loginDeliveryBoy",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      // 🔥 GET PUSH TOKEN
      const pushToken = await registerForPushNotificationsAsync();

      const res = await api.post("/deliveryboy/login", { email, password, pushToken });
      const token = res.data.token;
      await AsyncStorage.setItem("deliveryBoyToken", token);

      const profileRes = await api.get("/deliveryboy/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        deliveryBoy: profileRes.data.deliveryBoy,
        token,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Login failed");
    }
  }
);

export const fetchDeliveryBoyProfile = createAsyncThunk<
  { deliveryBoy: DeliveryBoy; token: string | null },
  void,
  { rejectValue: string }
>(
  "deliveryBoy/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const token = await getDeliveryBoyToken();
      if (!token) throw new Error("No valid token");

      const res = await api.get("/deliveryboy/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const dboy = res.data.deliveryBoy;

      // 🔥 Update push token silently
      const currentPushToken = await registerForPushNotificationsAsync();
      if (currentPushToken && dboy.pushToken !== currentPushToken) {
        api.put(`/deliveryboy/update-push-token`, { pushToken: currentPushToken }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(e => console.log("Failed to update dboy push token", e));
      }

      return {
        deliveryBoy: dboy,
        token,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch profile");
    }
  }
);

export const updateDeliveryBoyProfile = createAsyncThunk<
  { deliveryBoy: DeliveryBoy; token: string },
  FormData,
  { rejectValue: string }
>(
  "deliveryBoy/updateProfile",
  async (updatedData, { rejectWithValue }) => {
    try {
      const token = await getDeliveryBoyToken();
      if (!token) throw new Error("No valid token");

      const res = await api.put("/deliveryboy/update", updatedData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      return {
        deliveryBoy: res.data.deliveryBoy,
        token,
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Update failed");
    }
  }
);

export const fetchAllDeliveryBoys = createAsyncThunk<
  Omit<DeliveryBoy, 'email' | 'password'>[],
  void,
  { rejectValue: string }
>(
  "deliveryBoy/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/deliveryboy/all");
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch delivery boys");
    }
  }
);

export const toggleAvailability = createAsyncThunk<
  boolean,
  void,
  { rejectValue: string }
>(
  "deliveryBoy/toggleAvailability",
  async (_, { rejectWithValue }) => {
    try {
      const token = await getDeliveryBoyToken();
      if (!token) throw new Error("No valid token");

      const res = await api.patch("/deliveryboy/toggle-availability", {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.isAvailable;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to toggle availability");
    }
  }
);

export const fetchOrdersByDeliveryBoy = createAsyncThunk<
  Order[], string, { rejectValue: string }
>(
  "deliveryBoy/fetchOrdersByDeliveryBoy",
  async (deliveryBoyId, { rejectWithValue }) => {
    try {
      const token = await getDeliveryBoyToken();
      if (!token) return rejectWithValue("Authentication token not found. Please log in.");

      const res = await api.get(`/deliveryboy/${deliveryBoyId}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.orders || [];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch delivery boy orders");
    }
  }
);

interface UpdateOrderStatusPayload {
  orderId: string;
  status: 'picked_up' | 'delivered';
}
export const updateOrderStatus = createAsyncThunk<
  Order, UpdateOrderStatusPayload, { rejectValue: string }
>(
  "deliveryBoy/updateOrderStatus",
  async ({ orderId, status }, { rejectWithValue }) => {
    try {
      const token = await getDeliveryBoyToken();
      if (!token) return rejectWithValue("Authentication token not found. Please log in.");

      const res = await api.patch(`/orders/${orderId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.order;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to update order status");
    }
  }
);

const initialState: DeliveryBoyState = {
  deliveryBoy: null,
  token: null,
  loading: false,
  error: null,
  allDeliveryBoys: [],
  assignedOrders: [],
};

const deliveryBoyAuthSlice = createSlice({
  name: "deliveryBoyAuth",
  initialState,
  reducers: {
    setDeliveryBoy: (state, action: PayloadAction<{ deliveryBoy: DeliveryBoy; token: string }>) => {
      state.deliveryBoy = action.payload.deliveryBoy;
      state.token = action.payload.token;
      AsyncStorage.setItem("deliveryBoyToken", action.payload.token);
    },
    logoutDeliveryBoy: (state) => {
      state.deliveryBoy = null;
      state.token = null;
      state.error = null;
      AsyncStorage.removeItem("deliveryBoyToken");
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerDeliveryBoy.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerDeliveryBoy.fulfilled, (state, action) => {
        state.loading = false;
        state.deliveryBoy = action.payload.deliveryBoy;
        state.token = action.payload.token;
      })
      .addCase(registerDeliveryBoy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Registration failed";
      })
      .addCase(loginDeliveryBoy.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginDeliveryBoy.fulfilled, (state, action) => {
        state.loading = false;
        state.deliveryBoy = action.payload.deliveryBoy;
        state.token = action.payload.token;
      })
      .addCase(loginDeliveryBoy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Login failed";
      })
      .addCase(fetchDeliveryBoyProfile.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDeliveryBoyProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.deliveryBoy = action.payload.deliveryBoy;
        state.token = action.payload.token;
      })
      .addCase(fetchDeliveryBoyProfile.rejected, (state, action) => {
        state.loading = false;
        state.deliveryBoy = null;
        state.token = null;
        state.error = action.payload ?? "Failed to fetch profile";
      })
      .addCase(updateDeliveryBoyProfile.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateDeliveryBoyProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.deliveryBoy = action.payload.deliveryBoy;
        state.token = action.payload.token;
      })
      .addCase(updateDeliveryBoyProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Update failed";
      })
      .addCase(fetchAllDeliveryBoys.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAllDeliveryBoys.fulfilled, (state, action) => {
        state.loading = false;
        state.allDeliveryBoys = action.payload;
      })
      .addCase(fetchAllDeliveryBoys.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to fetch all delivery boys";
      })
      .addCase(toggleAvailability.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(toggleAvailability.fulfilled, (state, action) => {
        state.loading = false;
        if (state.deliveryBoy) {
          state.deliveryBoy.isAvailable = action.payload;
        }
      })
      .addCase(toggleAvailability.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to toggle availability";
      })
      .addCase(fetchOrdersByDeliveryBoy.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchOrdersByDeliveryBoy.fulfilled, (state, action) => {
        state.loading = false;
        state.assignedOrders = action.payload;
      })
      .addCase(fetchOrdersByDeliveryBoy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to fetch assigned orders";
      })
      .addCase(updateOrderStatus.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(updateOrderStatus.fulfilled, (state, action: PayloadAction<Order>) => {
        state.loading = false;
        const updatedOrder = action.payload;
        const index = state.assignedOrders.findIndex(o => o._id === updatedOrder._id);
        if (index !== -1) {
          state.assignedOrders[index] = updatedOrder;
        }
      })
      .addCase(updateOrderStatus.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to update order status";
      });
  },
});

export const { setDeliveryBoy, logoutDeliveryBoy } = deliveryBoyAuthSlice.actions;
export default deliveryBoyAuthSlice.reducer;