import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  ImageBackground,
  Animated, // Import Animated
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

const { width, height } = Dimensions.get("window");

// --- 💎 LUXURY COLOR PALETTE (Replicated from CartScreen) ---
const Colors = {
  primaryGreen: "#00704A",
  darkGreen: "#00563F",
  gold: "#FFD700",
  white: "#FFFFFF",
  darkText: "#2C3E50",
  grayText: "#95A5A6",
  lightGray: "#ECF0F1",
  redAlert: "#C0392B",
  yellowStar: "#F39C12",
  greenSuccess: "#2ECC71",
  blueHighlight: "#3498DB",
  softGray: "#F4F7F9",
  mediumGray: "#BDC3C7",
  deepGreen: "#014421",
  shadow: "rgba(0, 0, 0, 0.15)",
  successBackground: "#E8F8F5", // This is too opaque, will make it more transparent for overlay
  transparentGreenOverlay: "rgba(46, 204, 113, 0.2)", // A subtle transparent green for applied state
  inputBackground: "#F5F5F5",
  darkOverlay: "rgba(0,0,0,0.3)",
  lightOverlay: "rgba(255,255,255,0.0)", // Making this fully transparent
  toastSuccess: "#D4EDDA", // Light green for toast background
  toastText: "#155724", // Dark green for toast text
  toastError: "#F8D7DA", // Light red for toast background
  toastErrorText: "#721C24", // Dark red for toast text
};

// --- Type Definitions for Props ---

interface Coupon {
  code: string;
  title: string;
  description: string;
  discountAmount: number;
}

interface CouponSectionProps {
  // Coupon State
  couponCode: string;
  couponDiscount: number;
  isCouponApplied: boolean;
  // Handlers
  handleApplyCoupon: (code: string, discountAmount: number) => void;
  handleClearCoupon: () => void;
  // Data for validation
  initialDiscountedSubtotal: number;
}

// --- Toast Type Definition ---
type ToastType = "success" | "error";

interface ToastState {
  isVisible: boolean;
  message: string;
  type: ToastType;
}

// 📌 LOCAL ASSET DEFINITION
const COUPON_BACKGROUND_IMAGE = require("../../assets/Muhammad Andy Stock Image and Video Portfolio - iStock.jpg"); // Update with your actual image path

// 📌 Toast Notification Component
const ToastNotification: React.FC<ToastState> = ({
  isVisible,
  message,
  type,
}) => {
  const [animatedValue] = useState(new Animated.Value(-100)); // Start off-screen

  const backgroundColor =
    type === "success" ? Colors.toastSuccess : Colors.toastError;
  const textColor =
    type === "success" ? Colors.toastText : Colors.toastErrorText;
  const iconName = type === "success" ? "checkmark-circle" : "close-circle";
  const iconColor = type === "success" ? Colors.greenSuccess : Colors.redAlert;

  useEffect(() => {
    if (isVisible) {
      // Slide in
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Slide out after 3 seconds
        setTimeout(() => {
          Animated.timing(animatedValue, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }, 3000);
      });
    }
  }, [isVisible]);

  if (!message) return null; // Don't render if no message

  return (
    <Animated.View
      style={[
        toastStyles.toastContainer,
        {
          backgroundColor: backgroundColor,
          transform: [{ translateY: animatedValue }],
        },
      ]}
      pointerEvents="none" // Important: allows touches to pass through the toast area
    >
      <Ionicons
        name={iconName}
        size={width * 0.05}
        color={iconColor}
        style={{ marginRight: 10 }}
      />
      <Text style={[toastStyles.toastMessage, { color: textColor }]}>
        {message}
      </Text>
    </Animated.View>
  );
};

// 📌 Coupon Card Component (Internal to this file)
const CouponCard: React.FC<
  Coupon & {
    isApplied: boolean;
    onPress: (code: string, discountAmount: number, isApplied: boolean) => void;
  }
