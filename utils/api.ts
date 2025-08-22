import axios from 'axios';
import config from '../src/config/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Create an Axios instance with the base URL from the config
const api = axios.create({
    baseURL: config.apiUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Add Authorization header if a token is found
api.interceptors.request.use(
    async (config) => {
        let token: string | null = null;
        let role = '';

        // 1. Prioritize adminToken from SecureStore
        try {
            token = await SecureStore.getItemAsync("adminToken");
            if (token) role = 'admin';
        } catch (e) {
            console.error("API Interceptor: Error getting adminToken from SecureStore:", e);
        }

        // 2. If no adminToken, try vendorToken from AsyncStorage
        if (!token) {
            try {
                token = await AsyncStorage.getItem("vendorToken");
                if (token) role = 'vendor';
            } catch (e) {
                console.error("API Interceptor: Error getting vendorToken from AsyncStorage:", e);
            }
        }

        // 3. If no vendorToken, try deliveryBoyToken from AsyncStorage
        if (!token) {
            try {
                token = await AsyncStorage.getItem("deliveryBoyToken");
                if (token) role = 'deliveryBoy';
            } catch (e) {
                console.error("API Interceptor: Error getting deliveryBoyToken from AsyncStorage:", e);
            }
        }
        
        // 4. Fallback to regular user token if no specific role token found
        if (!token) {
            try {
                token = await AsyncStorage.getItem("token");
                if (token) role = 'user';
            } catch (e) {
                console.error("API Interceptor: Error getting user token from AsyncStorage:", e);
            }
        }


        // If a valid token is found, set the Authorization header
        if (token && token !== "null") {
            config.headers.Authorization = `Bearer ${token}`;
            // A concise log to confirm the token is being applied
            console.log(`API Interceptor: Authorization header set for role '${role}'.`);
        } else {
            console.log("API Interceptor: No valid token found, Authorization header NOT set.");
        }

        return config;
    },
    (error) => {
        console.error("API Interceptor Request Error:", error);
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle 401 Unauthorized responses (e.g., token expiry)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            console.warn("API Interceptor: Token expired or invalid (401), attempting to clear tokens.");

            // Clear all potential tokens from storage
            await AsyncStorage.removeItem("vendorToken");
            await AsyncStorage.removeItem("vendor");
            await AsyncStorage.removeItem("deliveryBoyToken");
            await AsyncStorage.removeItem("deliveryBoy");
            await SecureStore.deleteItemAsync("adminToken");
            await AsyncStorage.removeItem("token");
            
            // You might also want to clear any corresponding user state in your Redux store.
        } else if (error.response) {
            console.error("API Interceptor Response Error:", error.response.status, error.response.data);
        } else {
            console.error("API Interceptor Network Error:", error.message);
        }
        return Promise.reject(error);
    }
);

export default api;