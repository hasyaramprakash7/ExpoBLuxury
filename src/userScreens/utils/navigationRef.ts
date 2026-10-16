// src/userScreens/utils/navigationRef.ts
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export type RootStackParamList = {
  // Chooser + auth
  ProfileChooser: undefined;
  Login: undefined;
  Signup: undefined;
  VendorLogin: undefined;
  SignupVendor: undefined;
  DeliveryBoyLogin: undefined;
  DeliveryBoySignup: undefined;

  // Role roots
  UserTabs: undefined;
  VendorTabs: undefined;
  DeliveryBoyDashboard: undefined;
  DeliveryBoyOrders: undefined;
  VendorDashboard: undefined;

  // User stacks
  AddressScreen: undefined;
  Profile: undefined;
  CartScreen: undefined;
  OrderScreen: undefined;
  ProductDetails: { productId: string };
  UserOrderScreen: undefined;
  ShopListings: undefined;
  ShopDetails: { vendorId: string };
  ShopReviews: undefined;
  CategoryShopsScreen: undefined;
  CategoryProducts: undefined;
  ShopProducts: undefined;
  BrandProducts: undefined;
  ProductSearchScreen: undefined;
  MyCategoriesScreen: undefined;
  InsuranceProductsAndDetails: undefined;
  ProductDetailScreen: undefined;
  ProductDetailScreen10: undefined;
  PropertyDetailScreen: { propertyId: string };
  UserPropertyListScreen: undefined;
  RentalList: undefined;
  RentalDetail: { rentalId: string };
  AdListScreen: undefined;
  AdGroupDetail: undefined;
  WebViewScreen: { url: string };
  AllCategoriesScreen: undefined;
  AddAddressScreen: undefined;

  // Vendor extras
  VendorProductViews: undefined;
  VendorChatScreen: undefined;
  VendorProductCRUD: undefined;
  VendorOrderList: undefined;
  ActiveDeliveryBoys: { orderId: string };
  VendorGenerateInvoice: undefined;
  InsuranceProductCRUD: undefined;
  PropertyCRUDScreen: undefined;
  VendorAppointmentsList: undefined;
  VendorLeads: undefined;
  RentalCRUD: undefined;
  SubscriptionChoice: undefined;
  SubscriptionManagement: undefined;
  SubscriptionPending: undefined;
  AdManagement: undefined;

  // Social
  Messages: undefined | { conversationId?: string };
  Notifications: undefined;
  EditProfile: undefined;
  StoryViewer: { storyId: string };
  HashtagPosts: { tag: string };
  SearchScreen: undefined;

  // Misc
  ChatScreen: undefined;
  HomeScreen: undefined;
  Search: undefined;
};