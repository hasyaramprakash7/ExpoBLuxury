// src/app/store.ts
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";

import authReducer from "../features/user/authSlice";
import { vendorAuthReducer } from "../features/vendor/vendorAuthSlice";
import vendorOrderReducer from '../features/vendor/vendorOrderSlice';
import cartReducer from '../features/cart/cartSlice';
import chatReducer from '../features/chat/chatSlice';
import orderReducer from '../features/orders/orderSlice';
import vendorProductReducer from "../features/vendor/vendorProductSlices";
import deliveryBoyAuthReducer from '../features/deliveryBoy/deliveryBoyOrderSlice';
import locationReducer from "../features/locationSlice";
import insuranceReducer from "../features/insuranceSlice";
import appointmentReducer from '../features/appointmentSlice';
import propertyReducer from '../features/propertySlice';
import rentalReducer from '../features/rentalSlice';
import productViewReducer from '../features/productViewSlice';

// ========== NEW SLICES ==========
import categoryReducer from '../features/categorySlice';
import reviewReducer from '../features/reviewSlice';
import leadReducer from '../features/leadSlice';
import adReducer from '../features/adSlice';

// 1. Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  vendorAuth: vendorAuthReducer,
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

  // ========== NEW REDUCERS ==========
  categories: categoryReducer,
  reviews: reviewReducer,
  leads: leadReducer,
  ads: adReducer,
});

// 2. Configure Redux Persist
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: [
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
    // ========== PERSIST NEW DATA ==========
    'categories',
    'reviews',   // cache reviews for offline viewing
    'leads',     // vendor leads cache
    'ads',       // banner ads cache
  ],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// 3. Create Store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;