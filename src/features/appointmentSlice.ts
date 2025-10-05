import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import AsyncStorage from "@react-native-async-storage/async-storage";
import appConfig from '../config/config';
import { RootState } from '../app/store'; // Import RootState to access other slices

// Use the API URL from your imported configuration file
const API_BASE_URL = `${appConfig.apiUrl}/appointments`;

// --- Type Definitions ---
interface Appointment {
    _id: string;
    userId: string;
    vendorId: string;
    insuranceProductId: string;
    status: 'scheduled' | 'completed' | 'cancelled';
    createdAt: string;
    // These are populated fields from your backend
    vendorId?: { name: string; };
    insuranceProductId?: { name: string; mainImage: string; description: string; };
    userId?: {
        name?: string;
        email?: string;
        phone?: string;
        address?: {
            pincode?: string;
            district?: string;
            state?: string;
            country?: string;
        };
    };
}

interface BookAppointmentPayload {
    userId: string;
    vendorId: string;
    insuranceProductId: string;
}

interface AppointmentsState {
    userAppointments: Appointment[];
    vendorAppointments: Appointment[];
    loading: boolean;
    error: string | null;
}

// --- Async Thunks ---
// Thunk to book a new appointment.
export const bookNewAppointment = createAsyncThunk<
    Appointment,
    BookAppointmentPayload,
    { state: RootState, rejectValue: string }
>(
    'appointments/book',
    async (appointmentData, { getState, rejectWithValue }) => {
        try {
            const token = getState().auth.user?.token;
            if (!token) {
                return rejectWithValue("Authentication token not found.");
            }
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            };
            const response = await axios.post<Appointment>(`${API_BASE_URL}`, appointmentData, config);
            return response.data;
        } catch (error) {
            return rejectWithValue(axios.isAxiosError(error) && error.response?.data?.message
                ? error.response.data.message
                : "Failed to book appointment.");
        }
    }
);

// Thunk to fetch a user's appointments.
export const fetchUserAppointments = createAsyncThunk<
    Appointment[],
    void, // No argument needed as we get user ID from state
    { state: RootState, rejectValue: string }
>(
    'appointments/fetchUserAppointments',
    async (_, { getState, rejectWithValue }) => {
        try {
            // Retrieve token and userId directly from the Redux state
            const token = getState().auth.user?.token;
            const userId = getState().auth.user?._id;

            if (!token) {
                return rejectWithValue("Authentication token not found.");
            }
            if (!userId) {
                return rejectWithValue("User ID not found in state.");
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            };
            const response = await axios.get<Appointment[]>(`${API_BASE_URL}/user/${userId}`, config);
            return response.data;
        } catch (error) {
            return rejectWithValue(axios.isAxiosError(error) && error.response?.data?.message
                ? error.response.data.message
                : "Failed to fetch user appointments.");
        }
    }
);

// Thunk to fetch a vendor's appointments.
export const fetchVendorAppointments = createAsyncThunk<
    Appointment[],
    void, // No argument needed as we get vendor ID from state
    { state: RootState, rejectValue: string }
>(
    'appointments/fetchVendorAppointments',
    async (_, { getState, rejectWithValue }) => {
        try {
            const token = getState().vendorAuth.token;
            const vendorId = getState().vendorAuth.vendor?._id;
            
            if (!token || !vendorId) {
                return rejectWithValue("Authentication token or vendor ID not found.");
            }
            
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            };
            const response = await axios.get<Appointment[]>(`${API_BASE_URL}/vendor/${vendorId}`, config);
            return response.data;
        } catch (error) {
            return rejectWithValue(axios.isAxiosError(error) && error.response?.data?.message
                ? error.response.data.message
                : "Failed to fetch vendor appointments.");
        }
    }
);

// --- Initial State ---
const initialState: AppointmentsState = {
    userAppointments: [],
    vendorAppointments: [],
    loading: false,
    error: null,
};

// --- Slice Definition ---
const appointmentSlice = createSlice({
    name: "appointments",
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Handle bookNewAppointment
            .addCase(bookNewAppointment.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(bookNewAppointment.fulfilled, (state, action: PayloadAction<Appointment>) => {
                state.loading = false;
                state.userAppointments.push(action.payload);
            })
            .addCase(bookNewAppointment.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "Failed to book appointment.";
            })
            // Handle fetchUserAppointments
            .addCase(fetchUserAppointments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUserAppointments.fulfilled, (state, action: PayloadAction<Appointment[]>) => {
                state.loading = false;
                state.userAppointments = action.payload;
            })
            .addCase(fetchUserAppointments.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "Failed to fetch user appointments.";
            })
            // Handle fetchVendorAppointments
            .addCase(fetchVendorAppointments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchVendorAppointments.fulfilled, (state, action: PayloadAction<Appointment[]>) => {
                state.loading = false;
                state.vendorAppointments = action.payload;
            })
            .addCase(fetchVendorAppointments.rejected, (state, action: PayloadAction<string | undefined>) => {
                state.loading = false;
                state.error = action.payload || "Failed to fetch vendor appointments.";
            });
    },
});

export const { clearError } = appointmentSlice.actions;
export default appointmentSlice.reducer;