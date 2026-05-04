import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
// Removed: import { Picker } from "@react-native-picker/picker";
import Ionicons from "@expo/vector-icons/Ionicons";

// --- Color Palette (Rolex-inspired) ---
const Colors = {
  rolexGreen: "#00563F", // Deep, rich green (Used for deep/royal COD color)
  rolexGold: "#B8860B", // Muted, elegant gold
  rolexDarkText: "#2C2C2C", // Almost black for strong contrast
  rolexLightText: "#6F6F6F", // Soft gray for secondary text
  rolexWhite: "#FFFFFF",
  rolexPlatinum: "#E0E0E0", // Light gray/off-white for backgrounds and dividers
  rolexAccentGold: "#DAA520", // Brighter gold for highlights
  rorolexRed: "#A30000", // A sophisticated red for alerts
  rolexSuccess: "#00704A", // A slightly brighter green for success messages
};

// --- Type Definitions (UNCHANGED) ---
interface PricingBreakdown {
  itemsSubtotal: number;
  discountedSubtotal: number;
  totalSavings: number;
  deliveryCharge: number;
  platformFee: number;
  gstAmount: number;
  finalTotal: number;
}

interface SimpleCartItem {
  _id: string;
  quantity: number;
  productId: {
    _id: string;
  };
}

