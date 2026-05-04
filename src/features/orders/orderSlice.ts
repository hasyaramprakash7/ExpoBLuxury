import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from "../../config/config"; // Ensure this path is correct based on your project structure

// Base API URL for orders
const API = `${config.apiUrl}/orders`;

// Helper functions to get tokens from AsyncStorage
const getUserToken = async () => {
    try {
        const token = await AsyncStorage.getItem("token");
        return token;
    } catch (e) {
        console.error("Failed to retrieve user token from AsyncStorage", e);
        return null;
    }
};

const getVendorToken = async () => {
    try {
        const token = await AsyncStorage.getItem("vendorToken");
        return token;
    } catch (e) {
        console.error("Failed to retrieve vendor token from AsyncStorage", e);
        return null;
    }
};

const getAdminToken = async () => {
    try {
        const token = await AsyncStorage.getItem("adminToken");
        return token;
    } catch (e) {
        console.error("Failed to retrieve admin token from AsyncStorage", e);
        return null;
    }
};

const getDeliveryBoyToken = async () => {
    try {
        const token = await AsyncStorage.getItem("deliveryBoyToken");
        return token;
    } catch (e) {
        console.error("Failed to retrieve delivery boy token from AsyncStorage", e);
        return null;
    }
};

// Utility to get any available authenticated token with logging for debugging
const getAnyAuthToken = async () => {
    const userToken = await getUserToken();
    if (userToken) {
        // console.log("Using user token for API call.");
        return userToken;
    }
    const vendorToken = await getVendorToken();
    if (vendorToken) {
        // console.log("Using vendor token for API call.");
        return vendorToken;
    }
    const adminToken = await getAdminToken();
    if (adminToken) {
        // console.log("Using admin token for API call.");
        return adminToken;
    }
    const deliveryBoyToken = await getDeliveryBoyToken();
    if (deliveryBoyToken) {
        // console.log("Using delivery boy token for API call.");
        return deliveryBoyToken;
    }
    console.warn("No authentication token found for API call.");
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
    vendorName: string; 
    vendorPhone?: string;
}

export interface Order {
    _id: string;
    userId: string;
    address: OrderAddress;
    items: OrderItem[];
    total: number;
    // 🎯 UPDATED: Includes 'pending_payment' status
    status: 'pending_payment' | 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'; 
    paymentMethod: 'COD' | 'Online Payment'; 
    paymentId?: string; // Added paymentId field for online payments
    orderImage?: string[]; 
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

const initialState: OrderState = {
    orders: [],
    assignedOrders: [],
    placedOrder: null,
    selectedOrder: null,
    loading: false,
    error: null,
};

// ------------------------------------------------
// --- ORDER THUNKS ---
// ------------------------------------------------

// Payload excludes IDs, status, and payment details
interface PlacePendingOrderPayload extends Omit<Order, '_id' | 'createdAt' | 'updatedAt' | 'orderImage' | 'deliveryBoy' | 'paymentId' | 'status'> {}

/**
 * @desc Places a temporary order with 'pending_payment' status to get a receipt ID.
 * @route POST /api/orders/pending
 */
export const placePendingOrder = createAsyncThunk<
    { order: Order, receiptId: string }, // Returned type now includes the receipt ID (Order._id)
    PlacePendingOrderPayload, 
    { rejectValue: string }
>(
    "order/placePendingOrder",
    async (orderData, { rejectWithValue }) => {
        try {
            const token = await getUserToken();
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in.");
            }
            // 🎯 New endpoint: /pending
            const res = await axios.post(`${API}/pending`, orderData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            return res.data; 
        } catch (err: any) {
            console.error("Failed to place pending order:", err.response?.data?.message || err.message);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to initiate pending order");
        }
    }
);


// Razorpay Payment Link Integration Thunk
interface CreateRazorpayLinkPayload {
    amount: number;
    receipt: string; // The internal Pending Order ID (Order._id)
    customerDetails: { name: string, email: string, contact: string }; 
}

export const createRazorpayPaymentLink = createAsyncThunk<
    // Returned type remains the same
    { orderId: string; currency: string; amount: number; paymentLinkUrl: string; paymentLinkId: string }, 
    CreateRazorpayLinkPayload, 
    { rejectValue: string }
>(
    "order/createRazorpayPaymentLink",
    async (payload, { rejectWithValue }) => {
        try {
            const token = await getUserToken(); // Only users can initiate payment
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in.");
            }
            
            const res = await axios.post(`${API}/create-payment-link`, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            return res.data; 
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
            console.error("Failed to create Razorpay Payment Link:", errorMsg);
            
            return rejectWithValue(errorMsg || "Failed to initiate online payment.");
        }
    }
);

// 🎯 NEW THUNK: Client-side Fallback for Online Payment Confirmation
/**
 * @desc Client-side finalization of a pending order (Fallback). Changes status from 'pending_payment' to 'processing'.
 * @route POST /api/orders/confirm-online-payment
 */
interface ConfirmOnlinePaymentPayload {
    orderId: string;
    paymentId: string; // The Razorpay payment ID
}

export const confirmOnlinePayment = createAsyncThunk<
    Order, 
    ConfirmOnlinePaymentPayload, 
    { rejectValue: string }
>(
    "order/confirmOnlinePayment",
    async ({ orderId, paymentId }, { rejectWithValue }) => {
        try {
            const token = await getUserToken(); // Must be the user placing the order
            if (!token) {
                return rejectWithValue("Authentication token not found. Please log in.");
            }

            console.log(`[Redux] Attempting manual confirmation for order ${orderId}`);

            // 🎯 Call the new server endpoint
            const res = await axios.post(`${API}/confirm-online-payment`, { orderId, paymentId }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            // The server returns the updated order
            return res.data.order;
        } catch (err: any) {
            console.error("Failed to confirm online payment manually:", err.response?.data?.message || err.message);
            return rejectWithValue(err.response?.data?.message || err.message || "Manual order confirmation failed.");
        }
    }
);


// Place an order (COD flow)
interface PlaceOrderPayload extends Omit<Order, '_id' | 'createdAt' | 'updatedAt' | 'orderImage' | 'deliveryBoy'> {}

export const placeOrder = createAsyncThunk<
    Order, // Returned type
    PlaceOrderPayload, 
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

// 📦 Get all orders for a user (unchanged)
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

// 📋 Fetch order by ID (accessible by User, Vendor, DeliveryBoy, Admin) (unchanged)
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
            // This is the critical point where the client checks the order status
            console.error(`Failed to fetch order ${orderId}:`, err);
            return rejectWithValue(err.response?.data?.message || err.message || "Failed to fetch order");
        }
    }
);

