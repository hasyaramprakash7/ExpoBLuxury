// src/components/VendorOrderGroup.tsx

import React from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Dimensions,
} from "react-native";
import { useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import CartItem from "./CartItem";
import { clearCartByVendor } from "../features/cart/cartSlice";

const { width } = Dimensions.get("window");

// --- LUXURY COLORS ---
const Colors = {
    primaryGreen: "#00704A",
    darkGreen: "#00563F",
    deepGreen: "#014421",
    white: "#FFFFFF",
    darkText: "#4A2C2A",
    grayText: "gray",
    mediumGray: "#E5E7EB",
    blueHighlight: "#3498db",
    softGray: "#F8F5F0",
    softLightGray: "#F5F5F5",
    greenSuccess: "#10B981",
};

interface ProductInCart {
    _id: string;
    name: string;
    description: string;
    price: number;
    discountedPrice?: number;
    images?: string[];
    stock: number;
    vendorId: string;
    companyName?: string;
}

interface CartReduxItem {
    productId: ProductInCart;
    quantity: number;
    price: number;
    vendorId: string;
    _id: string;
    size?: string; // variant support
}

export interface VendorGroupProps {
    vendorId: string;
    vendorName: string;
    items: CartReduxItem[];
    subtotal: number;
    deliveryCharge: number;
    FREE_DELIVERY_THRESHOLD: number;
    // 🔑 Pass the toast function from CartScreen down to CartItem
    showToast: (message: string, type: "success" | "error" | "info" | "loading") => void;
}

const VendorOrderGroup: React.FC<VendorGroupProps> = ({
    vendorId,
    vendorName,
    items,
    subtotal,
    deliveryCharge,
    FREE_DELIVERY_THRESHOLD,
    showToast,
}) => {
    const dispatch = useDispatch<any>();

    const handleRemoveVendor = () => {
        Alert.alert(
            "Remove All Items",
            `Remove all items from ${vendorName}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    onPress: async () => {
                        try {
                            await dispatch(clearCartByVendor(vendorId)).unwrap();
                            showToast(`Removed all items from ${vendorName}`, "success");
                        } catch (error) {
                            showToast("Failed to remove items.", "error");
                        }
                    },
                    style: "destructive",
                },
            ]
        );
    };

    return (
        <View style={groupStyles.groupContainer}>
            <View style={groupStyles.header}>
                <View style={groupStyles.headerLeft}>
                    <Ionicons name="storefront" size={width * 0.05} color={Colors.deepGreen} />
                    <Text style={groupStyles.vendorTitle}>{vendorName}</Text>
                </View>

                <TouchableOpacity onPress={handleRemoveVendor} style={groupStyles.removeButton}>
                    <Ionicons name="trash-outline" size={width * 0.05} color={Colors.darkText} />
                </TouchableOpacity>
            </View>

            <View style={groupStyles.itemsList}>
                {items.map((item) => (
                    <CartItem 
                        key={item._id} 
                        item={item} 
                        loading={false} 
                        showToast={showToast} // 🔑 Passing the key logic here
                    />
                ))}
            </View>

            <View style={groupStyles.summaryBox}>
                <View style={groupStyles.summaryRow}>
                    <Text style={groupStyles.summaryLabel}>Items Subtotal</Text>
                    <Text style={groupStyles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
                </View>

                <View style={groupStyles.summaryRow}>
                    <Text style={groupStyles.summaryLabel}>Delivery Charge</Text>
                    {deliveryCharge === 0 ? (
                        <View style={groupStyles.freeDelivery}>
                            <Ionicons name="flash" size={width * 0.035} color={Colors.greenSuccess} />
                            <Text style={groupStyles.freeDeliveryText}>FREE</Text>
                        </View>
                    ) : (
                        <Text style={groupStyles.summaryValue}>₹{deliveryCharge.toFixed(2)}</Text>
                    )}
                </View>

                {deliveryCharge > 0 && subtotal < FREE_DELIVERY_THRESHOLD && (
                    <Text style={groupStyles.deliveryHint}>
                        {`Add ₹${(FREE_DELIVERY_THRESHOLD - subtotal).toFixed(2)} for `}
                        <Text style={{ fontWeight: "bold", color: Colors.blueHighlight }}>FREE</Text>
                        {` delivery!`}
                    </Text>
                )}

                <View style={groupStyles.totalRow}>
                    <Text style={groupStyles.totalLabel}>Shop Total</Text>
                    <Text style={groupStyles.totalValue}>₹{(subtotal + deliveryCharge).toFixed(2)}</Text>
                </View>
            </View>
        </View>
    );
};

const groupStyles = StyleSheet.create({
    groupContainer: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: width * 0.04,
        marginBottom: width * 0.05,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: Colors.mediumGray,
        paddingBottom: 10,
        marginBottom: 15,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    vendorTitle: {
        fontSize: width * 0.05,
        fontWeight: "700",
        color: Colors.darkText,
        marginLeft: 10,
    },
    removeButton: {
        padding: width * 0.02,
        borderRadius: 8,
        backgroundColor: Colors.softLightGray,
    },
    itemsList: {
        marginBottom: 15,
    },
    summaryBox: {
        backgroundColor: Colors.softGray,
        padding: width * 0.04,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.mediumGray,
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
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
    deliveryHint: {
        fontSize: width * 0.035,
        color: Colors.blueHighlight,
        textAlign: "right",
        marginTop: 5,
        fontStyle: "italic",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: Colors.mediumGray,
        paddingTop: 10,
        marginTop: 8,
    },
    totalLabel: {
        fontSize: width * 0.045,
        fontWeight: "bold",
        color: Colors.darkGreen,
    },
    totalValue: {
        fontSize: width * 0.048,
        fontWeight: "bold",
        color: Colors.darkGreen,
    },
});

export default VendorOrderGroup;