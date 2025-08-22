// src/features/order/orderSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from "../../config/config"; // Ensure this path is correct based on your project structure

// Base API URL for orders
const API = `${config.apiUrl}/orders`;

// Helper functions to get tokens from AsyncStorage
const getUserToken = async (): Promise<string | null> => {
    try {
        const token = await AsyncStorage.getItem("token");
        return token;
    } catch (e) {
        console.error("Failed to retrieve user token from AsyncStorage", e);
        return null;
    }
};

const getVendorToken = async (): Promise<string | null> => {
    try {
        const token = await AsyncStorage.getItem("vendorToken");
        return token;
    } catch (e) {
        console.error("Failed to retrieve vendor token from AsyncStorage", e);
        return null;
    }
};

const getAdminToken = async (): Promise<string | null> => {
    try {
        const token = await AsyncStorage.getItem("adminToken");
        return token;
    } catch (e) {
        console.error("Failed to retrieve admin token from AsyncStorage", e);
        return null;
    }
};

const getDeliveryBoyToken = async (): Promise<string | null> => {
    try {
        const token = await AsyncStorage.getItem("deliveryBoyToken");
        return token;
    } catch (e) {
        console.error("Failed to retrieve delivery boy token from AsyncStorage", e);
        return null;
    }
};

// Utility to get any available authenticated token with logging for debugging
const getAnyAuthToken = async (): Promise<string | null> => {
    const userToken = await getUserToken();
    if (userToken) {
        console.log("Using user token for API call.");
        return userToken;
    }
    const vendorToken = await getVendorToken();
    if (vendorToken) {
        console.log("Using vendor token for API call.");
        return vendorToken;
    }
    const adminToken = await getAdminToken();
    if (adminToken) {
        console.log("Using admin token for API call.");
        return adminToken;
    }
    const deliveryBoyToken = await getDeliveryBoyToken();
    if (deliveryBoyToken) {
        console.log("Using delivery boy token for API call.");
        return deliveryBoyToken;
    }
    console.log("No authentication token found for API call.");
    return null;
};

// Define types for order data and state
export interface OrderAddress {
    fullName: string;
    street: string;
    street2?: string;
    landmark?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
    latitude?: number | null;
    longitude?: number | null;
}

export interface OrderItem {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    productImage?: string;
    vendorId: string;
    vendorName: string; // Assuming these are part of the item for display
    vendorPhone?: string;
}

export interface Order {
    _id: string;
    userId: string;
    address: OrderAddress;
    items: OrderItem[];
    total: number;
    status: 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'; // Specific literal types for status
    paymentMethod: string;
    orderImage?: string[]; // Array of image URLs
    createdAt: string;
    updatedAt: string;
    deliveryBoy?: { _id: string; name: string; email: string; } | null;
}

interface OrderState {
    orders: Order[];
    assignedOrders: Order[];
    placedOrder: Order | null;
    selectedOrder: Order | null;
    loading: boolean;
    error: string | null;
}

const initialOrder: Order = {
    _id: '',
    userId: '',
    address: {
        fullName: '',
        street: '',
        street2: '',
        landmark: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'India',
        phone: '',
        latitude: null,
        longitude: null,
    },
    items: [],
    total: 0,
    status: 'placed',
    paymentMethod: '',
    orderImage: [],
    createdAt: '',
    updatedAt: '',
    deliveryBoy: null,
};

const initialState: OrderState = {
    orders: [],
    assignedOrders: [],
    placedOrder: null,
    selectedOrder: null,
    loading: false,
    error: null,
};


// 🛒 Place an order
export const placeOrder = createAsyncThunk<
    Order, // Returned type
    Omit<Order, '_id' | 'status' | 'createdAt' | 'updatedAt' | 'orderImage' | 'deliveryBoy'>, // Argument type
    { rejectValue: string } // rejectValue type