// 🖼️ Upload order image (unchanged)
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
            formData.append("image", imageFile); // TS will infer the correct type if file is constructed properly

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

// 🔄 Update status (unchanged)
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
            // Note: Your backend uses /:orderId/status for VENDOR updates.
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

// ❌ Cancel order (unchanged)
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

// 🗑️ Delete order (unchanged)
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

// 🛵 Assign delivery boy to an order (unchanged)
interface AssignDeliveryBoyPayload {
    orderId: string;
    deliveryBoyId: string;
}
// export const assignDeliveryBoy = createAsyncThunk<
//     { success: boolean; message: string; order: Order; }, AssignDeliveryBoyPayload, { rejectValue: string }
// >(
//     "orders/assignDeliveryBoy",
//     async ({ orderId, deliveryBoyId }, { rejectWithValue }) => {
//         try {
//             // Note: The backend uses the vendor token but should check for admin role
//             const token = await getVendorToken(); 
//             if (!token) {
//                 return rejectWithValue("Admin authentication token not found. Please log in as an administrator.");
//             }
//             const res = await axios.post(`${API}/${orderId}/assign`, { deliveryBoyId }, {
//                 headers: {
//                     Authorization: `Bearer ${token}`,
//                     "Content-Type": "application/json",
//                 },
//             });
//             return res.data;
//         } catch (err: any) {
//             console.error("Assignment failed:", err);
//             return rejectWithValue(err.response?.data?.message || err.message || "Assignment failed");
//         }
//     }
// );
export const assignDeliveryBoy = createAsyncThunk<
  { success: boolean; message: string; order: Order }, 
  AssignDeliveryBoyPayload, 
  { rejectValue: string }
