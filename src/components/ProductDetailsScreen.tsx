import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  FlatList,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import Toast from "react-native-toast-message";

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
  unit?: string;
}

type RootStackParamList = {
  ProductDetails: {
    product: Product;
    isVendorOffline?: boolean;
    isVendorOutOfRange?: boolean;
  };
};

type ProductDetailRouteProp = RouteProp<RootStackParamList, "ProductDetails">;

const Colors = {
  white: "#FFFFFF",
  textDark: "#000000",
  textGray: "#A3A3A3",
  textLightGray: "#E5E5E5",
  accentGreen: "#22C55E",
  redAlert: "#EF4444",
  saveYellow: "#FACC15",
  bgOverlay: "rgba(0,0,0,0.6)",
  goldPrimary: "#FFFFFF",
  royalGreen: "#1B8C40",
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

const FloatingProductDetailScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute<ProductDetailRouteProp>();
  const {
    product,
    isVendorOffline = false,
    isVendorOutOfRange = false,
  } = route.params;

  // --- VEG/NON-VEG ---
  const isNonVeg = useMemo(() => {
    const nonVegKeywords = /chicken|mutton|fish|egg|meat|prawn|crab|beef|pork/i;
    return (
      nonVegKeywords.test(product.name) ||
      nonVegKeywords.test(product.category || "")
    );
  }, [product.name, product.category]);

  // --- DYNAMIC UNIT ---
  const unitLabel = useMemo(() => {
    if (product.unit) return product.unit;

    const cat = (product.category || "").toLowerCase();
    const name = product.name.toLowerCase();

    if (
      cat.includes("grocery") ||
      cat.includes("vegetable") ||
      cat.includes("fruit") ||
      cat.includes("meat") ||
      cat.includes("fish") ||
      cat.includes("dairy") ||
      cat.includes("bakery") ||
      cat.includes("spice") ||
      cat.includes("oil") ||
      cat.includes("flour") ||
      name.includes("kg") ||
      name.includes("gram") ||
      name.includes("gm") ||
      name.includes("litre") ||
      name.includes("ml")
    ) {
      if (product.sizes?.some((s) => s.includes("g") || s.includes("kg"))) {
        return "kg";
      }
      return "kg";
    }

    if (product.sizes?.some((s) => /^[A-Z]+$/.test(s) || /^\d+$/.test(s))) {
      return "units";
    }

    return "units";
  }, [product.unit, product.category, product.name, product.sizes]);

  // --- SIZE SELECTION ---
  const requiresSizeSelection = product.sizes && product.sizes.length > 0;
  const [selectedSize, setSelectedSize] = useState<string | null>(
    requiresSizeSelection ? product.sizes![0] : null,
  );

  // --- CART ---
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
  const [isEditingQty, setIsEditingQty] = useState<boolean>(false);

  // --- IMAGE CAROUSEL STATE ---
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const flatListRef = useRef<FlatList>(null);
  const images = product.images || [];

  // --- ANIMATION FOR QUANTITY CONTROLS ---
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

  // --- PRICE TIERS WITH DYNAMIC UNIT ---
  const priceTiers = useMemo(() => {
    const tiers: any[] = [];
    const bulkMin = product.bulkMinimumUnits || Infinity;
    const largeQtyMin = product.largeQuantityMinimumUnits || Infinity;
    const hasBulkTier = !!(product.bulkPrice && product.bulkMinimumUnits);
    const hasLargeQtyTier = !!(
      product.largeQuantityPrice && product.largeQuantityMinimumUnits
    );

    const defaultMax = Math.min(bulkMin - 1, largeQtyMin - 1);
    const unit = unitLabel;

    // Default tier
    if (defaultMax >= 1 || (!hasBulkTier && !hasLargeQtyTier)) {
      const label =
        defaultMax === Infinity
          ? `1+ ${unit}`
          : defaultMax === 1
          ? `1 ${unit}`
          : `1 - ${defaultMax} ${unit}`;
      tiers.push({
        minQty: 1,
        maxQty: defaultMax,
        price: product.discountedPrice || product.price,
        label: label,
      });
    }

    // Bulk tier
    if (hasBulkTier) {
      const bulkMax = largeQtyMin - 1;
      const label =
        bulkMax === Infinity
          ? `${product.bulkMinimumUnits}+ ${unit}`
          : `${product.bulkMinimumUnits} - ${bulkMax} ${unit}`;
      tiers.push({
        minQty: product.bulkMinimumUnits!,
        maxQty: bulkMax,
        price: product.bulkPrice!,
        label: label,
      });
    }

    // Large quantity tier
    if (hasLargeQtyTier) {
      const label = `≥ ${product.largeQuantityMinimumUnits} ${unit}`;
      tiers.push({
        minQty: product.largeQuantityMinimumUnits!,
        maxQty: Infinity,
        price: product.largeQuantityPrice!,
        label: label,
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
  }, [
    currentNumericalQuantity,
    product,
    unitLabel,
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

  // --- TOAST ---
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

  // --- CART ACTIONS ---
  const handleCartAction = async (qtyToDispatch: number) => {
    // Prevent adding to cart if stock is 0 (walk-in product)
    if (displayStock === 0) {
      return showToast("This is a walk-in product. Please visit the store.", "info");
    }
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
    // Don't allow quantity changes for walk-in products
    if (displayStock === 0) return;
    
    setIsEditingQty(false);
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
    // Don't allow quantity changes for walk-in products
    if (displayStock === 0) {
      return showToast("This is a walk-in product. Please visit the store.", "info");
    }
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
    // Prevent adding to cart for walk-in products
    if (displayStock === 0) {
      return showToast("This is a walk-in product. Please visit the store to purchase.", "info");
    }
    if (isDisabled)
      return showToast("Vendor unavailable.", "error");
    if (requiresSizeSelection && !selectedSize)
      return showToast("Please select a size.", "warn");
    if (!showQuantityInput || currentNumericalQuantity === 0) {
      setQuantity("1");
      setShowQuantityInput(true);
      await handleCartAction(1);
    }
  };

  const isDisabled = isVendorOffline || isVendorOutOfRange;
  const isWalkIn = displayStock === 0;
  
  const isAddToCartButtonDisabled =
    isDisabled ||
    isWalkIn ||
    isAddingToCart ||
    (requiresSizeSelection && !selectedSize);

  const getButtonText = () => {
    if (isWalkIn) return "Visit Store";
    if (isDisabled) return isVendorOffline ? "Offline" : "Out of Range";
    if (requiresSizeSelection && !selectedSize) return "Select Size";
    return "   Order Now   ";
  };

  // --- IMAGE CAROUSEL RENDER ---
  const renderImageItem = ({ item }: { item: string }) => (
    <Image source={{ uri: item }} style={styles.carouselImage} />
  );

  const onScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIndex(index);
  };

  return (
    <KeyboardAvoidingView
      style={styles.overlayContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (isEditingQty) {
            Keyboard.dismiss();
          } else {
            navigation.goBack();
          }
        }}
      >
        <View style={StyleSheet.absoluteFillObject} />
      </TouchableWithoutFeedback>

      <View style={styles.sheetContainer}>
        {/* --- IMAGE CAROUSEL (No overlay for walk-in) --- */}
        {images.length > 0 ? (
          <>
            <FlatList
              ref={flatListRef}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              renderItem={renderImageItem}
              keyExtractor={(item, index) => index.toString()}
              onScroll={onScroll}
              scrollEventThrottle={16}
              style={styles.carousel}
            />
            {/* Dot indicators */}
            {images.length > 1 && (
              <View style={styles.dotContainer}>
                {images.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      activeImageIndex === idx && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={[styles.carouselImage, styles.noImageBg]}>
            <Ionicons name="image-outline" size={50} color={Colors.textGray} />
          </View>
        )}

        {/* Gradient Overlay - Only for non-walk-in products or keep it subtle */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)", "#000000"]}
          locations={[0.2, 0.65, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Top Header Row */}
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
              onPress={() => navigation.goBack()}
              style={[styles.iconButton, { marginLeft: 10 }]}
            >
              <Ionicons name="close" size={22} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mainInfoRow}>
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

              {/* Walk-in Badge - Royal Green */}
              {isWalkIn && (
                <View style={styles.walkInBadge}>
                  <Ionicons name="storefront-outline" size={16} color={Colors.royalGreen} />
                  <Text style={styles.walkInBadgeText}>Available in-store only</Text>
                </View>
              )}

              {/* --- SIZE PILLS --- */}
              {requiresSizeSelection && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sizeScrollView}
                  keyboardShouldPersistTaps="handled"
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

              {/* Price Tiers - Hidden for walk-in products */}
              {!isWalkIn && priceTiers.length > 0 && (
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

            {/* Right side: Add/Quantity controls */}
            <View style={styles.rightActionSide}>
              {isWalkIn ? (
                <View style={[styles.controlBtnStyle, styles.walkInBtn]}>
                  <Text style={styles.walkInBtnText}>Visit Store</Text>
                </View>
              ) : isDisabled || displayStock === 0 ? (
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
                      onFocus={() => setIsEditingQty(true)}
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

                  {isEditingQty && (
                    <TouchableOpacity
                      style={styles.updateConfirmBtn}
                      onPress={() => Keyboard.dismiss()}
                    >
                      <Text style={styles.updateConfirmText}>Update</Text>
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
                {!isWalkIn && displayStock > 0 && displayStock <= 10
                  ? `Only ${displayStock} left!`
                  : ""}
              </Text>
            </View>
          </View>

          {product.description && (
            <Text style={styles.descriptionText}>{product.description}</Text>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    backgroundColor: Colors.bgOverlay,
    justifyContent: "flex-end",
  },
  sheetContainer: {
    height: SCREEN_HEIGHT * 0.75,
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  // Carousel
  carousel: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: "100%",
    resizeMode: "cover",
  },
  noImageBg: {
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
  },
  dotContainer: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    zIndex: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: Colors.white,
    width: 20,
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
    backgroundColor: "rgba(247, 247, 247, 0.2)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    padding: 20,
    paddingBottom: 40,
  },
  mainInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
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
  // Walk-in styles - Royal Green
  walkInBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "rgba(27, 140, 64, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Colors.royalGreen,
  },
  walkInBadgeText: {
    color: Colors.royalGreen,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  // Size pills
  sizeScrollView: {
    marginVertical: 8,
  },
  sizePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginRight: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sizePillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  sizePillText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: "600",
  },
  sizePillTextActive: {
    color: Colors.textDark,
    fontWeight: "bold",
  },
  // Price tiers
  priceTiersContainer: {
    marginTop: 4,
  },
  priceTierItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    paddingRight: 20,
  },
  priceTierLabel: { fontSize: 13, color: Colors.textGray },
  priceTierPrice: { fontSize: 13, color: Colors.textGray },
  priceTierActiveText: { color: Colors.white, fontWeight: "bold" },
  // Controls
  controlBtnStyle: {
    width: "100%",
    backgroundColor: Colors.goldPrimary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnText: {
    color: Colors.textDark,
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
  updateConfirmBtn: {
    backgroundColor: Colors.accentGreen,
    width: "100%",
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 6,
    alignItems: "center",
  },
  updateConfirmText: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: 13,
  },
  stockAlertText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: "bold",
    marginTop: 6,
    textAlign: "right",
    width: "100%",
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.textLightGray,
    lineHeight: 22,
    marginTop: 16,
  },
  // Walk-in button styles
  walkInBtn: {
    backgroundColor: Colors.royalGreen,
    borderWidth: 1,
    borderColor: Colors.royalGreen,
  },
  walkInBtnText: {
    color: Colors.white,
    fontWeight: "900",
    fontSize: 16,
  },
});

export default FloatingProductDetailScreen;