> = ({ code, title, description, discountAmount, isApplied, onPress }) => {
  const handlePress = useCallback(() => {
    onPress(code, discountAmount, isApplied);
  }, [code, discountAmount, isApplied, onPress]);

  const buttonStyle = isApplied
    ? couponStyles.appliedButton
    : couponStyles.applyButton;

  const backgroundImageSource = COUPON_BACKGROUND_IMAGE;

  return (
    <ImageBackground
      source={backgroundImageSource}
      style={[couponStyles.couponCardBackground]}
      imageStyle={couponStyles.couponImageStyle}
    >
      {/* NEW: Status Overlay */}
      {isApplied && <View style={couponStyles.statusGreenOverlay} />}

      {/* Main content overlay (transparent) for text and button */}
      <View style={couponStyles.couponCardContentContainer}>
        <View style={couponStyles.couponDetails}>
          <Text style={couponStyles.couponTitle}>{title}</Text>
          <Text style={couponStyles.couponCodeText}>{code}</Text>
          <Text style={couponStyles.couponDescription}>{description}</Text>
        </View>
        <TouchableOpacity
          style={[couponStyles.applyButtonCouponCard, buttonStyle]}
          onPress={handlePress}
          disabled={isApplied} // Disable button when applied
        >
          <Text style={couponStyles.applyButtonText}>
            {isApplied ? "APPLIED" : "APPLY"}
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

// 📌 Main Coupon Section Component
const CouponSection: React.FC<CouponSectionProps> = ({
  couponCode,
  couponDiscount,
  isCouponApplied,
  handleApplyCoupon,
  handleClearCoupon,
  initialDiscountedSubtotal,
}) => {
  // --- Toast State ---
  const [toastState, setToastState] = useState<ToastState>({
    isVisible: false,
    message: "",
    type: "success",
  });

  const showToast = useCallback((message: string, type: ToastType) => {
    setToastState({ isVisible: true, message, type });
    // Reset the toast state after the animation completes (approx 3.6s)
    setTimeout(() => {
      setToastState((prev) => ({ ...prev, isVisible: false, message: "" }));
    }, 3600);
  }, []);

  // 🎯 LOGIC FIX: Effect to clear the FLAT200 coupon if the subtotal drops below ₹2000 AFTER it has been applied.
  useEffect(() => {
    const MIN_ORDER_VALUE = 2000;
    const TARGET_COUPON = "FLAT200";

    if (
      isCouponApplied &&
      couponCode === TARGET_COUPON &&
      initialDiscountedSubtotal < MIN_ORDER_VALUE
    ) {
      // The validation criteria are no longer met. Clear the coupon.
      handleClearCoupon();

      // Show a toast notification to the user
      showToast(
        `Coupon ${TARGET_COUPON} automatically removed. Minimum order value of ₹${MIN_ORDER_VALUE.toFixed(
          0
        )} required.`,
        "error"
      );
    }
  }, [
    initialDiscountedSubtotal,
    isCouponApplied,
    couponCode,
    handleClearCoupon,
    showToast,
  ]);

  const availableCoupons: Coupon[] = useMemo(
    () => [
      {
        code: "FIRST100",
        title: "FLAT ₹100 OFF",
        description: "For your first 5 orders.",
        discountAmount: 100,
      },
      {
        code: "FLAT200",
        title: "FLAT ₹200 OFF",
        // Logic for validation check (e.g., minimum subtotal) would go here
        description:
          initialDiscountedSubtotal >= 2000
            ? `Minimum order value of ₹2000. (Current: ₹${initialDiscountedSubtotal.toFixed(
                2
              )})`
            : `Min order ₹2000 not met. (Current: ₹${initialDiscountedSubtotal.toFixed(
                2
              )})`,
        discountAmount: 200,
      },
    ],
    [initialDiscountedSubtotal]
  );

  const handleCardPress = useCallback(
    (code: string, discountAmount: number, isApplied: boolean) => {
      // --- Validation for FLAT200 (Checked before application) ---
      if (
        code === "FLAT200" &&
        initialDiscountedSubtotal < 2000 &&
        !isApplied
      ) {
        showToast("Order minimum of ₹2000 required for FLAT200.", "error");
        return; // Stop execution
      }

      if (isApplied) {
        handleClearCoupon();
        showToast(`Coupon ${code} has been successfully removed.`, "success");
      } else {
        handleApplyCoupon(code, discountAmount);
        showToast(
          `Coupon ${code} applied! Saved ₹${discountAmount.toFixed(2)}!`,
          "success"
        );
      }
    },
    [handleApplyCoupon, handleClearCoupon, initialDiscountedSubtotal, showToast]
  );

  return (
    <View style={couponStyles.container}>
      {/* Toast is rendered first to be on top of everything */}
      <ToastNotification {...toastState} />

      <View style={couponStyles.couponSection}>
        <Text style={couponStyles.sectionHeaderTitle}>
          Available Coupons 🏷️
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={couponStyles.couponCardScroll}
        >
          {availableCoupons.map((coupon) => (
            <CouponCard
              key={coupon.code}
              {...coupon}
              isApplied={isCouponApplied && couponCode === coupon.code}
              onPress={handleCardPress}
            />
          ))}
        </ScrollView>

        {couponDiscount > 0 && (
          <View style={couponStyles.couponSuccessContainer}>
            <Ionicons
              name="gift-outline"
              size={width * 0.04}
              color={Colors.primaryGreen}
            />
            <Text style={couponStyles.couponSuccessText}>
              🎉 Coupon Savings ({couponCode}): -₹
              {couponDiscount.toFixed(2)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// --------------------------------------------------------
// NEW: TOAST STYLES (Preserved original user-provided styles)
// --------------------------------------------------------
const toastStyles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    top: 0, // Position right at the top
    left: 0,
    right: 0,
    padding: width * 0.04,
    minHeight: height * 0.08,
    zIndex: 9999, // Ensure it's on top of all other elements
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    // Luxury shadow for the toast
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  toastMessage: {
    fontSize: width * 0.04,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1, // Allows text to wrap
  },
});

// --------------------------------------------------------
// COUPON STYLES (Preserved original user-provided styles)
// --------------------------------------------------------
const couponStyles = StyleSheet.create({
  container: {
    // Add this to wrap the whole section if the coupon section is not the root view.
    // It's crucial for the absolute positioned toast to work correctly if this component is wrapped.
    // Assuming the parent component handles the view, we'll keep the toast positioning simple.
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
  couponSection: {
    marginBottom: 20,
    padding: width * 0.04,
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
  },
  couponCardScroll: {
    paddingVertical: 10,
  },
  couponCardBackground: {
    width: width * 1, // Original user-provided width
    marginRight: 15,
    borderRadius: 10,
    overflow: "hidden",
    minHeight: height * 0.1, // Original user-provided height
    justifyContent: "center",
  },
  couponImageStyle: {
    borderRadius: 10,
    resizeMode: "cover",
  },
  statusGreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.transparentGreenOverlay,
  },
  couponCardContentContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: width * 0.22, // Original user-provided padding
  },

  couponImageContainer: {
    width: width * 0.2,
    height: width * 0.1,
    marginRight: 10,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  couponDetails: {
    flex: 1,
  },
  couponTitle: {
    fontSize: width * 0.045,
    fontWeight: "900",
  },
  couponCodeText: {
    fontSize: width * 0.035,
    fontWeight: "bold",
    color: Colors.darkText,
    backgroundColor: Colors.gold,
    paddingHorizontal: 5,
    borderRadius: 3,
    alignSelf: "flex-start",
    marginVertical: 2,
  },
  couponDescription: {
    fontSize: width * 0.03,
  },
  applyButtonCouponCard: {
    paddingVertical: height * 0.01,
    paddingHorizontal: width * 0.03,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    minWidth: width * 0.15,
  },
  applyButton: {
    backgroundColor: Colors.primaryGreen,
  },
  appliedButton: {
    backgroundColor: Colors.deepGreen,
  },
  applyButtonText: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: width * 0.04,
  },
  couponSuccessContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.successBackground,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  couponSuccessText: {
    fontSize: width * 0.038,
    color: Colors.primaryGreen,
    fontWeight: "bold",
    marginLeft: 8,
  },
});

export default CouponSection;