interface OrderSummaryProps {
  items: SimpleCartItem[];
  pricingBreakdown: PricingBreakdown;
  DELIVERY_CHARGE: number;
  FREE_DELIVERY_THRESHOLD: number;
  PLATFORM_FEE_RATE: number;
  GST_RATE: number;
  paymentMethod: "COD" | "Online Payment";
  setPaymentMethod: (method: "COD" | "Online Payment") => void;
  handleOpenAddressModal: () => void;
  handleClear: () => void;
  orderLoading: boolean;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  items,
  pricingBreakdown,
  DELIVERY_CHARGE,
  FREE_DELIVERY_THRESHOLD,
  PLATFORM_FEE_RATE,
  GST_RATE,
  paymentMethod,
  setPaymentMethod,
  handleOpenAddressModal,
  handleClear,
  orderLoading,
}) => {
  const [showFeesDetails, setShowFeesDetails] = useState(false);

  const toggleFeesDetails = () => {
    setShowFeesDetails(!showFeesDetails);
  };

  // Dynamically update the button text
  const buttonText =
    paymentMethod === "Online Payment" ? "Proceed to Payment" : "Place Order";

  const isOnlineSelected = paymentMethod === "Online Payment";
  const isCODSelected = paymentMethod === "COD";

  return (
    <View style={summaryStyles.container}>
      <View style={summaryStyles.card}>
        <View style={summaryStyles.header}>
          <Ionicons
            name="receipt-outline"
            size={26}
            color={Colors.rolexDarkText}
          />
          <Text style={summaryStyles.headerText}>Order Summary</Text>
        </View>

        {/* --- Pricing Details (UNCHANGED) --- */}

        {/* Item Subtotal Row */}
        <View style={summaryStyles.detailRow}>
          <Text style={summaryStyles.detailLabel}>Items ({items.length})</Text>
          <Text style={summaryStyles.detailValue}>
            ₹{pricingBreakdown.itemsSubtotal.toFixed(2)}
          </Text>
        </View>

        {/* Savings Row (Conditional) */}
        {pricingBreakdown.totalSavings > 0 && (
          <View style={summaryStyles.detailRow}>
            <Text style={summaryStyles.detailLabelSavings}>Savings</Text>
            <Text style={summaryStyles.detailValueSavings}>
              - ₹{pricingBreakdown.totalSavings.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Discounted Subtotal Row */}
        <View style={summaryStyles.detailRow}>
          <Text style={summaryStyles.detailLabel}>Discounted Subtotal</Text>
          <Text style={summaryStyles.detailValueBold}>
            ₹{pricingBreakdown.discountedSubtotal.toFixed(2)}
          </Text>
        </View>

        {/* Combined Fees with Dropdown Toggle */}
        <TouchableOpacity
          onPress={toggleFeesDetails}
          style={{ marginBottom: 10 }}
        >
          <View style={summaryStyles.detailRow}>
            <Text style={summaryStyles.detailLabel}>Fees & Taxes</Text>
            <Ionicons
              name={showFeesDetails ? "chevron-up" : "chevron-down"}
              size={20}
              color={Colors.rolexLightText}
              style={summaryStyles.feesToggleIcon}
            />
          </View>
        </TouchableOpacity>

        {/* Fees Breakdown (Conditional) */}
        {showFeesDetails && (
          <View style={summaryStyles.feesBreakdown}>
            <View style={summaryStyles.feesDetailRow}>
              <Text style={summaryStyles.feesDetailLabel}>
                Platform Fee ({Math.round(PLATFORM_FEE_RATE * 100)}%)
              </Text>
              <Text style={summaryStyles.feesDetailValue}>
                ₹{pricingBreakdown.platformFee.toFixed(2)}
              </Text>
            </View>
            <View style={summaryStyles.feesDetailRow}>
              <Text style={summaryStyles.feesDetailLabel}>
                GST ({Math.round(GST_RATE * 100)}%)
              </Text>
              <Text style={summaryStyles.feesDetailValue}>
                ₹{pricingBreakdown.gstAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Delivery Charges Row */}
        <View style={summaryStyles.detailRow}>
          <Text style={summaryStyles.detailLabel}>Delivery Charges</Text>
          {pricingBreakdown.deliveryCharge === 0 ? (
            <View style={summaryStyles.freeDeliveryContainer}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={Colors.rolexSuccess}
              />
              <Text style={summaryStyles.freeDeliveryText}>FREE</Text>
            </View>
          ) : (
            <Text style={summaryStyles.detailValue}>
              ₹{pricingBreakdown.deliveryCharge.toFixed(2)}
            </Text>
          )}
        </View>

        {/* Free Delivery Hint (Conditional) */}
        {pricingBreakdown.discountedSubtotal > 0 &&
          pricingBreakdown.discountedSubtotal < FREE_DELIVERY_THRESHOLD && (
            <View style={summaryStyles.deliveryHint}>
              <Ionicons name="car-outline" size={20} color={Colors.rolexGold} />
              <Text style={summaryStyles.deliveryHintText}>
                Add ₹
                {(
                  FREE_DELIVERY_THRESHOLD - pricingBreakdown.discountedSubtotal
                ).toFixed(2)}{" "}
                more for **FREE** delivery!
              </Text>
            </View>
          )}

        <View style={summaryStyles.divider} />

        {/* Total Amount Row */}
        <View style={summaryStyles.totalRow}>
          <Text style={summaryStyles.totalLabel}>Total Payable</Text>
          <Text style={summaryStyles.totalValue}>
            ₹{pricingBreakdown.finalTotal.toFixed(2)}
          </Text>
        </View>

        {/* Total Savings Message (Conditional) */}
        {pricingBreakdown.totalSavings > 0 && (
          <View style={summaryStyles.totalSavingsMessage}>
            <Ionicons
              name="wallet-outline"
              size={22}
              color={Colors.rolexSuccess}
            />
            <Text style={summaryStyles.totalSavingsText}>
              You're saving **₹{pricingBreakdown.totalSavings.toFixed(2)}** on
              this order!
            </Text>
          </View>
        )}

        {/* --- Payment Method Selector (CUSTOM UI) --- */}
        <View style={summaryStyles.paymentMethodSection}>
          <Text style={summaryStyles.paymentMethodLabel}>
            Select Payment Method
          </Text>
          <View style={summaryStyles.paymentOptionsContainer}>
            {/* Option 1: Online Payment */}
            <TouchableOpacity
              style={[
                summaryStyles.paymentOption,
                isOnlineSelected && summaryStyles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod("Online Payment")}
            >
              <Ionicons
                name={isOnlineSelected ? "radio-button-on" : "radio-button-off"}
                size={24}
                color={
                  isOnlineSelected ? Colors.rolexGreen : Colors.rolexLightText
                }
              />
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={summaryStyles.optionTitle}>Online Payment</Text>
                <Text style={summaryStyles.optionSubtitle}>
                  (Card, UPI, Netbanking via Razorpay)
                </Text>
              </View>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={Colors.rolexLightText}
              />
            </TouchableOpacity>

            {/* Option 2: Cash on Delivery (COD) */}
            <TouchableOpacity
              style={[
                summaryStyles.paymentOption,
                isCODSelected && summaryStyles.paymentOptionSelected,
                { marginTop: 10 },
              ]}
              onPress={() => setPaymentMethod("COD")}
            >
              <Ionicons
                name={isCODSelected ? "radio-button-on" : "radio-button-off"}
                size={24}
                color={
                  isCODSelected ? Colors.rolexGreen : Colors.rolexLightText
                }
              />
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text
                  style={[
                    summaryStyles.optionTitle,
                    summaryStyles.codOptionTitle,
                  ]}
                >
                  Cash on Delivery (COD)
                </Text>
                <Text style={summaryStyles.optionSubtitle}>
                  Pay cash upon successful delivery.
                </Text>
              </View>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={Colors.rolexLightText}
              />
            </TouchableOpacity>
          </View>

          <Text style={summaryStyles.paymentMethodHint}>
            {paymentMethod === "COD"
              ? "Final confirmation and address entry occurs after clicking 'Place Order'."
              : "Proceed to Payment will take you to the secure Razorpay gateway."}
          </Text>
        </View>
        {/* --- End Custom Payment UI --- */}

        {/* Action Buttons */}
        <View style={summaryStyles.actionButtonsContainer}>
          <TouchableOpacity
            onPress={handleOpenAddressModal}
            style={[
              summaryStyles.placeOrderButton,
              (orderLoading || items.length === 0) &&
                summaryStyles.buttonDisabled,
            ]}
            disabled={orderLoading || items.length === 0}
          >
            {orderLoading ? (
              <ActivityIndicator
                size="small"
                color={Colors.rolexWhite}
                style={{ marginRight: 10 }}
              />
            ) : null}
            <Text style={summaryStyles.placeOrderButtonText}>{buttonText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClear}
            style={[
              summaryStyles.clearCartButton,
              (orderLoading || items.length === 0) &&
                summaryStyles.buttonDisabled,
            ]}
            disabled={orderLoading || items.length === 0}
          >
            <Text style={summaryStyles.clearCartButtonText}>Clear Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const summaryStyles = StyleSheet.create({
  container: {
    width: "100%",
    marginTop: 25,
  },
  card: {
    backgroundColor: Colors.rolexWhite,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    padding: 25,
    borderColor: Colors.rolexPlatinum,
    borderWidth: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
    paddingBottom: 12,
    borderBottomWidth: 0.7,
    borderBottomColor: Colors.rolexPlatinum,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "600",
    color: Colors.rolexDarkText,
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  feesToggleIcon: {
    marginLeft: 5,
  },
  feesBreakdown: {
    backgroundColor: Colors.rolexPlatinum,
    borderRadius: 8,
    padding: 15,
    marginTop: -5,
    marginBottom: 10,
  },
  feesDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  feesDetailLabel: {
    fontSize: 14,
    color: Colors.rolexDarkText,
    fontFamily: "serif",
  },
  feesDetailValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.rolexDarkText,
    fontFamily: "serif",
  },
  detailLabel: {
    fontSize: 16,
    color: Colors.rolexLightText,
    fontFamily: "serif",
  },
  detailLabelSavings: {
    fontSize: 16,
    color: Colors.rolexSuccess,
    fontWeight: "500",
    fontFamily: "serif",
  },
  detailValue: {
    fontSize: 16,
    color: Colors.rolexDarkText,
    fontFamily: "serif",
  },
  detailValueSavings: {
    fontSize: 16,
    color: Colors.rolexSuccess,
    fontWeight: "500",
    fontFamily: "serif",
  },
  detailValueBold: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.rolexDarkText,
    fontFamily: "serif",
  },
  freeDeliveryContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  freeDeliveryText: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.rolexSuccess,
    marginLeft: 6,
    fontFamily: "serif",
  },
  deliveryHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.rolexGold + "15",
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    borderColor: Colors.rolexGold,
    borderWidth: 0.7,
  },
  deliveryHintText: {
    fontSize: 14,
    color: Colors.rolexDarkText,
    marginLeft: 10,
    flexShrink: 1,
    fontFamily: "serif",
  },
  divider: {
    borderBottomWidth: 0.7,
    borderBottomColor: Colors.rolexPlatinum,
    marginVertical: 20,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  totalLabel: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.rolexDarkText,
    letterSpacing: 0.5,
    fontFamily: "serif",
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.rolexGreen,
    letterSpacing: 0.5,
    fontFamily: "serif",
  },
  totalSavingsMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.rolexSuccess + "10",
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    borderColor: Colors.rolexSuccess,
    borderWidth: 0.7,
  },
  totalSavingsText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.rolexSuccess,
    marginLeft: 10,
    textAlign: "center",
    fontFamily: "serif",
  },
  // --- START NEW PAYMENT STYLES ---
  paymentMethodSection: {
    marginTop: 25,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.rolexDarkText,
    marginBottom: 15,
    fontFamily: "serif",
  },
  paymentOptionsContainer: {
    // No explicit style needed, relies on children layout
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.rolexPlatinum,
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.rolexPlatinum,
    // Shadow will be applied by default if not specified
  },
  paymentOptionSelected: {
    borderColor: Colors.rolexGreen,
    borderWidth: 2,
    backgroundColor: Colors.rolexGreen + "10",
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.rolexDarkText,
  },
  optionSubtitle: {
    fontSize: 13,
    color: Colors.rolexLightText,
    marginTop: 3,
  },
  codOptionTitle: {
    color: Colors.rolexGreen, // Royal Green color for COD text
    fontWeight: "bold",
  },
  paymentMethodHint: {
    fontSize: 14,
    color: Colors.rolexLightText,
    marginTop: 15,
    fontFamily: "serif",
  },
  // --- END NEW PAYMENT STYLES ---

  actionButtonsContainer: {
    marginTop: 35,
    gap: 18,
  },
  placeOrderButton: {
    backgroundColor: Colors.rolexGreen,
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: Colors.rolexGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  placeOrderButtonText: {
    color: Colors.rolexWhite,
    fontSize: 19,
    fontWeight: "bold",
    letterSpacing: 0.7,
    fontFamily: "serif",
  },
  clearCartButton: {
    backgroundColor: Colors.rorolexRed,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: Colors.rorolexRed,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 1,
    elevation: 5,
  },
  clearCartButtonText: {
    color: Colors.rolexWhite,
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
    fontFamily: "serif",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});

export default OrderSummary;
