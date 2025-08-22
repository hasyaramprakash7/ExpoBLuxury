// src/components/OrderSummary.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker"; // For dropdown selection
import Ionicons from "@expo/vector-icons/Ionicons"; // Using Ionicons for consistency

// --- Color Palette (Rolex-inspired) ---
const Colors = {
  rolexGreen: "#00563F", // Deep, rich green
  rolexGold: "#B8860B", // Muted, elegant gold
  rolexDarkText: "#2C2C2C", // Almost black for strong contrast
  rolexLightText: "#6F6F6F", // Soft gray for secondary text
  rolexWhite: "#FFFFFF",
  rolexPlatinum: "#E0E0E0", // Light gray/off-white for backgrounds and dividers
  rolexAccentGold: "#DAA520", // Brighter gold for highlights
  rorolexRed: "#A30000", // A sophisticated red for alerts
  rolexSuccess: "#00704A", // A slightly brighter green for success messages
};

// --- Type Definitions (Re-using from Cart.tsx) ---
interface PricingBreakdown {
  itemsSubtotal: number;
  discountedSubtotal: number;
  totalSavings: number;
  deliveryCharge: number;
  platformFee: number;
  gstAmount: number;
  finalTotal: number;
}

// Minimal item type for props validation (full `CartReduxItem` not needed here)
interface SimpleCartItem {
  _id: string;
  quantity: number;
  productId: {
    _id: string;
  };
}

interface OrderSummaryProps {
  items: SimpleCartItem[]; // Using SimpleCartItem as only length is used
  pricingBreakdown: PricingBreakdown;
  DELIVERY_CHARGE: number;
  FREE_DELIVERY_THRESHOLD: number;
  PLATFORM_FEE_RATE: number;
  GST_RATE: number;
  paymentMethod: "COD"; // Assuming only COD is available
  setPaymentMethod: (method: "COD") => void; // Setter for payment method
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

        <View style={summaryStyles.detailRow}>
          <Text style={summaryStyles.detailLabel}>Items ({items.length})</Text>
          <Text style={summaryStyles.detailValue}>
            ₹{pricingBreakdown.itemsSubtotal.toFixed(2)}
          </Text>
        </View>

