import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/user/authSlice";
import { vendorAuthReducer } from "../features/vendor/vendorAuthSlice";
import vendorOrderReducer from '../features/vendor/vendorOrderSlice';
import cartReducer from '../features/cart/cartSlice';
import orderReducer from '../features/orders/orderSlice';
import vendorProductReducer from "../features/vendor/vendorProductSlices";

// Correctly import the deliveryBoyAuthReducer (assuming it's the default export from deliveryBoyOrderSlice)
import deliveryBoyAuthReducer from '../features/deliveryBoy/deliveryBoyOrderSlice';
import locationReducer from "../features/locationSlice"; // <-- Add this line

export const store = configureStore({
  reducer: {
    auth: authReducer,
    vendorAuth: vendorAuthReducer,
    vendorOrders: vendorOrderReducer,
    vendorProducts: vendorProductReducer,
    cart: cartReducer,
    order: orderReducer,
    location: locationReducer, // <-- Add this line
    // Ensure the key here matches what you use in useSelector
    deliveryBoyAuth: deliveryBoyAuthReducer, // This is correct
  },
  // Middleware is added to avoid serialization errors with FormData (good practice)
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Define RootState and AppDispatch types for use throughout the app
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;