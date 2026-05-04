import React, { useMemo, useState, useEffect, useCallback } from "react";
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
  Dimensions,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import Toast from "react-native-toast-message";

// Actions from your slice
import { addOrUpdateItem, removeItem } from "../features/cart/cartSlice";

// --- TYPE DEFINITIONS ---
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
  rating?: number;
  numReviews?: number;
  category?: string;
  description?: string;
  vendorId?: string;
  vendor?: { _id: string };
  sizes?: string[];
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
}

type RootStackParamList = {
  ProductDetails: {
    product: Product;
    isVendorOffline?: boolean;
    isVendorOutOfRange?: boolean;
  };
};

type ProductDetailRouteProp = RouteProp<RootStackParamList, "ProductDetails">;

// --- COLORS EXACTLY FROM THE NEW UI IMAGE ---
const Colors = {
  white: "#FFFFFF",
  textDark: "#000000",
  textGray: "#A3A3A3",
  textLightGray: "#E5E5E5",
  accentGreen: "#22C55E",
  redAlert: "#EF4444",
  saveYellow: "#FACC15",
  bgOverlay: "rgba(0,0,0,0.6)",
  goldPrimary: "#FFFFFF", // Re-mapped to white to match the exact "Order Now" button in the image
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const FloatingProductDetailScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute<ProductDetailRouteProp>();
  const {
    product,
    isVendorOffline = false,
    isVendorOutOfRange = false,
  } = route.params;

  // --- LOGIC FROM NEW PRODUCT CARD ---
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

  const cartItems = useSelector((state: any) => state.cart.items);

  const cartItem = useMemo(() => {
    if (!cartItems || !Array.isArray(cartItems)) return null;
    return cartItems.find((item: any) => {
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
      tiers.push({
        minQty: product.bulkMinimumUnits,
        maxQty: bulkMax,
        price: product.bulkPrice!,
        label: `${product.bulkMinimumUnits} - ${bulkMax === Infinity ? "max" : bulkMax} Kg`,
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
    return tiers
      .filter((tier) => tier.minQty <= tier.maxQty || tier.maxQty === Infinity)
      .map((tier) => ({
        ...tier,
        isActive:
          currentNumericalQuantity >= tier.minQty &&
          (tier.maxQty === Infinity || currentNumericalQuantity <= tier.maxQty),
      }));
  }, [currentNumericalQuantity, product]);

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
      Toast.show({
        type: type === "warn" ? "warning" : type,
        text1: msg,
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
      if (newQty <= 0) newQty = 0;
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

  const isDisabled = isVendorOffline || isVendorOutOfRange;
  const isAddToCartButtonDisabled =
    isDisabled ||
    displayStock === 0 ||
    isAddingToCart ||
    (requiresSizeSelection && !selectedSize);

  const getButtonText = () => {
    if (displayStock === 0) return "Out of Stock";
    if (isDisabled) return isVendorOffline ? "Offline" : "Out of Range";
    if (requiresSizeSelection && !selectedSize) return "Select Size";
    return "Order Now";
  };

  return (
    <View style={styles.overlayContainer}>
      {/* Background Dim layer */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={() => navigation.goBack()}
      />

      {/* Floating Modal mimicking the Card UI */}
      <View style={styles.sheetContainer}>
        {/* Full Card Background Image */}
        {product.images && product.images.length > 0 ? (
          <Image
            source={{ uri: product.images[0] }}
            style={styles.backgroundImage}
          />
        ) : (
          <View style={[styles.backgroundImage, styles.noImageBg]}>
            <Ionicons name="image-outline" size={50} color={Colors.textGray} />
          </View>
        )}

        {/* Deep Bottom Gradient */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)", "#000000"]}
          locations={[0.2, 0.65, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Top Header Row: Badges & Share/Close */}
        <View style={styles.topRow}>
          <View>
            {!!amountSaved && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>Save ₹{amountSaved}</Text>
              </View>
            )}
          </View>
          <View style={styles.topRightControls}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("ChatScreen" as any, {
                  forwardProduct: product,
                })
              }
              style={styles.iconButton}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={20}
                color={Colors.white}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.iconButton, { marginLeft: 10 }]}
            >
              <Ionicons name="close" size={22} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Bottom Content Area */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.mainInfoRow}>
            {/* LEFT SIDE: Name, Prices, Tiers */}
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
                <Text style={styles.productName}>{product.name}</Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceText}>
                  ₹{effectivePrice.toFixed(2)}
                </Text>
                {product.discountedPrice &&
                  product.discountedPrice < product.price && (
                    <Text style={styles.originalPriceText}>
                      ₹{product.price.toFixed(2)}
                    </Text>
                  )}
              </View>

              {/* Price Tiers List exactly like the image */}
              {priceTiers.length > 0 && (
                <View style={styles.priceTiersContainer}>
                  {priceTiers.map((tier, index) => (
                    <View key={index} style={styles.priceTierItem}>
                      <Text
                        style={[
                          styles.priceTierLabel,
                          tier.isActive && styles.priceTierActiveText,
                        ]}
                      >
                        {tier.label}
                      </Text>
                      <Text
                        style={[
                          styles.priceTierPrice,
                          tier.isActive && styles.priceTierActiveText,
                        ]}
                      >
                        ₹{tier.price.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* RIGHT SIDE: Add To Cart Button / Controls */}
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
                        color={Colors.textDark}
                        style={{ marginRight: 2 }}
                      />
                      <Text style={styles.floatingAddedText}>
                        Added ({cartItem.quantity})
                      </Text>
                    </View>
                  )}

                  <View style={[styles.controlBtnStyle, styles.qtyControlBox]}>
                    <TouchableOpacity
                      onPress={() => handleQuantityButtonClick(false)}
                      disabled={isAddingToCart}
                      style={styles.qtyBtn}
                    >
                      <FontAwesome
                        name="minus"
                        size={14}
                        color={Colors.textDark}
                      />
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
                        currentNumericalQuantity >= displayStock ||
                        isAddingToCart
                      }
                      style={styles.qtyBtn}
                    >
                      <FontAwesome
                        name="plus"
                        size={14}
                        color={Colors.textDark}
                      />
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
                      <Text style={styles.controlBtnText}>
                        {getButtonText()}
                      </Text>
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

          {/* Additional details placed below the main info row */}
          {requiresSizeSelection && (
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
          )}

          {product.description && (
            <Text style={styles.descriptionText}>{product.description}</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    backgroundColor: Colors.bgOverlay,
    justifyContent: "flex-end", // Aligns to the bottom like a sheet
  },
  sheetContainer: {
    height: SCREEN_HEIGHT * 0.75, // Tall enough for details, keeps sheet feel
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
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
    alignItems: "flex-start",
    padding: 16,
    zIndex: 10,
  },
  saveBadge: {
    backgroundColor: Colors.saveYellow,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveBadgeText: { color: Colors.textDark, fontSize: 12, fontWeight: "bold" },
  topRightControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end", // Pushes content to the bottom
    padding: 20,
    paddingBottom: 40,
  },
  mainInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", // Align Order button with bottom of tiers
  },
  leftInfoSide: {
    flex: 1,
    paddingRight: 10,
  },
  rightActionSide: {
    width: 120,
    alignItems: "flex-end",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  productName: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.white,
    flexShrink: 1,
  },
  typeIcon: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  typeIconVeg: { borderColor: Colors.accentGreen },
  typeIconNonVeg: { borderColor: Colors.redAlert },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentGreen,
  },
  nonVegTriangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: Colors.redAlert,
  },
  priceRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  priceText: { fontSize: 24, fontWeight: "900", color: Colors.white },
  originalPriceText: {
    fontSize: 14,
    color: Colors.textGray,
    textDecorationLine: "line-through",
    marginLeft: 10,
  },
  priceTiersContainer: {
    marginTop: 4,
  },
  priceTierItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    paddingRight: 20, // Space between left text and right text
  },
  priceTierLabel: { fontSize: 13, color: Colors.textGray },
  priceTierPrice: { fontSize: 13, color: Colors.textGray },
  priceTierActiveText: { color: Colors.white, fontWeight: "bold" },
  controlBtnStyle: {
    width: "100%",
    backgroundColor: Colors.goldPrimary, // Mapped to white now
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnText: {
    color: Colors.textDark, // Black text on white background
    fontWeight: "900",
    fontSize: 16,
  },
  addBtnDisabled: { backgroundColor: "rgba(255,255,255,0.5)", elevation: 0 },
  disabledBtnText: { color: Colors.textDark, fontWeight: "700", fontSize: 14 },
  floatingStackContainer: {
    width: "100%",
    alignItems: "flex-end",
  },
  floatingAddedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.goldPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  floatingAddedText: {
    color: Colors.textDark,
    fontSize: 10,
    fontWeight: "bold",
  },
  qtyControlBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  qtyBtn: { padding: 4 },
  qtyInput: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    width: 35,
    color: Colors.textDark,
  },
  stockAlertText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: "bold",
    marginTop: 6,
    textAlign: "right",
    width: "100%",
  },
  sizeScrollView: { marginVertical: 12 },
  sizePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginRight: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sizePillActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  sizePillText: { fontSize: 12, color: Colors.white, fontWeight: "600" },
  sizePillTextActive: { color: Colors.textDark, fontWeight: "bold" },
  descriptionText: {
    fontSize: 14,
    color: Colors.textLightGray,
    lineHeight: 22,
    marginTop: 16,
  },
});

export default FloatingProductDetailScreen;
