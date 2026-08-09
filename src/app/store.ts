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

// --- NEW IMPORT ---
// import browserReducer from "../features/browserSlice"; 

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

  // browser: browserReducer, 
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
    "rental",
    // 'browser',
    // 🔥 ADDED THE MISSING REDUCERS TO SAVE EVERYTHING OFFLINE 🔥
    'location', // 🔥 ADD LOCATION BACK HERE SO IT SAVES OFFLINE!
    'insurance',
    'appointments',
    'deliveryBoyAuth',
    "productViews"

  ], 
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// 3. Create Store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Disables warnings for redux-persist
      immutableCheck: false,    // Fixes the 44ms state invariant warning
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;