// src/components/CartScreen.tsx (Final Corrected File with Input Error Highlighting)

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  Linking,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { RootState } from "../app/store";
import { fetchCart, clearCart } from "../features/cart/cartSlice";
import {
  placeOrder,
  placePendingOrder,
  createRazorpayPaymentLink,
  fetchOrderById,
  confirmOnlinePayment,
} from "../features/orders/orderSlice";

import CouponSection from "./CouponSection";
import VendorOrderGroup, { VendorGroupProps } from "./VendorOrderGroup";
import OrderSummary from "./OrderSummary";

import {
  useNavigation,
  NavigationProp,
  useFocusEffect,
} from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

// --- 💎 LUXURY COLOR PALETTE ---
const Colors = {
  primaryGreen: "#00704A", // Used for primary buttons/accents
  darkGreen: "#00563F",
  gold: "#FFD700",
  white: "#FFFFFF",
  darkText: "#2C3E50",
  grayText: "#95A5A6",
  lightGray: "#ECF0F1",
  redAlert: "#C0392B", // Used for errors and important alerts
  yellowStar: "#F39C12",
  greenSuccess: "#2ECC71",
  blueHighlight: "#3498DB",
  softGray: "#F4F7F9", // Used for main screen background
  mediumGray: "#BDC3C7",
  deepGreen: "#014421",
  shadow: "rgba(0, 0, 0, 0.15)",
  successBackground: "#E8F8F5",
  stepActive: "#007AFF",
  inputBackground: "#F5F5F5",
  richBrown: "#6D4C3A", // For primary CTA buttons (View Order)
  softBrown: "#F4EAE6", // For success background
};

// --- Type Definitions (Kept in CartScreen as they are widely used) ---
interface Address {
  fullName: string;
  phone: string;
  street: string;
  street2: string;
  landmark: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}
type AddressKeys = keyof Address; // Utility type for validation

interface ProductInCart {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountedPrice?: number;
  discountPercent?: number;
  category?: string;
  images?: string[];
  stock: number;
  isAvailable: boolean;
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
  vendorId: string;
  companyName?: string;
}

interface CartReduxItem {
  productId: ProductInCart;
  quantity: number;
  price: number;
  vendorId: string;
  _id: string;
  size?: string;
}

type RootStackParamList = {
  LoginScreen: undefined;
  UserOrderScreen: undefined;
  OrderScreen: undefined;
  Home: undefined;
  UserTabs: { screen: "Home" } | undefined;
};

interface OverallPricingBreakdown {
  itemsSubtotal: number;
  discountedSubtotal: number;
  totalSavings: number;
  deliveryCharge: number;
  platformFee: number;
  gstAmount: number;
  finalTotal: number;
  couponDiscount: number;
}

interface SuccessModalData {
  paymentType: "Online" | "COD";
  orderId: string;
}

// 📌 Toast State Interface
interface ToastState {
  message: string;
  type: "success" | "error" | "info" | "loading";
}

const PENDING_PAYMENT_KEY = "pendingPaymentData";

