// src/userScreens/utils/api.ts
import axios from 'axios';
import config from '../../config/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: config.apiUrl,
});

function getStore(): any {
  try {
    return require('../../app/store').store;
  } catch {
    return null;
  }
}

let _switchingProfile = false;

export const setSwitchingProfile = (v: boolean) => {
  _switchingProfile = !!v;
  console.log(`[API] switching profile flag = ${_switchingProfile}`);
};

export const isSwitchingProfile = () => _switchingProfile;

async function resolveActiveToken(): Promise<{
  token: string | null;
  role: string;
}> {
  const store = getStore();
  const state = store ? store.getState() : null;
  const activeRole = state?.session?.activeRole ?? 'user';

  if (activeRole === 'admin') {
    const t = await SecureStore.getItemAsync('adminToken').catch(() => null);
    if (t && t !== 'null') return { token: t, role: 'admin' };
    return { token: null, role: 'admin' };
  }

  if (activeRole === 'deliveryBoy') {
    const t = await SecureStore.getItemAsync('deliveryBoyToken').catch(
      () => null
    );
    if (t && t !== 'null') return { token: t, role: 'deliveryBoy' };
    return { token: null, role: 'deliveryBoy' };
  }

  if (activeRole === 'vendor') {
    const raw = await AsyncStorage.getItem('vendorToken');
    const diskToken = raw && raw !== 'null' ? raw : null;
    if (diskToken) return { token: diskToken, role: 'vendor' };

    const reduxToken = state?.vendorAuth?.token ?? null;
    if (reduxToken && reduxToken !== 'null') {
      return { token: reduxToken, role: 'vendor' };
    }
    return { token: null, role: 'vendor' };
  }

  const raw = await AsyncStorage.getItem('token');
  const diskToken = raw && raw !== 'null' ? raw : null;
  if (diskToken) return { token: diskToken, role: 'user' };

  const reduxToken = state?.auth?.user?.token ?? null;
  if (reduxToken && reduxToken !== 'null') {
    return { token: reduxToken, role: 'user' };
  }
  return { token: null, role: 'user' };
}

api.interceptors.request.use(
  async (requestConfig) => {
    const { token, role } = await resolveActiveToken();
    const url = requestConfig.url || '';

    if (token) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
      console.log(
        `API Interceptor: Authorization header set for role '${role}' (url=${url}).`
      );
    } else {
      console.log(
        `API Interceptor: No token found for role '${role}' (url=${url}).`
      );
    }

    if (!(requestConfig.data instanceof FormData)) {
      requestConfig.headers['Content-Type'] = 'application/json';
    }

    return requestConfig;
  },
  (error) => Promise.reject(error)
);

let _recent401: { token: string; at: number } = { token: '', at: 0 };
const CONFIRM_WINDOW_MS = 5000;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const store = getStore();
      const state = store ? store.getState() : null;
      const activeRole = state?.session?.activeRole ?? 'user';

      const sentAuth: string = originalRequest?.headers?.Authorization || '';
      const sentToken = sentAuth.startsWith('Bearer ')
        ? sentAuth.slice(7)
        : '';

      // ✅ Never clear session during a profile switch.
      if (_switchingProfile) {
        console.warn(
          `API Interceptor: 401 on '${originalRequest?.url}' during profile switch — suppressing session clear for '${activeRole}'.`
        );
        return Promise.reject(error);
      }

      if (!sentToken) {
        console.warn(
          `API Interceptor: 401 on '${originalRequest?.url}' but no token was sent — NOT clearing session.`
        );
        return Promise.reject(error);
      }

      let currentStored: string | null = null;
      if (activeRole === 'vendor') {
        currentStored = await AsyncStorage.getItem('vendorToken');
      } else if (activeRole === 'user') {
        currentStored = await AsyncStorage.getItem('token');
      }

      if (activeRole !== 'admin' && activeRole !== 'deliveryBoy') {
        if (!currentStored || currentStored !== sentToken) {
          console.warn(
            `API Interceptor: 401 on '${originalRequest?.url}' but stored token differs from sent token — NOT clearing session.`
          );
          return Promise.reject(error);
        }
      }

      const now = Date.now();
      const withinWindow =
        _recent401.token === sentToken &&
        now - _recent401.at < CONFIRM_WINDOW_MS;

      if (!withinWindow) {
        _recent401 = { token: sentToken, at: now };
        console.warn(
          `API Interceptor: first 401 on '${originalRequest?.url}' — waiting to confirm before clearing '${activeRole}'.`
        );
        return Promise.reject(error);
      }

      _recent401 = { token: '', at: 0 };
      console.warn(
        `API Interceptor: second 401 on '${originalRequest?.url}' — clearing '${activeRole}' session.`
      );

      try {
        if (activeRole === 'vendor') {
          await AsyncStorage.removeItem('vendorToken');
          await AsyncStorage.removeItem('vendor');
          const clearVendor = require('../../features/vendor/vendorAuthSlice')
            .clearVendor;
          if (typeof clearVendor === 'function')
            store?.dispatch(clearVendor());
        } else if (activeRole === 'user') {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          const authModule = require('../../features/user/authSlice');
          const clearUser = authModule.clearUser || authModule.setUser;
          if (typeof clearUser === 'function') {
            store?.dispatch(clearUser(null));
          }
        } else if (activeRole === 'admin') {
          await SecureStore.deleteItemAsync('adminToken');
        } else if (activeRole === 'deliveryBoy') {
          await SecureStore.deleteItemAsync('deliveryBoyToken');
          await AsyncStorage.removeItem('deliveryBoy');
        }
      } catch (e) {
        console.warn('Failed to clear active role session on 401:', e);
      }
    } else if (error.response) {
      console.error(
        'API Interceptor Response Error:',
        error.response.status,
        error.response.data
      );
    } else {
      console.error('API Interceptor Network Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;