        {pricingBreakdown.totalSavings > 0 && (
          <View style={summaryStyles.detailRow}>
            <Text style={summaryStyles.detailLabelSavings}>Savings</Text>
            <Text style={summaryStyles.detailValueSavings}>
              - ₹{pricingBreakdown.totalSavings.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={summaryStyles.detailRow}>
          <Text style={summaryStyles.detailLabel}>Discounted Subtotal</Text>
          <Text style={summaryStyles.detailValueBold}>
            ₹{pricingBreakdown.discountedSubtotal.toFixed(2)}
          </Text>
        </View>

        <View style={summaryStyles.detailRow}>
          <Text style={summaryStyles.detailLabel}>
            Platform Fee ({Math.round(PLATFORM_FEE_RATE * 100)}%)
          </Text>
          <Text style={summaryStyles.detailValue}>
            ₹{pricingBreakdown.platformFee.toFixed(2)}
          </Text>
        </View>

        <View style={summaryStyles.detailRow}>
          <Text style={summaryStyles.detailLabel}>
            GST ({Math.round(GST_RATE * 100)}%)
          </Text>
          <Text style={summaryStyles.detailValue}>
            ₹{pricingBreakdown.gstAmount.toFixed(2)}
          </Text>
        </View>

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

        {pricingBreakdown.discountedSubtotal > 0 &&
          pricingBreakdown.discountedSubtotal < FREE_DELIVERY_THRESHOLD && (
            <View style={summaryStyles.deliveryHint}>
              <Ionicons name="car-outline" size={20} color={Colors.rolexGold} />
              <Text style={summaryStyles.deliveryHintText}>
                Add ₹
                {(
                  FREE_DELIVERY_THRESHOLD - pricingBreakdown.discountedSubtotal
                ).toFixed(2)}{" "}
                more for FREE delivery!
              </Text>
            </View>
          )}

        <View style={summaryStyles.divider} />

        <View style={summaryStyles.totalRow}>
          <Text style={summaryStyles.totalLabel}>Total Amount</Text>
          <Text style={summaryStyles.totalValue}>
            ₹{pricingBreakdown.finalTotal.toFixed(2)}
          </Text>
        </View>

        {pricingBreakdown.totalSavings > 0 && (
          <View style={summaryStyles.totalSavingsMessage}>
            <Ionicons
              name="wallet-outline"
              size={22}
              color={Colors.rolexSuccess}
            />
            <Text style={summaryStyles.totalSavingsText}>
              You're saving ₹{pricingBreakdown.totalSavings.toFixed(2)} on this
              order!
            </Text>
          </View>
        )}

        <View style={summaryStyles.paymentMethodSection}>
          <Text style={summaryStyles.paymentMethodLabel}>
            Select Payment Method
          </Text>
          <View style={summaryStyles.pickerContainer}>
            <Picker
              selectedValue={paymentMethod}
              onValueChange={(itemValue: "COD", itemIndex) =>
                setPaymentMethod(itemValue)
              }
              style={summaryStyles.picker}
              dropdownIconColor={Colors.rolexDarkText}
            >
              <Picker.Item label="Cash on Delivery (COD)" value="COD" />
              {/* <Picker.Item label="Online Payment (Coming Soon)" value="Online Payment" enabled={false} /> */}
            </Picker>
            <View style={summaryStyles.pickerIcon}>
              <Ionicons
                name="chevron-down"
                size={20}
                color={Colors.rolexLightText}
              />
            </View>
          </View>
          <Text style={summaryStyles.paymentMethodHint}>
            Currently, only Cash on Delivery is available.
          </Text>
        </View>

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
            <Text style={summaryStyles.placeOrderButtonText}>Place Order</Text>
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
            <Text style={summaryStyles.clearCartButtonText}>Clear </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const summaryStyles = StyleSheet.create({
  container: {
    width: "100%", // Takes full width in column layout
    marginTop: 25, // Increased space from cart items
  },
  card: {
    backgroundColor: Colors.rolexWhite,
    borderRadius: 12, // Slightly more rounded corners
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 }, // More pronounced shadow
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    padding: 25, // Increased padding
    borderColor: Colors.rolexPlatinum, // Subtle border
    borderWidth: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25, // Increased margin
    paddingBottom: 12,
    borderBottomWidth: 0.7, // Thinner, more refined divider
    borderBottomColor: Colors.rolexPlatinum,
  },
  headerText: {
    fontSize: 22, // Slightly larger font
    fontWeight: "600", // Semi-bold for elegance
    color: Colors.rolexDarkText,
    marginLeft: 12, // Increased margin
    letterSpacing: 0.5, // Subtle letter spacing
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10, // Increased spacing between detail rows
  },
  detailLabel: {
    fontSize: 16,
    color: Colors.rolexLightText,
    fontFamily: "serif", // Using a serif font for a classic feel (if available)
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
    backgroundColor: Colors.rolexGold + "15", // Light gold background
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    borderColor: Colors.rolexGold,
    borderWidth: 0.7, // Subtle border
  },
  deliveryHintText: {
    fontSize: 14,
    color: Colors.rolexDarkText,
    marginLeft: 10,
    flexShrink: 1,
    fontFamily: "serif",
  },
  divider: {
    borderBottomWidth: 0.7, // Thinner divider
    borderBottomColor: Colors.rolexPlatinum,
    marginVertical: 20, // Increased vertical margin
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15, // Increased margin
  },
  totalLabel: {
    fontSize: 22,
    fontWeight: "700", // Bolder
    color: Colors.rolexDarkText,
    letterSpacing: 0.5,
    fontFamily: "serif",
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.rolexGreen, // Deep green for the total
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
  paymentMethodSection: {
    marginTop: 25,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.rolexDarkText,
    marginBottom: 10,
    fontFamily: "serif",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: Colors.rolexPlatinum,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    height: 55, // Slightly taller picker
    backgroundColor: Colors.rolexWhite,
  },
  picker: {
    height: 55,
    width: "100%",
    color: Colors.rolexDarkText,
    fontFamily: "serif",
  },
  pickerIcon: {
    position: "absolute",
    right: 15,
    top: "50%",
    marginTop: -10, // Center vertically
  },
  paymentMethodHint: {
    fontSize: 14,
    color: Colors.rolexLightText,
    marginTop: 8,
    fontFamily: "serif",
  },
  actionButtonsContainer: {
    marginTop: 35, // Increased margin
    gap: 18, // More space between buttons
  },
  placeOrderButton: {
    backgroundColor: Colors.rolexGreen, // Rolex deep green
    paddingVertical: 18, // Taller button
    borderRadius: 10, // Slightly more rounded
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: Colors.rolexGreen,
    shadowOffset: { width: 0, height: 6 }, // More prominent shadow
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  placeOrderButtonText: {
    color: Colors.rolexWhite,
    fontSize: 19, // Slightly larger font
    fontWeight: "bold",
    letterSpacing: 0.7, // Subtle letter spacing
    fontFamily: "serif",
  },
  clearCartButton: {
    backgroundColor: Colors.rorolexRed, // Sophisticated red
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
    opacity: 0.4, // More subtle disabled state
  },
});

export default OrderSummary;