>(
  "orders/assignDeliveryBoy",
  async ({ orderId, deliveryBoyId }, { rejectWithValue }) => {
    try {
      // 🎯 FIX: Get whatever token is available (Admin or Vendor)
      const token = await getAnyAuthToken(); 
      if (!token) return rejectWithValue("No authentication token found.");

      const res = await axios.post(`${API}/${orderId}/assign`, { deliveryBoyId }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Assignment failed");
    }
  }
);


// 🚚 Get orders assigned to a delivery boy (unchanged)
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

// ------------------------------------------------
// ----------------- Order Slice ------------------
// ------------------------------------------------

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
            // --- Place Pending Order ---
            .addCase(placePendingOrder.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(placePendingOrder.fulfilled, (state, action: PayloadAction<{ order: Order, receiptId: string }>) => {
                state.loading = false;
                state.placedOrder = action.payload.order; // Store the pending order
                // Note: The receiptId (Order ID) is crucial for the next step.
            })
            .addCase(placePendingOrder.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                // 🎯 FIX 1: Clear placedOrder on initial failure
                state.placedOrder = null; 
                state.error = action.payload || "Failed to create pending order.";
            })

            // --- Place Order (COD ONLY) ---
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

            // --- Create Razorpay Payment Link ---
            .addCase(createRazorpayPaymentLink.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createRazorpayPaymentLink.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                console.log("Razorpay Payment Link URL obtained:", action.payload.paymentLinkUrl);
            })
            .addCase(createRazorpayPaymentLink.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                // 🎯 FIX 2: Clear placedOrder if link creation fails
                state.placedOrder = null; 
                state.error = action.payload || "Failed to create online payment link.";
            })

            // 🎯 NEW: Confirm Online Payment (Fallback/Manual Confirmation)
            .addCase(confirmOnlinePayment.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(confirmOnlinePayment.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                // This manually confirmed order is now successfully placed ('processing' status)
                state.selectedOrder = action.payload;
                state.placedOrder = action.payload;
                // Update main list status too if it exists
                const idx = state.orders.findIndex(o => o._id === action.payload._id);
                if (idx !== -1) state.orders[idx] = action.payload;
            })
            .addCase(confirmOnlinePayment.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                // 🎯 FIX 3: Clear placedOrder if manual confirmation fails
                state.placedOrder = null; 
                state.error = action.payload || "Manual order confirmation failed.";
            })

            // --- Fetch User Orders (unchanged) ---
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
                state.error = action.payload || "Failed to fetch user orders.";
            })

            // --- Fetch Order by ID (used for final webhook check) ---
            .addCase(fetchOrderById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOrderById.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                state.selectedOrder = action.payload;
                // Update main list status too if it exists
                const idx = state.orders.findIndex(o => o._id === action.payload._id);
                if (idx !== -1) state.orders[idx] = action.payload;
            })
            .addCase(fetchOrderById.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "Failed to fetch order details.";
            })

            // --- Upload Order Image (unchanged) ---
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
                state.error = action.payload || "Failed to upload order image.";
            })

            // --- Update Order Status (unchanged) ---
            .addCase(updateOrderStatus.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateOrderStatus.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                const updated = action.payload;
                const idx = state.orders.findIndex(o => o._id === updated._id);
                if (idx !== -1) state.orders[idx] = updated;
                const assignedIdx = state.assignedOrders.findIndex(o => o._id === updated._id);
                if (assignedIdx !== -1) state.assignedOrders[assignedIdx] = updated;
                if (state.selectedOrder && state.selectedOrder._id === updated._id) state.selectedOrder = updated;
            })
            .addCase(updateOrderStatus.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "Failed to update order status.";
            })

            // --- Cancel User Order (unchanged) ---
            .addCase(cancelUserOrder.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(cancelUserOrder.fulfilled, (state, action: PayloadAction<Order>) => {
                state.loading = false;
                const updated = action.payload;
                const idx = state.orders.findIndex(o => o._id === updated._id);
                if (idx !== -1) state.orders[idx] = updated;
                const assignedIdx = state.assignedOrders.findIndex(o => o._id === updated._id);
                if (assignedIdx !== -1) state.assignedOrders[assignedIdx] = updated;
                if (state.selectedOrder && state.selectedOrder._id === updated._id) state.selectedOrder = updated;
            })
            .addCase(cancelUserOrder.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "Failed to cancel order.";
            })

            // --- Delete Order (unchanged) ---
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
                state.error = action.payload || "Failed to delete order.";
            })

            // --- Assign Delivery Boy (unchanged) ---
            .addCase(assignDeliveryBoy.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(assignDeliveryBoy.fulfilled, (state, action: PayloadAction<{ success: boolean; message: string; order: Order; }>) => {
                state.loading = false;
                const assignedOrder = action.payload.order;
                const mainOrderIdx = state.orders.findIndex(o => o._id === assignedOrder._id);
                if (mainOrderIdx !== -1) state.orders[mainOrderIdx] = assignedOrder;
                
                const assignedIdx = state.assignedOrders.findIndex(o => o._id === assignedOrder._id);
                if (assignedIdx === -1) {
                    state.assignedOrders.push(assignedOrder);
                } else {
                    state.assignedOrders[assignedIdx] = assignedOrder;
                }
                if (state.selectedOrder && state.selectedOrder._id === assignedOrder._id) state.selectedOrder = assignedOrder;
            })
            .addCase(assignDeliveryBoy.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "Failed to assign delivery boy.";
            })

            // --- Fetch Orders by Delivery Boy (unchanged) ---
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
                state.error = action.payload || "Failed to fetch assigned orders.";
            });
    },
});

export const { clearOrderStatus } = orderSlice.actions;
export default orderSlice.reducer;