// FILE: src/navigation/navigationRef.ts
import { createNavigationContainerRef, NavigatorScreenParams } from "@react-navigation/native";

interface Product {
  _id: string;
  name: string;
  price: number;
  discountedPrice?: number;
}

interface Order {
  _id: string;
  status: string;
  items: Array<any>;
  user: { name?: string };
  address: any;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  deliveryBoy?: any;
}

interface Vendor {
  _id: string;
  shopName: string;
  address?: any;
}

export type BottomTabParamList = {
  Home: undefined;
  Gift: undefined;
  Order: undefined;
  Pay: undefined;
  Search: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  VendorLogin: undefined;
  SignupVendor: undefined;
  VendorDashboard: undefined;
  VendorProductCRUD: undefined;
  VendorChatScreen: { sharedData?: any } | undefined;
  VendorOrderList: undefined;
  ActiveDeliveryBoys: { orderId: string };
  UserTabs: NavigatorScreenParams<BottomTabParamList>;
  Profile: undefined;
  ProductDetails: { product: Product };
  OrderScreen: undefined;
  UserOrderScreen: undefined;
  CartScreen: undefined;
  DeliveryBoyLogin: undefined;
  DeliveryBoySignup: undefined;
  DeliveryBoyDashboard: undefined;
  DeliveryBoyOrders: { id: string };
  DeliveryBoyPickups: { id: string };
  DeliveryBoyHistory: { id: string };
  VendorGenerateInvoice: { orderData: Order; vendorData: Vendor };
  ShopListings: undefined;
  ShopDetails: { vendorId: string; vendorName: string };
  CategoryProducts: { categoryName: string };
  ShopProducts: { vendorId: string; vendorName: string };
  BrandProducts: { brandName: string };
  InsuranceProductCRUD: undefined;
  VendorAppointmentsList: undefined;
  InsuranceProductsAndDetails: undefined;
  ProductDetailScreen: { productId: string };
  PropertyCRUDScreen: undefined;
  PropertyDetailScreen: { propertyId: string };
  ChatScreen: { sharedData?: any } | undefined;
  UserPropertyListScreen: undefined;
  AddressScreen: { isForceSelect?: boolean } | undefined; 
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();