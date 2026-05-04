import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Animated,
  ScrollView,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";

import { addOrUpdateItem } from "../features/cart/cartSlice";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.9;

export type RootStackParamList = {
  ProductDetails: { product: Product };
  Home: { forwardProduct?: Product }; // 🔥 FIXED: Matches your Tab Navigator name for ChatScreen
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
  sizes?: string[];
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

// 👑 LUXURY COLORS 👑
const Colors = {
  goldPrimary: "#F5F5F5",
  purpleDark: "#1b3a2dff",
  emeraldGreen: "#1b4130ff",
  textLight: "#FFFFFF",
  textDark: "#1A1A1A",
  grayText: "#AAAAAA",
  redAlert: "#DC2626",
  cardBackground: "#F5F5F5",
  borderLuxury: "#F8F5F0",
  shadowLuxury: "#000000",
};

const PRODUCT_NAME_MAX_LENGTH = 100;

const getCategoryDisplayName = (
  fullCategoryName: string | undefined,
): string => {
  if (!fullCategoryName) return "";
  const parts = fullCategoryName.split(/[_/\\]/);
  let lastPart = parts[parts.length - 1];

  if (lastPart.length > 0) {
    lastPart = lastPart.trim();
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  }
  return "";
};

const NewProductCard: React.FC<NewProductCardProps> = ({
  product,
  isVendorOffline = false,
  isVendorOutOfRange = false,
  vendorDistance,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<ProductCardNavigationProp>();

  const [selectedSize, setSelectedSize] = useState<string | null>(
    product.sizes?.[0] || null,
  );

  const cartItemsByProduct = useSelector((state: any) => state.cart.items);

  const cartKey = useMemo(() => {
    if (product.sizes?.length > 0 && selectedSize) {
      return `${product._id}_${selectedSize}`;
    }
    return product._id;
  }, [product._id, product.sizes, selectedSize]);

  const activeCartItem = cartItemsByProduct[cartKey];
  const cartItem = activeCartItem;

  const basePrice = useMemo(
    () => product.discountedPrice || product.price,
    [product.discountedPrice, product.price],
  );

  const [quantity, setQuantity] = useState(
    cartItem?.quantity > 0 ? String(cartItem.quantity) : "",
  );
  const [effectivePrice, setEffectivePrice] = useState(basePrice);
  const [showQuantityInput, setShowQuantityInput] = useState(
    (cartItem?.quantity || 0) > 0,
  );
  const [displayStock, setDisplayStock] = useState(product.stock);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const controlOpacity = useRef(
    new Animated.Value(showQuantityInput ? 1 : 0),
  ).current;
  const [renderQuantityControls, setRenderQuantityControls] =
    useState(showQuantityInput);

  useEffect(() => {
    if (showQuantityInput) {
      setRenderQuantityControls(true);
      Animated.timing(controlOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(controlOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setRenderQuantityControls(false);
      });
    }
  }, [showQuantityInput]);

  useEffect(() => {
    const currentCartQty = activeCartItem?.quantity || 0;
    setQuantity(currentCartQty > 0 ? String(currentCartQty) : "");
    setShowQuantityInput(currentCartQty > 0);
  }, [activeCartItem]);

  const truncatedProductName = useMemo(() => {
    if (product.name.length > PRODUCT_NAME_MAX_LENGTH) {
      return `${product.name.substring(0, PRODUCT_NAME_MAX_LENGTH)}...`;
    }
    return product.name;
  }, [product.name]);

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

  const originalPriceDisplay =
    product.discountedPrice && product.discountedPrice < product.price
      ? product.price.toFixed(2)
      : null;

  const priceTiers = useMemo(() => {
    const tiers = [];
    const bulkMin = product.bulkMinimumUnits || Infinity;
    const largeQtyMin = product.largeQuantityMinimumUnits || Infinity;
    const hasBulkTier = !!(product.bulkPrice && product.bulkMinimumUnits);
    const hasLargeQtyTier = !!(
      product.largeQuantityPrice && product.largeQuantityMinimumUnits
    );

    const defaultMax = Math.min(bulkMin, largeQtyMin) - 1;
    const defaultLabel = `1 - ${
      defaultMax === Infinity ? "max" : defaultMax
    } kg`;

    if (defaultMax >= 1) {
      tiers.push({
        minQty: 1,
        maxQty: defaultMax,
        price: product.discountedPrice || product.price,
        label: defaultLabel,
      });
    }

    let nextTierMin = defaultMax + 1;
    let nextTierMax = Infinity;

    if (hasBulkTier && bulkMin < largeQtyMin) {
      const bulkMax = largeQtyMin - 1;
      const bulkLabel = `${product.bulkMinimumUnits} - ${
        bulkMax === Infinity ? "max" : bulkMax
      } kg`;
      if (bulkMin >= nextTierMin) {
        tiers.push({
          minQty: product.bulkMinimumUnits,
          maxQty: bulkMax,
          price: product.bulkPrice,
          label: bulkLabel,
        });
      }
      nextTierMin = bulkMax + 1;
    }

    if (hasLargeQtyTier && product.largeQuantityMinimumUnits >= nextTierMin) {
      tiers.push({
        minQty: product.largeQuantityMinimumUnits,
        maxQty: Infinity,
        price: product.largeQuantityPrice,
        label: `>= ${product.largeQuantityMinimumUnits} kg`,
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
    let currentPrice = basePrice;
    const activeTier = priceTiers.find(
      (tier) =>
        currentNumericalQuantity >= tier.minQty &&
        (tier.maxQty === Infinity || currentNumericalQuantity <= tier.maxQty),
    );
    if (activeTier) {
      currentPrice = activeTier.price;
    }
    setEffectivePrice(currentPrice);
  }, [currentNumericalQuantity, basePrice, priceTiers]);

  useEffect(() => {
    setDisplayStock(product.stock);
  }, [product.stock]);

  const showToast = useCallback(
    (msg: string, type: "success" | "error" | "info" | "warn") => {
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
          toastType = "info";
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
    },
    [],
  );

  const requiresSizeSelection = product.sizes && product.sizes.length > 0;

  const handleCartAction = async (qtyToDispatch: number) => {
    if (isVendorOffline) {
      showToast(
        "Vendor is currently offline. Cannot add products from this shop.",
        "error",
      );
      return;
    }
    if (isVendorOutOfRange) {
      showToast(
        "Vendor is out of your delivery range. Cannot add products from this shop.",
        "error",
      );
      return;
    }

    if (requiresSizeSelection && !selectedSize && qtyToDispatch > 0) {
      showToast("Please select a size before adding to cart.", "warn");
      setIsAddingToCart(false);
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
        "error",
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
          size: selectedSize,
        }) as any,
      ).unwrap();

      const sizeDisplay = selectedSize ? ` (${selectedSize})` : "";

      if (numericalQuantity === 0) {
        showToast(`Removed ${product.name}${sizeDisplay} from cart.`, "info");
      } else if (!cartItem || cartItem.quantity === 0) {
        showToast(
          `Added ${numericalQuantity} x ${product.name}${sizeDisplay} to cart!`,
          "success",
        );
      } else {
        showToast(
          `Updated cart: ${numericalQuantity} x ${product.name}${sizeDisplay}`,
          "info",
        );
      }
    } catch (error) {
      console.error("Failed to update cart:", error);
      showToast(
        (error as Error).message ||
          "Failed to update item in cart. Please try again.",
        "error",
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

    if (numericalQuantity === 0 && (activeCartItem?.quantity || 0) > 0) {
      await handleCartAction(0);
      setQuantity("");
      setShowQuantityInput(false);
      return;
    }

    if (numericalQuantity > displayStock) {
      showToast(
        `Only ${displayStock} units available for "${product.name}". Setting quantity to max available.`,
        "warn",
      );
      numericalQuantity = displayStock;
      setQuantity(String(displayStock));
    }

    if (numericalQuantity !== (activeCartItem?.quantity || 0)) {
      await handleCartAction(numericalQuantity);
    } else if (
      numericalQuantity === 0 &&
      (activeCartItem?.quantity || 0) === 0
    ) {
      setShowQuantityInput(false);
      setQuantity("");
    }
  };

  const handleQuantityButtonClick = async (increment: boolean) => {
    if (requiresSizeSelection && !selectedSize) {
      showToast("Please select a size before changing quantity.", "warn");
      return;
    }

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
    if (isFullyDisabled || displayStock === 0) {
      return;
    }

    if (requiresSizeSelection && !selectedSize) {
      showToast("Please select a size before adding to cart.", "warn");
      return;
    }

    if (!showQuantityInput || currentNumericalQuantity === 0) {
      setQuantity("1");
      setShowQuantityInput(true);
      await handleCartAction(1);
    }
  };

  const handleCardPress = () => {
    if (!isDisabled) {
      navigation.navigate("ProductDetails", { product: product });
    }
  };

  // 🔥 FIXED: Routes directly to the "Home" tab where ChatScreen lives
  const handleShareToChat = () => {
    navigation.navigate("Home" as never, { forwardProduct: product } as never);
  };

  const isFullyDisabled =
    isVendorOffline || isVendorOutOfRange || displayStock === 0;

  const isDisabled = isVendorOffline || isVendorOutOfRange;
  const priceTagDisplay = basePrice.toFixed(2);

  const isAddToCartButtonDisabled =
    isFullyDisabled ||
    isAddingToCart ||
    (requiresSizeSelection && !selectedSize);

  const totalSavingsInfo = useMemo(() => {
    const currentQuantity = currentNumericalQuantity;

    if (currentQuantity > 0) {
      const regularTotal = product.price * currentQuantity;
      const actualTotal = effectivePrice * currentQuantity;
      const totalSaving = regularTotal - actualTotal;

      if (totalSaving > 0.01) {
        const formattedRegularTotal = regularTotal.toFixed(2);
        const formattedActualTotal = actualTotal.toFixed(2);
        const formattedTotalSaving = totalSaving.toFixed(2);

        return {
          show: true,
          regularTotal: formattedRegularTotal,
          actualTotal: formattedActualTotal,
          totalSaving: formattedTotalSaving,
          quantity: currentQuantity,
        };
      }
    }
    return { show: false };
  }, [currentNumericalQuantity, effectivePrice, product.price]);

  const categoryDisplayName = useMemo(
    () => getCategoryDisplayName(product.category),
    [product.category],
  );

  return (
    <View style={[styles.cardContainer]}>
      <TouchableOpacity
        onPress={() =>
          navigation.navigate("ProductDetails", { product: product })
        }
        style={styles.imageContainer}
        disabled={isFullyDisabled}
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

        {/* 🔥 SHARE TO CHAT BUTTON */}
        <TouchableOpacity
          style={styles.shareButtonOverlay}
          onPress={handleShareToChat}
        >
          <Ionicons
            name="arrow-redo-circle"
            size={32}
            color={Colors.goldPrimary}
          />
        </TouchableOpacity>

        <View style={styles.priceTag}>
          {originalPriceDisplay && (
            <Text style={styles.originalPriceText}>
              ₹{originalPriceDisplay}
            </Text>
          )}
          <Text style={styles.priceTagText}>₹{priceTagDisplay}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.detailsContainer}>
        <Text style={styles.productNameEnhanced}>{truncatedProductName}</Text>

        {totalSavingsInfo.show && (
          <View style={styles.bulkSavingsBanner}>
            <Text style={styles.bulkSavingsHeader}>👑 TOTAL SAVINGS 👑</Text>
            <Text style={styles.bulkSavingsText}>
              <Text style={styles.bulkQuantityText}>
                {totalSavingsInfo.quantity}{" "}
                {totalSavingsInfo.quantity === 1 ? "Kg" : "Kg's"}
              </Text>{" "}
              (Original Total):{" "}
              <Text style={styles.bulkSavingsOriginalPrice}>
                ₹{totalSavingsInfo.regularTotal}
              </Text>
              <Text style={styles.bulkSavingsDiscountedPrice}>
                {" "}
                NOW: ₹{totalSavingsInfo.actualTotal}
              </Text>
            </Text>
            <Text style={styles.bulkSavingsSubText}>
              You Save a total of ₹{totalSavingsInfo.totalSaving}!
            </Text>
          </View>
        )}

        <View style={styles.stockContainer}>
          {displayStock > 0 ? (
            displayStock <= 10 ? (
              <Text style={styles.limitedStockText}>
                Limited! ({displayStock} in stock)
              </Text>
            ) : (
              <Text
                style={[
                  styles.inStockText,
                  isFullyDisabled && styles.disabledText,
                ]}
              >
                Avail: {displayStock} Kg in stock
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
                  !tier.isActive && isFullyDisabled && styles.disabledText,
                ]}
              >
                {tier.label}
              </Text>
              <Text
                style={[
                  styles.priceTierPrice,
                  tier.isActive && styles.priceTierPriceActive,
                  !tier.isActive && isFullyDisabled && styles.disabledText,
                ]}
              >
                ₹{tier.price.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {renderQuantityControls ? (
          <Animated.View
            style={[
              styles.quantityControlsContainer,
              { opacity: controlOpacity },
            ]}
          >
            {!!(cartItem?.quantity || 0) && (
              <View style={styles.addedToCartMessage}>
                <Ionicons
                  name="checkmark-circle"
                  size={10}
                  color={Colors.goldPrimary}
                />
                <Text style={styles.addedToCartMessageText}>
                  Added ({cartItem.quantity})
                </Text>
              </View>
            )}
            <View style={styles.quantityButtonsWrapper}>
              <TouchableOpacity
                onPress={() => handleQuantityButtonClick(false)}
                disabled={
                  currentNumericalQuantity <= 0 ||
                  isAddingToCart ||
                  isFullyDisabled
                }
                style={[
                  styles.quantityButton,
                  styles.quantityButtonLeft,
                  (currentNumericalQuantity <= 0 ||
                    isAddingToCart ||
                    isFullyDisabled) &&
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
                style={[
                  styles.quantityInput,
                  isFullyDisabled && styles.disabledInput,
                ]}
                maxLength={String(displayStock).length + 2}
                editable={!isFullyDisabled && !isAddingToCart}
              />
              <TouchableOpacity
                onPress={() => handleQuantityButtonClick(true)}
                disabled={
                  currentNumericalQuantity >= displayStock ||
                  isAddingToCart ||
                  isFullyDisabled
                }
                style={[
                  styles.quantityButton,
                  styles.quantityButtonRight,
                  (currentNumericalQuantity >= displayStock ||
                    isAddingToCart ||
                    isFullyDisabled) &&
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
                disabled={isAddingToCart || isFullyDisabled}
                style={[
                  styles.updateCartButton,
                  (isAddingToCart || isFullyDisabled) &&
                    styles.updateCartButtonDisabled,
                ]}
              >
                {isAddingToCart ? (
                  <ActivityIndicator size="small" color={Colors.goldPrimary} />
                ) : (
                  <Text style={styles.updateCartButtonText}>
                    {currentNumericalQuantity === 0
                      ? "Remove from Cart"
                      : "Update Cart"}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              {
                opacity: controlOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleAddToCartClick}
              disabled={isAddToCartButtonDisabled}
              style={[
                styles.addToCartButton,
                isAddToCartButtonDisabled && styles.addToCartButtonDisabled,
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
                  <Text style={styles.addToCartButtonText}>
                    {displayStock === 0
                      ? "Out of Stock"
                      : isDisabled
                        ? "Unavailable"
                        : requiresSizeSelection && !selectedSize
                          ? "Select Size"
                          : "Add to Cart"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    marginHorizontal: 5,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: Colors.borderLuxury,
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  disabledText: { color: Colors.grayText },
  disabledInput: { backgroundColor: Colors.borderLuxury },
  sizePillDisabled: { opacity: 0.7 },

  imageContainer: {
    width: "100%",
    height: CARD_WIDTH * 1.1,
    position: "relative",
    overflow: "hidden",
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },

  shareButtonOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 20,
    padding: 2,
  },

  saveBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.purpleDark,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 1,
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  saveBadgeText: {
    color: Colors.goldPrimary,
    fontSize: 10,
    fontWeight: "800",
  },
  priceTag: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: Colors.emeraldGreen,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  originalPriceText: {
    color: Colors.textLight,
    fontSize: 13,
    fontWeight: "normal",
    textDecorationLine: "line-through",
    marginRight: 6,
    opacity: 0.7,
  },
  priceTagText: {
    color: Colors.textLight,
    fontSize: 18,
    fontWeight: "bold",
  },
  detailsContainer: {
    padding: 10,
  },
  productNameEnhanced: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.textDark,
    marginBottom: 4,
    textAlign: "center",
  },
  categoryDisplayContainer: { alignItems: "center", marginBottom: 8 },
  categoryDisplayText: {
    fontSize: 11,
    color: Colors.emeraldGreen,
    fontWeight: "500",
  },

  bulkSavingsBanner: {
    backgroundColor: Colors.purpleDark,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.goldPrimary,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginVertical: 5,
    alignItems: "center",
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  bulkSavingsHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.goldPrimary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  bulkSavingsText: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.goldPrimary,
    marginBottom: 4,
    textAlign: "center",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  bulkQuantityText: { fontWeight: "900", fontSize: 15 },
  bulkSavingsOriginalPrice: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.goldPrimary,
    textDecorationLine: "line-through",
    marginRight: 8,
    opacity: 0.7,
  },
  bulkSavingsDiscountedPrice: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.textLight,
  },
  bulkSavingsSubText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textLight,
    marginTop: 4,
  },

  sizeSelectorWrapper: {
    flexDirection: "column",
    marginBottom: 8,
    width: "100%",
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.borderLuxury,
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  sizeSelectorLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.textDark,
    marginBottom: 5,
  },
  requiredText: { color: Colors.redAlert, fontSize: 14, fontWeight: "900" },
  sizeScrollView: { alignItems: "center" },
  sizePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.grayText,
    marginHorizontal: 3,
    backgroundColor: Colors.cardBackground,
  },
  sizePillActive: {
    backgroundColor: Colors.purpleDark,
    borderColor: Colors.purpleDark,
  },
  sizePillText: { fontSize: 11, color: Colors.textDark, fontWeight: "600" },
  sizePillTextActive: { color: Colors.goldPrimary },

  stockContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    justifyContent: "center",
  },
  limitedStockText: { fontSize: 10, color: Colors.redAlert, fontWeight: "700" },
  inStockText: { fontSize: 10, color: Colors.emeraldGreen, fontWeight: "700" },
  outOfStockText: { fontSize: 10, color: Colors.redAlert, fontWeight: "700" },

  priceTiersContainer: {
    flexDirection: "column",
    gap: 4,
    marginBottom: 10,
    alignItems: "stretch",
    paddingHorizontal: 5,
  },
  priceTierItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    width: "100%",
  },
  priceTierActive: {
    backgroundColor: Colors.purpleDark,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  priceTierLabel: {
    fontSize: 11,
    color: Colors.grayText,
    fontWeight: "600",
    textAlign: "left",
  },
  priceTierLabelActive: { color: Colors.goldPrimary, fontWeight: "800" },
  priceTierPrice: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.purpleDark,
    textAlign: "right",
  },
  priceTierPriceActive: { color: Colors.goldPrimary, fontSize: 16 },

  addToCartButton: {
    backgroundColor: Colors.emeraldGreen,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  addToCartButtonDisabled: {
    backgroundColor: Colors.grayText,
    opacity: 0.8,
    shadowOpacity: 0.1,
    elevation: 0,
  },
  addToCartButtonText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: "bold",
  },
  addToCartIcon: { marginRight: 4, color: Colors.textLight },

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
    backgroundColor: Colors.purpleDark,
    borderRadius: 8,
    paddingVertical: 4,
    marginBottom: 2,
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  addedToCartMessageText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.goldPrimary,
    marginLeft: 4,
  },
  quantityButtonsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    backgroundColor: Colors.cardBackground,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLuxury,
  },
  quantityButton: {
    width: "33.33%",
    paddingVertical: 8,
    backgroundColor: Colors.emeraldGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonLeft: { borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  quantityButtonRight: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  quantityButtonDisabled: { opacity: 0.5 },
  quantityInput: {
    width: "33.33%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 2,
    paddingVertical: 8,
    backgroundColor: Colors.cardBackground,
    color: Colors.purpleDark,
  },
  updateCartButton: {
    marginTop: 6,
    width: "100%",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.purpleDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  updateCartButtonDisabled: { opacity: 0.5 },
  updateCartButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.goldPrimary,
  },
});

export default NewProductCard;
