import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";

import { addOrUpdateItem } from "../features/cart/cartSlice";

const { width } = Dimensions.get("window");

const CARD_WIDTH = width * 0.59;

export type RootStackParamList = {
  ProductDetails: { product: Product };
};

interface Product {
  _id: string;
  name: string;
  price: number;
  discountedPrice?: number;
  stock: number;
  isAvailable: boolean;
  images?: string[];
  companyName?: string;
  brand?: string;
  location?: string;
  rating?: number;
  numReviews?: number;
  vendorId?: string;
  vendor?: {
    _id: string;
  };
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
  category?: string;
}

interface NewProductCardProps {
  product: Product;
  isVendorOffline?: boolean;
  isVendorOutOfRange?: boolean;
  vendorDistance?: number;
}

type ProductCardNavigationProp = StackNavigationProp<
  RootStackParamList,
  "ProductDetails"
>;

const Colors = {
  greenDark: "#005612",
  greenPrimary: "#0A3D2B",
  greenSecondary: "#009632",
  yellowHighlight: "#FFD700",
  textDark: "#4A2C2A",
  textLight: "#FFFFFF",
  grayDark: "#333333",
  grayLight: "#DDDDDD",
  redAlert: "#DC2626",
  greenSuccess: "#10B981",
  yellowStar: "#F59E0B",
  grayText: "#777777",
  lightGreenBackground: "#E8F5E9",
  cardBackground: "#EBF3E8",
};

const PRODUCT_NAME_MAX_LENGTH = 20;

