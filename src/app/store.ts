// src/app/store.ts
import { configureStore, combineReducers, createSlice } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import authReducer from '../features/user/authSlice';
import {
  vendorAuthReducer,
  rehydrateVendorAuth,
} from '../features/vendor/vendorAuthSlice';
import { vendorFollowerReducer } from '../features/vendor/vendorFollowerSlice';
import vendorOrderReducer from '../features/vendor/vendorOrderSlice';
import cartReducer from '../features/cart/cartSlice';
import chatReducer from '../features/chat/chatSlice';
import orderReducer from '../features/orders/orderSlice';
import vendorProductReducer from '../features/vendor/vendorProductSlices';
import deliveryBoyAuthReducer from '../features/deliveryBoy/deliveryBoyOrderSlice';
import locationReducer from '../features/locationSlice';
import insuranceReducer from '../features/insuranceSlice';
import appointmentReducer from '../features/appointmentSlice';
import propertyReducer from '../features/propertySlice';
import rentalReducer from '../features/rentalSlice';
import productViewReducer from '../features/productViewSlice';

import categoryReducer from '../features/categorySlice';
import reviewReducer from '../features/reviewSlice';
import leadReducer from '../features/leadSlice';
import adReducer, { setActiveRoleForAds } from '../features/adSlice';

import sessionReducer from '../features/session/sessionSlice';

interface BootstrapState {
  hydrated: boolean;
}

const initialBootstrapState: BootstrapState = {
  hydrated: false,
};

const bootstrapSlice = createSlice({
  name: 'bootstrap',
  initialState: initialBootstrapState,
  reducers: {
    setHydrated: (state, action: { payload: boolean; type: string }) => {
      state.hydrated = action.payload;
    },
  },
});

export const { setHydrated } = bootstrapSlice.actions;
const bootstrapReducer = bootstrapSlice.reducer;

const rootReducer = combineReducers({
  bootstrap: bootstrapReducer,
  session: sessionReducer,
  auth: authReducer,
  vendorAuth: vendorAuthReducer,
  vendorFollower: vendorFollowerReducer,
  vendorOrders: vendorOrderReducer,
  vendorProducts: vendorProductReducer,
  cart: cartReducer,
  chat: chatReducer,
  order: orderReducer,
  location: locationReducer,
  insurance: insuranceReducer,
  appointments: appointmentReducer,
  property: propertyReducer,
  deliveryBoyAuth: deliveryBoyAuthReducer,
  rental: rentalReducer,
  productViews: productViewReducer,
  categories: categoryReducer,
  reviews: reviewReducer,
  leads: leadReducer,
  ads: adReducer,
});

const persistConfig = {
  key: 'root',
  version: 3,
  storage: AsyncStorage,
  whitelist: [
    'session',
    'auth',
    'vendorAuth',
    'chat',
    'cart',
    'vendorProducts',
    'vendorOrders',
    'order',
    'property',
    'rental',
    'location',
    'insurance',
    'appointments',
    'deliveryBoyAuth',
    'productViews',
    'categories',
    'reviews',
    // ads is intentionally NOT persisted — it holds volatile feed/profile data
  ],
  blacklist: ['bootstrap', 'vendorFollower', 'ads'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // ✅ Perf: turn off the dev-only invariants. They walk the entire
      //    Redux tree on every action and are slow with large lists
      //    (ads feed, conversations, stories, messages, resolvedIdentities).
      //    No effect on production builds — they're dev-only anyway.
      serializableCheck: false,
      immutableCheck: false,
    }),
  devTools: __DEV__,
});

export const persistor = persistStore(store, null, async () => {
  store.dispatch(setHydrated(true));

  store.dispatch(rehydrateVendorAuth()).catch((e) => {
    console.warn('[store] rehydrateVendorAuth failed:', e);
  });

  try {
    const state: any = store.getState();
    const reduxVendorToken = state?.vendorAuth?.token ?? null;
    const reduxVendor = state?.vendorAuth?.vendor ?? null;
    const reduxUserToken = state?.auth?.user?.token ?? null;
    const reduxUser = state?.auth?.user ?? null;

    const [diskVendorToken, diskVendor, diskUserToken, diskUser] =
      await Promise.all([
        AsyncStorage.getItem('vendorToken'),
        AsyncStorage.getItem('vendor'),
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('user'),
      ]);

    if (reduxVendorToken && (!diskVendorToken || diskVendorToken === 'null')) {
      await AsyncStorage.setItem('vendorToken', reduxVendorToken);
      console.log('[store] ✅ restored vendorToken from persist:root');
    }
    if (reduxVendor && (!diskVendor || diskVendor === 'null')) {
      await AsyncStorage.setItem('vendor', JSON.stringify(reduxVendor));
      console.log('[store] ✅ restored vendor object from persist:root');
    }
    if (reduxUserToken && (!diskUserToken || diskUserToken === 'null')) {
      await AsyncStorage.setItem('token', reduxUserToken);
      console.log('[store] ✅ restored user token from persist:root');
    }
    if (reduxUser && (!diskUser || diskUser === 'null')) {
      await AsyncStorage.setItem('user', JSON.stringify(reduxUser));
      console.log('[store] ✅ restored user object from persist:root');
    }
  } catch (e) {
    console.warn('[store] ❌ standalone key repair failed:', e);
  }

  // ✅ Initial sync: make sure adSlice knows the current active role
  try {
    const initialRole = store.getState()?.session?.activeRole ?? null;
    setActiveRoleForAds(initialRole);
    console.log('[store] adSlice activeRole initialized →', initialRole);
  } catch (e) {
    console.warn('[store] initial adSlice role sync failed:', e);
  }

  try {
    const role = store.getState()?.session?.activeRole ?? null;
    if (role) {
      AsyncStorage.setItem('activeRole', role).catch(() => {});
    }
  } catch {}
});

let _lastRole: string | null = null;

store.subscribe(() => {
  try {
    const state: any = store.getState();
    const role: string | null = state?.session?.activeRole ?? null;

    if (role !== _lastRole) {
      const previous = _lastRole;
      _lastRole = role;

      // ✅ CRITICAL: propagate the role to adSlice so every thunk
      //    sends the correct Bearer token.
      try {
        setActiveRoleForAds(role);
      } catch (e) {
        console.warn('[store] setActiveRoleForAds failed:', e);
      }

      if (role) {
        AsyncStorage.setItem('activeRole', role).catch(() => {});
      } else {
        AsyncStorage.removeItem('activeRole').catch(() => {});
      }

      console.log(
        `[Store] activeRole synced → ${role} (was ${previous ?? 'null'})`
      );
    }
  } catch {}
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;