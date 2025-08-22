import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  View,
  Image,
} from "react-native";
import Toast from "react-native-toast-message";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";

// Define the Rolex-inspired colors for consistency
const rolexGreen = "#006039";
const rolexGold = "#A37E2C";
const subtleBorder = "#E5E7EB";

// Define the necessary props for the component
interface WhatsappInvoiceSenderProps {
  orderData: any;
  vendorData: any;
}

const WhatsappInvoiceSender: React.FC<WhatsappInvoiceSenderProps> = ({
  orderData,
  vendorData,
}) => {
  // A ref to the view that will be captured as an image
  const invoiceViewRef = useRef(null);

  // This is the component that will be rendered to an image
  const InvoiceContent = () => {
    const customerName = orderData.user?.name || "Customer";
    const orderId = orderData._id.slice(-8).toUpperCase();
    const vendorName = vendorData.name || "Vendor";

    const customerAddress = orderData.address;
    const customerFullName = customerAddress?.fullName || orderData.user?.name;
    const customerPhone = customerAddress?.phone || orderData.user?.phone;

    const vendorItems = orderData.items.filter(
      (item: any) => item.vendorId?.toString() === vendorData._id?.toString()
    );

    const vendorTotal = vendorItems.reduce(
      (sum: number, item: any) => sum + item.quantity * item.price,
      0
    );

    return (
      <View style={invoiceStyles.container}>
        <View style={invoiceStyles.header}>
          <Text style={invoiceStyles.brandName}>Your Brand Name</Text>
          <Text style={invoiceStyles.invoiceTitle}>INVOICE</Text>
        </View>

        <View style={invoiceStyles.details}>
          <Text style={invoiceStyles.detailText}>
            To: <Text style={invoiceStyles.boldText}>{customerFullName}</Text>
          </Text>
          {customerAddress && (
            <>
              <Text style={invoiceStyles.detailText}>
                <Text style={invoiceStyles.boldText}>Address:</Text>{" "}
                {customerAddress.street}
              </Text>
              {customerAddress.street2 && (
                <Text style={invoiceStyles.detailText}>
                  {customerAddress.street2}
                </Text>
              )}
              {customerAddress.landmark && (
                <Text style={invoiceStyles.detailText}>
                  Near {customerAddress.landmark}
                </Text>
              )}
              <Text style={invoiceStyles.detailText}>
                {customerAddress.city}, {customerAddress.state} -{" "}
                {customerAddress.zipCode}
              </Text>
              <Text style={invoiceStyles.detailText}>
                {customerAddress.country}
              </Text>
            </>
          )}
          {customerPhone && (
            <Text style={invoiceStyles.detailText}>
              <Text style={invoiceStyles.boldText}>Phone:</Text> {customerPhone}
            </Text>
          )}
          <Text style={invoiceStyles.detailText}>Order ID: #{orderId}</Text>
          <Text style={invoiceStyles.detailText}>
            Date: {new Date().toLocaleDateString()}
          </Text>
        </View>

        <View style={invoiceStyles.itemTable}>
          <View style={invoiceStyles.tableHeader}>
            <Text style={invoiceStyles.tableHeaderText}>Item</Text>
            <Text style={invoiceStyles.tableHeaderText}>Qty</Text>
            <Text style={invoiceStyles.tableHeaderText}>Price</Text>
            <Text style={invoiceStyles.tableHeaderText}>Total</Text>
          </View>
          {vendorItems.map((item: any, index: number) => (
            <View key={index} style={invoiceStyles.tableRow}>
              <Image
                source={{
                  uri:
                    item.productImage ||
                    "https://via.placeholder.com/50?text=Product",
                }}
                style={invoiceStyles.productImage}
              />
              <View style={invoiceStyles.itemDescription}>
                <Text style={invoiceStyles.itemText}>{item.name}</Text>
                <Text style={invoiceStyles.itemTextSmall}>
                  from {vendorName}
                </Text>
              </View>
              <Text style={invoiceStyles.itemText}>{item.quantity}</Text>
              <Text style={invoiceStyles.itemText}>
                ₹{item.price.toFixed(2)}
              </Text>
              <Text style={invoiceStyles.itemTextBold}>
                ₹{(item.quantity * item.price).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={invoiceStyles.summary}>
          <View style={invoiceStyles.summaryRow}>
            <Text style={invoiceStyles.summaryLabel}>
              Total from {vendorName}:
            </Text>
            <Text style={invoiceStyles.summaryValue}>
              ₹{vendorTotal.toFixed(2)}
            </Text>
          </View>
          <View style={invoiceStyles.summaryRow}>
            <Text style={invoiceStyles.summaryLabel}>Overall Order Total:</Text>
            <Text style={invoiceStyles.summaryValue}>
              ₹{orderData.total.toFixed(2)}
            </Text>
          </View>
          <View style={[invoiceStyles.summaryRow, invoiceStyles.finalTotal]}>
            <Text style={invoiceStyles.summaryLabelFinal}>Grand Total:</Text>
            <Text style={invoiceStyles.summaryValueFinal}>
              ₹{orderData.total.toFixed(2)}
            </Text>
          </View>
        </View>

        <Text style={invoiceStyles.footerText}>Thank you for your order!</Text>
        <Text style={invoiceStyles.footerNote}>
          For any queries, please contact us.
        </Text>
      </View>
    );
  };

  const handlePress = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing not available",
          "Sharing is not supported on this device. Please try again later."
        );
        return;
      }

      if (!invoiceViewRef.current) {
        Alert.alert("Error", "Could not capture invoice image.");
        return;
      }

      // Capture with highest quality
      const uri = await (invoiceViewRef.current as any).capture();

      await Sharing.shareAsync(uri, {
        mimeType: "image/jpeg",
        dialogTitle: `Invoice for Order #${orderData._id
          .slice(-8)
          .toUpperCase()}`,
        UTI: "public.jpeg",
      });
    } catch (error) {
      console.error("Failed to share invoice:", error);
      Toast.show({
        type: "error",
        text1: "Share Error",
        text2: "Could not share the invoice. Please try again.",
      });
    }
  };

  const vendorItems = orderData.items.filter(
    (item: any) => item.vendorId?.toString() === vendorData._id?.toString()
  );

  const dynamicHeight = 450 + vendorItems.length * 80;

  return (
    <>
      <ViewShot
        ref={invoiceViewRef}
        options={{ format: "jpg", quality: 1.0 }} // Changed quality to 1.0 for highest resolution
        style={[invoiceStyles.hiddenView, { height: dynamicHeight }]}
      >
        <InvoiceContent />
      </ViewShot>

      <TouchableOpacity onPress={handlePress} style={styles.actionButton}>
        <Text style={styles.actionButtonText}>👑 Send Invoice (WhatsApp)</Text>
      </TouchableOpacity>
    </>
  );
};

