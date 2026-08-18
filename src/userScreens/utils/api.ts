import axios from 'axios';
import config from '../../config/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: config.apiUrl,
  // ✅ REMOVE global Content-Type – we set it conditionally in the interceptor
});

// Request Interceptor
api.interceptors.request.use(
  async (config) => {
    let token: string | null = null;
    let role = '';

    // (your token retrieval logic – unchanged)
    try {
      token = await SecureStore.getItemAsync("adminToken");
      if (token) role = 'admin';
    } catch (e) { /* ... */ }

    if (!token) {
      try {
        token = await AsyncStorage.getItem("vendorToken");
        if (token) role = 'vendor';
      } catch (e) { /* ... */ }
    }

    if (!token) {
      try {
        token = await AsyncStorage.getItem("deliveryBoyToken");
        if (token) role = 'deliveryBoy';
      } catch (e) { /* ... */ }
    }

    if (!token) {
      try {
        token = await AsyncStorage.getItem("token");
        if (token) role = 'user';
      } catch (e) { /* ... */ }
    }

    if (token && token !== "null") {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`API Interceptor: Authorization header set for role '${role}'.`);
    } else {
      console.log("API Interceptor: No valid token found.");
    }

    // ✅ CRITICAL FIX: Only set Content-Type for non-FormData requests
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }
    // If it's FormData, the browser/RN will set the correct multipart boundary automatically.

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor (unchanged)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.warn("API Interceptor: Token expired or invalid (401).");
      await AsyncStorage.removeItem("vendorToken");
      await AsyncStorage.removeItem("vendor");
      await AsyncStorage.removeItem("deliveryBoyToken");
      await AsyncStorage.removeItem("deliveryBoy");
      await SecureStore.deleteItemAsync("adminToken");
      await AsyncStorage.removeItem("token");
    } else if (error.response) {
      console.error("API Interceptor Response Error:", error.response.status, error.response.data);
    } else {
      console.error("API Interceptor Network Error:", error.message);
    }
    return Promise.reject(error);
  }
);

export default api;