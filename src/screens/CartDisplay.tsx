// CartDisplay.tsx
import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { Colors, cartStyles } from "../theme/styles"; // Import styles/colors
import VendorOrderGroup, { VendorGroupProps } from "./VendorOrderGroup";
import OrderSummary from "./OrderSummary";

const { width } = Dimensions.get("window");

const CartDisplay: React.FC<
  any /* Use proper props type for better practice */
> = ({
  items,
  loading,
  error,
  isRefreshing,
  onRefresh,
  vendorOrderGroups,
  pricingBreakdown,
  paymentMethod,
  setPaymentMethod,
  handleOpenAddressModal,
  handleClear,
  orderLoading,
  navigation,
  FREE_DELIVERY_THRESHOLD,
  DELIVERY_CHARGE,
  PLATFORM_FEE_RATE,
  GST_RATE,
}) => {
  if (loading) {
    return (
      <View style={cartStyles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primaryGreen} />
        <Text style={cartStyles.loadingText}>Loading your cart...</Text>
      </View>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (items.length === 0) {
    return (
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
          onPress={() => navigation.navigate("UserTabs", { screen: "Home" })}
          style={cartStyles.shopNowButton}
        >
          <Text style={cartStyles.shopNowButtonText}>Shop Collection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
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
            />
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
    </ScrollView>
  );
};

export default CartDisplay;
