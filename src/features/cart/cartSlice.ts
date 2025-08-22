// src/features/cart/cartSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import config from "../../config/config"; // Import your API configuration

const API_CART_URL = `${config.apiUrl}/cart`;

// --- Type Definitions for Cart ---
// Based on your Mongoose schemas and expected populated product data
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

// ➕ Add or update item in cart
export const addOrUpdateItem = createAsyncThunk<
  CartItem[], // Expected return type (the refreshed cart items)
  { productId: string; quantity: number; price: number; vendorId: string }, // Argument type for addOrUpdateItem
  { state: any; rejectValue: string } // ThunkAPI configuration
>(
  "cart/addOrUpdateItem",
  async (itemData, { dispatch, getState, rejectWithValue }) => {
    try {
      const token = getState().auth.user?.token;
      if (!token) {
        return rejectWithValue("Authentication required to add/update cart items.");
      }

      // Send productId and quantity to backend
      await axios.post(`${API_CART_URL}/items`, itemData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Re-fetch full cart after add/update to get latest state including populated product details
      const refreshedCartItems = await dispatch(fetchCart()).unwrap();
      return refreshedCartItems;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message;
      return rejectWithValue(errorMessage);
    }
  }
);

// ❌ Remove item from cart
export const removeItem = createAsyncThunk<
  CartItem[], // Expected return type (the refreshed cart items)
  string, // Argument type (productId to remove)
  { state: any; rejectValue: string } // ThunkAPI configuration
>(
  "cart/removeItem",
  async (productId, { dispatch, getState, rejectWithValue }) => {
    try {
      const token = getState().auth.user?.token;
      if (!token) {
        return rejectWithValue("Authentication required to remove cart items.");
      }

      await axios.delete(`${API_CART_URL}/items/${productId}`, {
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
    //   state.items = [];
    //   state.loading = false;
    //   state.error = null;
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
      // Note: We update state directly here, as `addOrUpdateItem` dispatches `fetchCart`
      // which will then update `state.items` in its fulfilled handler.
      // So, these reducers primarily handle loading/error states for the *initiation* of the add/update action.
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

      // Clear cart
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

export default cartSlice.reducer;