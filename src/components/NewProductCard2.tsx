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
  Animated, // Use Animated for fluid motion
  ScrollView, // Import ScrollView for size selection
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";
import { Gyroscope } from "expo-sensors";

import { addOrUpdateItem } from "../features/cart/cartSlice";

const { width } = Dimensions.get("window");

const CARD_WIDTH = width * 0.65;

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
  sizes?: string[]; // <--- NEW: Added sizes array
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
  // Deep, Royal, Premium Palette
  goldPrimary: "#F5F5F5", // Bright Gold/Yellow
  purpleDark: "#006C3E", // Deep Royal Purple
  emeraldGreen: "#006C3E", // Rich Emerald Green
  textLight: "#FFFFFF",
  textDark: "#1A1A1A", // Near Black
  grayText: "#AAAAAA",
  redAlert: "#DC2626",
  cardBackground: "#F5F5F5", // Off-White/Light Gray for base
  borderLuxury: "#fff", // Darker Gold for borders/accents
  shadowLuxury: "#000000",
};

const PRODUCT_NAME_MAX_LENGTH = 7;

// --- 1. Custom Hook for Gyroscope Tilt Animation ---
const useTiltMotion = (maxTiltDegrees = 30) => {
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    const startListening = async () => {
      const isAvailable = await Gyroscope.isAvailableAsync();
      if (!isAvailable) {
        console.warn("Gyroscope not available on this device.");
        return;
      }

      Gyroscope.setUpdateInterval(50); // 20 updates per second
      subscription = Gyroscope.addListener(({ x, y }) => {
        const rotY = x * 20;
        const rotX = y * 20;

        Animated.parallel([
          Animated.spring(tiltX, {
            toValue: Math.min(Math.max(rotX, -maxTiltDegrees), maxTiltDegrees),
            friction: 8, // Controls the bounciness
            tension: 40, // Controls the speed
            useNativeDriver: true,
          }),
          Animated.spring(tiltY, {
            toValue: Math.min(Math.max(rotY, -maxTiltDegrees), maxTiltDegrees),
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    startListening();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [maxTiltDegrees]);

  const rotateX = tiltX.interpolate({
    inputRange: [-maxTiltDegrees, maxTiltDegrees],
    outputRange: [`${maxTiltDegrees}deg`, `-${maxTiltDegrees}deg`],
  });

  const rotateY = tiltY.interpolate({
    inputRange: [-maxTiltDegrees, maxTiltDegrees],
    outputRange: [`-${maxTiltDegrees}deg`, `${maxTiltDegrees}deg`],
  });

  return { rotateX, rotateY };
};
// --- END Custom Hook ---

const NewProductCard2: React.FC<NewProductCardProps> = ({
  product,
  isVendorOffline = false,
  isVendorOutOfRange = false,
  vendorDistance,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<ProductCardNavigationProp>();

  // Motion Hook Integration
  const { rotateX, rotateY } = useTiltMotion(30);

  // --- NEW: Size State & Cart Key Logic ---
  const [selectedSize, setSelectedSize] = useState<string | null>(
    product.sizes?.length === 1 ? product.sizes[0] : null
  );

  const cartItemsByProduct = useSelector((state: any) => state.cart.items);

  const cartKey = useMemo(() => {
    // Logic must match how cart items are keyed in cartSlice
    if (product.sizes?.length > 0 && selectedSize) {
      return `${product._id}_${selectedSize}`;
    }
    return product._id;
  }, [product._id, product.sizes, selectedSize]);

  const activeCartItem = cartItemsByProduct[cartKey];
  const cartItem = activeCartItem; // Use activeCartItem for all cart interactions
  // --- END Size State & Cart Key Logic ---

  const basePrice = useMemo(
    () => product.discountedPrice || product.price,
    [product.discountedPrice, product.price]
  );

  const [quantity, setQuantity] = useState(
    cartItem?.quantity > 0 ? String(cartItem.quantity) : ""
  );
  const [effectivePrice, setEffectivePrice] = useState(basePrice);
  const [showQuantityInput, setShowQuantityInput] = useState(
    (cartItem?.quantity || 0) > 0
  );
  const [displayStock, setDisplayStock] = useState(product.stock);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // --- Smooth Transition Logic ---
  const controlOpacity = useRef(
    new Animated.Value(showQuantityInput ? 1 : 0)
  ).current;
  const [renderQuantityControls, setRenderQuantityControls] =
    useState(showQuantityInput);

  useEffect(() => {
    if (showQuantityInput) {
      setRenderQuantityControls(true); // Start rendering controls immediately
      Animated.timing(controlOpacity, {
        toValue: 1,
        duration: 200, // Quick, smooth transition in
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(controlOpacity, {
        toValue: 0,
        duration: 200, // Quick, smooth transition out
        useNativeDriver: true,
      }).start(() => {
        setRenderQuantityControls(false); // Stop rendering controls after animation is done
      });
    }
  }, [showQuantityInput]);

  // Sync Quantity when activeCartItem changes (due to size switch or external update)
  useEffect(() => {
    const currentCartQty = activeCartItem?.quantity || 0;
    setQuantity(currentCartQty > 0 ? String(currentCartQty) : "");
    setShowQuantityInput(currentCartQty > 0);
  }, [activeCartItem]);
  // --- END Smooth Transition Logic & Sync ---

  const truncatedProductName = useMemo(() => {
    // Adjusted truncation limit to be larger for better readability, though the constant is small
    const maxLen = 30;
    if (product.name.length > maxLen) {
      return `${product.name.substring(0, maxLen)}...`;
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
    } pcs`;

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
      } pcs`;
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
    let currentPrice = basePrice;
    const activeTier = priceTiers.find(
      (tier) =>
        currentNumericalQuantity >= tier.minQty &&
        (tier.maxQty === Infinity || currentNumericalQuantity <= tier.maxQty)
    );
    if (activeTier) {
      currentPrice = activeTier.price;
    }
    setEffectivePrice(currentPrice);
  }, [currentNumericalQuantity, basePrice, priceTiers]);

  useEffect(() => {
    setDisplayStock(product.stock);
  }, [product.stock]);

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
  }, []);

  const requiresSizeSelection = product.sizes && product.sizes.length > 0;

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

    // NEW VALIDATION: Check for selected size if required and quantity > 0
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
        "error"
      );
      setQuantity(String(displayStock));
      return;
    }

    setIsAddingToCart(true);
    try {
      // Include selectedSize in the dispatch payload
      await dispatch(
        addOrUpdateItem({
          productId: product._id,
          quantity: numericalQuantity,
          price: effectivePrice,
          vendorId: product.vendorId || product.vendor?._id,
          size: selectedSize, // <--- NEW: Include size in the payload
        }) as any
      ).unwrap();

      const sizeDisplay = selectedSize ? ` (${selectedSize})` : "";

      if (numericalQuantity === 0) {
        showToast(`Removed ${product.name}${sizeDisplay} from cart.`, "info");
      } else if (!cartItem || cartItem.quantity === 0) {
        showToast(
          `Added ${numericalQuantity} x ${product.name}${sizeDisplay} to cart!`,
          "success"
        );
      } else {
        showToast(
          `Updated cart: ${numericalQuantity} x ${product.name}${sizeDisplay}`,
          "info"
        );
      }
    } catch (error) {
      console.error("Failed to update cart:", error);
      showToast(
        (error as Error).message ||
          "Failed to update item in cart. Please try again.",
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

    if (numericalQuantity === 0 && (activeCartItem?.quantity || 0) > 0) {
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

  const handleQuantityButtonClick = async (increment) => {
    // NEW VALIDATION: Check for selected size if required
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

    // NEW VALIDATION: Check for selected size if required
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

  const isDisabled = isVendorOffline || isVendorOutOfRange;
  const priceTagDisplay = basePrice.toFixed(2);

  const isAddToCartButtonDisabled =
    isDisabled ||
    displayStock === 0 ||
    isAddingToCart ||
    (requiresSizeSelection && !selectedSize);

  // Luxury 3D Card Styling (Uses tilt motion from useTiltMotion hook)
  const animatedStyle = {
    transform: [
      { perspective: 1000 }, // For 3D effect
      { rotateX: rotateX },
      { rotateY: rotateY },
    ],
    // Subtle shadow for 3D depth
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  };

  return (
    <Animated.View // 👈 Applies the 3D tilt animation
      style={[
        styles.cardContainer,
        isDisabled && styles.cardDisabled,
        animatedStyle,
      ]}
    >
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
          <Text style={styles.priceTagText}>₹{priceTagDisplay}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.detailsContainer}>
        <Text style={styles.productName}>{truncatedProductName}</Text>

        {/* NEW SIZE SELECTION UI */}
        {requiresSizeSelection && (
          <View style={styles.sizeSelectorWrapper}>
            <Text style={styles.sizeSelectorLabel}>
              Select Size:{" "}
              <Text style={styles.requiredText}>
                {!selectedSize ? "*" : ""}
              </Text>
            </Text>
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
                  disabled={isDisabled || displayStock === 0}
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
          </View>
        )}
        {/* END NEW SIZE SELECTION UI */}

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
        ) : renderQuantityControls ? (
          // Renders Quantity Controls with smooth fade-in
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
          // Renders Add to Cart button with smooth fade-in
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
                    {requiresSizeSelection && !selectedSize
                      ? "Select Size"
                      : "Add to Cart"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

// --- 3. UPDATED STYLES FOR LUXURY UI FEEL ---
const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12, // More rounded corners for luxury
    marginHorizontal: 5,
    marginVertical: 15, // Increased vertical margin for shadow space
    borderWidth: 1, // Subtle border
    borderColor: Colors.borderLuxury, // White/Light border
  },
  cardDisabled: {
    opacity: 0.4, // Reduced opacity for disabled state
  },
  imageContainer: {
    width: "100%",
    height: CARD_WIDTH * 1.0, // Adjusted height for 65% width card
    position: "relative",
    overflow: "hidden", // Contain image within border radius
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  saveBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.purpleDark, // Royal purple background
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 1,
    // Small, sharp shadow for badge prominence
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  saveBadgeText: {
    color: Colors.goldPrimary, // Gold text
    fontSize: 10,
    fontWeight: "800", // Extra bold
  },
  priceTag: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: Colors.emeraldGreen, // Emerald Green accent
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    color: Colors.textDark, // Dark text
    marginBottom: 5,
    textAlign: "center",
  },

  // NEW SIZE SELECTION STYLES
  sizeSelectorWrapper: {
    flexDirection: "column",
    marginBottom: 8,
    width: "100%",
    alignItems: "flex-start", // Align content to the start (left)
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
  requiredText: {
    color: Colors.redAlert,
    fontSize: 14,
    fontWeight: "900",
  },
  sizeScrollView: {
    alignItems: "center",
  },
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
  sizePillText: {
    fontSize: 11,
    color: Colors.textDark,
    fontWeight: "600",
  },
  sizePillTextActive: {
    color: Colors.goldPrimary,
  },
  // END NEW SIZE SELECTION STYLES

  stockContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    justifyContent: "center",
  },
  limitedStockText: {
    fontSize: 10,
    color: Colors.redAlert,
    fontWeight: "700",
  },
  inStockText: {
    fontSize: 10,
    color: Colors.emeraldGreen, // Use Emerald Green for positive status
    fontWeight: "700",
  },
  outOfStockText: {
    fontSize: 10,
    color: Colors.redAlert,
    fontWeight: "700",
  },
  priceTiersContainer: {
    // Parent container is column/stretch
    flexDirection: "column",
    gap: 4,
    marginBottom: 10,
    alignItems: "stretch", // Ensures items take full width
    paddingHorizontal: 5,
  },
  priceTierItem: {
    // 👇 MODIFIED: Single-line display
    flexDirection: "row",
    justifyContent: "space-between", // Push label and price to ends
    alignItems: "center", // Vertically center content
    paddingVertical: 4,
    width: "100%",
  },
  priceTierActive: {
    backgroundColor: Colors.purpleDark, // Royal Purple for active tier
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    // Elevated shadow to make it pop when active
    shadowColor: Colors.shadowLuxury,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  priceTierLabel: {
    // Left side: Quantity Range (Smaller)
    fontSize: 11,
    color: Colors.grayText,
    fontWeight: "600",
    textAlign: "left",
  },
  priceTierLabelActive: {
    color: Colors.goldPrimary, // Gold text for active label
    fontWeight: "800",
  },
  priceTierPrice: {
    // Right side: Price (Bigger and bold)
    fontSize: 15, // Increased size for prominence
    fontWeight: "bold",
    color: Colors.purpleDark,
    textAlign: "right",
  },
  priceTierPriceActive: {
    color: Colors.goldPrimary, // Gold text for active price
    fontSize: 16, // Slightly larger when active
  },
  addToCartButton: {
    backgroundColor: Colors.emeraldGreen, // Rich Green for primary action
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: Colors.shadowLuxury, // Button shadow
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  addToCartButtonDisabled: {
    backgroundColor: Colors.grayText,
    opacity: 0.6,
    shadowOpacity: 0.1,
    elevation: 0,
  },
  addToCartButtonText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: "bold",
  },
  addToCartIcon: {
    marginRight: 4,
    color: Colors.textLight,
  },
  disabledButton: {
    backgroundColor: Colors.grayText,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButtonText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: "bold",
  },
  // Quantity Controls (Styled with Luxury Palette)
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
    fontWeight: "800",
    paddingHorizontal: 2,
    paddingVertical: 8,
    backgroundColor: Colors.cardBackground,
    color: Colors.purpleDark, // Darker text for input
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
  updateCartButtonDisabled: {
    opacity: 0.5,
  },
  updateCartButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.goldPrimary,
  },
});

export default NewProductCard2;
