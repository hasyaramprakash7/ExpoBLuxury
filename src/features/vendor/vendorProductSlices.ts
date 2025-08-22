import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import config from "../../config/config";

const API_BASE = `${config.apiUrl}/vendor-products`;

// --- Type Definitions ---
interface Product {
  _id: string;
  name: string;
  description: string;
  brandName?: string; // Correctly named to match schema
  price: number;
  discountedPrice?: number;
  discountPercent?: number;
  category: string;
  stock: number;
  isAvailable: boolean;
  images: { url: string }[];
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
  vendorId: string;
  vendor?: {
    _id: string;
    shopName: string;
    isOnline: boolean;
  };
}

interface VendorProductState {
  myProducts: Product[];
  allProducts: Product[];
  loading: boolean;
  error: string | null;
}

// --- Async Thunks ---
export const fetchMyProducts = createAsyncThunk<Product[], void, { rejectValue: string }>(
  "vendorProducts/fetchMyProducts",
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem("vendorToken");
      const res = await axios.get(`${API_BASE}/my-products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.products;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchAllVendorProducts = createAsyncThunk<Product[], void, { rejectValue: string }>(
  "vendorProducts/fetchAllVendorProducts",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${API_BASE}/all`);
      return res.data.products;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const addProduct = createAsyncThunk<Product, FormData, { rejectValue: string }>(
  "vendorProducts/addProduct",
  async (formData, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem("vendorToken");
      const res = await axios.post(`${API_BASE}/add`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data.product;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const updateProduct = createAsyncThunk<Product, { id: string; formData: FormData }, { rejectValue: string }>(
  "vendorProducts/updateProduct",
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem("vendorToken");
      const res = await axios.put(`${API_BASE}/update/${id}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data.product;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const deleteProduct = createAsyncThunk<string, string, { rejectValue: string }>(
  "vendorProducts/deleteProduct",
  async (id, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem("vendorToken");
      await axios.delete(`${API_BASE}/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// --- Redux Slice ---
const initialState: VendorProductState = {
  myProducts: [],
  allProducts: [],
  loading: false,
  error: null,
};

const vendorProductSlice = createSlice({
  name: "vendorProducts",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMyProducts: (state) => {
      state.myProducts = [];
    },
    clearAllProducts: (state) => {
      state.allProducts = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyProducts.pending, (state) => {
        state.loading = true; state.error = null;
      })
      .addCase(fetchMyProducts.fulfilled, (state, action) => {
        state.myProducts = action.payload; state.loading = false;
      })
      .addCase(fetchMyProducts.rejected, (state, action) => {
        state.loading = false; state.error = action.payload ?? "Failed to fetch products";
      })
      .addCase(fetchAllVendorProducts.pending, (state) => {
        state.loading = true; state.error = null;
      })
      .addCase(fetchAllVendorProducts.fulfilled, (state, action) => {
        state.allProducts = action.payload; state.loading = false;
      })
      .addCase(fetchAllVendorProducts.rejected, (state, action) => {
        state.loading = false; state.error = action.payload ?? "Failed to fetch all products";
      })
      .addCase(addProduct.pending, (state) => {
        state.loading = true;
      })
      .addCase(addProduct.fulfilled, (state, action) => {
        state.myProducts.unshift(action.payload);
        state.allProducts.unshift(action.payload);
        state.loading = false;
      })
      .addCase(addProduct.rejected, (state, action) => {
        state.loading = false; state.error = action.payload ?? "Failed to add product";
      })
      .addCase(updateProduct.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        const updatedProduct = action.payload;
        let myIndex = state.myProducts.findIndex((p) => p._id === updatedProduct._id);
        if (myIndex !== -1) state.myProducts[myIndex] = updatedProduct;
        let allIndex = state.allProducts.findIndex((p) => p._id === updatedProduct._id);
        if (allIndex !== -1) state.allProducts[allIndex] = updatedProduct;
        state.loading = false;
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.loading = false; state.error = action.payload ?? "Failed to update product";
      })
      .addCase(deleteProduct.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        const deletedId = action.payload;
        state.myProducts = state.myProducts.filter((p) => p._id !== deletedId);
        state.allProducts = state.allProducts.filter((p) => p._id !== deletedId);
        state.loading = false;
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.loading = false; state.error = action.payload ?? "Failed to delete product";
      });
  },
});

export const { clearError, clearMyProducts, clearAllProducts } = vendorProductSlice.actions;
export default vendorProductSlice.reducer;