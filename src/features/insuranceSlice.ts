import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import AsyncStorage from "@react-native-async-storage/async-storage";
import appConfig from '../config/config';

// Use the API URL from your imported configuration file
const API_BASE_URL = `${appConfig.apiUrl}/products`;

// --- Type Definitions ---
// Define a type for a single insurance product, matching the Mongoose schema.
interface InsuranceProduct {
  _id: string;
  vendorId: string;
  name: string;
  description: string;
  mainImage: string;
  otherImages?: string[];
  icon: string;
  badgeText?: string;
  options?: {
    isNew: boolean;
    isAwardWinning: boolean;
    isPopular: boolean;
  };
  contactNumber: string;
  executiveContact?: {
    phoneNumber: string;
    pointOfContact: string;
  };
  categories?: {
    level1: { name: string };
    level2: { name: string };
    level3: { name: string };
  };
}

// Define the shape of your slice's state
interface InsuranceState {
  products: InsuranceProduct[];
  vendorProducts: InsuranceProduct[];
  currentProduct: InsuranceProduct | null;
  loading: boolean;
  error: string | null;
}

// Function to get the authentication token from AsyncStorage
const getToken = async (): Promise<string | null> => {
    try {
        const token = await AsyncStorage.getItem("vendorToken");
        return token;
    } catch (e) {
        console.error("Failed to get token from AsyncStorage", e);
        return null;
    }
};

// --- Async Thunks ---

// Fetch all public insurance products
export const fetchAllInsuranceProducts = createAsyncThunk<
  InsuranceProduct[],
  void,
  { rejectValue: string }
>(
  'insurance/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<{ products: InsuranceProduct[] }>(API_BASE_URL);
      return response.data.products;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      return rejectWithValue("Failed to fetch all insurance products.");
    }
  }
);

// Fetch a single insurance product by ID
export const fetchInsuranceProductById = createAsyncThunk<
  InsuranceProduct,
  string,
  { rejectValue: string }
>(
  'insurance/fetchById',
  async (productId, { rejectWithValue }) => {
    try {
      const response = await axios.get<{ product: InsuranceProduct }>(`${API_BASE_URL}/${productId}`);
      return response.data.product;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      return rejectWithValue("Failed to fetch insurance product.");
    }
  }
);

// Fetch all products for the authenticated vendor
export const fetchVendorInsuranceProducts = createAsyncThunk<
  InsuranceProduct[],
  void,
  { rejectValue: string }
>(
  'insurance/fetchVendorProducts',
  async (_, { rejectWithValue }) => {
    try {
      const token = await getToken();
      if (!token) {
        return rejectWithValue("Authentication token not found.");
      }
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      const response = await axios.get<{ products: InsuranceProduct[] }>(`${API_BASE_URL}/me`, config);
      return response.data.products;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      return rejectWithValue("Failed to fetch your insurance products.");
    }
  }
);

// Add a new insurance product (Vendor specific)
export const createInsuranceProduct = createAsyncThunk<
  InsuranceProduct,
  FormData,
  { rejectValue: string }
>(
  'insurance/createProduct',
  async (formData, { rejectWithValue }) => {
    try {
      const token = await getToken();
      if (!token) {
        return rejectWithValue("Authentication token not found.");
      }
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      };
      const response = await axios.post<{ product: InsuranceProduct }>(API_BASE_URL, formData, config);
      return response.data.product;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      return rejectWithValue("Failed to create insurance product.");
    }
  }
);

// Update an existing insurance product (Vendor specific)
export const updateInsuranceProduct = createAsyncThunk<
  InsuranceProduct,
  { id: string; formData: FormData },
  { rejectValue: string }
>(
  'insurance/updateProduct',
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const token = await getToken();
      if (!token) {
        return rejectWithValue("Authentication token not found.");
      }
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      };
      const response = await axios.put<{ product: InsuranceProduct }>(`${API_BASE_URL}/${id}`, formData, config);
      return response.data.product;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      return rejectWithValue("Failed to update insurance product.");
    }
  }
);

// Delete an insurance product (Vendor specific)
export const deleteInsuranceProduct = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>(
  'insurance/deleteProduct',
  async (productId, { rejectWithValue }) => {
    try {
      const token = await getToken();
      if (!token) {
        return rejectWithValue("Authentication token not found.");
      }
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
      await axios.delete(`${API_BASE_URL}/${productId}`, config);
      return productId;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return rejectWithValue(error.response.data.message);
      }
      return rejectWithValue("Failed to delete insurance product.");
    }
  }
);

// --- Initial State ---
const initialState: InsuranceState = {
  products: [],
  vendorProducts: [],
  currentProduct: null,
  loading: false,
  error: null,
};

// --- Slice Definition ---
const insuranceSlice = createSlice({
  name: "insurance",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetProductState: (state) => {
      state.products = [];
      state.vendorProducts = [];
      state.currentProduct = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- Handlers for fetchAllInsuranceProducts ---
      .addCase(fetchAllInsuranceProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllInsuranceProducts.fulfilled, (state, action: PayloadAction<InsuranceProduct[]>) => {
        state.loading = false;
        state.products = action.payload;
      })
      .addCase(fetchAllInsuranceProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // --- Handlers for fetchInsuranceProductById ---
      .addCase(fetchInsuranceProductById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInsuranceProductById.fulfilled, (state, action: PayloadAction<InsuranceProduct>) => {
        state.loading = false;
        state.currentProduct = action.payload;
      })
      .addCase(fetchInsuranceProductById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // --- Handlers for fetchVendorInsuranceProducts ---
      .addCase(fetchVendorInsuranceProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVendorInsuranceProducts.fulfilled, (state, action: PayloadAction<InsuranceProduct[]>) => {
        state.loading = false;
        state.vendorProducts = action.payload;
      })
      .addCase(fetchVendorInsuranceProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // --- Handlers for createInsuranceProduct ---
      .addCase(createInsuranceProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createInsuranceProduct.fulfilled, (state, action: PayloadAction<InsuranceProduct>) => {
        state.loading = false;
        state.vendorProducts.push(action.payload);
      })
      .addCase(createInsuranceProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // --- Handlers for updateInsuranceProduct ---
      .addCase(updateInsuranceProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateInsuranceProduct.fulfilled, (state, action: PayloadAction<InsuranceProduct>) => {
        state.loading = false;
        const updatedProduct = action.payload;
        const index = state.vendorProducts.findIndex(p => p._id === updatedProduct._id);
        if (index !== -1) {
          state.vendorProducts[index] = updatedProduct;
        }
      })
      .addCase(updateInsuranceProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // --- Handlers for deleteInsuranceProduct ---
      .addCase(deleteInsuranceProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteInsuranceProduct.fulfilled, (state, action: PayloadAction<string>) => {
        state.loading = false;
        const deletedId = action.payload;
        state.vendorProducts = state.vendorProducts.filter(p => p._id !== deletedId);
      })
      .addCase(deleteInsuranceProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, resetProductState } = insuranceSlice.actions;

export default insuranceSlice.reducer;