const NewProductCard: React.FC<NewProductCardProps> = ({
  product,
  isVendorOffline = false,
  isVendorOutOfRange = false,
  vendorDistance,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<ProductCardNavigationProp>();
  const cartItem = useSelector((state) => state.cart.items[product._id]);

  const [quantity, setQuantity] = useState(
    cartItem?.quantity > 0 ? String(cartItem.quantity) : ""
  );
  const [effectivePrice, setEffectivePrice] = useState(
    product.discountedPrice || product.price
  );
  const [showQuantityInput, setShowQuantityInput] = useState(
    (cartItem?.quantity || 0) > 0
  );
  const [displayStock, setDisplayStock] = useState(product.stock);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const currentNumericalQuantity = useMemo(() => {
    return quantity === "" ? 0 : parseInt(quantity, 10) || 0;
  }, [quantity]);

  const amountSaved = useMemo(() => {
    if (
      product.price > 0 &&
      product.discountedPrice &&
      product.discountedPrice < product.price
    ) {
      return (product.price - product.discountedPrice).toFixed(2);
    }
    return 0;
  }, [product.price, product.discountedPrice]);

  const priceTiers = useMemo(() => {
    const tiers = [];
    const bulkMin = product.bulkMinimumUnits || Infinity;
    const largeQtyMin = product.largeQuantityMinimumUnits || Infinity;
    const hasBulkTier = !!(product.bulkPrice && product.bulkMinimumUnits);
    const hasLargeQtyTier = !!(
      product.largeQuantityPrice && product.largeQuantityMinimumUnits
    );

    const defaultMax = Math.min(bulkMin - 1, largeQtyMin - 1);
    const defaultLabel = `1 - ${
      defaultMax === Infinity ? "max" : defaultMax
    } pcs`;

    if (defaultMax > 0) {
      tiers.push({
        minQty: 1,
        maxQty: defaultMax,
        price: product.discountedPrice || product.price,
        label: defaultLabel,
      });
    }

    if (hasBulkTier) {
      const bulkMax = largeQtyMin - 1;
      const bulkLabel = `${product.bulkMinimumUnits} - ${
        bulkMax === Infinity ? "max" : bulkMax
      } pcs`;
      tiers.push({
        minQty: product.bulkMinimumUnits,
        maxQty: bulkMax,
        price: product.bulkPrice,
        label: bulkLabel,
      });
    }

    if (hasLargeQtyTier) {
      tiers.push({
        minQty: product.largeQuantityMinimumUnits,
        maxQty: Infinity,
        price: product.largeQuantityPrice,
        label: `>= ${product.largeQuantityMinimumUnits} pcs`,
      });
    }

    tiers.sort((a, b) => a.minQty - b.minQty);
    const filteredTiers = tiers.filter((tier) => tier.minQty <= tier.maxQty);

    return filteredTiers.map((tier) => ({
      ...tier,
      isActive:
        currentNumericalQuantity >= tier.minQty &&
        (tier.maxQty === Infinity || currentNumericalQuantity <= tier.maxQty),
    }));
  }, [
    currentNumericalQuantity,
    product.price,
    product.discountedPrice,
    product.bulkPrice,
    product.bulkMinimumUnits,
    product.largeQuantityPrice,
    product.largeQuantityMinimumUnits,
  ]);

  useEffect(() => {
    let currentPrice = product.discountedPrice || product.price;
    const activeTier = priceTiers.find(
      (tier) =>
        currentNumericalQuantity >= tier.minQty &&
        (tier.maxQty === Infinity || currentNumericalQuantity <= tier.maxQty)
    );
    if (activeTier) {
      currentPrice = activeTier.price;
    }
    setEffectivePrice(currentPrice);
  }, [
    currentNumericalQuantity,
    product.price,
    product.discountedPrice,
    priceTiers,
  ]);

  useEffect(() => {
    setDisplayStock(product.stock);
  }, [product.stock]);

  useEffect(() => {
    const currentCartQty = cartItem?.quantity || 0;
    setQuantity(currentCartQty > 0 ? String(currentCartQty) : "");
    setShowQuantityInput(currentCartQty > 0);
  }, [cartItem]);

  const showToast = useCallback((msg, type) => {
    let toastType;
    let text1Title;
    switch (type) {
      case "success":
        toastType = "success";
        text1Title = "Success";
        break;
      case "error":
        toastType = "error";
        text1Title = "Error";
        break;
      case "info":
        toastType = "info";
        text1Title = "Info";
        break;
      case "warn":
        toastType = "warning";
        text1Title = "Warning";
        break;
      default:
        toastType = "info";
        text1Title = "Info";
    }
    Toast.show({
      type: toastType,
      text1: text1Title,
      text2: msg,
      visibilityTime: 3000,
      autoHide: true,
      topOffset: 40,
    });
  }, []);

  const handleCartAction = async (qtyToDispatch) => {
    if (isVendorOffline) {
      showToast(
        "Vendor is currently offline. Cannot add products from this shop.",
        "error"
      );
      return;
    }
    if (isVendorOutOfRange) {
      showToast(
        "Vendor is out of your delivery range. Cannot add products from this shop.",
        "error"
      );
      return;
    }

    const numericalQuantity = qtyToDispatch;

    if (numericalQuantity < 0) {
      showToast("Quantity cannot be negative.", "error");
      return;
    }
    if (numericalQuantity > displayStock) {
      showToast(
        `Cannot add more than available stock (${displayStock})`,
        "error"
      );
      setQuantity(String(displayStock));
      return;
    }

    setIsAddingToCart(true);
    try {
      await dispatch(
        addOrUpdateItem({
          productId: product._id,
          quantity: numericalQuantity,
          price: effectivePrice,
          vendorId: product.vendorId || product.vendor?._id,
        })
      ).unwrap();

      if (numericalQuantity === 0) {
        showToast(`Removed ${product.name} from cart.`, "info");
      } else if (!cartItem || cartItem.quantity === 0) {
        showToast(
          `Added ${numericalQuantity} x ${product.name} to cart!`,
          "success"
        );
      } else {
        showToast(
          `Updated cart: ${numericalQuantity} x ${product.name}`,
          "info"
        );
      }
    } catch (error) {
      console.error("Failed to update cart:", error);
      showToast(
        error.message || "Failed to update item in cart. Please try again.",
        "error"
      );
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleQuantityChange = (value) => {
    if (value === "") {
      setQuantity("");
      return;
    }
    if (!/^\d+$/.test(value)) {
      return;
    }
    let numVal = parseInt(value, 10);
    if (isNaN(numVal) || numVal < 0) {
      numVal = 0;
    }
    setQuantity(String(numVal));
  };

  const handleQuantityBlur = async () => {
    let numericalQuantity = currentNumericalQuantity;

    if (numericalQuantity === 0 && (cartItem?.quantity || 0) > 0) {
      await handleCartAction(0);
      setQuantity("");
      setShowQuantityInput(false);
      return;
    }

    if (numericalQuantity > displayStock) {
      showToast(
        `Only ${displayStock} units available for "${product.name}". Setting quantity to max available.`,
        "warn"
      );
      numericalQuantity = displayStock;
      setQuantity(String(displayStock));
    }

    if (numericalQuantity !== (cartItem?.quantity || 0)) {
      await handleCartAction(numericalQuantity);
    } else if (numericalQuantity === 0 && (cartItem?.quantity || 0) === 0) {
      setShowQuantityInput(false);
      setQuantity("");
    }
  };

  const handleQuantityButtonClick = async (increment) => {
    let newQty;
    if (increment) {
      newQty = currentNumericalQuantity + 1;
      if (newQty > displayStock) {
        showToast(`Max stock reached (${displayStock})`, "info");
        return;
      }
    } else {
      newQty = currentNumericalQuantity - 1;
      if (newQty < 0) {
        newQty = 0;
      }
    }
    setQuantity(String(newQty));
    await handleCartAction(newQty);
  };

  const handleAddToCartClick = async () => {
    if (isDisabled || displayStock === 0) {
      showToast(
        displayStock === 0
          ? "This product is out of stock."
          : isVendorOffline
          ? "Vendor is offline."
          : "Vendor is out of range.",
        "error"
      );
      return;
    }
    if (!showQuantityInput || currentNumericalQuantity === 0) {
      setQuantity("1");
      setShowQuantityInput(true);
      await handleCartAction(1);
    }
  };

  const isDisabled = isVendorOffline || isVendorOutOfRange;

  return (
    <View style={[styles.cardContainer, isDisabled && styles.cardDisabled]}>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("ProductDetails", { product: product })
        }
        style={styles.imageContainer}
        disabled={isDisabled}
      >
        <Image
          source={{
            uri: product.images?.[0] || "https://via.placeholder.com/150",
          }}
          style={styles.productImage}
        />
        {!!amountSaved && (
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>Save ₹{amountSaved}</Text>
          </View>
        )}
        <View style={styles.priceTag}>
          <Text style={styles.priceTagText}>₹{effectivePrice.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.detailsContainer}>
        <Text style={styles.productName}>{product.name}</Text>
        <View style={styles.stockContainer}>
          {displayStock > 0 ? (
            displayStock <= 10 ? (
              <Text style={styles.limitedStockText}>
                Limited! ({displayStock} in stock)
              </Text>
            ) : (
              <Text style={styles.inStockText}>
                Avail: {displayStock} in stock
              </Text>
            )
          ) : (
            <Text style={styles.outOfStockText}>Unavail.</Text>
          )}
        </View>
        <View style={styles.priceTiersContainer}>
          {priceTiers.map((tier, index) => (
            <View
              key={index}
              style={[
                styles.priceTierItem,
                tier.isActive && styles.priceTierActive,
              ]}
            >
              <Text
                style={[
                  styles.priceTierLabel,
                  tier.isActive && styles.priceTierLabelActive,
                ]}
              >
                {tier.label}
              </Text>
              <Text
                style={[
                  styles.priceTierPrice,
                  tier.isActive && styles.priceTierPriceActive,
                ]}
              >
                ₹{tier.price.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
        {isDisabled || displayStock === 0 ? (
          <View style={styles.disabledButton}>
            <Text style={styles.disabledButtonText}>
              {displayStock === 0
                ? "Out of Stock"
                : isVendorOffline
                ? "Vendor Offline"
                : "Out of Range"}
            </Text>
          </View>
        ) : showQuantityInput &&
          (currentNumericalQuantity > 0 || quantity === "") ? (
          <View style={styles.quantityControlsContainer}>
            {!!(cartItem?.quantity || 0) && (
              <View style={styles.addedToCartMessage}>
                <Ionicons
                  name="checkmark-circle"
                  size={10}
                  color={Colors.textLight}
                />
                <Text style={styles.addedToCartMessageText}>
                  Added ({cartItem.quantity})
                </Text>
              </View>
            )}
            <View style={styles.quantityButtonsWrapper}>
              <TouchableOpacity
                onPress={() => handleQuantityButtonClick(false)}
                disabled={currentNumericalQuantity <= 0 || isAddingToCart}
                style={[
                  styles.quantityButton,
                  styles.quantityButtonLeft,
                  (currentNumericalQuantity <= 0 || isAddingToCart) &&
                    styles.quantityButtonDisabled,
                ]}
              >
                <FontAwesome name="minus" size={10} color={Colors.textLight} />
              </TouchableOpacity>
              <TextInput
                keyboardType="numeric"
                value={quantity}
                onChangeText={handleQuantityChange}
                onEndEditing={handleQuantityBlur}
                style={styles.quantityInput}
                maxLength={String(displayStock).length + 2}
              />
              <TouchableOpacity
                onPress={() => handleQuantityButtonClick(true)}
                disabled={
                  currentNumericalQuantity >= displayStock || isAddingToCart
                }
                style={[
                  styles.quantityButton,
                  styles.quantityButtonRight,
                  (currentNumericalQuantity >= displayStock ||
                    isAddingToCart) &&
                    styles.quantityButtonDisabled,
                ]}
              >
                <FontAwesome name="plus" size={10} color={Colors.textLight} />
              </TouchableOpacity>
            </View>
            {((currentNumericalQuantity > 0 &&
              cartItem?.quantity !== currentNumericalQuantity) ||
              (currentNumericalQuantity === 0 &&
                (cartItem?.quantity || 0) > 0)) && (
              <TouchableOpacity
                onPress={() => handleCartAction(currentNumericalQuantity)}
                disabled={isAddingToCart}
                style={[
                  styles.updateCartButton,
                  isAddingToCart && styles.updateCartButtonDisabled,
                ]}
              >
                {isAddingToCart ? (
                  <ActivityIndicator size="small" color={Colors.textLight} />
                ) : (
                  <Text style={styles.updateCartButtonText}>
                    {currentNumericalQuantity === 0
                      ? "Remove from Cart"
                      : "Update Cart"}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleAddToCartClick}
            disabled={
              !product.isAvailable || displayStock === 0 || isAddingToCart
            }
            style={[
              styles.addToCartButton,
              (!product.isAvailable || displayStock === 0 || isAddingToCart) &&
                styles.addToCartButtonDisabled,
            ]}
          >
            {isAddingToCart ? (
              <ActivityIndicator size="small" color={Colors.textLight} />
            ) : (
              <>
                <Ionicons
                  name="cart"
                  size={10}
                  color={Colors.textLight}
                  style={styles.addToCartIcon}
                />
                <Text style={styles.addToCartButtonText}>Add to Cart</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
        width: CARD_WIDTH,
      
    backgroundColor: Colors.cardBackground,
    borderRadius: 8,
    marginHorizontal: 5,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 412 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
  },
  cardDisabled: {
    opacity: 0.6,
  },
  imageContainer: {
    width: "100%",
    height: CARD_WIDTH * 0.8,
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  saveBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: Colors.greenDark,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 1,
  },
  saveBadgeText: {
    color: Colors.textLight,
    fontSize: 10,
    fontWeight: "bold",
  },
  priceTag: {
    position: "absolute",
    bottom: 5,
    left: 5,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  priceTagText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: "bold",
  },
  detailsContainer: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.grayDark,
    marginBottom: 5,
    textAlign: "center", // Centered the product name for better aesthetic
  },
  stockContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    justifyContent: "center",
  },
  limitedStockText: {
    fontSize: 10,
    color: Colors.redAlert,
    fontWeight: "600",
  },
  inStockText: {
    fontSize: 10,
    color: Colors.greenDark,
    fontWeight: "600",
  },
  outOfStockText: {
    fontSize: 10,
    color: Colors.redAlert,
    fontWeight: "600",
  },
  priceTiersContainer: {
    flexDirection: "column",
    gap: 4,
    marginBottom: 10,
    alignItems: "center",
  },
  priceTierItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    width: "100%",
  },
  priceTierActive: {
    backgroundColor: Colors.greenDark,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  priceTierLabel: {
    fontSize: 10,
    color: Colors.grayText,
    fontWeight: "500",
  },
  priceTierLabelActive: {
    color: Colors.textLight,
  },
  priceTierPrice: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.greenDark,
  },
  priceTierPriceActive: {
    color: Colors.textLight,
  },
  addToCartButton: {
    backgroundColor: Colors.greenPrimary,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  addToCartInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addToCartButtonDisabled: {
    backgroundColor: Colors.grayLight,
  },
  addToCartButtonText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: "bold",
  },
  addToCartIcon: {
    marginRight: 4,
  },
  disabledButton: {
    backgroundColor: Colors.grayLight,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButtonText: {
    color: Colors.grayText,
    fontSize: 14,
    fontWeight: "bold",
  },
  // New Styles for quantity controls
  quantityControlsContainer: {
    flexDirection: "column",
    gap: 6,
    marginTop: 4,
    width: "100%",
  },
  addedToCartMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenDark,
    borderRadius: 8,
    paddingVertical: 4,
    marginBottom: 2,
  },
  addedToCartMessageText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textLight,
    marginLeft: 4,
  },
  quantityButtonsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    backgroundColor: Colors.lightGreenBackground,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  quantityButton: {
    width: "33.33%",
    paddingVertical: 8,
    backgroundColor: Colors.greenSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonLeft: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  quantityButtonRight: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityInput: {
    width: "33.33%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 2,
    paddingVertical: 8,
    backgroundColor: Colors.lightGreenBackground,
    color: Colors.greenDark,
  },
  updateCartButton: {
    marginTop: 6,
    width: "100%",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.greenDark,
    alignItems: "center",
    justifyContent: "center",
  },
  updateCartButtonDisabled: {
    opacity: 0.5,
  },
  updateCartButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textLight,
  },
});

export default NewProductCard;