const invoiceStyles = StyleSheet.create({
  hiddenView: {
    position: "absolute",
    left: -9999,
    width: 600,
  },
  container: {
    backgroundColor: "#FFFFFF",
    padding: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rolexGold,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  brandName: {
    fontSize: 24,
    fontWeight: "bold",
    color: rolexGreen,
    letterSpacing: 1,
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: rolexGold,
    marginTop: 5,
  },
  details: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: subtleBorder,
    paddingBottom: 10,
  },
  detailText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  boldText: {
    fontWeight: "600",
    color: "#1F2937",
  },
  itemTable: {
    borderWidth: 1,
    borderColor: subtleBorder,
    borderRadius: 5,
    marginBottom: 20,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: rolexGreen,
    paddingVertical: 10,
  },
  tableHeaderText: {
    flex: 1,
    textAlign: "center",
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: subtleBorder,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 10,
  },
  itemDescription: {
    flex: 3,
  },
  itemText: {
    flex: 1,
    textAlign: "center",
    color: "#4B5563",
    fontSize: 12,
  },
  itemTextSmall: {
    fontSize: 10,
    color: "#6B7280",
  },
  itemTextBold: {
    flex: 1,
    textAlign: "center",
    fontWeight: "bold",
    color: "#1F2937",
    fontSize: 14,
  },
  summary: {
    borderTopWidth: 1,
    borderTopColor: rolexGold,
    paddingTop: 10,
    alignItems: "flex-end",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1F2937",
  },
  finalTotal: {
    borderTopWidth: 2,
    borderTopColor: rolexGreen,
    paddingTop: 8,
    marginTop: 8,
  },
  summaryLabelFinal: {
    fontSize: 16,
    fontWeight: "bold",
    color: rolexGreen,
  },
  summaryValueFinal: {
    fontSize: 18,
    fontWeight: "bold",
    color: rolexGreen,
  },
  footerText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 12,
    color: "#6B7280",
  },
  footerNote: {
    textAlign: "center",
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 5,
  },
});

const styles = StyleSheet.create({
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: rolexGreen,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: subtleBorder,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default WhatsappInvoiceSender;