>(
    "order/placeOrder",
    async (orderData, { rejectWithValue }) => {
        try {
            const token = await getUserToken(); // Only users can place orders
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in.");
            }
            const res = await axios.post(API, orderData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            return res.data.order;
        } catch (err: any) {
            console.error("Failed to place order:", err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to place order");
        }
    }
);

// 📦 Get all orders for a user
export const fetchUserOrders = createAsyncThunk<
    Order[], string, { rejectValue: string }
>(
    "order/fetchUserOrders",
    async (userId, { rejectWithValue }) => {
        try {
            const token = await getUserToken();
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in.");
            }
            const res = await axios.get(`${API}/user/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return res.data.orders;
        } catch (err: any) {
            console.error(`Failed to fetch orders for user ${userId}:`, err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch user orders");
        }
    }
);

// 📋 Fetch order by ID (accessible by User, Vendor, DeliveryBoy, Admin)
export const fetchOrderById = createAsyncThunk<
    Order, string, { rejectValue: string }
>(
    "order/fetchById",
    async (orderId, { rejectWithValue }) => {
        try {
            const token = await getAnyAuthToken();
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in.");
            }
            const res = await axios.get(`${API}/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return res.data.order;
        } catch (err: any) {
            console.error(`Failed to fetch order ${orderId}:`, err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch order");
        }
    }
);

// 🖼️ Upload order image
interface UploadOrderImagePayload {
    orderId: string;
    imageFile: { uri: string; name: string; type: string }; // React Native file object structure
}
export const uploadOrderImage = createAsyncThunk<
    Order, UploadOrderImagePayload, { rejectValue: string }
>(
    "order/uploadOrderImage",
    async ({ orderId, imageFile }, { rejectWithValue }) => {
        try {
            const token = await getAnyAuthToken();
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in to upload images.");
            }
            const formData = new FormData();
            formData.append("image", imageFile as any); // Type assertion for FormData append

            const res = await axios.put(`${API}/${orderId}/upload-image`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            return res.data.order;
        } catch (err: any) {
            console.error(`Failed to upload image for order ${orderId}:`, err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to upload order image");
        }
    }
);

// 🔄 Update status
interface UpdateOrderStatusPayload {
    orderId: string;
    status: string;
}
export const updateOrderStatus = createAsyncThunk<
    Order, UpdateOrderStatusPayload, { rejectValue: string }
>(
    "order/updateOrderStatus",
    async ({ orderId, status }, { rejectWithValue }) => {
        try {
            const token = await getAnyAuthToken();
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in to update order status.");
            }
            const res = await axios.put(`${API}/${orderId}/status`, { status }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            return res.data.order;
        } catch (err: any) {
            console.error(`Failed to update status for order ${orderId}:`, err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to update order status");
        }
    }
);

// ❌ Cancel order
export const cancelUserOrder = createAsyncThunk<
    Order, string, { rejectValue: string }
>(
    "order/cancelUserOrder",
    async (orderId, { rejectWithValue }) => {
        try {
            const token = await getAnyAuthToken(); // User or Admin can cancel
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in to cancel orders.");
            }
            const res = await axios.patch(`${API}/${orderId}/cancel`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return res.data.order;
        } catch (err: any) {
            console.error(`Failed to cancel order ${orderId}:`, err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to cancel order");
        }
    }
);

// 🗑️ Delete order
export const deleteOrder = createAsyncThunk<
    string, string, { rejectValue: string }
>(
    "order/deleteOrder",
    async (orderId, { rejectWithValue }) => {
        try {
            const token = await getAdminToken(); // Assuming only admins can delete
            if (!token) {
                return rejectWithValue("Admin authentication token not found. Please log in as an administrator to delete orders.");
            }
            await axios.delete(`${API}/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return orderId;
        } catch (err: any) {
            console.error(`Failed to delete order ${orderId}:`, err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to delete order");
        }
    }
);

// 🛵 Assign delivery boy to an order
interface AssignDeliveryBoyPayload {
    orderId: string;
    deliveryBoyId: string;
}
export const assignDeliveryBoy = createAsyncThunk<
    { success: boolean; message: string; order: Order; }, AssignDeliveryBoyPayload, { rejectValue: string }
>(
    "orders/assignDeliveryBoy",
    async ({ orderId, deliveryBoyId }, { rejectWithValue }) => {
        try {
            const token = await getVendorToken(); // Assuming this is an admin action
            if (!token) {
                return rejectWithValue("Admin authentication token not found. Please log in as an administrator.");
            }
            const res = await axios.post(`${API}/${orderId}/assign`, { deliveryBoyId }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            return res.data;
        } catch (err: any) {
            console.error("Assignment failed:", err);
            return rejectWithValue(err.response?.data?.message || err.message || "Assignment failed");
        }
    }
);


// 🚚 Get orders assigned to a delivery boy
export const fetchOrdersByDeliveryBoy = createAsyncThunk<
    Order[], string, { rejectValue: string }
>(
    "order/fetchOrdersByDeliveryBoy",
    async (deliveryBoyId, { rejectWithValue }) => {
        try {
            const token = await getAnyAuthToken(); // Can be fetched by delivery boy or admin
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in as an administrator or delivery boy.");
            }
            const res = await axios.get(`${API}/delivery-boy/${deliveryBoyId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            return res.data.orders || [];
        } catch (err: any) {
            console.error("Failed to fetch delivery boy orders:", err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch delivery boy orders");
        }
    }
);

const orderSlice = createSlice({
    name: "order",
    initialState,
    reducers: {
        clearOrderStatus: (state) => {
            state.placedOrder = null;
            state.error = null;
            state.selectedOrder = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Place Order
            .addCase(placeOrder.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(placeOrder.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                state.placedOrder = action.payload;
            })
            .addCase(placeOrder.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            })

            // Fetch User Orders
            .addCase(fetchUserOrders.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUserOrders.fulfilled, (state, action: PayloadAction<Order[]>) => {
                state.loading = false;
                state.orders = action.payload;
            })
            .addCase(fetchUserOrders.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            })

            // Fetch Order by ID
            .addCase(fetchOrderById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOrderById.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                state.selectedOrder = action.payload;
            })
            .addCase(fetchOrderById.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            })

            // Upload Order Image
            .addCase(uploadOrderImage.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(uploadOrderImage.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                const updated = action.payload;
                const idx = state.orders.findIndex(o => o._id === updated._id);
                if (idx !== -1) state.orders[idx] = updated;
                if (state.selectedOrder && state.selectedOrder._id === updated._id) state.selectedOrder = updated;
            })
            .addCase(uploadOrderImage.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            })

            // Update Order Status
            .addCase(updateOrderStatus.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateOrderStatus.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                const updated = action.payload;
                const idx = state.orders.findIndex(o => o._id === updated._id);
                if (idx !== -1) state.orders[idx] = updated;
                if (state.selectedOrder && state.selectedOrder._id === updated._id) state.selectedOrder = updated;
                const assignedIdx = state.assignedOrders.findIndex(o => o._id === updated._id);
                if (assignedIdx !== -1) state.assignedOrders[assignedIdx] = updated;
            })
            .addCase(updateOrderStatus.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            })

            // Cancel User Order
            .addCase(cancelUserOrder.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(cancelUserOrder.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                const updated = action.payload;
                const idx = state.orders.findIndex(o => o._id === updated._id);
                if (idx !== -1) state.orders[idx] = updated;
                if (state.selectedOrder && state.selectedOrder._id === updated._id) state.selectedOrder = updated;
                const assignedIdx = state.assignedOrders.findIndex(o => o._id === updated._id);
                if (assignedIdx !== -1) state.assignedOrders[assignedIdx] = updated;
            })
            .addCase(cancelUserOrder.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            })

            // Delete Order
            .addCase(deleteOrder.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteOrder.fulfilled, (state, action: PayloadAction<string>) => {
                state.loading = false;
                const id = action.payload;
                state.orders = state.orders.filter(o => o._id !== id);
                state.assignedOrders = state.assignedOrders.filter(o => o._id !== id);
                if (state.selectedOrder && state.selectedOrder._id === id) state.selectedOrder = null;
            })
            .addCase(deleteOrder.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            })

            // Assign Delivery Boy
            .addCase(assignDeliveryBoy.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(assignDeliveryBoy.fulfilled, (state, action: PayloadAction<{ success: boolean; message: string; order: Order; }>) => {
                state.loading = false;
                const assignedOrder = action.payload.order;
                const mainOrderIdx = state.orders.findIndex(o => o._id === assignedOrder._id);
                if (mainOrderIdx !== -1) {
                    state.orders[mainOrderIdx] = assignedOrder;
                }
                const assignedIdx = state.assignedOrders.findIndex(o => o._id === assignedOrder._id);
                if (assignedIdx !== -1) {
                    state.assignedOrders[assignedIdx] = assignedOrder;
                } else {
                    state.assignedOrders.push(assignedOrder);
                }
                if (state.selectedOrder && state.selectedOrder._id === assignedOrder._id) {
                    state.selectedOrder = assignedOrder;
                }
            })
            .addCase(assignDeliveryBoy.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            })

            // Fetch Orders by Delivery Boy
            .addCase(fetchOrdersByDeliveryBoy.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOrdersByDeliveryBoy.fulfilled, (state, action: PayloadAction<Order[]>) => {
                state.loading = false;
                state.assignedOrders = action.payload;
            })
            .addCase(fetchOrdersByDeliveryBoy.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "An unknown error occurred.";
            });
    },
});

export const { clearOrderStatus } = orderSlice.actions;
export default orderSlice.reducer; 