import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/user/authSlice";
import { vendorAuthReducer } from "../features/vendor/vendorAuthSlice";
import vendorOrderReducer from '../features/vendor/vendorOrderSlice';
import cartReducer from '../features/cart/cartSlice';
import orderReducer from '../features/orders/orderSlice';
import vendorProductReducer from "../features/vendor/vendorProductSlices";
import deliveryBoyAuthReducer from '../features/deliveryBoy/deliveryBoyOrderSlice';
import locationReducer from "../features/locationSlice";
import insuranceReducer from "../features/insuranceSlice"; // <-- New import for the insurance slice
import appointmentReducer from '../features/appointmentSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    vendorAuth: vendorAuthReducer,
    vendorOrders: vendorOrderReducer,
    vendorProducts: vendorProductReducer,
    cart: cartReducer,
    order: orderReducer,
    location: locationReducer,
    deliveryBoyAuth: deliveryBoyAuthReducer,
    insurance: insuranceReducer, // <-- Added the new reducer here
        appointments: appointmentReducer,

  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;