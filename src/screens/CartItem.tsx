// src/components/CartItem.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useDispatch } from "react-redux";
import { addOrUpdateItem, removeItem } from "../features/cart/cartSlice";

// --- Color Palette (Consistency) ---
const Colors = {
  primaryGreen: "#00704A",
  darkGreen: "#00563F",
  gold: "#FFD700",
  white: "#FFFFFF",
  darkText: "#4A2C2A",
  grayText: "gray",
  lightGray: "#DDDDDD",
  redAlert: "#DC2626",
  yellowStar: "#F59E0B",
  greenSuccess: "#10B981",
  blueHighlight: "#3498db",
  softGray: "#F9FAFB",
  mediumGray: "#E5E7EB",
};

// --- Type Definitions (Re-using from Cart.tsx for consistency) ---
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
}

interface CartItemProps {
  item: CartReduxItem;
  loading: boolean;
}

// Helper function to calculate effective price (copied from Cart.tsx)
const getEffectivePrice = (
  product: ProductInCart,
  quantity: number
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

const CartItem: React.FC<CartItemProps> = ({ item, loading }) => {
  const dispatch = useDispatch<any>();

  const product = item.productId || ({} as ProductInCart);
  const currentQuantity = item.quantity;
  const originalPrice = product.price || 0;
  const availableStock = product.stock !== undefined ? product.stock : Infinity;

  // Local state for the manual quantity input field
  const [tempQuantity, setTempQuantity] = useState(String(currentQuantity));
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false);

  useEffect(() => {
    setTempQuantity(String(currentQuantity));
  }, [currentQuantity]);

  // Derived values for rendering
  const effectivePrice = getEffectivePrice(product, currentQuantity);
  const itemSavings = (originalPrice - effectivePrice) * currentQuantity;
  const hasDiscount = effectivePrice < originalPrice;
  const isBulkDiscount =
    product.bulkMinimumUnits &&
    currentQuantity >= product.bulkMinimumUnits &&
    effectivePrice === product.bulkPrice;
  const isLargeQuantityDiscount =
    product.largeQuantityMinimumUnits &&
    currentQuantity >= product.largeQuantityMinimumUnits &&
    effectivePrice === product.largeQuantityPrice;

  // --- Quantity Handlers ---
  const updateQuantityInCart = async (newQuantity: number) => {
    if (newQuantity < 0) {
      Alert.alert("Error", "Quantity cannot be negative.");
      return;
    }
    if (newQuantity > availableStock) {
      Alert.alert(
        "Warning",
        `Only ${availableStock} units available for "${product.name}". Setting quantity to max available.`
      );
      newQuantity = availableStock;
      setTempQuantity(String(newQuantity));
      if (newQuantity === currentQuantity) {
        return;
      }
    }

    setIsUpdatingQuantity(true);
    try {
      await dispatch(
        addOrUpdateItem({
          productId: product._id,
          quantity: newQuantity,
          price: effectivePrice,
          vendorId: product.vendorId,
        })
      ).unwrap();

      if (newQuantity === 0) {
        Alert.alert("Info", `"${product.name}" removed from cart.`);
      } else {
        Alert.alert(
          "Success",
          `Quantity of "${product.name}" updated to ${newQuantity}.`
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update quantity.");
      setTempQuantity(String(currentQuantity));
    } finally {
      setIsUpdatingQuantity(false);
    }
  };

  const handleIncrement = () => {
    const newQuantity = currentQuantity + 1;
    updateQuantityInCart(newQuantity);
  };

  const handleDecrement = () => {
    const newQuantity = currentQuantity - 1;
    updateQuantityInCart(newQuantity);
  };

  const handleManualQuantityChange = (text: string) => {
    if (text === "" || /^\d+$/.test(text)) {
      setTempQuantity(text);
    }
  };

  const handleManualQuantityBlur = () => {
    const inputValue = tempQuantity;
    let newQuantity = parseInt(inputValue, 10);

    if (inputValue === "") {
      newQuantity = currentQuantity;
    } else if (isNaN(newQuantity) || newQuantity < 0) {
      Alert.alert(
        "Error",
        "Please enter a valid positive number for quantity."
      );
      newQuantity = currentQuantity;
    }

    if (newQuantity === currentQuantity) {
      return;
    }

    updateQuantityInCart(newQuantity);
  };

  const handleRemove = async () => {
    Alert.alert(
      "Remove Item",
      `Are you sure you want to remove "${
        product.name || "this item"
      }" from your cart?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          onPress: async () => {
            setIsUpdatingQuantity(true);
            try {
              await dispatch(removeItem(product._id)).unwrap();
              Alert.alert(
                "Success",
                `"${product.name || "Item"}" removed from cart.`
              );
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to remove item.");
            } finally {
              setIsUpdatingQuantity(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (!product._id) {
    return (
      <View style={itemStyles.invalidItemContainer}>
        <Ionicons
          name="information-circle-outline"
          size={24}
          color={Colors.yellowStar}
        />
        <View style={itemStyles.invalidItemTextContainer}>
          <Text style={itemStyles.invalidItemTitle}>Invalid Item in Cart</Text>
          <Text style={itemStyles.invalidItemDescription}>
            This item could not be loaded. It might have been removed or is
            unavailable. Please remove it.
          </Text>
          <TouchableOpacity
            onPress={handleRemove}
            style={itemStyles.removeInvalidButton}
          >
            <Text style={itemStyles.removeInvalidButtonText}>
              Remove Invalid Item
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasProductImage = product.images && product.images.length > 0;
  const imageSource = hasProductImage ? { uri: product.images[0] } : undefined;

  // --- Start of changes: Truncate both name and description ---
  const formattedProductName =
    product.name && product.name.length > 15
      ? `${product.name.substring(0, 15)}...`
      : product.name || "Unknown Product";

  const formattedDescription =
    product.description && product.description.length > 15
      ? `${product.description.substring(0, 15)}...`
      : product.description || "No description available.";
  // --- End of changes ---

  return (
    <View style={itemStyles.cardContainer}>
      {hasProductImage ? (
        <Image
          source={imageSource}
          style={itemStyles.productImage}
          resizeMode="contain"
        />
      ) : (
        <View style={itemStyles.textImagePlaceholder}>
          <Ionicons name="image-outline" size={30} color={Colors.grayText} />
          <Text style={itemStyles.textImagePlaceholderText}>No Image</Text>
        </View>
      )}

      <View style={itemStyles.detailsContainer}>
        <Text style={itemStyles.productName}>{formattedProductName}</Text>
        {product.companyName && (
          <Text style={itemStyles.vendorText}>
            Vendor: {product.companyName}
          </Text>
        )}
        <Text style={itemStyles.descriptionText}>{formattedDescription}</Text>

        <View style={itemStyles.priceAndDiscountRow}>
          <View style={itemStyles.priceContainer}>
            <Text style={itemStyles.effectivePrice}>
              ₹{effectivePrice.toFixed(2)}
            </Text>
            {originalPrice > effectivePrice && (
              <Text style={itemStyles.originalPrice}>
                ₹{originalPrice.toFixed(2)}
              </Text>
            )}
          </View>
          {hasDiscount && (
            <View style={itemStyles.discountTag}>
              <Ionicons name="pricetag" size={12} color={Colors.greenSuccess} />
              <Text style={itemStyles.discountTagText}>
                {isLargeQuantityDiscount
                  ? "Large Qty Discount"
                  : isBulkDiscount
                  ? "Bulk Discount"
                  : "Discounted"}
              </Text>
            </View>
          )}
        </View>

        {itemSavings > 0 && (
          <Text style={itemStyles.savingsText}>
            You save ₹{itemSavings.toFixed(2)} on this item!
          </Text>
        )}
        {availableStock !== Infinity && (
          <Text style={itemStyles.stockText}>
            Available Stock: {availableStock}
          </Text>
        )}

        <View style={itemStyles.actionsRow}>
          <View style={itemStyles.quantityControl}>
            <TouchableOpacity
              onPress={handleDecrement}
              style={[
                itemStyles.quantityButton,
                (currentQuantity <= 0 || loading || isUpdatingQuantity) &&
                  itemStyles.quantityButtonDisabled,
              ]}
              disabled={currentQuantity <= 0 || loading || isUpdatingQuantity}
            >
              <Ionicons name="remove" size={16} color={Colors.darkText} />
            </TouchableOpacity>
            <TextInput
              style={itemStyles.quantityInput}
              value={tempQuantity}
              onChangeText={handleManualQuantityChange}
              onEndEditing={handleManualQuantityBlur}
              keyboardType="numeric"
              editable={!loading && !isUpdatingQuantity}
            />
            <TouchableOpacity
              onPress={handleIncrement}
              style={[
                itemStyles.quantityButton,
                (currentQuantity >= availableStock ||
                  loading ||
                  isUpdatingQuantity) &&
                  itemStyles.quantityButtonDisabled,
              ]}
              disabled={
                currentQuantity >= availableStock ||
                loading ||
                isUpdatingQuantity
              }
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
        <TouchableOpacity
          onPress={handleRemove}
          style={itemStyles.removeButton}
        >
          <Text style={itemStyles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const itemStyles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 15,
  },
  textImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.softGray,
    marginRight: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  textImagePlaceholderText: {
    fontSize: 10,
    color: Colors.grayText,
    marginTop: 5,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.softGray,
    marginRight: 15,
  },
  detailsContainer: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.darkText,
    marginBottom: 2,
  },
  vendorText: {
    fontSize: 12,
    color: Colors.grayText,
    marginBottom: 5,
  },
  descriptionText: {
    fontSize: 13,
    color: Colors.grayText,
    marginBottom: 8,
  },
  priceAndDiscountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  effectivePrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.primaryGreen,
  },
  originalPrice: {
    fontSize: 13,
    color: Colors.grayText,
    textDecorationLine: "line-through",
    marginLeft: 8,
  },
  discountTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.greenSuccess + "10",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  discountTagText: {
    fontSize: 10,
    color: Colors.greenSuccess,
    fontWeight: "bold",
    marginLeft: 4,
  },
  savingsText: {
    fontSize: 12,
    color: Colors.primaryGreen,
    marginBottom: 8,
  },
  stockText: {
    fontSize: 12,
    color: Colors.grayText,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    marginTop: 5,
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 8,
    overflow: "hidden",
  },
  quantityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.mediumGray,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityInput: {
    width: 40,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.darkText,
    paddingVertical: 5,
  },
  itemTotalPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.darkText,
  },
  removeButton: {
    position: "absolute",
    right: 0,
    marginTop: 10,
    width: 75,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: Colors.redAlert + "10",
  },
  removeButtonText: {
    fontSize: 14,
    color: Colors.redAlert,
    fontWeight: "600",
  },
  invalidItemContainer: {
    backgroundColor: Colors.yellowStar + "10",
    borderColor: Colors.yellowStar,
    borderWidth: 1,
    padding: 15,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 15,
  },
  invalidItemTextContainer: {
    flex: 1,
  },
  invalidItemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.darkText,
  },
  invalidItemDescription: {
    fontSize: 13,
    color: Colors.grayText,
    marginTop: 5,
  },
  removeInvalidButton: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  removeInvalidButtonText: {
    fontSize: 14,
    color: Colors.redAlert,
    fontWeight: "bold",
  },
});

export default CartItem;