// --- PAYMENT SUCCESS MODAL COMPONENT (Re-included for compilation) ---
const PaymentSuccessModal: React.FC<{
  isVisible: boolean;
  data: SuccessModalData;
  onClose: () => void;
  navigation: NavigationProp<RootStackParamList>;
}> = ({ isVisible, data, onClose, navigation }) => {
  const isOnline = data.paymentType === "Online";

  const handleViewOrder = () => {
    onClose();
    navigation.navigate("UserOrderScreen");
  };

  const handleViewReceipt = () => {
    Alert.alert("E-Receipt", "E-Receipt functionality coming soon!");
  };

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible}>
      <View style={cartStyles.successModalOverlay}>
        <View style={cartStyles.successModalContent}>
          <View style={cartStyles.successIconContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={width * 0.25}
              color={isOnline ? Colors.richBrown : Colors.deepGreen}
              style={{ backgroundColor: Colors.softGray, borderRadius: 100 }}
            />
          </View>
          <Text style={cartStyles.successTitle}>
            {isOnline ? "Payment Successful!" : "Order Placed!"}
          </Text>
          <Text style={cartStyles.successSubtitle}>
            {isOnline
              ? "Thank you for your secure purchase."
              : "Your order is confirmed and will be delivered soon."}
          </Text>
          <View style={cartStyles.successSpacer} />
          <TouchableOpacity
            onPress={handleViewOrder}
            style={[cartStyles.button, cartStyles.viewOrderButton]}
          >
            <Text style={cartStyles.buttonText}>View Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleViewReceipt}
            style={cartStyles.viewReceiptButton}
          >
            <Text style={cartStyles.viewReceiptText}>
              {isOnline ? "View E-Receipt" : "Continue Shopping"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
// --- END PAYMENT SUCCESS MODAL COMPONENT ---

// 📌 Toast Component
const ToastMessage: React.FC<{ toast: ToastState | null }> = ({ toast }) => {
  if (!toast || toast.type === "loading") return null;

  let backgroundColor = Colors.darkGreen;
  let iconName: keyof typeof Ionicons.glyphMap = "information-circle-outline";

  if (toast.type === "error") {
    backgroundColor = Colors.redAlert;
    iconName = "close-circle-outline";
  } else if (toast.type === "success") {
    backgroundColor = Colors.greenSuccess;
    iconName = "checkmark-circle-outline";
  } else if (toast.type === "info") {
    backgroundColor = Colors.blueHighlight;
    iconName = "information-circle-outline";
  }

  return (
    <View style={[cartStyles.floatingToast, { backgroundColor }]}>
      <Ionicons
        name={iconName}
        size={width * 0.05}
        color={Colors.white}
        style={{ marginRight: 10 }}
      />
      <Text style={cartStyles.floatingToastText}>{toast.message}</Text>
    </View>
  );
};
// --- END TOAST COMPONENT ---

const CartScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const cartItemsMap = useSelector((state: RootState) => state.cart.items);
  const items: CartReduxItem[] = useMemo(
    () => Object.values(cartItemsMap) as CartReduxItem[],
    [cartItemsMap],
  );

  const loading = useSelector((state: RootState) => state.cart.loading);
  const error = useSelector((state: RootState) => state.cart.error);
  const { loading: orderLoading } = useSelector(
    (state: RootState) => state.order,
  );
  const authUser = useSelector((state: RootState) => state.auth.user);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingPaymentStatus, setIsCheckingPaymentStatus] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "Online Payment">(
    "COD",
  );
  const [selectedOnlineOption, setSelectedOnlineOption] =
    useState<string>("Card");

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showConfirmOrderModal, setShowConfirmOrderModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [successModalData, setSuccessModalData] = useState<SuccessModalData>({
    paymentType: "Online",
    orderId: "",
  });

  const [pendingPaymentData, setPendingPaymentData] = useState<{
    referenceId: string;
    paymentId: string;
  } | null>(null);

  // ✅ NEW STATE: Tracks which address fields failed validation
  const [validationErrors, setValidationErrors] = useState<AddressKeys[]>([]);

  // ✨ Coupon State - Passed down to CouponSection
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isCouponApplied, setIsCouponApplied] = useState(false);

  const [address, setAddress] = useState<Address>({
    fullName: "",
    phone: "",
    street: "",
    street2: "",
    landmark: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",
    latitude: null,
    longitude: null,
  });

  const DELIVERY_CHARGE = 0;
  const FREE_DELIVERY_THRESHOLD = 0;
  const PLATFORM_FEE_RATE = 0;
  const GST_RATE = 0;

  // 📌 Toast Message Handler
  const showToastMessage = useCallback(
    (message: string, type: ToastState["type"] = "info") => {
      setToast({ message, type });
      setTimeout(() => {
        setToast(null);
      }, 3000);
    },
    [],
  );

  // --- Utility Handlers ---
  const getEffectivePrice = useCallback(
    (product: ProductInCart, quantity: number): number => {
      let price = product.discountedPrice || product.price || 0;
      if (
        product.largeQuantityPrice &&
        product.largeQuantityMinimumUnits &&
        quantity >= product.largeQuantityMinimumUnits
      ) {
        price = product.largeQuantityPrice;
      } else if (
        product.bulkPrice &&
        product.bulkMinimumUnits &&
        quantity >= product.bulkMinimumUnits
      ) {
        price = product.bulkPrice;
      }
      return price;
    },
    [],
  );

  // --- MEMO: Pricing & Order Data (Unchanged) ---
  const vendorOrderGroups = useMemo<VendorGroupProps[]>(() => {
    const vendorGroupsMap = items.reduce(
      (groups: { [key: string]: CartReduxItem[] }, item) => {
        const product = item.productId as ProductInCart;
        const vendorId = product.vendorId;
        if (!groups[vendorId]) groups[vendorId] = [];
        groups[vendorId].push(item);
        return groups;
      },
      {},
    );

    const groupsArray: VendorGroupProps[] = [];
    for (const vendorId in vendorGroupsMap) {
      const vendorItems = vendorGroupsMap[vendorId];

      const vendorDiscountedSubtotal = vendorItems.reduce((sum, item) => {
        const product = item.productId as ProductInCart;
        return sum + getEffectivePrice(product, item.quantity) * item.quantity;
      }, 0);

      const vendorDeliveryCharge =
        vendorDiscountedSubtotal >= FREE_DELIVERY_THRESHOLD
          ? 0
          : DELIVERY_CHARGE;

      groupsArray.push({
        vendorId,
        vendorName:
          (vendorItems[0]?.productId as ProductInCart)?.companyName ||
          `Vendor ${vendorId.substring(0, 4)}`,
        items: vendorItems,
        subtotal: vendorDiscountedSubtotal,
        deliveryCharge: vendorDeliveryCharge,
        FREE_DELIVERY_THRESHOLD: FREE_DELIVERY_THRESHOLD,
      });
    }

    return groupsArray;
  }, [items, getEffectivePrice, DELIVERY_CHARGE, FREE_DELIVERY_THRESHOLD]);

  const pricingBreakdown: OverallPricingBreakdown = useMemo(() => {
    let itemsSubtotal = 0;
    let discountedSubtotal = 0;
    let totalDeliveryCharge = 0;

    items.forEach((item) => {
      const product = (item.productId as ProductInCart) || {};
      const originalPrice = product.price || 0;
      const effectivePrice = getEffectivePrice(product, item.quantity);

      itemsSubtotal += originalPrice * item.quantity;
      discountedSubtotal += effectivePrice * item.quantity;
    });
    vendorOrderGroups.forEach((group) => {
      totalDeliveryCharge += group.deliveryCharge;
    });

    const totalSavings = itemsSubtotal - discountedSubtotal + couponDiscount;
    const platformFee = discountedSubtotal * PLATFORM_FEE_RATE;

    let preTaxTotal =
      discountedSubtotal + platformFee + totalDeliveryCharge - couponDiscount;
    if (preTaxTotal < 0) preTaxTotal = 0;

    const gstAmount = preTaxTotal * GST_RATE;
    const finalTotal = preTaxTotal + gstAmount;

    return {
      itemsSubtotal,
      discountedSubtotal,
      totalSavings,
      deliveryCharge: totalDeliveryCharge,
      platformFee,
      gstAmount,
      finalTotal,
      couponDiscount,
    };
  }, [
    items,
    vendorOrderGroups,
    PLATFORM_FEE_RATE,
    GST_RATE,
    getEffectivePrice,
    couponDiscount,
  ]);

  const initialDiscountedSubtotal = pricingBreakdown?.discountedSubtotal || 0;

  // Coupon Handlers (Unchanged)
  const handleClearCoupon = useCallback(() => {
    setCouponDiscount(0);
    setIsCouponApplied(false);
    setCouponCode("");
  }, [setCouponDiscount, setIsCouponApplied, setCouponCode]);

  const handleApplyCoupon = useCallback(
    (code: string, discountAmount: number) => {
      setCouponDiscount(discountAmount);
      setIsCouponApplied(true);
      setCouponCode(code);
    },
    [setCouponDiscount, setIsCouponApplied, setCouponCode],
  );

  // Pincode Blur Handler (Unchanged)
  const handlePincodeBlur = useCallback(async () => {
    const zipCode = address.zipCode;
    if (!zipCode || zipCode.length !== 6 || isNaN(Number(zipCode))) {
      showToastMessage(
        "Please enter a valid 6-digit pincode to auto-fill city/state.",
        "error",
      );
      return;
    }
    showToastMessage("Fetching address details...", "loading");
    try {
      const res = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            postalcode: zipCode,
            format: "json",
            addressdetails: 1,
            countrycodes: "in",
          },
          headers: {
            "User-Agent":
              "GrocerEase-ReactNativeApp/1.0 (contact@grocer-ease.com)",
          },
        },
      );
      if (res.data.length > 0) {
        const location = res.data[0];
        const addr = location.address;
        setAddress((prev) => ({
          ...prev,
          city:
            addr.city || addr.town || addr.village || addr.county || prev.city,
          state: addr.state || prev.state,
          country: addr.country || "India",
          latitude: parseFloat(location.lat) || prev.latitude,
          longitude: parseFloat(location.lon) || prev.longitude,
        }));
        showToastMessage("City and State pre-filled from pincode!", "success");
      } else {
        showToastMessage("No address details found for this pincode.", "info");
      }
    } catch (err) {
      console.error("Error fetching from pincode:", err);
      showToastMessage(
        "Failed to fetch address from pincode. Please try again or fill manually.",
        "error",
      );
    }
  }, [address.zipCode, showToastMessage]);

  // Initial Load & Geolocation (Unchanged)
  useEffect(() => {
    dispatch(fetchCart());

    const loadUserDataAndPendingPayment = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setAddress((prev) => ({
            fullName: user.address?.fullName || user.username || prev.fullName,
            phone: user.phone || prev.phone,
            street: user.address?.street || prev.street,
            street2: user.address?.street2 || prev.street2,
            landmark: user.address?.landmark || prev.landmark,
            city:
              user.address?.city ||
              user.address?.town ||
              user.address?.village ||
              user.address?.county ||
              prev.city,
            state: user.address?.state || prev.state,
            zipCode: user.address?.pincode || prev.zipCode,
            country: user.address?.country || "India",
            latitude: user.address?.latitude || prev.latitude,
            longitude: user.address?.longitude || prev.longitude,
          }));
        }

        const storedPendingJson =
          await AsyncStorage.getItem(PENDING_PAYMENT_KEY);
        if (storedPendingJson) {
          setPendingPaymentData(JSON.parse(storedPendingJson));
        }
      } catch (e) {
        console.error(
          "Failed to load user data or pending data from async storage",
          e,
        );
      }
    };

    loadUserDataAndPendingPayment();

    const getGeoLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return;
      }
      try {
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 10000,
        });
        const { latitude, longitude } = location.coords;
        setLatitude(latitude);
        setLongitude(longitude);
        const res = await axios.get(
          "https://nominatim.openstreetmap.org/reverse",
          {
            params: {
              lat: latitude,
              lon: longitude,
              format: "json",
              addressdetails: 1,
              zoom: 16,
            },
            headers: {
              "User-Agent":
                "GrocerEase-ReactNativeApp/1.0 (contact@grocer-ease.com)",
            },
          },
        );
        const addr = res.data?.address || {};
        setAddress((prev) => ({
          ...prev,
          street: addr.road || addr.building || prev.street,
          landmark: addr.neighbourhood || addr.suburb || prev.landmark,
          city:
            addr.city || addr.town || addr.village || addr.county || prev.city,
          state: addr.state || prev.state,
          zipCode: addr.postcode || prev.zipCode,
          country: addr.country || "India",
        }));
      } catch (error: any) {
        console.error("Geolocation or Reverse geocoding failed:", error);
      }
    };
    getGeoLocation();
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchCart()).unwrap();
      showToastMessage("Cart refreshed successfully!", "success");
    } catch (error) {
      console.error("Refresh failed:", error);
      showToastMessage("Failed to refresh cart.", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, showToastMessage]);

  // Final Success Handler (Unchanged)
  const handleFinalSuccess = useCallback(
    async (confirmedOrderId: string) => {
      console.log(
        "CLIENT DEBUG: 🎯 Starting handleFinalSuccess (Cleanup and Modal trigger)",
      );

      // 1. Clear local data
      await AsyncStorage.removeItem(PENDING_PAYMENT_KEY);
      setPendingPaymentData(null);
      handleClearCoupon();

      await dispatch(clearCart()).unwrap();

      console.log(
        "CLIENT DEBUG: ✅ AsyncStorage cleared and Cart cleared in Redux. Showing success modal.",
      );

      // 2. Show the new success modal
      setSuccessModalData({
        paymentType: "Online",
        orderId: confirmedOrderId,
      });
      setShowSuccessModal(true);
      setToast(null); // Clear any floating toasts
    },
    [dispatch, handleClearCoupon],
  );

  // Secure Reconciliation Logic (Unchanged)
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchCart());
      let reconciliationCheckRan = false;

      const runReconciliationCheck = async (
        initialUrl: string | null = null,
      ) => {
        if (reconciliationCheckRan) {
          console.log("CLIENT DEBUG: ❌ Reconciliation skipped (already ran).");
          return;
        }
        reconciliationCheckRan = true;

        const startTime = Date.now();
        setToast(null);
        const storedDataJson = await AsyncStorage.getItem(PENDING_PAYMENT_KEY);
        const storedData = storedDataJson ? JSON.parse(storedDataJson) : null;

        if (!storedData || !storedData.referenceId) {
          console.log(
            "CLIENT DEBUG: No pending payment data found in AsyncStorage. Clean exit.",
          );
          reconciliationCheckRan = false;
          return;
        }
        const storedOrderId = storedData.referenceId;
        console.log(
          `CLIENT DEBUG: ⚙️ Starting reconciliation check for stored Order ID: ${storedOrderId}...`,
        );

        setIsCheckingPaymentStatus(true);
        showToastMessage("Verifying payment status... Please wait.", "loading");

        let paymentStatus = null;
        let referenceIdFromLink = null;
        let paymentIdFromLink = null;
        let webhookSucceeded = false;

        const currentUrl = initialUrl || (await Linking.getInitialURL());

        console.log("CLIENT DEBUG: RZP Redirect URL (Raw):", currentUrl);

        if (
          currentUrl &&
          (currentUrl.includes("order/status") ||
            currentUrl.includes("order/confirm"))
        ) {
          try {
            const url = new URL(currentUrl);
            paymentStatus = url.searchParams.get("status");
            referenceIdFromLink = url.searchParams.get("referenceId");
            paymentIdFromLink = url.searchParams.get("paymentId");

            console.log(`CLIENT DEBUG: 🔗 Deep Link parsed successfully.`);
          } catch (e) {
            console.error("CLIENT DEBUG: ❌ Failed to parse deep link URL.", e);
          }
        }

        if (!referenceIdFromLink) {
          referenceIdFromLink = storedOrderId;
        }

        try {
          const currentOrder = await dispatch(
            fetchOrderById(storedOrderId),
          ).unwrap();

          if (
            currentOrder.status === "processing" ||
            currentOrder.status === "placed"
          ) {
            paymentStatus = "success";
            webhookSucceeded = true;
            if (currentOrder.paymentId)
              paymentIdFromLink = currentOrder.paymentId;
            console.log(
              "CLIENT DEBUG: 💨 Webhook confirmed order prior to app resume. Confirmed success.",
            );
          } else if (currentOrder.status === "pending_payment") {
            console.log(
              "CLIENT DEBUG: ⏳ Status is 'pending_payment'. Checking manual fallback conditions...",
            );

            if (paymentStatus === "success" && paymentIdFromLink) {
              showToastMessage(
                "Webhook missed/delayed. Manually confirming payment details...",
                "loading",
              );
              console.log(
                `CLIENT DEBUG: Calling confirmOnlinePayment with Order ID: ${storedOrderId}, RZP ID: ${paymentIdFromLink}`,
              );

              const confirmedOrder = await dispatch(
                confirmOnlinePayment({
                  orderId: storedOrderId,
                  paymentId: paymentIdFromLink,
                }),
              ).unwrap();

              webhookSucceeded = confirmedOrder.status === "processing";

              console.log(
                `CLIENT DEBUG: ✅ Manual confirmation result. Success: ${webhookSucceeded}. New DB Status: ${confirmedOrder.status}`,
              );
            } else {
              console.log(
                `CLIENT DEBUG: 🛑 Manual fallback blocked. Assuming failure.`,
              );
              paymentStatus = "failed";
            }
          } else {
            paymentStatus = "failed";
          }
        } catch (err: any) {
          console.error(
            "CLIENT DEBUG: ⚠️ Initial fetch failed (Auth/Network). Trying secure retry...",
            err.message,
          );

          if (paymentStatus === "success" && paymentIdFromLink) {
            try {
              showToastMessage(
                "Retrying confirmation after server glitch...",
                "loading",
              );
              await dispatch(
                confirmOnlinePayment({
                  orderId: storedOrderId,
                  paymentId: paymentIdFromLink,
                }),
              ).unwrap();

              webhookSucceeded = true;
              console.log("CLIENT DEBUG: ✅ Secured retry successful.");
            } catch (retryErr: any) {
              console.error(
                "CLIENT DEBUG: ❌ Secured retry failed (Final Error).",
                retryErr.message,
              );
              webhookSucceeded = false;
              paymentStatus = "failed";
            }
          } else {
            paymentStatus = "failed";
          }
        }

        setIsCheckingPaymentStatus(false);
        const elapsedTime = (Date.now() - startTime) / 1000;

        if (webhookSucceeded) {
          console.log(
            "CLIENT DEBUG: 💰 CONFIRMED SUCCESS PATH. Calling final handler.",
          );
          handleFinalSuccess(storedOrderId);
        } else if (paymentStatus === "failed") {
          console.log("CLIENT DEBUG: 🛑 FAILURE PATH.");
          await AsyncStorage.removeItem(PENDING_PAYMENT_KEY);
          setPendingPaymentData(null);

          handleClearCoupon();

          showToastMessage(
            "The online payment was cancelled or failed. Please try again or check 'My Orders'.",
            "error",
          );
          setToast(null);
        } else {
          console.log(
            "CLIENT DEBUG: ❓ DELAYED STATUS PATH (Neither confirmed nor explicitly failed).",
          );
          showToastMessage(
            "Payment succeeded, but the final booking status is delayed. Please check the 'My Orders' screen in a moment or contact support.",
            "info",
          );
          setToast(null);
        }
        console.log("CLIENT DEBUG: Reconciliation check ended.");
        reconciliationCheckRan = false;
      };

      Linking.getInitialURL().then((url) => {
        if (url) {
          runReconciliationCheck(url);
        } else {
          runReconciliationCheck(null);
        }
      });

      const subscription = Linking.addEventListener("url", ({ url }) => {
        console.log("CLIENT DEBUG: Deep link event detected:", url);
        if (!reconciliationCheckRan) {
          runReconciliationCheck(url);
        } else {
          console.log(
            "CLIENT DEBUG: Deep link event ignored (check is already running or ran).",
          );
        }
      });

      return () => {
        setToast(null);
        setIsCheckingPaymentStatus(false);
        subscription.remove();
        reconciliationCheckRan = false;
      };
    }, [
      dispatch,
      navigation,
      handleFinalSuccess,
      showToastMessage,
      handleClearCoupon,
    ]),
  );

  // --- UI Handlers ---
  const handleClear = () => {
    Alert.alert(
      "Clear Cart",
      "Are you sure you want to clear all items from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          onPress: async () => {
            try {
              await dispatch(clearCart()).unwrap();
              handleClearCoupon();

              showToastMessage("Cart cleared successfully!", "success");
            } catch (err: any) {
              showToastMessage(err.message || "Failed to clear cart.", "error");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleOpenAddressModal = () => {
    if (!authUser?._id) {
      showToastMessage("You need to be logged in to place an order.", "error");
      navigation.navigate("LoginScreen");
      return;
    }
    if (items.length === 0) {
      showToastMessage(
        "Your cart is empty. Add items before placing an order.",
        "info",
      );
      return;
    }
    // Clear previous errors when opening the modal
    setValidationErrors([]);
    setShowAddressModal(true);
  };

  const handleAddressChange = (name: keyof Address, value: string) => {
    setAddress((prev) => ({ ...prev, [name]: value }));
    // Remove error state as user starts typing
    setValidationErrors((prev) => prev.filter((err) => err !== name));
  };

  // 🎯 Address Validation Logic (Modified to set error state)
  const handleConfirmAddress = () => {
    const requiredFields: AddressKeys[] = [
      "fullName",
      "phone",
      "street",
      "city",
      "state",
      "zipCode",
      "country",
    ];

    const missingFields: string[] = [];
    const newErrors: AddressKeys[] = [];
    let hasFormatError = false;

    // 1. Check for empty fields
    requiredFields.forEach((field) => {
      if (field !== "country" && !address[field]?.trim()) {
        missingFields.push(
          field.charAt(0).toUpperCase() + field.slice(1), // Capitalize for display
        );
        newErrors.push(field);
      }
      // Special check for country if it's somehow missing, though it defaults
      if (field === "country" && !address[field]?.trim()) {
        missingFields.push("Country");
        newErrors.push(field);
      }
    });

    // 2. Check for format issues
    if (!/^\d{10}$/.test(address.phone.trim())) {
      showToastMessage(
        "Phone number must be a valid 10-digit number.",
        "error",
      );
      newErrors.push("phone");
      hasFormatError = true;
    }
    if (!/^\d{6}$/.test(address.zipCode.trim())) {
      showToastMessage("ZIP Code must be a valid 6-digit number.", "error");
      newErrors.push("zipCode");
      hasFormatError = true;
    }

    // Set all detected errors
    setValidationErrors(Array.from(new Set(newErrors)));

    if (missingFields.length > 0 || hasFormatError) {
      if (missingFields.length > 0) {
        showToastMessage(
          `Please fill the following required address fields: ${missingFields.join(
            ", ",
          )}.`,
          "error",
        );
      }
      return;
    }

    // If validation passes
    setShowAddressModal(false);
    setShowConfirmOrderModal(true);
  };

  const handleEditAddress = () => {
    setShowConfirmOrderModal(false);
    // Show address modal again and clear current validation errors
    setValidationErrors([]);
    setShowAddressModal(true);
  };

  const handleSelectOnlinePayment = (option: string) => {
    setPaymentMethod("Online Payment");
    setSelectedOnlineOption(option);
  };

  const handleSelectCOD = () => {
    setPaymentMethod("COD");
    setSelectedOnlineOption("");
  };

  // Order Placement (Unchanged)
  const handlePlaceOrderConfirmed = async () => {
    const user = authUser;
    const token = authUser?.token;

    if (!token || !user?._id) {
      showToastMessage("You need to be logged in to place an order.", "error");
      setShowConfirmOrderModal(false);
      navigation.navigate("LoginScreen");
      return;
    }

    const invalidItems = items.filter(
      (item) => !item.productId?._id || !item.productId?.vendorId,
    );
    if (invalidItems.length > 0) {
      showToastMessage(
        "Some items in your cart are invalid or missing vendor information. Please remove them.",
        "error",
      );
      return;
    }
    if (items.length === 0) {
      showToastMessage("Your cart is empty. No order to place.", "info");
      setShowConfirmOrderModal(false);
      return;
    }

    // --- PREPARE CONSOLIDATED ORDER DATA ---
    const totalAmountToPay = pricingBreakdown.finalTotal;
    const consolidatedItems = vendorOrderGroups.flatMap((group) =>
      group.items.map((item) => ({
        productId: (item.productId as ProductInCart)._id,
        name: (item.productId as ProductInCart).name,
        quantity: item.quantity,
        price: getEffectivePrice(
          item.productId as ProductInCart,
          item.quantity,
        ),
        productImage: (item.productId as ProductInCart).images?.[0],
        vendorId: (item.productId as ProductInCart).vendorId,
        size: item.size, // Including the size property
      })),
    );

    const baseOrderData = {
      userId: user._id,
      address: { ...address, latitude, longitude },
      items: consolidatedItems,
      total: totalAmountToPay,
      // ✨ ADDED: Coupon Data
      couponCode: isCouponApplied ? couponCode : undefined,
      couponDiscount: isCouponApplied ? couponDiscount : undefined,
    };

    // --- 2. ONLINE PAYMENT FLOW (Razorpay Link) ---
    if (paymentMethod === "Online Payment") {
      try {
        const pendingOrderResponse = await dispatch(
          placePendingOrder({
            ...baseOrderData,
            paymentMethod: "Online Payment",
          }),
        ).unwrap();
        const pendingOrderId = pendingOrderResponse.receiptId;

        const prefillDetails = {
          name: address.fullName,
          email: user.email || "user@placeholder.com",
          contact: address.phone,
        };
        const paymentLinkResponse = await dispatch(
          createRazorpayPaymentLink({
            amount: totalAmountToPay,
            receipt: pendingOrderId,
            customerDetails: prefillDetails,
          }),
        ).unwrap();

        const paymentLinkUrl = paymentLinkResponse.paymentLinkUrl;
        const paymentLinkId = paymentLinkResponse.paymentLinkId;

        const dataToSave = {
          referenceId: pendingOrderId,
          paymentId: paymentLinkId,
        };

        await AsyncStorage.setItem(
          PENDING_PAYMENT_KEY,
          JSON.stringify(dataToSave),
        );
        setPendingPaymentData(dataToSave as any);

        setShowConfirmOrderModal(false);

        Linking.openURL(paymentLinkUrl);
        showToastMessage(
          "Redirecting to secure payment. Please complete the transaction.",
          "info",
        );
        return;
      } catch (err: any) {
        let errorMsg =
          typeof err === "string"
            ? err
            : err.message ||
              "Payment initiation failed. Please try again or select COD.";

        console.error("Razorpay Link Creation Error:", err);
        showToastMessage("Payment Failed: " + errorMsg, "error");
        setShowConfirmOrderModal(false);
        setPendingPaymentData(null);
        return;
      }
    }

    // --- 3. COD FLOW (Order is placed immediately) ---
    else if (paymentMethod === "COD") {
      try {
        const finalOrderData = {
          ...baseOrderData,
          status: "placed",
          paymentMethod: "COD",
          paymentId: undefined,
        };
        const orderResponse = await dispatch(
          placeOrder(finalOrderData),
        ).unwrap();
        await dispatch(clearCart()).unwrap();

        handleClearCoupon();

        setShowConfirmOrderModal(false);

        // Show success modal for COD
        setSuccessModalData({
          paymentType: "COD",
          orderId: orderResponse._id, // Assuming response returns order ID
        });
        setShowSuccessModal(true);
      } catch (err: any) {
        console.error("COD Order placement error:", err);
        showToastMessage(
          err.message?.message ||
            err.message ||
            "An unexpected error occurred during order placement.",
          "error",
        );
        setShowConfirmOrderModal(false);
      }
    }
  };

  // --- RENDER START ---
  return (
    <View style={cartStyles.container}>
      <ScrollView
        contentContainerStyle={cartStyles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primaryGreen}
            colors={[Colors.primaryGreen]}
          />
        }
      >
        {loading || isCheckingPaymentStatus ? (
          <View style={cartStyles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primaryGreen} />
            <Text style={cartStyles.loadingText}>
              {isCheckingPaymentStatus
                ? "Reconciling Payment Status... Please Wait."
                : "Loading your cart..."}
            </Text>
          </View>
        ) : error ? (
          <View style={cartStyles.errorContainer}>
            <Text style={cartStyles.errorTitle}>Error!</Text>
            <Text style={cartStyles.errorMessage}>
              {error || "Failed to load cart items."}
            </Text>
            {error === "Authentication required. Please log in." && (
              <TouchableOpacity
                onPress={() => navigation.navigate("LoginScreen")}
                style={cartStyles.loginButton}
              >
                <Text style={cartStyles.loginButtonText}>Login</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : items.length === 0 ? (
          <View style={cartStyles.emptyCartContainer}>
            <Ionicons
              name="cart-outline"
              size={width * 0.18}
              color={Colors.grayText}
              style={cartStyles.emptyCartIcon}
            />
            <Text style={cartStyles.emptyCartText}>Your cart is empty.</Text>
            <Text style={cartStyles.emptyCartSubText}>
              Discover exclusive products and fill it up.
            </Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("UserTabs", { screen: "Home" })
              }
              style={cartStyles.shopNowButton}
            >
              <Text style={cartStyles.shopNowButtonText}>Shop Collection</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={cartStyles.mainContent}>
            <View style={cartStyles.cartItemsSection}>
              <Text style={cartStyles.sectionHeaderTitle}>
                Cart Summary ({vendorOrderGroups.length} Shops)
              </Text>
              {vendorOrderGroups.map((group) => (
                <VendorOrderGroup
                  key={group.vendorId}
                  {...group}
                  FREE_DELIVERY_THRESHOLD={FREE_DELIVERY_THRESHOLD}
                  showToast={showToastMessage} // 🔑 Pass the toast function down
                />
              ))}
            </View>

            {/* COUPON SECTION COMPONENT */}
            {/* <CouponSection
                            couponCode={couponCode}
                            couponDiscount={couponDiscount}
                            isCouponApplied={isCouponApplied}
                            handleApplyCoupon={handleApplyCoupon}
                            handleClearCoupon={handleClearCoupon}
                            initialDiscountedSubtotal={initialDiscountedSubtotal}
                        /> */}

            <OrderSummary
              items={items}
              pricingBreakdown={pricingBreakdown}
              DELIVERY_CHARGE={DELIVERY_CHARGE}
              FREE_DELIVERY_THRESHOLD={FREE_DELIVERY_THRESHOLD}
              PLATFORM_FEE_RATE={PLATFORM_FEE_RATE}
              GST_RATE={GST_RATE}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              handleOpenAddressModal={handleOpenAddressModal}
              handleClear={handleClear}
              orderLoading={orderLoading}
            />
          </View>
        )}
      </ScrollView>

      <ToastMessage toast={toast} />

      {/* Address Modal (START) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddressModal}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <KeyboardAvoidingView
          style={cartStyles.fullScreenModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={cartStyles.addressModalContentFull}>
            <View style={cartStyles.modalHeaderContainer}>
              <Ionicons
                name="map"
                size={width * 0.07}
                color={Colors.primaryGreen}
                style={cartStyles.modalHeaderIcon}
              />
              <Text style={cartStyles.modalTitle}>Enter Delivery Address</Text>
              <TouchableOpacity
                onPress={() => setShowAddressModal(false)}
                style={cartStyles.modalCloseButton}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={width * 0.07}
                  color={Colors.grayText}
                />
              </TouchableOpacity>
            </View>
            <Text style={cartStyles.requiredFieldsText}>
              Fields marked with{" "}
              <Text style={{ color: Colors.redAlert }}>*</Text> are required.
            </Text>
            <ScrollView style={cartStyles.addressFormScrollView}>
              {/* Form fields with CONDITIONAL STYLING for errors */}
              <View style={cartStyles.formRow}>
                <View style={cartStyles.formGroupHalf}>
                  <Text style={cartStyles.label}>
                    Full Name <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      cartStyles.textInput,
                      validationErrors.includes("fullName") &&
                        cartStyles.errorInput,
                    ]}
                    value={address.fullName}
                    onChangeText={(text) =>
                      handleAddressChange("fullName", text)
                    }
                    placeholder="John Doe"
                  />
                </View>
                <View style={cartStyles.formGroupHalf}>
                  <Text style={cartStyles.label}>
                    Phone Number{" "}
                    <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      cartStyles.textInput,
                      validationErrors.includes("phone") &&
                        cartStyles.errorInput,
                    ]}
                    value={address.phone}
                    onChangeText={(text) => handleAddressChange("phone", text)}
                    placeholder="e.g., 9876543210"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
              <View style={cartStyles.formGroup}>
                <Text style={cartStyles.label}>
                  Street Address{" "}
                  <Text style={{ color: Colors.redAlert }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    cartStyles.textInput,
                    validationErrors.includes("street") &&
                      cartStyles.errorInput,
                  ]}
                  value={address.street}
                  onChangeText={(text) => handleAddressChange("street", text)}
                  placeholder="House No., Building Name"
                  autoCapitalize="words"
                />
              </View>
              <View style={cartStyles.formGroup}>
                <Text style={cartStyles.label}>
                  Apartment, Suite, Floor (Optional)
                </Text>
                <TextInput
                  style={cartStyles.textInput}
                  value={address.street2}
                  onChangeText={(text) => handleAddressChange("street2", text)}
                  placeholder="Apt, Suite, Unit, etc."
                />
              </View>
              <View style={cartStyles.formGroup}>
                <Text style={cartStyles.label}>
                  Landmark (e.g., Near XYZ Mall)
                </Text>
                <TextInput
                  style={cartStyles.textInput}
                  value={address.landmark}
                  onChangeText={(text) => handleAddressChange("landmark", text)}
                  placeholder="e.g., Near Main Market"
                />
              </View>
              <View style={cartStyles.formRow}>
                <View style={cartStyles.formGroupHalf}>
                  <Text style={cartStyles.label}>
                    ZIP Code <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      cartStyles.textInput,
                      validationErrors.includes("zipCode") &&
                        cartStyles.errorInput,
                    ]}
                    value={address.zipCode}
                    onChangeText={(text) =>
                      handleAddressChange("zipCode", text)
                    }
                    onBlur={handlePincodeBlur}
                    placeholder="e.g., 530001"
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <Text style={cartStyles.hintText}>
                    Enter ZIP code to auto-fill City/State.
                  </Text>
                </View>
                <View style={cartStyles.formGroupHalf}>
                  <Text style={cartStyles.label}>
                    City <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      cartStyles.textInput,
                      validationErrors.includes("city") &&
                        cartStyles.errorInput,
                    ]}
                    value={address.city}
                    onChangeText={(text) => handleAddressChange("city", text)}
                    placeholder="City"
                  />
                </View>
              </View>
              <View style={cartStyles.formRow}>
                <View style={cartStyles.formGroupHalf}>
                  <Text style={cartStyles.label}>
                    State <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      cartStyles.textInput,
                      validationErrors.includes("state") &&
                        cartStyles.errorInput,
                    ]}
                    value={address.state}
                    onChangeText={(text) => handleAddressChange("state", text)}
                    placeholder="State"
                  />
                </View>
                <View style={cartStyles.formGroupHalf}>
                  <Text style={cartStyles.label}>Country</Text>
                  <TextInput
                    style={[
                      cartStyles.textInput,
                      cartStyles.readOnlyInput,
                      validationErrors.includes("country") &&
                        cartStyles.errorInput,
                    ]}
                    value={address.country}
                    readOnly
                  />
                </View>
              </View>
            </ScrollView>
            <View style={cartStyles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowAddressModal(false)}
                style={[cartStyles.button, cartStyles.cancelButton]}
              >
                <Text style={cartStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmAddress}
                style={[cartStyles.button, cartStyles.confirmButton]}
              >
                <Text style={cartStyles.buttonText}>Continue to Summary</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Address Modal (END) */}

      {/* Confirm Order Modal (Unchanged) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showConfirmOrderModal}
        onRequestClose={() => setShowConfirmOrderModal(false)}
      >
        <KeyboardAvoidingView
          style={cartStyles.fullScreenModalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={cartStyles.confirmModalContent}>
            <View style={cartStyles.confirmModalHeader}>
              <Text style={cartStyles.modalTitle}>Confirm Your Order</Text>
              <TouchableOpacity
                onPress={() => setShowConfirmOrderModal(false)}
                style={cartStyles.modalCloseButton}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={width * 0.07}
                  color={Colors.grayText}
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={cartStyles.confirmModalScrollViewContent}
            >
              {/* Order Summary Section */}
              <View style={cartStyles.section}>
                <View style={cartStyles.sectionHeaderConfirm}>
                  <Ionicons
                    name="receipt"
                    size={width * 0.05}
                    color={Colors.darkText}
                  />
                  <Text style={cartStyles.sectionTitleConfirm}>
                    Order Summary
                  </Text>
                </View>
                <View style={cartStyles.summaryRow}>
                  <Text style={cartStyles.summaryLabel}>Items Subtotal</Text>
                  <Text style={cartStyles.summaryValue}>
                    ₹{pricingBreakdown.itemsSubtotal.toFixed(2)}
                  </Text>
                </View>
                <View style={cartStyles.summaryRow}>
                  <Text style={cartStyles.summaryLabel}>Delivery Charges</Text>
                  <Text style={cartStyles.summaryValue}>
                    ₹{pricingBreakdown.deliveryCharge.toFixed(2)}
                  </Text>
                </View>

                {/* Coupon Discount Row */}
                {pricingBreakdown.couponDiscount > 0 && (
                  <View style={[cartStyles.summaryRow, { marginTop: 6 }]}>
                    <Text style={cartStyles.summaryLabel}>
                      Coupon Discount ({couponCode}) 🏷️
                    </Text>
                    <Text
                      style={[
                        cartStyles.summaryValue,
                        { fontWeight: "700", color: Colors.redAlert },
                      ]}
                    >
                      -₹{pricingBreakdown.couponDiscount.toFixed(2)}
                    </Text>
                  </View>
                )}
                {/* End Coupon Discount Row */}

                <View style={cartStyles.summaryRow}>
                  <Text style={cartStyles.summaryLabel}>
                    Platform Fee ({Math.round(PLATFORM_FEE_RATE * 100)}%)
                  </Text>
                  <Text style={cartStyles.summaryValue}>
                    ₹{pricingBreakdown.platformFee.toFixed(2)}
                  </Text>
                </View>
                <View style={cartStyles.summaryRow}>
                  <Text style={cartStyles.summaryLabel}>
                    GST ({Math.round(GST_RATE * 100)}%)
                  </Text>
                  <Text style={cartStyles.summaryValue}>
                    ₹{pricingBreakdown.gstAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={cartStyles.summaryDivider} />
                <View style={cartStyles.summaryTotalRow}>
                  <Text style={cartStyles.summaryTotalLabel}>
                    Total Payable
                  </Text>
                  <Text style={cartStyles.summaryTotalValue}>
                    ₹{pricingBreakdown.finalTotal.toFixed(2)}
                  </Text>
                </View>
                {pricingBreakdown.totalSavings > 0 && (
                  <View style={cartStyles.savingsTextContainer}>
                    <Ionicons
                      name="wallet-outline"
                      size={width * 0.04}
                      color={Colors.primaryGreen}
                    />
                    <Text style={cartStyles.savingsText}>
                      You saved ₹{pricingBreakdown.totalSavings.toFixed(2)} 🎉
                    </Text>
                  </View>
                )}
              </View>

              {/* Delivery Address Section */}
              <View style={cartStyles.section}>
                <View style={cartStyles.sectionHeaderConfirm}>
                  <Ionicons
                    name="location"
                    size={width * 0.05}
                    color={Colors.redAlert}
                  />
                  <Text style={cartStyles.sectionTitleConfirm}>
                    Delivery Address
                  </Text>
                </View>
                <View style={cartStyles.addressDetailContainer}>
                  <Text style={cartStyles.addressDetailTextBold}>
                    {address.fullName} | {address.phone}
                  </Text>
                  <Text style={cartStyles.addressDetailText}>
                    {address.street}
                    {address.street2 ? `, ${address.street2}` : ""}
                  </Text>
                  {address.landmark ? (
                    <Text style={cartStyles.addressDetailText}>
                      Landmark: {address.landmark}
                    </Text>
                  ) : null}
                  <Text style={cartStyles.addressDetailText}>
                    {address.city}, {address.state} - {address.zipCode}
                  </Text>
                  <TouchableOpacity
                    onPress={handleEditAddress}
                    style={cartStyles.editAddressButton}
                  >
                    <Ionicons
                      name="create"
                      size={width * 0.045}
                      color={Colors.blueHighlight}
                    />
                    <Text style={cartStyles.editAddressButtonText}>
                      Edit Address
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* PAYMENT METHOD SECTION */}
              <View style={cartStyles.section}>
                <View style={cartStyles.sectionHeaderConfirm}>
                  <Ionicons
                    name="wallet"
                    size={width * 0.05}
                    color={Colors.darkGreen}
                  />
                  <Text style={cartStyles.sectionTitleConfirm}>
                    Payment Method
                  </Text>
                </View>

                {/* COD Option - Section 1 */}
                <Text style={cartStyles.paymentCategoryTitle}>
                  Cash on Delivery
                </Text>
                <View style={cartStyles.codOption}>
                  <TouchableOpacity
                    style={cartStyles.paymentOptionRow}
                    onPress={handleSelectCOD}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={width * 0.06}
                      color={Colors.deepGreen}
                      style={cartStyles.paymentOptionIcon}
                    />
                    <Text style={cartStyles.codText}>Pay Cash on Delivery</Text>
                    <View style={cartStyles.codRadioOuter}>
                      {paymentMethod === "COD" && (
                        <View style={cartStyles.codRadioInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Online Payment Options - Section 2 */}
                <Text
                  style={[cartStyles.paymentCategoryTitle, { marginTop: 15 }]}
                >
                  Online Payment Options (via Razorpay)
                </Text>
                <View style={cartStyles.onlinePaymentGroup}>
                  {/* Option 1: Cards */}
                  <TouchableOpacity
                    style={[
                      cartStyles.paymentOptionRow,
                      selectedOnlineOption === "Card" &&
                        paymentMethod === "Online Payment" &&
                        cartStyles.selectedOption,
                    ]}
                    onPress={() => handleSelectOnlinePayment("Card")}
                  >
                    <Ionicons
                      name="card-outline"
                      size={width * 0.06}
                      color={Colors.darkText}
                      style={cartStyles.paymentOptionIcon}
                    />
                    <Text style={cartStyles.codText}>Credit & Debit Card</Text>
                    <View style={cartStyles.codRadioOuter}>
                      {paymentMethod === "Online Payment" &&
                        selectedOnlineOption === "Card" && (
                          <View style={cartStyles.codRadioInner} />
                        )}
                    </View>
                  </TouchableOpacity>

                  {/* Option 2: UPI */}
                  <TouchableOpacity
                    style={[
                      cartStyles.paymentOptionRow,
                      selectedOnlineOption === "UPI" &&
                        paymentMethod === "Online Payment" &&
                        cartStyles.selectedOption,
                    ]}
                    onPress={() => handleSelectOnlinePayment("UPI")}
                  >
                    <Ionicons
                      name="logo-google"
                      size={width * 0.06}
                      color={Colors.darkText}
                      style={cartStyles.paymentOptionIcon}
                    />
                    <Text style={cartStyles.codText}>
                      UPI (GPay, PhonePe, etc.)
                    </Text>
                    <View style={cartStyles.codRadioOuter}>
                      {paymentMethod === "Online Payment" &&
                        selectedOnlineOption === "UPI" && (
                          <View style={cartStyles.codRadioInner} />
                        )}
                    </View>
                  </TouchableOpacity>

                  {/* Option 3: Netbanking/Wallet */}
                  <TouchableOpacity
                    style={[
                      cartStyles.paymentOptionRow,
                      selectedOnlineOption === "Wallet" &&
                        paymentMethod === "Online Payment" &&
                        cartStyles.selectedOption,
                    ]}
                    onPress={() => handleSelectOnlinePayment("Wallet")}
                  >
                    <Ionicons
                      name="wallet-outline"
                      size={width * 0.06}
                      color={Colors.darkText}
                      style={cartStyles.paymentOptionIcon}
                    />
                    <Text style={cartStyles.codText}>Netbanking / Wallet</Text>
                    <View style={cartStyles.codRadioOuter}>
                      {paymentMethod === "Online Payment" &&
                        selectedOnlineOption === "Wallet" && (
                          <View style={cartStyles.codRadioInner} />
                        )}
                    </View>
                  </TouchableOpacity>
                </View>
                <Text style={cartStyles.paymentHintText}>
                  {paymentMethod === "COD"
                    ? "Pay cash upon successful delivery of your order."
                    : "You will be redirected to the secure Razorpay gateway to complete the payment using your chosen method."}
                </Text>
              </View>
              {/* END PAYMENT METHOD SECTION */}
            </ScrollView>

            <View style={cartStyles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowConfirmOrderModal(false)}
                style={[cartStyles.button, cartStyles.cancelButton]}
                disabled={orderLoading || isCheckingPaymentStatus}
              >
                <Text style={cartStyles.buttonText}>Review Cart</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePlaceOrderConfirmed}
                style={[
                  cartStyles.button,
                  paymentMethod === "Online Payment"
                    ? cartStyles.confirmOrderButton
                    : cartStyles.confirmOrderButtonCOD,
                ]}
                disabled={
                  orderLoading || items.length === 0 || isCheckingPaymentStatus
                }
              >
                {orderLoading || isCheckingPaymentStatus ? (
                  <ActivityIndicator
                    size="small"
                    color={Colors.white}
                    style={{ marginRight: 10 }}
                  />
                ) : (
                  <Ionicons
                    name="arrow-forward-circle"
                    size={width * 0.05}
                    color={Colors.white}
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text style={cartStyles.buttonText}>
                  {paymentMethod === "Online Payment"
                    ? `Pay ₹${pricingBreakdown.finalTotal.toFixed(2)} Online`
                    : `Place Order (COD)`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Confirm Order Modal (END) */}

      {/* Payment/Order Success Modal (START) */}
      <PaymentSuccessModal
        isVisible={showSuccessModal}
        data={successModalData}
        onClose={() => setShowSuccessModal(false)}
        navigation={navigation}
      />
      {/* Payment/Order Success Modal (END) */}
    </View>
  );
};
// --------------------------------------------------------
// STYLES (Includes styles for CouponCard, Toast, and Modals)
// --------------------------------------------------------
const cartStyles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === "ios" ? 40 : 20,
    flex: 1,
    backgroundColor: Colors.softGray,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingHorizontal: width * 0.04,
    paddingBottom: 100,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: height * 0.3,
    backgroundColor: Colors.softGray,
    borderRadius: 12,
    marginTop: height * 0.1,
  },
  loadingText: {
    marginTop: 15,
    fontSize: width * 0.05,
    fontWeight: "600",
    color: Colors.darkText,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: Colors.redAlert,
    padding: width * 0.05,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: Colors.redAlert,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  errorTitle: {
    fontSize: width * 0.055,
    fontWeight: "bold",
    color: Colors.white,
  },
  errorMessage: {
    color: Colors.white,
    textAlign: "center",
    marginTop: 8,
    fontSize: width * 0.04,
  },
  loginButton: {
    marginTop: 15,
    backgroundColor: Colors.white,
    paddingVertical: height * 0.012,
    paddingHorizontal: width * 0.05,
    borderRadius: 8,
  },
  loginButtonText: {
    color: Colors.redAlert,
    fontWeight: "bold",
    fontSize: width * 0.04,
  },
  emptyCartContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
    padding: width * 0.1,
    borderRadius: 12,
    marginTop: height * 0.05,
    marginHorizontal: width * 0.02,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  emptyCartIcon: {
    marginBottom: 20,
  },
  emptyCartText: {
    fontSize: width * 0.06,
    fontWeight: "700",
    color: Colors.darkText,
    marginBottom: 10,
    textAlign: "center",
  },
  emptyCartSubText: {
    fontSize: width * 0.04,
    color: Colors.grayText,
    textAlign: "center",
    marginBottom: 25,
  },
  shopNowButton: {
    backgroundColor: Colors.primaryGreen,
    paddingVertical: height * 0.018,
    paddingHorizontal: width * 0.07,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primaryGreen,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  shopNowButtonText: {
    color: Colors.white,
    fontSize: width * 0.045,
    fontWeight: "bold",
  },
  mainContent: {
    flexDirection: "column",
  },
  cartItemsSection: {
    marginBottom: 20,
    paddingTop: 10,
  },
  sectionHeaderTitle: {
    fontSize: width * 0.055,
    fontWeight: "bold",
    color: Colors.darkText,
    marginBottom: 18,
    borderLeftWidth: 5,
    borderLeftColor: Colors.gold,
    paddingLeft: 10,
  },
  fullScreenModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  addressModalContentFull: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: width * 0.06,
    width: "100%",
    marginTop: height * 0.1,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  modalHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    paddingBottom: 15,
  },
  modalHeaderIcon: {
    marginRight: 10,
  },
  modalTitle: {
    fontSize: width * 0.06,
    fontWeight: "bold",
    color: Colors.darkText,
    flex: 1,
    textAlign: "left",
  },
  modalCloseButton: {
    padding: 5,
  },
  requiredFieldsText: {
    fontSize: width * 0.038,
    color: Colors.grayText,
    marginBottom: 15,
  },
  addressFormScrollView: {
    flex: 1,
    paddingRight: 5,
    marginBottom: 15,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    flexWrap: "wrap",
  },
  formGroup: {
    width: "100%",
    marginBottom: 15,
  },
  formGroupHalf: {
    width: "48%",
    marginBottom: 15,
  },
  label: {
    fontSize: width * 0.04,
    fontWeight: "600",
    color: Colors.darkText,
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.mediumGray,
    borderRadius: 8,
    paddingHorizontal: width * 0.04,
    paddingVertical: height * 0.015,
    fontSize: width * 0.04,
    color: Colors.darkText,
    backgroundColor: Colors.inputBackground,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  // ✅ NEW STYLE: Red border for invalid inputs
  errorInput: {
    borderColor: Colors.redAlert,
    borderWidth: 2,
  },
  readOnlyInput: {
    backgroundColor: Colors.mediumGray,
    color: Colors.grayText,
  },
  hintText: {
    fontSize: width * 0.03,
    color: Colors.grayText,
    marginTop: 5,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 20,
    paddingBottom: 20,
  },
  button: {
    paddingVertical: height * 0.018,
    paddingHorizontal: width * 0.05,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: width * 0.3,
    flexGrow: 1,
    marginHorizontal: 5,
    flexDirection: "row",
  },
  buttonText: {
    fontSize: width * 0.042,
    fontWeight: "bold",
    color: Colors.white,
    textAlign: "center",
  },
  cancelButton: {
    backgroundColor: Colors.grayText,
    flexGrow: 0.5,
  },
  confirmButton: {
    backgroundColor: Colors.primaryGreen,
  },
  confirmModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  confirmModalHeader: {
    padding: width * 0.05,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmModalScrollViewContent: {
    flexGrow: 1,
    paddingHorizontal: width * 0.05,
    paddingVertical: height * 0.02,
  },
  section: {
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: Colors.white,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
    padding: width * 0.05,
  },
  sectionHeaderConfirm: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.softGray,
    paddingBottom: 8,
  },
  sectionTitleConfirm: {
    fontSize: width * 0.048,
    fontWeight: "bold",
    color: Colors.darkText,
    marginLeft: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: width * 0.04,
    color: Colors.grayText,
  },
  summaryValue: {
    fontSize: width * 0.04,
    fontWeight: "600",
    color: Colors.darkText,
  },
  summaryDivider: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.mediumGray,
    marginVertical: 10,
    borderStyle: "dashed",
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    alignItems: "center",
  },
  summaryTotalLabel: {
    fontSize: width * 0.05,
    fontWeight: "bold",
    color: Colors.darkText,
  },
  summaryTotalValue: {
    fontSize: width * 0.055,
    fontWeight: "900",
    color: Colors.primaryGreen,
  },
  savingsTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.successBackground,
    borderRadius: 8,
    padding: width * 0.03,
    marginTop: 15,
    borderColor: Colors.greenSuccess,
    borderWidth: 1,
  },
  savingsText: {
    fontSize: width * 0.038,
    fontWeight: "600",
    color: Colors.primaryGreen,
    marginLeft: 8,
    textAlign: "center",
  },
  addressDetailContainer: {
    backgroundColor: Colors.softGray,
    borderRadius: 8,
    padding: width * 0.04,
    borderLeftWidth: 4,
    borderLeftColor: Colors.redAlert,
  },
  addressDetailTextBold: {
    fontSize: width * 0.042,
    fontWeight: "bold",
    color: Colors.darkText,
    marginBottom: 5,
  },
  addressDetailText: {
    fontSize: width * 0.038,
    color: Colors.darkText,
    lineHeight: width * 0.06,
  },
  editAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 5,
  },
  editAddressButtonText: {
    fontSize: width * 0.038,
    color: Colors.blueHighlight,
    marginLeft: 5,
    fontWeight: "600",
  },
  // --- NEW PAYMENT UI STYLES (Unchanged) ---
  paymentCategoryTitle: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    color: Colors.darkText,
    marginBottom: 10,
  },
  codOption: {
    padding: 0,
    backgroundColor: Colors.softGray,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.mediumGray,
    marginBottom: 15,
  },
  onlinePaymentGroup: {
    backgroundColor: Colors.softGray,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.mediumGray,
  },
  paymentOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: height * 0.02,
    paddingHorizontal: width * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    justifyContent: "space-between",
  },
  paymentOptionIcon: {
    marginRight: 10,
    width: width * 0.07,
  },
  selectedOption: {
    backgroundColor: Colors.lightGray,
  },
  codText: {
    fontSize: width * 0.042,
    fontWeight: "600",
    color: Colors.darkText,
    flex: 1,
  },
  codRadioOuter: {
    width: width * 0.05,
    height: width * 0.05,
    borderRadius: width * 0.025,
    borderWidth: 2,
    borderColor: Colors.primaryGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  codRadioInner: {
    width: width * 0.028,
    height: width * 0.028,
    borderRadius: width * 0.014,
    backgroundColor: Colors.primaryGreen,
  },
  paymentHintText: {
    fontSize: width * 0.035,
    color: Colors.grayText,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.mediumGray,
    paddingTop: 8,
  },
  confirmOrderButton: {
    backgroundColor: Colors.primaryGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmOrderButtonCOD: {
    backgroundColor: Colors.richBrown,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  // 📌 General Floating Toast Style (Unchanged)
  floatingToast: {
    position: "absolute",
    bottom: height * 0.03,
    left: width * 0.04,
    right: width * 0.04,
    borderRadius: 12,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  floatingToastText: {
    color: Colors.white,
    fontSize: width * 0.042,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "flex-end",
  },
  successModalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: "100%",
    padding: width * 0.08,
    alignItems: "center",
    minHeight: height * 0.45,
  },
  successIconContainer: {
    backgroundColor: Colors.softGray,
    borderRadius: width * 0.15,
    width: width * 0.3,
    height: width * 0.3,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: width * 0.07,
    fontWeight: "bold",
    color: Colors.darkText,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: width * 0.045,
    color: Colors.grayText,
    textAlign: "center",
    marginBottom: 20,
  },
  successSpacer: {
    flex: 1,
  },
  viewOrderButton: {
    backgroundColor: Colors.richBrown,
    width: "100%",
    marginBottom: 15,
  },
  viewReceiptButton: {
    width: "100%",
    paddingVertical: 10,
  },
  viewReceiptText: {
    fontSize: width * 0.042,
    color: Colors.grayText,
    fontWeight: "600",
  },
});

export default CartScreen;
