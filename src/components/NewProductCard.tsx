import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";

// Replace lucide-react-native imports with react-native-vector-icons equivalent
// (assuming you're already using them based on the prompt's comment)
import { addOrUpdateItem } from "../features/cart/cartSlice";

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
  vendorDistance?: number; // <-- Added new prop for vendor distance
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
};

const PRODUCT_NAME_MAX_LENGTH = 20;

const NewProductCard: React.FC<NewProductCardProps> = ({
  product,
  isVendorOffline = false,
  isVendorOutOfRange = false,
  vendorDistance, // <-- Destructure the new prop
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<ProductCardNavigationProp>();
  const cartItem = useSelector((state: any) => state.cart.items[product._id]);

  const [quantity, setQuantity] = useState<string>(
    cartItem?.quantity > 0 ? String(cartItem.quantity) : ""
  );
  const [effectivePrice, setEffectivePrice] = useState<number>(
    product.discountedPrice || product.price
  );
  const [showQuantityInput, setShowQuantityInput] = useState<boolean>(
    (cartItem?.quantity || 0) > 0
  );
  const [displayStock, setDisplayStock] = useState<number>(product.stock);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);

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
    const tiers: {
      minQty: number;
      maxQty: number;
      price: number;
      label: string;
      isActive?: boolean;
    }[] = [];

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

  const showToast = (
    msg: string,
    type: "success" | "error" | "info" | "warn"
  ) => {
    let toastType: "success" | "error" | "info" | "warning";
    let text1Title: string;
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
  };

  const handleCartAction = async (qtyToDispatch: number) => {
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
    } catch (error: any) {
      console.error("Failed to update cart:", error);
      showToast(
        error.message || "Failed to update item in cart. Please try again.",
        "error"
      );
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleQuantityChange = (value: string) => {
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

  const handleQuantityButtonClick = async (increment: boolean) => {
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

  const truncatedProductName =
    product.name.length > PRODUCT_NAME_MAX_LENGTH
      ? `${product.name.substring(0, PRODUCT_NAME_MAX_LENGTH)}...`
      : product.name;

  return (
    <View style={[styles.cardContainer, isDisabled && styles.cardDisabled]}>
      <View style={styles.detailsContainer}>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ProductDetails", { product: product })
          }
          style={styles.productLink}
          disabled={isDisabled}
        >
          <View >
            <Text style={styles.productName}>{truncatedProductName}</Text>
            {!!product.companyName && (
              <Text style={styles.metaText}>{product.companyName}</Text>
            )}
            {!!product.brand && (
              <Text style={styles.metaText}>Brand: {product.brand}</Text>
            )}
            {!!product.location && (
              <Text style={styles.metaText}>📍 {product.location}</Text>
            )}
            {/* Added a condition to display vendor distance */}
            {typeof vendorDistance === "number" && (
              <Text style={styles.distanceText}>
                {vendorDistance.toFixed(2)} km away
              </Text>
            )}
            {!!product.rating && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={10} color={Colors.yellowStar} />
                <Text style={styles.metaText}>
                  {product.rating.toFixed(1)}{" "}
                  {product.numReviews ? `(${product.numReviews})` : ""}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.bottomDetailsContainer}>
          <View style={styles.stockContainer}>
            {displayStock > 0 ? (
              displayStock <= 10 ? (
                <Text style={styles.limitedStockText}>
                  Limited! ({displayStock} in stock)
                </Text>
              ) : (
                <View style={styles.inStockContainer}>
                  <Ionicons
                    name="checkmark-circle"
                    size={10}
                    color={Colors.greenSuccess}
                  />
                  <Text style={styles.inStockText}>
                    Avail: {displayStock} in stock
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.outOfStockContainer}>
                <Ionicons
                  name="close-circle"
                  size={10}
                  color={Colors.redAlert}
                />
                <Text style={styles.outOfStockText}>Unavail.</Text>
              </View>
            )}
          </View>

          {priceTiers.length > 0 && (
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
          )}

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
                  <FontAwesome
                    name="minus"
                    size={10}
                    color={Colors.textLight}
                  />
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
                (!product.isAvailable ||
                  displayStock === 0 ||
                  isAddingToCart) &&
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

      <TouchableOpacity
        onPress={() =>
          navigation.navigate("ProductDetails", { product: product })
        }
        style={styles.imageContainer}
        disabled={isDisabled}
      >
        <View style={styles.imageWrapper}>
          {product.images && product.images.length > 0 ? (
            <Image
              source={{ uri: product.images[0] }}
              style={styles.productImage}
            />
          ) : (
            <View style={styles.noImageIcon}>
              <Ionicons
                name="image-outline"
                size={30}
                color={Colors.grayLight}
              />
              <Text style={styles.noImageText}>No Image</Text>
            </View>
          )}

          {isVendorOffline && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>Vendor Offline</Text>
            </View>
          )}

          {isVendorOutOfRange && !isVendorOffline && (
            <View style={[styles.overlay, styles.overlayDanger]}>
              <Text style={styles.overlayText}>Out of Range</Text>
            </View>
          )}

          {!!amountSaved && (
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save ₹{amountSaved}</Text>
            </View>
          )}
          {product.discountedPrice &&
            product.discountedPrice < product.price &&
            !amountSaved && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>Discounted!</Text>
              </View>
            )}

          <View style={styles.priceDisplay}>
            <Text style={styles.priceDisplayText}>
              ₹{effectivePrice.toFixed(2)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    backgroundColor: Colors.textLight,
    borderRadius: 12,
    marginHorizontal: 4,
    marginVertical: 4,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 260,
    maxWidth: "100%",
    height: 200,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  detailsContainer: {
    padding: 6,
    flexDirection: "column",
    justifyContent: "space-between",
    flexGrow: 1,
    width: "60%",
    overflow: "hidden",
  },
  productLink: {
    flexGrow: 0,
    minHeight: 40,
  },
  productName: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.grayDark,
    lineHeight: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  metaText: {
    fontSize: 8,
    color: Colors.grayDark,
    marginVertical: 1,
    flexShrink: 1,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 2,
  },
  bottomDetailsContainer: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  stockContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 4,
    marginBottom: 2,
  },
  limitedStockText: {
    fontSize: 8,
    color: Colors.redAlert,
    fontWeight: "600",
  },
  inStockContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  inStockText: {
    fontSize: 8,
    color: Colors.greenDark,
    fontWeight: "600",
  },
  outOfStockContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  outOfStockText: {
    fontSize: 8,
    color: Colors.redAlert,
    fontWeight: "600",
  },
  priceTiersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 2,
  },
  priceTierItem: {
    flexDirection: "column",
    alignItems: "center",
    padding: 2,
    borderRadius: 6,
    backgroundColor: Colors.textLight,
  },
  priceTierActive: {
    backgroundColor: Colors.greenDark,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  priceTierLabel: {
    fontSize: 8,
    fontWeight: "500",
    color: Colors.grayDark,
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
  quantityControlsContainer: {
    flexDirection: "column",
    gap: 2,
    marginTop: 4,
  },
  addedToCartMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenDark,
    borderRadius: 8,
    paddingVertical: 2,
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
    paddingVertical: 4,
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
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 2,
    paddingVertical: 4,
    backgroundColor: Colors.lightGreenBackground,
    color: Colors.greenDark,
  },
  updateCartButton: {
    marginTop: 2,
    width: "100%",
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.greenDark,
    alignItems: "center",
    justifyContent: "center",
  },
  updateCartButtonDisabled: {
    opacity: 0.5,
  },
  updateCartButtonText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textLight,
  },
  addToCartButton: {
    marginTop: 2,
    width: "100%",
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.greenDark,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  addToCartButtonDisabled: {
    backgroundColor: Colors.grayLight,
  },
  addToCartButtonText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textLight,
    marginLeft: 4,
  },
  addToCartIcon: {
    marginRight: 4,
  },
  disabledButton: {
    width: "100%",
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.grayLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  disabledButtonText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.grayText,
  },
  imageContainer: {
    flexShrink: 0,
    width: "40%",
    overflow: "hidden",
    borderRadius: 2,
  },
  imageWrapper: {
    position: "relative",
    width: "100%",
    height: "100%",
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  noImageIcon: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.grayLight,
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  noImageText: {
    fontSize: 10,
    color: Colors.grayText,
    marginLeft: 2,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  overlayDanger: {
    backgroundColor: "rgba(220, 38, 38, 0.6)",
  },
  overlayText: {
    color: Colors.textLight,
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "center",
    padding: 4,
  },
  saveBadge: {
    position: "absolute",
    top: 2,
    left: 2,
    backgroundColor: Colors.yellowHighlight,
    borderRadius: 9999,
    paddingHorizontal: 4,
    paddingVertical: 2,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveBadgeText: {
    color: Colors.textLight,
    fontSize: 8,
    fontWeight: "bold",
  },
  priceDisplay: {
    position: "absolute",
    bottom: 2,
    left: 2,
    right: 2,
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 2,
    borderRadius: 6,
  },
  priceDisplayText: {
    color: Colors.textLight,
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  distanceText: {
    // <-- New style for the distance
    fontSize: 10,
    color: Colors.grayText,
    marginTop: 2,
    flexShrink: 1,
  },
});

export default NewProductCard;
