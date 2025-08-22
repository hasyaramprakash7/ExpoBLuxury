// src/features/vendor/vendorOrderSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../utils/api"; // CORRECTED: Import your global API instance
import { Order } from "../../types/models"; // Import Order from shared types

// Define the state structure for this slice
interface VendorOrderState {
    orders: Order[]; // Orders specific to the logged-in vendor
    allSystemOrders: Order[]; // All orders (primarily for admin dashboard)
    loading: boolean; // General loading state for the slice
    error: string | null; // General error state for the slice
}

// --- Async Thunks ---

/**
 * @asyncThunk fetchVendorOrders
 * @desc Fetches all orders for the authenticated vendor using the '/orders/vendor/me' endpoint.
 * The backend derives the vendorId from the token.
 */
export const fetchVendorOrders = createAsyncThunk<
    Order[], // Expected return type when fulfilled
    void, // No argument needed as vendorId is derived from token
    { rejectValue: string } // Type for the rejected value
>(
    "vendorOrders/fetchVendorOrders",
    async (_, { rejectWithValue }) => {
        try {
            // Use 'api' instance. Interceptor handles token.
            // The backend must have an endpoint /orders/vendor/me that uses authMiddleware to get the vendorId.
            const res = await api.get(`/orders/vendor/me`);

            console.log("fetchVendorOrders: API Response for /vendor/me:", res.data);
            console.log("fetchVendorOrders: Fetched vendor orders successfully (payload):", res.data.orders);
            return res.data.orders; // Assuming backend sends { success: true, orders: [...] }
        } catch (err: any) {
            console.error("Failed to fetch vendor orders:", err.response?.data?.message || err.message);
            return rejectWithValue(err.response?.data?.message || "Failed to fetch vendor orders");
        }
    }
);

/**
 * @asyncThunk updateVendorOrderStatus
 * @desc Updates the overall status of a specific order (for logged-in vendor).
 */
export const updateVendorOrderStatus = createAsyncThunk<
    Order, // Expected return type when fulfilled (the updated order)
    { orderId: string; newStatus: string }, // Argument type
    { rejectValue: string } // Type for the rejected value
>(
    "vendorOrders/updateVendorOrderStatus",
    async ({ orderId, newStatus }, { rejectWithValue }) => {
        try {
            // ⭐ This is the correct endpoint and call for a vendor to update an order. ⭐
            const res = await api.put(`/orders/${orderId}/status`, { status: newStatus });

            console.log(`updateVendorOrderStatus: Order ${orderId} status updated to ${newStatus}. Response:`, res.data.order);
            return res.data.order; // Assuming backend returns the updated order object
        } catch (err: any) {
            console.error(`Failed to update status for order ${orderId}:`, err.response?.data?.message || err.message);
            return rejectWithValue(err.response?.data?.message || "Failed to update order status");
        }
    }
);

/**
 * @asyncThunk fetchAllSystemOrders
 * @desc Fetches all orders in the system (typically for Admin Panel).
 */
export const fetchAllSystemOrders = createAsyncThunk<
    Order[], // Expected return type when fulfilled (array of all orders)
    void, // No arguments
    { rejectValue: string } // Type for the rejected value
>(
    "vendorOrders/fetchAllSystemOrders",
    async (_, { rejectWithValue }) => {
        try {
            // ⭐ This is the correct endpoint for an admin to fetch all orders. ⭐
            const res = await api.get(`/orders/all`); // Assumes this is the backend endpoint for all orders

            console.log("[fetchAllSystemOrders] Response:", res.data.orders);
            return res.data.orders;
        } catch (err: any) {
            console.error("[fetchAllSystemOrders] Error:", err.response?.data?.message || err.message);
            return rejectWithValue(err.response?.data?.message || "Failed to fetch all system orders");
        }
    }
);

/**
 * @asyncThunk adminUpdateOrderStatus
 * @desc Updates the status of any order (typically for Admin Panel).
 */
export const adminUpdateOrderStatus = createAsyncThunk<
    Order, // Expected return type when fulfilled (the updated order)
    { orderId: string; newStatus: string }, // Argument type
    { rejectValue: string } // Type for the rejected value
>(
    "vendorOrders/adminUpdateOrderStatus",
    async ({ orderId, newStatus }, { rejectWithValue }) => {
        try {
            console.log(`[adminUpdateOrderStatus] Updating order ${orderId} to status: ${newStatus}`);

            // ⭐ This is the correct endpoint for an admin to update any order. ⭐
            const res = await api.put(`/orders/${orderId}/admin-status`, { status: newStatus });

            console.log("[adminUpdateOrderStatus] API Response:", res.data.order);
            return res.data.order; // Assuming backend returns the updated order object
        } catch (err: any) {
            console.error(`[adminUpdateOrderStatus] Error updating order ${orderId}:`, err.response?.data?.message || err.message);
            return rejectWithValue(err.response?.data?.message || `Failed to update order status for ID: ${orderId}`);
        }
    }
);

// --- Redux Slice Definition ---
const vendorOrderSlice = createSlice({
    name: "vendorOrders",
    initialState: {
        orders: [],
        allSystemOrders: [],
        loading: false,
        error: null,
    } as VendorOrderState,
    reducers: {
        clearVendorOrderError: (state) => {
            state.error = null;
        },
        clearVendorOrders: (state) => {
            state.orders = [];
            state.error = null;
        },
        clearAllSystemOrders: (state) => {
            state.allSystemOrders = [];
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchVendorOrders.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchVendorOrders.fulfilled, (state, action) => {
                state.loading = false;
                state.orders = action.payload;
                console.log("Redux: fetchVendorOrders.fulfilled CALLED. Payload:", action.payload);
                console.log("Redux: state.orders AFTER UPDATE:", state.orders);
            })
            .addCase(fetchVendorOrders.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || "Failed to fetch vendor orders";
                state.orders = [];
            })

            .addCase(updateVendorOrderStatus.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateVendorOrderStatus.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.orders.findIndex(order => order._id === action.payload._id);
                if (index !== -1) {
                    state.orders[index] = action.payload;
                }
                const allSysIndex = state.allSystemOrders.findIndex(order => order._id === action.payload._id);
                if (allSysIndex !== -1) {
                    state.allSystemOrders[allSysIndex] = action.payload;
                }
            })
            .addCase(updateVendorOrderStatus.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || "Failed to update vendor order status";
            })

            .addCase(fetchAllSystemOrders.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAllSystemOrders.fulfilled, (state, action) => {
                state.loading = false;
                state.allSystemOrders = action.payload;
            })
            .addCase(fetchAllSystemOrders.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || "Failed to fetch all system orders";
                state.allSystemOrders = [];
            })

            .addCase(adminUpdateOrderStatus.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(adminUpdateOrderStatus.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.allSystemOrders.findIndex(order => order._id === action.payload._id);
                if (index !== -1) {
                    state.allSystemOrders[index] = action.payload;
                }
                const vendorOrdersIndex = state.orders.findIndex(order => order._id === action.payload._id);
                if (vendorOrdersIndex !== -1) {
                    state.orders[vendorOrdersIndex] = action.payload;
                }
            })
            .addCase(adminUpdateOrderStatus.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || "Failed to update order status by admin";
            });
    },
});

export const { clearVendorOrderError, clearVendorOrders, clearAllSystemOrders } = vendorOrderSlice.actions;
export default vendorOrderSlice.reducer;