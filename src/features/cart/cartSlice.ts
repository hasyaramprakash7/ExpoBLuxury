// src/features/cart/cartSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import config from "../../config/config"; // Import your API configuration

const API_CART_URL = `${config.apiUrl}/cart`;

// --- Type Definitions for Cart ---
interface ProductInCart {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountedPrice?: number;
  discountPercent?: number;
  category?: string;
  images?: string[];
  stock: number;
  isAvailable: boolean;
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
  vendorId: string; // Ensure this is present and correct
}

export interface CartItem {
  productId: string; // Stored as ObjectId string
  quantity: number;
  price: number; // Price at the time of adding to cart
  vendorId: string; // Stored as ObjectId string
  _id?: string; // Mongoose will add this
  // When populated from backend, productId will be a full object
  product?: ProductInCart; // The populated product data
}

interface CartState {
  items: CartItem[];
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: CartState = {
  items: [],
  loading: false,
  error: null,
};

// --- Async Thunks ---

// 📦 Fetch user's cart
export const fetchCart = createAsyncThunk<CartItem[], void, { state: any; rejectValue: string }>(
  "cart/fetchCart",
  async (_, { getState, rejectWithValue }) => {
    try {
      // Assuming your RootState has an 'auth' slice with a 'user' object and 'token'
      const token = getState().auth.user?.token;

      if (!token) {
        // If no token, return an empty array and don't make an API call
        return [];
      }

      const res = await axios.get(`${API_CART_URL}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // The backend returns { success: true, items: [...] }
      return res.data.items as CartItem[];
    } catch (err: any) {
      if (err.response && err.response.status === 401) {
        // Handle unauthorized: e.g., dispatch a logout action here
        console.error("Authentication expired or invalid. Please log in again.");
        // Example: dispatch(logoutUser()); // You'd need to import logoutUser from your auth slice
        return rejectWithValue("Authentication required. Please log in.");
      }
      const errorMessage = err.response?.data?.message || err.message;
      return rejectWithValue(errorMessage);
    }
  }
);
// src/features/cart/cartSlice.ts

// ... (keep imports and initial state)

export const removeItem = createAsyncThunk<
  CartItem[],
  { productId: string; size?: string }, // 🔑 Change 1: Accept an object
  { state: any; rejectValue: string }
>(
  "cart/removeItem",
  async ({ productId, size }, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.user?.token;
      if (!token) return rejectWithValue("Authentication required.");

      // 🔑 Change 2: Pass size as a 'param' so it appears as ?size= in the URL
      const res = await axios.delete(`${API_CART_URL}/items/${productId}`, {
        params: { size }, 
        headers: { Authorization: `Bearer ${token}` },
      });

      // The backend already returns the updated items list
      return res.data.items as CartItem[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// Update addOrUpdateItem to accept size properly as well
export const addOrUpdateItem = createAsyncThunk<
  CartItem[],
  { productId: string; quantity: number; size?: string; price: number; vendorId: string },
  { state: any; rejectValue: string }
>(
  "cart/addOrUpdateItem",
  async (itemData, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.user?.token;
      const res = await axios.post(`${API_CART_URL}/items`, itemData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.items as CartItem[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// 🛒 NEW: Remove all items belonging to a single vendor
export const clearCartByVendor = createAsyncThunk<
  CartItem[], // Expected return type (the refreshed cart items)
  string, // Argument type (vendorId to remove)
  { state: any; rejectValue: string } // ThunkAPI configuration
>(
  "cart/clearCartByVendor",
  async (vendorId, { dispatch, getState, rejectWithValue }) => {
    try {
      const token = getState().auth.user?.token;
      if (!token) {
        return rejectWithValue("Authentication required to remove vendor items.");
      }

      // Assuming your backend has an endpoint to delete items by vendor ID
      await axios.delete(`${API_CART_URL}/vendor/${vendorId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Re-fetch full cart after removal
      const refreshedCartItems = await dispatch(fetchCart()).unwrap();
      return refreshedCartItems;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message;
      return rejectWithValue(errorMessage);
    }
  }
);

// 🧹 Clear entire cart
export const clearCart = createAsyncThunk<
  CartItem[], // Expected return type (should be empty array)
  void, // No arguments for clearCart
  { state: any; rejectValue: string }
>(
  "cart/clearCart",
  async (_, { dispatch, getState, rejectWithValue }) => {
    try {
      const token = getState().auth.user?.token;
      if (!token) {
        return rejectWithValue("Authentication required to clear cart.");
      }

      await axios.delete(`${API_CART_URL}/clear`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Re-fetch to ensure the cart is truly empty from the backend perspective
      const refreshedCartItems = await dispatch(fetchCart()).unwrap();
      return refreshedCartItems; // This should be []
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message;
      return rejectWithValue(errorMessage);
    }
  }
);

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    // You might add a reducer here to clear cart items on logout if authSlice doesn't handle it
    // For example:
    // clearCartOnLogout: (state) => {
    //   state.items = [];
    //   state.loading = false;
    //   state.error = null;
    // }
  },
  extraReducers: (builder) => {
    builder
      // Fetch cart
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCart.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch cart.";
        state.items = []; // Clear items on rejection (e.g., unauthorized)
      })

      // Add or Update item
      .addCase(addOrUpdateItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addOrUpdateItem.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.loading = false;
        state.items = action.payload; // Payload is the refreshed cart from fetchCart
      })
      .addCase(addOrUpdateItem.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || "Failed to add/update item.";
      })

      // Remove item
      .addCase(removeItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeItem.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.loading = false;
        state.items = action.payload; // Payload is the refreshed cart from fetchCart
      })
      .addCase(removeItem.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || "Failed to remove item.";
      })
      
      // NEW: Clear Cart By Vendor
      .addCase(clearCartByVendor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(clearCartByVendor.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.loading = false;
        state.items = action.payload; // Payload is the refreshed cart from fetchCart
      })
      .addCase(clearCartByVendor.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || "Failed to remove items for vendor.";
      })


      // Clear entire cart
      .addCase(clearCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(clearCart.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.loading = false;
        state.items = action.payload; // Payload is the refreshed cart from fetchCart (should be empty)
      })
      .addCase(clearCart.rejected, (state, action: PayloadAction<string | undefined>) => {
        state.loading = false;
        state.error = action.payload || "Failed to clear cart.";
      });
  },
});

export const { } = cartSlice.actions; // Export any normal reducers if you add them later
export default cartSlice.reducer;