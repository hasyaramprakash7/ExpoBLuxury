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
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { RootState } from "../app/store";
import { fetchCart, clearCart } from "../features/cart/cartSlice";
import { placeOrder } from "../features/orders/orderSlice";
import CartItem from "./CartItem";
import OrderSummary from "./OrderSummary";
import { useNavigation, NavigationProp } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

// --- Color Palette (Consistency) ---
const Colors = {
  primaryGreen: "#00704A", // Starbucks green equivalent
  darkGreen: "#00563F", // Darker green for accents
  gold: "#FFD700",
  white: "#FFFFFF",
  darkText: "#4A2C2A",
  grayText: "gray",
  lightGray: "#DDDDDD",
  redAlert: "#DC2626",
  yellowStar: "#F59E0B",
  greenSuccess: "#10B981",
  blueHighlight: "#3498db",
  softGray: "#F8F5F0", // Equivalent to gray-50
  mediumGray: "#E5E7EB", // Equivalent to gray-200
  deepGreen: "#014421", // Very dark green for strong buttons
};

// --- Type Definitions ---
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

// Interface for Product data as it appears when populated in CartItem
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
  companyName?: string; // Often needed for display
}

// Cart Item as retrieved from Redux (after populate)
interface CartReduxItem {
  productId: ProductInCart; // Populated product data
  quantity: number;
  price: number; // Price at the time of adding to cart
  vendorId: string; // Vendor ID for the item
  _id: string; // Cart item ID
}

// Define your root navigation parameters if you have a RootStackParamList
type RootStackParamList = {
  LoginScreen: undefined;
  UserOrderScreen: undefined;
  OrderScreen: undefined; // Assuming 'OrderScreen' is where products are displayed
};

const CartScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const { items, loading, error } = useSelector(
    (state: RootState) => state.cart
  );
  const { loading: orderLoading } = useSelector(
    (state: RootState) => state.order
  );
  const authUser = useSelector((state: RootState) => state.auth.user);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"COD">("COD");
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showConfirmOrderModal, setShowConfirmOrderModal] = useState(false);

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

  // Pricing constants - centralized
  const DELIVERY_CHARGE = 75;
  const FREE_DELIVERY_THRESHOLD = 250;
  const PLATFORM_FEE_RATE = 0.03; // 3%
  const GST_RATE = 0.05; // 5% GST

  // Helper function to calculate effective price (passed to CartItem)
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
    []
  );

  // Function to handle auto-filling city and state based on pincode using Nominatim
  const handlePincodeBlur = useCallback(async () => {
    const zipCode = address.zipCode;
    if (!zipCode || zipCode.length !== 6 || isNaN(Number(zipCode))) {
      Alert.alert(
        "Invalid Pincode",
        "Please enter a valid 6-digit pincode to auto-fill city/state."
      );
      return;
    }
    try {
      const res = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            postalcode: zipCode,
            format: "json",
            addressdetails: 1,
            countrycodes: "in",
            limit: 1,
          },
          headers: {
            "User-Agent":
              "GrocerEase-ReactNativeApp/1.0 (contact@grocer-ease.com)",
          },
        }
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
        Alert.alert("Success", "City and State pre-filled from pincode!");
      } else {
        Alert.alert("Info", "No address details found for this pincode.");
      }
    } catch (err) {
      console.error("Error fetching from pincode:", err);
      Alert.alert(
        "Error",
        "Failed to fetch address from pincode. Please try again or fill manually."
      );
    }
  }, [address.zipCode]);

  // Effect hook to fetch cart and auto-detect/pre-fill address based on geolocation
  useEffect(() => {
    dispatch(fetchCart());

    const loadUserData = async () => {
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
      } catch (e) {
        console.error("Failed to load user data from async storage", e);
      }
    };

    loadUserData();

    const getGeoLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission to access location was denied. Please enable it in settings to auto-fill address."
        );
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
          }
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
        // Alert.alert("Success", "Location detected and address pre-filled!");
      } catch (error: any) {
        console.error("Geolocation or Reverse geocoding failed:", error);
        Alert.alert(
          "Warning",
          "Failed to auto-detect address from location. Please fill manually. " +
            (error.message || "")
        );
      }
    };
    getGeoLocation();
  }, [dispatch]);

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
              Alert.alert("Success", "Cart cleared successfully!");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to clear cart.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleAddressChange = (name: keyof Address, value: string) => {
    setAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenAddressModal = () => {
    if (!authUser?._id) {
      Alert.alert(
        "Login Required",
        "You need to be logged in to place an order."
      );
      navigation.navigate("LoginScreen");
      return;
    }
    if (items.length === 0) {
      Alert.alert(
        "Empty Cart",
        "Your cart is empty. Add items before placing an order."
      );
      return;
    }
    setShowAddressModal(true);
  };

  const handleConfirmAddress = () => {
    if (
      !address.fullName.trim() ||
      !address.phone.trim() ||
      !address.street.trim() ||
      !address.city.trim() ||
      !address.state.trim() ||
      !address.zipCode.trim()
    ) {
      Alert.alert(
        "Missing Fields",
        "Please fill in all required fields (Full Name, Phone, Street, City, State, ZIP Code)."
      );
      return;
    }
    if (!/^\d{10}$/.test(address.phone.trim())) {
      Alert.alert(
        "Invalid Phone",
        "Please enter a valid 10-digit phone number."
      );
      return;
    }
    if (!/^\d{6}$/.test(address.zipCode.trim())) {
      Alert.alert("Invalid ZIP Code", "Please enter a valid 6-digit ZIP code.");
      return;
    }
    setShowAddressModal(false);
    setShowConfirmOrderModal(true);
  };

  const handleEditAddress = () => {
    setShowConfirmOrderModal(false);
    setShowAddressModal(true);
  };

  // Memoize pricing calculations for the overall cart summary display
  const pricingBreakdown = useMemo(() => {
    const itemsSubtotal = items.reduce((sum, item) => {
      const product = (item.productId as ProductInCart) || {};
      const originalPrice = product.price || 0;
      return sum + originalPrice * item.quantity;
    }, 0);

    const discountedSubtotal = items.reduce((sum, item) => {
      const product = (item.productId as ProductInCart) || {};
      const effectivePrice = getEffectivePrice(product, item.quantity);
      return sum + effectivePrice * item.quantity;
    }, 0);

    const totalSavings = itemsSubtotal - discountedSubtotal;

    // These are placeholders for display purposes, actual fees are calculated per vendor below
    const deliveryCharge =
      discountedSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
    const platformFee = discountedSubtotal * PLATFORM_FEE_RATE;
    const gstAmount = (discountedSubtotal + platformFee) * GST_RATE;
    const finalTotal =
      discountedSubtotal + deliveryCharge + platformFee + gstAmount;

    return {
      itemsSubtotal,
      discountedSubtotal,
      totalSavings,
      deliveryCharge,
      platformFee,
      gstAmount,
      finalTotal,
    };
  }, [
    items,
    getEffectivePrice,
    DELIVERY_CHARGE,
    FREE_DELIVERY_THRESHOLD,
    PLATFORM_FEE_RATE,
    GST_RATE,
  ]);

  const handlePlaceOrderConfirmed = async () => {
    const user = authUser;
    const token = authUser?.token;

    if (!token || !user?._id) {
      Alert.alert(
        "Login Required",
        "You need to be logged in to place an order."
      );
      setShowConfirmOrderModal(false);
      navigation.navigate("LoginScreen");
      return;
    }

    const invalidItems = items.filter(
      (item) => !item.productId?._id || !item.productId?.vendorId
    );
    if (invalidItems.length > 0) {
      Alert.alert(
        "Invalid Items",
        "Some items in your cart are invalid or missing vendor information. Please remove them."
      );
      return;
    }
    if (items.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty. No order to place.");
      setShowConfirmOrderModal(false);
      return;
    }

    // Group items by vendor
    const vendorGroups: { [key: string]: CartReduxItem[] } = items.reduce(
      (groups: { [key: string]: CartReduxItem[] }, item) => {
        const product = item.productId as ProductInCart;
        const vendorId = product.vendorId;
        if (!groups[vendorId]) groups[vendorId] = [];
        groups[vendorId].push(item);
        return groups;
      },
      {}
    );

    try {
      for (const vendorId in vendorGroups) {
        const vendorItems = vendorGroups[vendorId];
        // Calculate totals and fees for the current vendor group
        const vendorDiscountedSubtotal = vendorItems.reduce((sum, item) => {
          const product = item.productId as ProductInCart;
          return (
            sum + getEffectivePrice(product, item.quantity) * item.quantity
          );
        }, 0);

        const vendorDeliveryCharge =
          vendorDiscountedSubtotal >= FREE_DELIVERY_THRESHOLD
            ? 0
            : DELIVERY_CHARGE;
        const vendorPlatformFee = vendorDiscountedSubtotal * PLATFORM_FEE_RATE;
        const vendorGstAmount =
          (vendorDiscountedSubtotal + vendorPlatformFee) * GST_RATE;
        const vendorTotal =
          vendorDiscountedSubtotal +
          vendorDeliveryCharge +
          vendorPlatformFee +
          vendorGstAmount;

        const orderData = {
          userId: user._id,
          vendorId,
          address: {
            ...address,
            latitude: latitude,
            longitude: longitude,
          },
          items: vendorItems.map((item) => ({
            productId: (item.productId as ProductInCart)._id,
            name: (item.productId as ProductInCart).name,
            quantity: item.quantity,
            price: getEffectivePrice(
              item.productId as ProductInCart,
              item.quantity
            ),
            productImage: (item.productId as ProductInCart).images?.[0],
            vendorId: (item.productId as ProductInCart).vendorId,
          })),
          total: vendorTotal,
          subtotal: vendorDiscountedSubtotal,
          deliveryCharge: vendorDeliveryCharge,
          platformFee: vendorPlatformFee,
          gstAmount: vendorGstAmount,
          totalSavings: 0, // Recalculate if needed per vendor
          status: "placed",
          paymentMethod,
        };

        await dispatch(placeOrder(orderData)).unwrap();
      }

      Alert.alert(
        "Success",
        `Orders placed successfully for all vendors! You can track them on the "My Orders" screen.`
      );
      await dispatch(clearCart()).unwrap();
      setShowConfirmOrderModal(false);
      navigation.navigate("UserOrderScreen");
    } catch (err: any) {
      console.error("Order placement error:", err);
      Alert.alert(
        "Order Failed",
        err.message?.message ||
          err.message ||
          "An unexpected error occurred during order placement."
      );
      setShowConfirmOrderModal(false);
    }
  };

  return (
    <View style={cartStyles.container}>
      <ScrollView contentContainerStyle={cartStyles.scrollViewContent}>
        {loading && (
          <View style={cartStyles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primaryGreen} />
            <Text style={cartStyles.loadingText}>Loading your cart...</Text>
          </View>
        )}
        {error && (
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
        )}
        {!loading && !error && items.length === 0 ? (
          <View style={cartStyles.emptyCartContainer}>
            <Ionicons
              name="cart-outline"
              size={width * 0.18}
              color={Colors.grayText}
              style={cartStyles.emptyCartIcon}
            />
            <Text style={cartStyles.emptyCartText}>
              Your cart is feeling a little empty.
            </Text>
            <Text style={cartStyles.emptyCartSubText}>
              Discover amazing products and fill it up!
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Home")}
              style={cartStyles.shopNowButton}
            >
              <Text style={cartStyles.shopNowButtonText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={cartStyles.mainContent}>
            <View style={cartStyles.cartItemsSection}>
              {items.map((item: CartReduxItem) => (
                <CartItem key={item._id} item={item} loading={loading} />
              ))}
            </View>
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
      {/* Address Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddressModal}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={cartStyles.modalOverlay}>
          <View style={cartStyles.addressModalContent}>
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
              <View style={cartStyles.formRow}>
                <View style={cartStyles.formGroup}>
                  <Text style={cartStyles.label}>
                    Full Name <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={cartStyles.textInput}
                    value={address.fullName}
                    onChangeText={(text) =>
                      handleAddressChange("fullName", text)
                    }
                    placeholder="John Doe"
                    autoCapitalize="words"
                  />
                </View>
                <View style={cartStyles.formGroup}>
                  <Text style={cartStyles.label}>
                    Phone Number{" "}
                    <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={cartStyles.textInput}
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
                  style={cartStyles.textInput}
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
                <View style={cartStyles.formGroup}>
                  <Text style={cartStyles.label}>
                    ZIP Code <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={cartStyles.textInput}
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
                <View style={cartStyles.formGroup}>
                  <Text style={cartStyles.label}>
                    City <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={cartStyles.textInput}
                    value={address.city}
                    onChangeText={(text) => handleAddressChange("city", text)}
                    placeholder="City"
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={cartStyles.formRow}>
                <View style={cartStyles.formGroup}>
                  <Text style={cartStyles.label}>
                    State <Text style={{ color: Colors.redAlert }}>*</Text>
                  </Text>
                  <TextInput
                    style={cartStyles.textInput}
                    value={address.state}
                    onChangeText={(text) => handleAddressChange("state", text)}
                    placeholder="State"
                    autoCapitalize="words"
                  />
                </View>
                <View style={cartStyles.formGroup}>
                  <Text style={cartStyles.label}>Country</Text>
                  <TextInput
                    style={[cartStyles.textInput, cartStyles.readOnlyInput]}
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
        </View>
      </Modal>
      {/* Confirm Order Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showConfirmOrderModal}
        onRequestClose={() => setShowConfirmOrderModal(false)}
      >
        <View style={cartStyles.modalOverlay}>
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
            <ScrollView style={cartStyles.confirmModalScrollView}>
              <View style={cartStyles.section}>
                <View style={cartStyles.sectionHeaderConfirm}>
                  <Ionicons
                    name="receipt"
                    size={width * 0.05}
                    color={Colors.blueHighlight}
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
                  {pricingBreakdown.deliveryCharge === 0 ? (
                    <View style={cartStyles.freeDelivery}>
                      <Ionicons
                        name="checkmark-circle"
                        size={width * 0.04}
                        color={Colors.greenSuccess}
                      />
                      <Text style={cartStyles.freeDeliveryText}>FREE</Text>
                    </View>
                  ) : (
                    <Text style={cartStyles.summaryValue}>
                      ₹{pricingBreakdown.deliveryCharge.toFixed(2)}
                    </Text>
                  )}
                </View>
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
                      name="cash"
                      size={width * 0.04}
                      color={Colors.primaryGreen}
                    />
                    <Text style={cartStyles.savingsText}>
                      Your Total Savings ₹
                      {pricingBreakdown.totalSavings.toFixed(2)} 🎉
                    </Text>
                  </View>
                )}
              </View>
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
                    {address.fullName} - {address.phone}
                  </Text>
                  <Text style={cartStyles.addressDetailText}>
                    {address.street}
                  </Text>
                  {address.street2 ? (
                    <Text style={cartStyles.addressDetailText}>
                      {address.street2}
                    </Text>
                  ) : null}
                  {address.landmark ? (
                    <Text style={cartStyles.addressDetailText}>
                      Landmark: {address.landmark}
                    </Text>
                  ) : null}
                  <Text style={cartStyles.addressDetailText}>
                    {address.city}, {address.state} - {address.zipCode}
                  </Text>
                  <Text style={cartStyles.addressDetailText}>
                    {address.country}
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
                <View style={cartStyles.paymentMethodContainer}>
                  <View style={cartStyles.codOption}>
                    <View style={cartStyles.codRadioOuter}>
                      <View style={cartStyles.codRadioInner} />
                    </View>
                    <Text style={cartStyles.codText}>
                      Cash on Delivery (COD)
                    </Text>
                  </View>
                  <Text style={cartStyles.paymentHintText}>
                    Currently, only Cash on Delivery is available.
                  </Text>
                </View>
              </View>
            </ScrollView>
            <View style={cartStyles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowConfirmOrderModal(false)}
                style={[cartStyles.button, cartStyles.cancelButton]}
              >
                <Text style={cartStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePlaceOrderConfirmed}
                style={[cartStyles.button, cartStyles.confirmOrderButton]}
                disabled={orderLoading || items.length === 0}
              >
                {orderLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={Colors.white}
                    style={{ marginRight: 10 }}
                  />
                ) : (
                  <Ionicons
                    name="checkmark-circle"
                    size={width * 0.05}
                    color={Colors.white}
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text style={cartStyles.buttonText}>Place Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
const cartStyles = StyleSheet.create({
  container: {
    paddingTop: 25,
    flex: 1,
    backgroundColor: Colors.softGray,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === "ios" ? 40 : 20,
    paddingHorizontal: width * 0.04,
    paddingBottom: 120,
  },
  header: {
    fontSize: width * 0.08,
    fontWeight: "bold",
    color: Colors.darkText,
    textAlign: "center",
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: height * 0.2,
  },
  loadingText: {
    marginTop: 10,
    fontSize: width * 0.045,
    color: Colors.grayText,
  },
  errorContainer: {
    backgroundColor: Colors.redAlert,
    padding: width * 0.04,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: width * 0.05,
    fontWeight: "bold",
    color: Colors.white,
  },
  errorMessage: {
    color: Colors.white,
    textAlign: "center",
    marginTop: 5,
    fontSize: width * 0.04,
  },
  loginButton: {
    marginTop: 10,
    backgroundColor: Colors.white,
    paddingVertical: height * 0.01,
    paddingHorizontal: width * 0.04,
    borderRadius: 5,
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
    marginHorizontal: width * 0.05,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  emptyCartIcon: {
    marginBottom: 15,
  },
  emptyCartText: {
    fontSize: width * 0.055,
    fontWeight: "600",
    color: Colors.grayText,
    marginBottom: 5,
    textAlign: "center",
  },
  emptyCartSubText: {
    fontSize: width * 0.04,
    color: Colors.grayText,
    textAlign: "center",
    marginBottom: 20,
  },
  shopNowButton: {
    backgroundColor: Colors.primaryGreen,
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.06,
    borderRadius: 8,
    shadowColor: Colors.darkGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
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
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: width * 0.02,
  },
  addressModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: width * 0.06,
    width: "95%",
    maxHeight: height * 0.9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    paddingBottom: 10,
  },
  modalHeaderIcon: {
    marginRight: 10,
  },
  modalTitle: {
    fontSize: width * 0.06,
    fontWeight: "bold",
    color: Colors.darkText,
    flex: 1,
    textAlign: "center",
  },
  modalCloseButton: {
    padding: 5,
  },
  requiredFieldsText: {
    fontSize: width * 0.035,
    color: Colors.grayText,
    textAlign: "center",
    marginBottom: 15,
  },
  addressFormScrollView: {
    maxHeight: height * 0.65,
    paddingRight: 5,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  formGroup: {
    width: Platform.OS === "web" && width > 768 ? "48%" : "100%",
    marginBottom: 10,
    ...Platform.select({
      web: width > 768 ? { marginHorizontal: "1%" } : {},
      default: {},
    }),
  },
  label: {
    fontSize: width * 0.038,
    fontWeight: "500",
    color: Colors.darkText,
    marginBottom: 5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 8,
    paddingHorizontal: width * 0.03,
    paddingVertical: height * 0.012,
    fontSize: width * 0.04,
    color: Colors.darkText,
    backgroundColor: Colors.white,
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
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 15,
  },
  button: {
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.05,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: width * 0.03,
    minWidth: width * 0.28,
    flexGrow: 1,
  },
  buttonText: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    color: Colors.white,
  },
  cancelButton: {
    backgroundColor: Colors.mediumGray,
  },
  confirmButton: {
    backgroundColor: Colors.primaryGreen,
  },
  confirmModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    width: "95%",
    maxHeight: "90%",
    height: "100%",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    overflow: "hidden",
  },
  confirmModalHeader: {
    padding: width * 0.05,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmModalScrollView: {
    flex: 1,
    paddingHorizontal: width * 0.05,
    paddingVertical: height * 0.02,
  },
  section: {
    marginBottom: 20,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    padding: width * 0.04,
  },
  sectionHeaderConfirm: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
    paddingVertical: 5,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: width * 0.04,
    color: Colors.grayText,
  },
  summaryValue: {
    fontSize: width * 0.04,
    fontWeight: "500",
    color: Colors.darkText,
  },
  freeDelivery: {
    flexDirection: "row",
    alignItems: "center",
  },
  freeDeliveryText: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    color: Colors.greenSuccess,
    marginLeft: 5,
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
    marginVertical: 10,
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    alignItems: "center",
  },
  summaryTotalLabel: {
    fontSize: width * 0.05,
    fontWeight: "bold",
    color: Colors.darkText,
  },
  summaryTotalValue: {
    fontSize: width * 0.05,
    fontWeight: "bold",
    color: Colors.primaryGreen,
  },
  savingsTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSuccess + "10",
    borderRadius: 8,
    padding: width * 0.025,
    marginTop: 10,
    borderColor: Colors.greenSuccess,
    borderWidth: 1,
  },
  savingsText: {
    fontSize: width * 0.038,
    fontWeight: "bold",
    color: Colors.primaryGreen,
    marginLeft: 5,
    textAlign: "center",
  },
  addressDetailContainer: {
    backgroundColor: Colors.softGray,
    borderRadius: 8,
    padding: width * 0.04,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  addressDetailTextBold: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    color: Colors.darkText,
    marginBottom: 5,
  },
  addressDetailText: {
    fontSize: width * 0.038,
    color: Colors.grayText,
    lineHeight: width * 0.055,
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
    fontWeight: "bold",
  },
  paymentMethodContainer: {
    backgroundColor: Colors.softGray,
    borderRadius: 8,
    padding: width * 0.04,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  codOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  codRadioOuter: {
    width: width * 0.045,
    height: width * 0.045,
    borderRadius: width * 0.0225,
    borderWidth: 2,
    borderColor: Colors.primaryGreen,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  codRadioInner: {
    width: width * 0.025,
    height: width * 0.025,
    borderRadius: width * 0.0125,
    backgroundColor: Colors.primaryGreen,
  },
  codText: {
    fontSize: width * 0.04,
    fontWeight: "600",
    color: Colors.darkText,
  },
  paymentHintText: {
    fontSize: width * 0.035,
    color: Colors.grayText,
    marginTop: 5,
  },
  confirmOrderButton: {
    backgroundColor: Colors.primaryGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
export default CartScreen;
