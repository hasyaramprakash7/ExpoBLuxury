import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";

// 🔥 Added removeItem to the imports
import { addOrUpdateItem, removeItem } from "../features/cart/cartSlice";

// --- TYPE DEFINITIONS ---
export type RootStackParamList = {
  ProductDetails: { product: Product };
  Chat: { forwardProduct?: Product };
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
  vendor?: { _id: string };
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
  category?: string;
  sizes?: string[];
  description?: string;
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

// --- COLORS MATCHING THE NEW UI ---
const Colors = {
  white: "#FFFFFF",
  textDark: "#1C1C1E",
  textGray: "#D1D5DB",
  textLightGray: "#9CA3AF",
  accentGreen: "#22C55E",
  redAlert: "#EF4444",
  divider: "rgba(255,255,255,0.2)",
  bgLight: "rgba(255,255,255,0.1)",
  yellowStar: "#fff",
  goldPrimary: "#fff",
};

const PRODUCT_NAME_MAX_LENGTH = 60;

const NewProductCard: React.FC<NewProductCardProps> = ({
  product,
  isVendorOffline = false,
  isVendorOutOfRange = false,
  vendorDistance,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<ProductCardNavigationProp>();

  const isNonVeg = useMemo(() => {
    const nonVegKeywords = /chicken|mutton|fish|egg|meat|prawn|crab|beef|pork/i;
    return (
      nonVegKeywords.test(product.name) ||
      nonVegKeywords.test(product.category || "")
    );
  }, [product.name, product.category]);

  const requiresSizeSelection = product.sizes && product.sizes.length > 0;
  const [selectedSize, setSelectedSize] = useState<string | null>(
    requiresSizeSelection ? product.sizes![0] : null,
  );

  // 🔥 FIX 1: Read cart items as an array and find the specific item
  const cartItems = useSelector((state: any) => state.cart.items);

  const cartItem = useMemo(() => {
    if (!cartItems || !Array.isArray(cartItems)) return null;

    return cartItems.find((item: any) => {
      // Safely check both productId as string or populated object
      const isMatchingProduct =
        item.productId === product._id || item.product?._id === product._id;
      const isMatchingSize = requiresSizeSelection
        ? item.size === selectedSize
        : true;
      return isMatchingProduct && isMatchingSize;
    });
  }, [cartItems, product._id, selectedSize, requiresSizeSelection]);

  const basePrice = useMemo(
    () => product.discountedPrice || product.price,
    [product.discountedPrice, product.price],
  );

  const [quantity, setQuantity] = useState<string>(
    (cartItem?.quantity || 0) > 0 ? String(cartItem.quantity) : "",
  );
  const [effectivePrice, setEffectivePrice] = useState<number>(basePrice);
  const [showQuantityInput, setShowQuantityInput] = useState<boolean>(
    (cartItem?.quantity || 0) > 0,
  );
  const [displayStock, setDisplayStock] = useState<number>(product.stock);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);

  const controlOpacity = useMemo(
    () => new Animated.Value(showQuantityInput ? 1 : 0),
    [],
  );
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
      }).start(() => setRenderQuantityControls(false));
    }
  }, [showQuantityInput, controlOpacity]);

  const currentNumericalQuantity = useMemo(
    () => (quantity === "" ? 0 : parseInt(quantity, 10) || 0),
    [quantity],
  );

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
    const tiers: any[] = [];
    const bulkMin = product.bulkMinimumUnits || Infinity;
    const largeQtyMin = product.largeQuantityMinimumUnits || Infinity;
    const hasBulkTier = !!(product.bulkPrice && product.bulkMinimumUnits);
    const hasLargeQtyTier = !!(
      product.largeQuantityPrice && product.largeQuantityMinimumUnits
    );

    const defaultMax = Math.min(bulkMin - 1, largeQtyMin - 1);
    const defaultLabel = `1 - ${defaultMax === Infinity ? "max" : defaultMax} Kg`;

    if (defaultMax >= 1 || (!hasBulkTier && !hasLargeQtyTier)) {
      tiers.push({
        minQty: 1,
        maxQty: defaultMax,
        price: product.discountedPrice || product.price,
        label: defaultLabel,
      });
    }
    if (hasBulkTier) {
      const bulkMax = largeQtyMin - 1;
      const bulkLabel = `${product.bulkMinimumUnits} - ${bulkMax === Infinity ? "max" : bulkMax} Kg`;
      tiers.push({
        minQty: product.bulkMinimumUnits,
        maxQty: bulkMax,
        price: product.bulkPrice!,
        label: bulkLabel,
      });
    }
    if (hasLargeQtyTier) {
      tiers.push({
        minQty: product.largeQuantityMinimumUnits!,
        maxQty: Infinity,
        price: product.largeQuantityPrice!,
        label: `>= ${product.largeQuantityMinimumUnits} Kg`,
      });
    }

    tiers.sort((a, b) => a.minQty - b.minQty);
    const filteredTiers = tiers.filter(
      (tier) => tier.minQty <= tier.maxQty || tier.maxQty === Infinity,
    );

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
    if (activeTier) currentPrice = activeTier.price;
    setEffectivePrice(currentPrice);
  }, [currentNumericalQuantity, basePrice, priceTiers]);

  useEffect(() => {
    setDisplayStock(product.stock);
  }, [product.stock]);

  useEffect(() => {
    const currentCartQty = cartItem?.quantity || 0;
    setQuantity(currentCartQty > 0 ? String(currentCartQty) : "");
    setShowQuantityInput(currentCartQty > 0);
  }, [cartItem]);

  const showToast = useCallback(
    (msg: string, type: "success" | "error" | "info" | "warn") => {
      let toastType: "success" | "error" | "info" | "warning" = "info";
      let text1Title = "Info";
      if (type === "success") {
        toastType = "success";
        text1Title = "Success";
      }
      if (type === "error") {
        toastType = "error";
        text1Title = "Error";
      }
      if (type === "warn") {
        toastType = "warning";
        text1Title = "Warning";
      }
      Toast.show({
        type: toastType,
        text1: text1Title,
        text2: msg,
        visibilityTime: 2000,
        autoHide: true,
        topOffset: 40,
      });
    },
    [],
  );

  const handleCartAction = async (qtyToDispatch: number) => {
    if (isVendorOffline)
      return showToast("Vendor is currently offline.", "error");
    if (isVendorOutOfRange)
      return showToast("Vendor is out of range.", "error");
    if (requiresSizeSelection && !selectedSize && qtyToDispatch > 0)
      return showToast("Please select a size.", "warn");
    if (qtyToDispatch < 0)
      return showToast("Quantity cannot be negative.", "error");
    if (qtyToDispatch > displayStock) {
      showToast(`Only ${displayStock} left in stock!`, "error");
      setQuantity(String(displayStock));
      return;
    }

    setIsAddingToCart(true);
    try {
      // 🔥 FIX 2: Correctly route to removeItem if quantity is 0
      if (qtyToDispatch === 0) {
        await dispatch(
          removeItem({
            productId: product._id,
            size: selectedSize || undefined,
          }) as any,
        ).unwrap();

        setShowQuantityInput(false);
        setQuantity("");
      } else {
        await dispatch(
          addOrUpdateItem({
            productId: product._id,
            quantity: qtyToDispatch,
            price: effectivePrice,
            vendorId: product.vendorId || product.vendor?._id || "",
            size: selectedSize || undefined,
          }) as any,
        ).unwrap();
      }
    } catch (error: any) {
      showToast(error.message || "Failed to update cart.", "error");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleQuantityChange = (value: string) => {
    if (value === "") return setQuantity("");
    if (!/^\d+$/.test(value)) return;
    let numVal = parseInt(value, 10);
    if (isNaN(numVal) || numVal < 0) numVal = 0;
    setQuantity(String(numVal));
  };

  const handleQuantityBlur = async () => {
    let numericalQuantity = currentNumericalQuantity;
    if (numericalQuantity === 0 && (cartItem?.quantity || 0) > 0) {
      await handleCartAction(0);
      return;
    }
    if (numericalQuantity > displayStock) {
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
    if (requiresSizeSelection && !selectedSize)
      return showToast("Please select a size.", "warn");
    let newQty;
    if (increment) {
      newQty = currentNumericalQuantity + 1;
      if (newQty > displayStock)
        return showToast(`Max stock reached (${displayStock})`, "info");
    } else {
      newQty = currentNumericalQuantity - 1;
      if (newQty <= 0) {
        newQty = 0;
      }
    }
    setQuantity(String(newQty));
    await handleCartAction(newQty);
  };

  const handleAddToCartClick = async () => {
    if (isDisabled || displayStock === 0)
      return showToast(
        displayStock === 0 ? "Out of stock." : "Vendor unavailable.",
        "error",
      );
    if (requiresSizeSelection && !selectedSize)
      return showToast("Please select a size.", "warn");
    if (!showQuantityInput || currentNumericalQuantity === 0) {
      setQuantity("1");
      setShowQuantityInput(true);
      await handleCartAction(1);
    }
  };

  const handleCardPress = () => {
    if (!isDisabled)
      navigation.navigate("ProductDetails", { product: product });
  };

  const handleShareToChat = () =>
    navigation.navigate("ChatScreen" as any, { forwardProduct: product });

  const isDisabled = isVendorOffline || isVendorOutOfRange;
  const isAddToCartButtonDisabled =
    isDisabled ||
    displayStock === 0 ||
    isAddingToCart ||
    (requiresSizeSelection && !selectedSize);
  const truncatedProductName =
    product.name.length > PRODUCT_NAME_MAX_LENGTH
      ? `${product.name.substring(0, PRODUCT_NAME_MAX_LENGTH)}...`
      : product.name;

  const getButtonText = () => {
    if (displayStock === 0) return "Out of Stock";
    if (isDisabled) return isVendorOffline ? "Offline" : "Out of Range";
    if (requiresSizeSelection && !selectedSize) return "Select Size";
    return "   Order Now   ";
  };

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      disabled={isDisabled}
      style={[styles.cardContainer, isDisabled && styles.cardDisabled]}
      activeOpacity={0.9}
    >
      {/* ============================== */}
      {/* CLEAR BACKGROUND IMAGE         */}
      {/* ============================== */}
      {product.images && product.images.length > 0 ? (
        <Image
          source={{ uri: product.images[0] }}
          style={styles.backgroundImage}
        />
      ) : (
        <View style={[styles.backgroundImage, styles.noImageBg]}>
          <Ionicons
            name="image-outline"
            size={40}
            color={Colors.textLightGray}
          />
        </View>
      )}

      {/* 🔥 GRADIENT */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.95)"]}
        locations={[0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {isDisabled && (
        <View style={styles.offlineOverlay}>
          <Text style={styles.offlineText}>
            {isVendorOffline ? "Vendor Offline" : "Out of Range"}
          </Text>
        </View>
      )}

      {/* ============================== */}
      {/* TOP ROW: BADGES & SHARE        */}
      {/* ============================== */}
      <View style={styles.topRow}>
        <View>
          {!!amountSaved && (
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save ₹{amountSaved}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareToChat}
        >
          <Ionicons name="arrow-redo-outline" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* ============================== */}
      {/* BOTTOM CONTENT AREA            */}
      {/* ============================== */}
      <View style={styles.bottomContent}>
        {/* LEFT COLUMN: INFO & TEXT */}
        <View style={styles.leftInfoSide}>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.typeIcon,
                isNonVeg ? styles.typeIconNonVeg : styles.typeIconVeg,
              ]}
            >
              {isNonVeg ? (
                <View style={styles.nonVegTriangle} />
              ) : (
                <View style={styles.vegDot} />
              )}
            </View>
            <Text style={styles.productName}>{truncatedProductName}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceText}>₹{effectivePrice.toFixed(2)}</Text>
            {product.discountedPrice &&
              product.discountedPrice < product.price && (
                <Text style={styles.originalPriceText}>
                  ₹{product.price.toFixed(2)}
                </Text>
              )}
          </View>

          {(product.companyName || product.brand || product.rating) && (
            <View style={styles.metaRow}>
              {!!product.rating && (
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={9} color={Colors.textDark} />
                  <Text style={styles.ratingText}>
                    {product.rating.toFixed(1)}{" "}
                    {product.numReviews ? `(${product.numReviews})` : ""}
                  </Text>
                </View>
              )}
              <Text style={styles.metaText} numberOfLines={1}>
                {[product.companyName, product.brand]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            </View>
          )}

          {/* {requiresSizeSelection && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sizeScrollView}
            >
              {product.sizes?.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizePill,
                    selectedSize === size && styles.sizePillActive,
                  ]}
                  onPress={() => setSelectedSize(size)}
                  disabled={isDisabled}
                >
                  <Text
                    style={[
                      styles.sizePillText,
                      selectedSize === size && styles.sizePillTextActive,
                    ]}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )} */}

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
        </View>

        {/* RIGHT COLUMN: CONTROLS */}
        <View style={styles.rightActionSide}>
          {isDisabled || displayStock === 0 ? (
            <View style={[styles.controlBtnStyle, styles.addBtnDisabled]}>
              <Text style={styles.disabledBtnText}>{getButtonText()}</Text>
            </View>
          ) : renderQuantityControls ? (
            <Animated.View
              style={[
                styles.floatingStackContainer,
                { opacity: controlOpacity },
              ]}
            >
              {!!(cartItem?.quantity || 0) && (
                <View style={styles.floatingAddedBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={10}
                    color={Colors.white}
                    style={{ marginRight: 2 }}
                  />
                  <Text style={styles.floatingAddedText}>
                    Added ({cartItem.quantity})
                  </Text>
                </View>
              )}

              {((currentNumericalQuantity > 0 &&
                cartItem?.quantity !== currentNumericalQuantity) ||
                (currentNumericalQuantity === 0 &&
                  (cartItem?.quantity || 0) > 0)) && (
                <TouchableOpacity
                  onPress={() => handleCartAction(currentNumericalQuantity)}
                  disabled={isAddingToCart}
                  style={styles.controlBtnStyle}
                >
                  {isAddingToCart ? (
                    <ActivityIndicator size="small" color={Colors.textDark} />
                  ) : (
                    <Text style={styles.controlBtnText}>
                      {currentNumericalQuantity === 0 ? "Remove" : "Update"}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <View style={[styles.controlBtnStyle, styles.qtyControlBox]}>
                <TouchableOpacity
                  onPress={() => handleQuantityButtonClick(false)}
                  disabled={isAddingToCart}
                  style={styles.qtyBtn}
                >
                  <FontAwesome name="minus" size={12} color={Colors.textDark} />
                </TouchableOpacity>

                <TextInput
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={handleQuantityChange}
                  onEndEditing={handleQuantityBlur}
                  style={styles.qtyInput}
                  maxLength={4}
                />

                <TouchableOpacity
                  onPress={() => handleQuantityButtonClick(true)}
                  disabled={
                    currentNumericalQuantity >= displayStock || isAddingToCart
                  }
                  style={styles.qtyBtn}
                >
                  <FontAwesome name="plus" size={12} color={Colors.textDark} />
                </TouchableOpacity>
              </View>
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
                style={styles.controlBtnStyle}
              >
                {isAddingToCart ? (
                  <ActivityIndicator size="small" color={Colors.textDark} />
                ) : (
                  <Text style={styles.controlBtnText}>{getButtonText()}</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}

          <Text style={styles.stockAlertText}>
            {displayStock > 0 && displayStock <= 10
              ? `Only ${displayStock} left!`
              : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    height: 250,
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.textDark,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  cardDisabled: { opacity: 0.7 },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  noImageBg: {
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    zIndex: 10,
  },
  saveBadge: {
    backgroundColor: "#EAB308",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveBadgeText: { color: Colors.textDark, fontSize: 10, fontWeight: "bold" },
  shareButton: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomContent: {
    flex: 1,
    flexDirection: "row",
    padding: 12,
    justifyContent: "space-between",
    alignItems: "flex-end",
    zIndex: 10,
  },
  leftInfoSide: {
    flex: 1,
    paddingRight: 10,
    justifyContent: "flex-end",
  },
  rightActionSide: {
    width: 100,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.white,
    flexShrink: 1,
  },
  typeIcon: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  typeIconVeg: { borderColor: Colors.accentGreen },
  typeIconNonVeg: { borderColor: Colors.redAlert },
  vegDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accentGreen,
  },
  nonVegTriangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: Colors.redAlert,
  },
  priceRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  priceText: { fontSize: 16, fontWeight: "900", color: Colors.goldPrimary },
  originalPriceText: {
    fontSize: 12,
    color: Colors.textGray,
    textDecorationLine: "line-through",
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.goldPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  ratingText: {
    color: Colors.textDark,
    fontSize: 9,
    fontWeight: "bold",
    marginLeft: 2,
  },
  metaText: { fontSize: 11, color: Colors.textGray, fontWeight: "500" },
  sizeScrollView: { marginVertical: 4 },
  sizePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginRight: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sizePillActive: {
    backgroundColor: Colors.goldPrimary,
    borderColor: Colors.goldPrimary,
  },
  sizePillText: { fontSize: 11, color: Colors.white, fontWeight: "600" },
  sizePillTextActive: { color: Colors.textDark, fontWeight: "bold" },
  priceTiersContainer: {
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: 6,
  },
  priceTierItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  priceTierActive: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  priceTierLabel: { fontSize: 9, color: Colors.textGray },
  priceTierLabelActive: { color: Colors.goldPrimary, fontWeight: "bold" },
  priceTierPrice: { fontSize: 9, color: Colors.textGray },
  priceTierPriceActive: { color: Colors.goldPrimary, fontWeight: "bold" },
  controlBtnStyle: {
    width: "100%",
    backgroundColor: Colors.goldPrimary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  controlBtnText: {
    color: Colors.textDark,
    fontWeight: "900",
    fontSize: 14,
  },
  addBtnDisabled: { backgroundColor: "rgba(255,255,255,0.5)", elevation: 0 },
  disabledBtnText: { color: Colors.textDark, fontWeight: "700", fontSize: 12 },
  floatingStackContainer: {
    width: "100%",
    alignItems: "flex-end",
  },
  floatingAddedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accentGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  floatingAddedText: { color: Colors.white, fontSize: 10, fontWeight: "bold" },
  qtyControlBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  qtyBtn: { padding: 4 },
  qtyInput: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    width: 35,
    color: Colors.textDark,
  },
  stockAlertText: {
    fontSize: 10,
    color: Colors.goldPrimary,
    fontWeight: "bold",
    marginTop: 6,
    textAlign: "right",
    width: "100%",
  },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  offlineText: {
    backgroundColor: Colors.redAlert,
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
});

export default NewProductCard;
