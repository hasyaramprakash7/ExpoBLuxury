// src/components/CartItem.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useDispatch } from "react-redux";
import { addOrUpdateItem, removeItem } from "../features/cart/cartSlice";

const { width } = Dimensions.get("window");

// --- Luxury Color Palette ---
const Colors = {
  primaryGreen: "#00704A",
  darkGreen: "#00563F",
  white: "#FFFFFF",
  darkText: "#4A2C2A",
  grayText: "gray",
  lightGray: "#DDDDDD",
  redAlert: "#DC2626",
  yellowStar: "#F59E0B",
  greenSuccess: "#10B981",
  softGray: "#F9FAFB",
  mediumGray: "#E5E7EB",
};

// --- Types ---
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
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
}

interface CartReduxItem {
  productId: ProductInCart;
  quantity: number;
  price: number;
  vendorId: string;
  _id: string;
  size?: string;
}

interface CartItemProps {
  item: CartReduxItem;
  loading: boolean;
  showToast: (
    message: string,
    type: "success" | "error" | "info" | "loading",
  ) => void;
}

const getEffectivePrice = (
  product: ProductInCart,
  quantity: number,
): number => {
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
};

// --- Confirmation Modal ---
const RemoveConfirmationModal: React.FC<{
  isVisible: boolean;
  productName: string;
  onClose: () => void;
  onConfirmRemove: () => void;
  isProcessing: boolean;
}> = ({ isVisible, productName, onClose, onConfirmRemove, isProcessing }) => (
  <Modal
    animationType="fade"
    transparent={true}
    visible={isVisible}
    onRequestClose={onClose}
  >
    <View style={itemStyles.modalOverlay}>
      <View style={itemStyles.modalContent}>
        <Ionicons name="trash-bin-outline" size={50} color={Colors.redAlert} />
        <Text style={itemStyles.modalTitle}>Remove Item?</Text>
        <Text style={itemStyles.modalMessage}>
          Are you sure you want to remove{" "}
          <Text style={itemStyles.modalMessageBold}>"{productName}"</Text> from
          your cart?
        </Text>
        <View style={itemStyles.modalActions}>
          <TouchableOpacity
            onPress={onClose}
            style={[itemStyles.modalButton, itemStyles.modalCancelButton]}
            disabled={isProcessing}
          >
            <Text style={itemStyles.modalCancelText}>Keep It</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirmRemove}
            style={[itemStyles.modalButton, itemStyles.modalConfirmButton]}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={itemStyles.modalConfirmText}>Remove</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const CartItem: React.FC<CartItemProps> = ({ item, loading, showToast }) => {
  const dispatch = useDispatch<any>();
  const product = item.productId || ({} as ProductInCart);
  const currentQuantity = item.quantity;
  const originalPrice = product.price || 0;
  const availableStock = product.stock ?? Infinity;
  const selectedSize = item.size;

  const [tempQuantity, setTempQuantity] = useState(String(currentQuantity));
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false);
  const [showConfirmRemoveModal, setShowConfirmRemoveModal] = useState(false);

  useEffect(() => {
    setTempQuantity(String(currentQuantity));
  }, [currentQuantity]);

  const effectivePrice = getEffectivePrice(product, currentQuantity);
  const itemSavings = (originalPrice - effectivePrice) * currentQuantity;

  // --- Logic Handlers ---
  const updateQuantityInCart = async (newQuantity: number) => {
    if (newQuantity > availableStock) {
      showToast(`Only ${availableStock} left in stock.`, "info");
      newQuantity = availableStock;
    }

    setIsUpdatingQuantity(true);
    try {
      await dispatch(
        addOrUpdateItem({
          productId: product._id,
          quantity: newQuantity,
          price: effectivePrice,
          vendorId: product.vendorId,
          size: selectedSize,
        }),
      ).unwrap();
    } catch (err: any) {
      showToast(err.message || "Update failed", "error");
      setTempQuantity(String(currentQuantity));
    } finally {
      setIsUpdatingQuantity(false);
    }
  };

  const confirmRemoveAction = async () => {
    setShowConfirmRemoveModal(false);
    setIsUpdatingQuantity(true);
    showToast(`Removing...`, "loading");

    try {
      // 🔑 CRITICAL FIX: Passing both productId AND size to match backend route
      await dispatch(
        removeItem({
          productId: product._id,
          size: selectedSize,
        }),
      ).unwrap();
      showToast(`Removed successfully`, "success");
    } catch (err: any) {
      showToast(err.message || "Removal failed", "error");
    } finally {
      setIsUpdatingQuantity(false);
    }
  };

  const handleDecrement = () => {
    if (currentQuantity === 1) {
      setShowConfirmRemoveModal(true);
    } else {
      updateQuantityInCart(currentQuantity - 1);
    }
  };

  return (
    <View style={itemStyles.cardContainer}>
      <RemoveConfirmationModal
        isVisible={showConfirmRemoveModal}
        productName={product.name || "Item"}
        onClose={() => setShowConfirmRemoveModal(false)}
        onConfirmRemove={confirmRemoveAction}
        isProcessing={isUpdatingQuantity}
      />

      <Image
        source={product.images?.[0] ? { uri: product.images[0] } : undefined}
        style={itemStyles.productImage}
      />

      <View style={itemStyles.detailsContainer}>
        <View style={itemStyles.nameRow}>
          <Text style={itemStyles.productName} numberOfLines={1}>
            {product.name}{" "}
            {selectedSize && (
              <Text style={itemStyles.sizeText}></Text>
            )}
          </Text>
          <TouchableOpacity
            onPress={() => setShowConfirmRemoveModal(true)}
            style={itemStyles.miniTrash}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.redAlert} />
          </TouchableOpacity>
        </View>

        <Text style={itemStyles.vendorText}>
          {product.companyName || "Vendor"}
        </Text>

        <View style={itemStyles.priceRow}>
          <Text style={itemStyles.effectivePrice}>
            ₹{effectivePrice.toFixed(2)}
          </Text>
          {originalPrice > effectivePrice && (
            <Text style={itemStyles.originalPrice}>
              ₹{originalPrice.toFixed(2)}
            </Text>
          )}
        </View>

        <View style={itemStyles.actionsRow}>
          <View style={itemStyles.quantityControl}>
            <TouchableOpacity
              onPress={handleDecrement}
              style={itemStyles.quantityButton}
            >
              <Ionicons name="remove" size={16} color={Colors.darkText} />
            </TouchableOpacity>
            <TextInput
              style={itemStyles.quantityInput}
              value={tempQuantity}
              keyboardType="numeric"
              onEndEditing={() =>
                updateQuantityInCart(parseInt(tempQuantity) || 1)
              }
              onChangeText={setTempQuantity}
            /><Text>Kg</Text>
            <TouchableOpacity
              onPress={() => updateQuantityInCart(currentQuantity + 1)}
              style={itemStyles.quantityButton}
            >
              <Ionicons name="add" size={16} color={Colors.darkText} />
            </TouchableOpacity>
          </View>

          {isUpdatingQuantity ? (
            <ActivityIndicator size="small" color={Colors.primaryGreen} />
          ) : (
            <Text style={itemStyles.itemTotalPrice}>
              ₹{(effectivePrice * currentQuantity).toFixed(2)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const itemStyles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.softGray,
  },
  detailsContainer: { flex: 1, marginLeft: 12 },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productName: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.darkText,
    flex: 1,
  },
  sizeText: { fontSize: 13, fontWeight: "normal", color: Colors.primaryGreen },
  miniTrash: { padding: 4 },
  vendorText: { fontSize: 12, color: Colors.grayText, marginVertical: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  effectivePrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.primaryGreen,
  },
  originalPrice: {
    fontSize: 12,
    color: Colors.grayText,
    textDecorationLine: "line-through",
    marginLeft: 6,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 6,
  },
  quantityButton: { padding: 6, backgroundColor: Colors.softGray },
  quantityInput: {
    width: 35,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.darkText,
  },
  itemTotalPrice: { fontSize: 16, fontWeight: "bold", color: Colors.darkText },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width * 0.8,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.darkText,
    marginTop: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: Colors.grayText,
    textAlign: "center",
    marginVertical: 12,
  },
  modalMessageBold: { fontWeight: "bold", color: Colors.darkText },
  modalActions: { flexDirection: "row", width: "100%", marginTop: 10 },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  modalCancelButton: { backgroundColor: Colors.mediumGray },
  modalConfirmButton: { backgroundColor: Colors.redAlert },
  modalCancelText: { color: Colors.darkText, fontWeight: "600" },
  modalConfirmText: { color: Colors.white, fontWeight: "600" },
});

export default CartItem;
