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
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";

import { addOrUpdateItem } from "../features/cart/cartSlice";

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
  textGray: "#6B7280",
  textLightGray: "#9CA3AF",
  accentGreen: "#1B8C40", // Veg Green
  redAlert: "#DC2626", // Non-Veg Red
  divider: "#F3F4F6",
  bgLight: "#F8F9FA",
  yellowStar: "#F59E0B",
  purpleDark: "#1b3a2dff",
  goldPrimary: "#F5F5F5",
};

const PRODUCT_NAME_MAX_LENGTH = 100;

const NewProductCard: React.FC<NewProductCardProps> = ({
  product,
  isVendorOffline = false,
  isVendorOutOfRange = false,
  vendorDistance,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<ProductCardNavigationProp>();

  // 🔥 DYNAMIC VEG/NON-VEG DETECTOR
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

  const cartItemsByProduct = useSelector((state: any) => state.cart.items);
  const cartKey = useMemo(() => {
    if (requiresSizeSelection && selectedSize)
      return `${product._id}_${selectedSize}`;
    return product._id;
  }, [product._id, selectedSize, requiresSizeSelection]);

  const cartItem = cartItemsByProduct[cartKey];
  const basePrice = useMemo(
    () => product.discountedPrice || product.price,
    [product.discountedPrice, product.price],
  );

  const [quantity, setQuantity] = useState<string>(
    cartItem?.quantity > 0 ? String(cartItem.quantity) : "",
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
      await dispatch(
        addOrUpdateItem({
          productId: product._id,
          quantity: qtyToDispatch,
          price: effectivePrice,
          vendorId: product.vendorId || product.vendor?._id,
          size: selectedSize,
        }) as any,
      ).unwrap();

      if (qtyToDispatch === 0) {
        setShowQuantityInput(false);
        setQuantity("");
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
      // FIX: Changed from ProductDetailScreen10 to ProductDetails to match your stack params
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
    return "ADD";
  };

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      disabled={isDisabled}
      style={[styles.cardContainer, isDisabled && styles.cardDisabled]}
      activeOpacity={0.9}
    >
      {/* ============================== */}
      {/* LEFT COLUMN: INFO & TEXT       */}
      {/* ============================== */}
      <View style={styles.leftInfoSide}>
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

        <View style={styles.priceRow}>
          <Text style={styles.priceText}>₹{effectivePrice.toFixed(2)}</Text>
          {product.discountedPrice &&
            product.discountedPrice < product.price && (
              <Text style={styles.originalPriceText}>
                ₹{product.price.toFixed(2)}
              </Text>
            )}
        </View>

        {(product.companyName ||
          product.brand ||
          product.location ||
          vendorDistance ||
          product.rating) && (
          <View style={styles.metaRow}>
            {!!product.rating && (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={10} color="#FFF" />
                <Text style={styles.ratingText}>
                  {product.rating.toFixed(1)}{" "}
                  {product.numReviews ? `(${product.numReviews})` : ""}
                </Text>
              </View>
            )}
            <Text style={styles.metaText}>
              {[
                product.companyName,
                product.brand,
                product.location,
                typeof vendorDistance === "number"
                  ? `${vendorDistance.toFixed(1)}km`
                  : null,
              ]
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

        {product.description && (
          <Text style={styles.descriptionText} numberOfLines={2}>
            {product.description}
          </Text>
        )}

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

      {/* ============================== */}
      {/* RIGHT COLUMN: IMAGE & CONTROLS */}
      {/* ============================== */}
      <View style={styles.rightImageSide}>
        <View style={styles.imageBox}>
          {product.images && product.images.length > 0 ? (
            <Image
              source={{ uri: product.images[0] }}
              style={styles.productImage}
            />
          ) : (
            <View style={styles.noImage}>
              <Ionicons
                name="image-outline"
                size={30}
                color={Colors.textLightGray}
              />
            </View>
          )}

          {!!amountSaved && (
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save ₹{amountSaved}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareToChat}
          >
            <Ionicons name="arrow-redo-circle" size={26} color={Colors.white} />
          </TouchableOpacity>

          {isDisabled && (
            <View style={styles.offlineOverlay}>
              <Text style={styles.offlineText}>
                {isVendorOffline ? "Offline" : "Out of Range"}
              </Text>
            </View>
          )}
        </View>

        {/* ============================== */}
        {/* FLOATING ADD / QUANTITY BTN    */}
        {/* ============================== */}
        <View style={styles.addBtnContainer}>
          {isDisabled || displayStock === 0 ? (
            <View style={[styles.addBtn, styles.addBtnDisabled]}>
              <Text style={styles.disabledBtnText}>{getButtonText()}</Text>
            </View>
          ) : renderQuantityControls ? (
            // 🔥 FLOATING WRAPPER FOR QUANTITY, UPDATE & ADDED MESSAGES
            <Animated.View
              style={[
                styles.floatingStackContainer,
                { opacity: controlOpacity },
              ]}
            >
              {/* Floats at the very top of the stack */}
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

              {/* Floats in the middle of the stack */}
              {((currentNumericalQuantity > 0 &&
                cartItem?.quantity !== currentNumericalQuantity) ||
                (currentNumericalQuantity === 0 &&
                  (cartItem?.quantity || 0) > 0)) && (
                <TouchableOpacity
                  onPress={() => handleCartAction(currentNumericalQuantity)}
                  disabled={isAddingToCart}
                  style={styles.floatingUpdateBtn}
                >
                  {isAddingToCart ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.floatingUpdateBtnText}>
                      {currentNumericalQuantity === 0 ? "Remove" : "Update"}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* The QTY Pill stays at the bottom */}
              <View style={styles.qtyControlBox}>
                <TouchableOpacity
                  onPress={() => handleQuantityButtonClick(false)}
                  disabled={isAddingToCart}
                  style={styles.qtyBtn}
                >
                  <FontAwesome
                    name="minus"
                    size={14}
                    color={Colors.accentGreen}
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
                    currentNumericalQuantity >= displayStock || isAddingToCart
                  }
                  style={styles.qtyBtn}
                >
                  <FontAwesome
                    name="plus"
                    size={14}
                    color={Colors.accentGreen}
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                {
                  width: "100%",
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
                style={styles.addBtn}
              >
                {isAddingToCart ? (
                  <ActivityIndicator size="small" color={Colors.accentGreen} />
                ) : (
                  <Text style={styles.addBtnText}>{getButtonText()}</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        <Text style={styles.stockAlertText}>
          {displayStock > 0 && displayStock <= 10
            ? `Only ${displayStock} left!`
            : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    height: 230,
  },
  cardDisabled: { opacity: 0.6 },

  leftInfoSide: {
    flex: 1,
    paddingRight: 16,
  },
  typeIcon: {
    width: 14,
    height: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
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

  productName: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.textDark,
    marginBottom: 4,
  },
  priceRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  priceText: { fontSize: 16, fontWeight: "800", color: Colors.textDark },
  originalPriceText: {
    fontSize: 13,
    color: Colors.textGray,
    textDecorationLine: "line-through",
    marginLeft: 6,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accentGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  ratingText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 2,
  },
  metaText: { fontSize: 11, color: Colors.textGray, fontWeight: "500" },

  descriptionText: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
    marginTop: 4,
  },

  sizeScrollView: { marginVertical: 6 },
  sizePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginRight: 6,
    backgroundColor: Colors.white,
  },
  sizePillActive: {
    backgroundColor: Colors.accentGreen,
    borderColor: Colors.accentGreen,
  },
  sizePillText: { fontSize: 11, color: Colors.textDark, fontWeight: "600" },
  sizePillTextActive: { color: Colors.white },

  priceTiersContainer: {
    marginTop: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: 8,
    padding: 6,
  },
  priceTierItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  priceTierActive: {
    backgroundColor: "rgba(27, 140, 64, 0.1)",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  priceTierLabel: { fontSize: 10, color: Colors.textGray },
  priceTierLabelActive: { color: Colors.accentGreen, fontWeight: "bold" },
  priceTierPrice: { fontSize: 10, color: Colors.textGray },
  priceTierPriceActive: { color: Colors.accentGreen, fontWeight: "bold" },

  rightImageSide: {
    width: 140,
    alignItems: "center",
  },
  imageBox: {
    width: 140,
    height: 140,
    borderRadius: 16,
    backgroundColor: Colors.bgLight,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    resizeMode: "cover",
  },
  noImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },

  saveBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#8b5cf6",
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveBadgeText: { color: Colors.white, fontSize: 10, fontWeight: "bold" },

  shareButton: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 15,
  },

  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  offlineText: {
    backgroundColor: Colors.redAlert,
    color: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: "bold",
  },

  addBtnContainer: {
    position: "absolute",
    bottom: -25,
    width: 110,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 10,
  },
  addBtn: {
    width: "100%",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  addBtnText: { color: Colors.accentGreen, fontWeight: "900", fontSize: 16 },
  addBtnDisabled: { backgroundColor: Colors.divider },
  disabledBtnText: { color: Colors.textGray, fontWeight: "700", fontSize: 12 },

  floatingStackContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  floatingAddedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accentGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  floatingAddedText: { color: Colors.white, fontSize: 10, fontWeight: "bold" },

  floatingUpdateBtn: {
    backgroundColor: Colors.textDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 4,
    width: "90%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  floatingUpdateBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "bold",
  },

  qtyControlBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  qtyBtn: { padding: 4 },
  qtyInput: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    width: 40,
  },

  stockAlertText: {
    fontSize: 10,
    color: Colors.redAlert,
    fontWeight: "bold",
    marginTop: 20,
    textAlign: "center",
  },
});

export default NewProductCard;
