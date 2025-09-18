import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Modal, // Add Modal
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import Swiper from "react-native-swiper";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import ImageViewer from "react-native-image-zoom-viewer"; // Add ImageViewer

import { addOrUpdateItem } from "../features/cart/cartSlice";
import { RootState } from "../app/store"; // Import RootState for type-safety

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
  description?: string;
}

interface CartReduxItem {
  productId: Product;
  quantity: number;
  price: number;
  _id: string;
}

export type RootStackParamList = {
  ProductDetails: { product: Product };
  Login: undefined;
  Gift: undefined; // Make sure the 'Gift' screen is defined for navigation
};

type ProductDetailsScreenRouteProp = RouteProp<
  RootStackParamList,
  "ProductDetails"
>;

// Luxury Color Palette
const Colors = {
  primary: "#0A3D2B", // Deep emerald green
  secondary: "#1A6D4F", // Rich forest green
  accent: "#D4AF37", // Gold metallic
  background: "#F8F5F0", // Creamy off-white
  card: "#FFFFFF", // Pure white cards
  textPrimary: "#2D3748", // Charcoal gray
  textSecondary: "#718096", // Soft gray
  border: "#E2E8F0", // Light gray border
  success: "#38A169", // Vibrant green
  warning: "#DD6B20", // Amber
  error: "#E53E3E", // Deep red
};

const { width, height } = Dimensions.get("window");

// --- Floating Cart Bar Logic and Component ---
const FloatingCartBar = () => {
  const navigation = useNavigation();
  const cartItems = useSelector(
    (state: RootState) => state.cart.items as CartReduxItem[]
  );

  // Re-define pricing constants here
  const DELIVERY_CHARGE = 75;
  const FREE_DELIVERY_THRESHOLD = 200;
  const PLATFORM_FEE_RATE = 0.03;
  const GST_RATE = 0.05;

  const getEffectivePrice = useCallback((product, quantity) => {
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
  }, []);

  const primaryItemName = useMemo(() => {
    if (cartItems.length === 0) return "";
    const firstItem = cartItems[0];
    const productName = firstItem.productId?.name || "Item";

    if (cartItems.length > 1) {
      const uniqueProducts = new Set(
        cartItems.map((item) => item.productId?._id)
      );
      if (uniqueProducts.size > 1) {
        return `${cartItems.length} Items`;
      }
    }
    return productName;
  }, [cartItems]);

  const pricingBreakdown = useMemo(() => {
    const discountedSubtotal = cartItems.reduce((sum, item) => {
      const product = item.productId || {};
      const effectivePrice = getEffectivePrice(product, item.quantity);
      return sum + effectivePrice * item.quantity;
    }, 0);

    const deliveryCharge =
      discountedSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
    const platformFee = discountedSubtotal * PLATFORM_FEE_RATE;
    const gstAmount = (discountedSubtotal + platformFee) * GST_RATE;
    const finalTotal =
      discountedSubtotal + deliveryCharge + platformFee + gstAmount;

    return {
      finalTotal,
      itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [cartItems, getEffectivePrice]);

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.floatingCartBar}>
      <View style={styles.floatingCartTextContainer}>
        <Text style={styles.floatingCartLabel}>{primaryItemName}</Text>
        <Text style={styles.floatingCartPrice}>
          ₹{pricingBreakdown.finalTotal.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.floatingCartButton}
        onPress={() => navigation.navigate("CartScreen")}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingCartButtonText}>View Cart</Text>
      </TouchableOpacity>
    </View>
  );
};

const ProductDetailsScreen = () => {
  const route = useRoute<ProductDetailsScreenRouteProp>();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const product = route.params?.product || {};

  const user = useSelector((state: any) => state.auth.user);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const cartItem = cartItems[product?._id];

  const [quantity, setQuantity] = useState<number | string>(
    cartItem?.quantity > 0 ? cartItem.quantity : ""
  );
  const [effectivePrice, setEffectivePrice] = useState(
    product?.discountedPrice || product?.price || 0
  );
  const [showQuantityControls, setShowQuantityControls] = useState(
    cartItem?.quantity > 0
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const scrollY = new Animated.Value(0);

  // New state for image zooming
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const currentNumericalQuantity =
    typeof quantity === "string" ? parseInt(quantity, 10) || 0 : quantity;

  const showToast = useCallback((msg, type = "success") => {
    let toastTypeToUse;
    let text1Title;

    switch (type) {
      case "success":
        toastTypeToUse = "success";
        text1Title = "Success";
        break;
      case "danger":
        toastTypeToUse = "error";
        text1Title = "Error";
        break;
      case "warning":
        toastTypeToUse = "warning";
        text1Title = "Warning";
        break;
      case "info":
        toastTypeToUse = "info";
        text1Title = "Info";
        break;
      default:
        toastTypeToUse = "info";
        text1Title = "Info";
    }

    Toast.show({
      type: toastTypeToUse,
      text1: text1Title,
      text2: msg,
      visibilityTime: 3000,
      autoHide: true,
      topOffset: Platform.OS === "ios" ? 60 : 30,
    });
  }, []);

  const priceTiers = useMemo(() => {
    const tiers = [];
    let bulkMin = product.bulkMinimumUnits || Number.MAX_SAFE_INTEGER;
    let largeQtyMin =
      product.largeQuantityMinimumUnits || Number.MAX_SAFE_INTEGER;

    let defaultMax = Math.min(bulkMin, largeQtyMin) - 1;
    if (defaultMax < 1) defaultMax = Number.MAX_SAFE_INTEGER;

    tiers.push({
      minQty: 1,
      maxQty: defaultMax,
      price: product.discountedPrice || product.price,
      label: `1 - ${
        defaultMax === Number.MAX_SAFE_INTEGER ? "max" : defaultMax
      } pcs`,
    });

    if (product.bulkPrice && product.bulkMinimumUnits) {
      let bulkMax = largeQtyMin - 1;
      tiers.push({
        minQty: product.bulkMinimumUnits,
        maxQty: bulkMax,
        price: product.bulkPrice,
        label: `${product.bulkMinimumUnits} - ${
          bulkMax === Number.MAX_SAFE_INTEGER ? "max" : bulkMax
        } pcs`,
      });
    }

    if (product.largeQuantityPrice && product.largeQuantityMinimumUnits) {
      tiers.push({
        minQty: product.largeQuantityMinimumUnits,
        maxQty: Number.MAX_SAFE_INTEGER,
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
        (tier.maxQty === Number.MAX_SAFE_INTEGER ||
          currentNumericalQuantity <= tier.maxQty),
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
    const currentCartQty = cartItem?.quantity || 0;
    setQuantity(currentCartQty > 0 ? currentCartQty : "");
    setShowQuantityControls(currentCartQty > 0);
  }, [cartItem]);

  useEffect(() => {
    let currentPrice = product.discountedPrice || product.price || 0;

    const activeTier = priceTiers.find(
      (tier) =>
        currentNumericalQuantity >= tier.minQty &&
        (tier.maxQty === Number.MAX_SAFE_INTEGER ||
          currentNumericalQuantity <= tier.maxQty)
    );

    if (activeTier) {
      currentPrice = activeTier.price;
    }

    setEffectivePrice(currentPrice);
  }, [currentNumericalQuantity, product, priceTiers]);

  useEffect(() => {
    if (!product._id) {
      showToast("Product data not found! Redirecting back.", "danger");
      navigation.goBack();
    }
  }, [product._id, navigation, showToast]);

  const handleCartConfirmation = async (qtyToDispatch) => {
    const finalQuantity =
      qtyToDispatch !== undefined ? qtyToDispatch : currentNumericalQuantity;

    if (!user?._id) {
      showToast("Please login to add items to cart", "danger");
      navigation.navigate("Login");
      return;
    }

    if (finalQuantity < 0) {
      showToast("Quantity cannot be negative.", "danger");
      return;
    }
    if (finalQuantity > product.stock) {
      showToast(
        `Cannot add more than available stock (${product.stock})`,
        "danger"
      );
      setQuantity(product.stock);
      return;
    }

    if (finalQuantity === 0 && (cartItem?.quantity || 0) === 0) {
      setShowQuantityControls(false);
      setQuantity("");
      return;
    }

    const payload = {
      productId: product._id,
      quantity: finalQuantity,
      price: effectivePrice,
      vendorId: product.vendorId || product.vendor?._id,
    };

    setIsLoading(true);
    try {
      await dispatch(addOrUpdateItem(payload)).unwrap();
      if (finalQuantity === 0) {
        showToast(`Removed ${product.name} from cart.`, "info");
        setShowQuantityControls(false);
        setQuantity("");
      } else if (!cartItem || (cartItem.quantity || 0) === 0) {
        showToast(
          `Added ${finalQuantity} x ${product.name} to cart!`,
          "success"
        );
      } else {
        showToast(`Cart updated: ${finalQuantity} x ${product.name}`, "info");
      }
      if (finalQuantity > 0) setShowQuantityControls(true);
    } catch (err) {
      console.error("Cart update failed:", err);
      showToast(
        err.message || "Failed to update item in cart. Please try again.",
        "danger"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuantityChange = useCallback(
    (text) => {
      if (text === "") {
        setQuantity("");
        return;
      }
      if (!/^\d*$/.test(text)) {
        return;
      }

      let numVal = parseInt(text, 10);
      if (text.length > 1 && text.startsWith("0")) {
        if (numVal === 0) {
          setQuantity("0");
          return;
        } else {
          setQuantity(String(numVal));
          return;
        }
      }
      if (text === "0") {
        setQuantity("0");
        return;
      }
      if (isNaN(numVal)) {
        setQuantity("");
        return;
      }

      setQuantity(text);
      if (numVal > product.stock) {
        showToast(`Available stock: ${product.stock}`, "info");
      }
    },
    [product.stock, showToast]
  );

  const handleQuantityBlur = useCallback(() => {
    setIsInputFocused(false);
    const numericalQuantity =
      typeof quantity === "string" ? parseInt(quantity, 10) || 0 : quantity;
    const wasInCart = (cartItem?.quantity || 0) > 0;

    if (numericalQuantity === 0) {
      if (wasInCart) {
        handleCartConfirmation(0);
      } else {
        setShowQuantityControls(false);
        setQuantity("");
      }
    } else {
      setQuantity(numericalQuantity);
      if (!showQuantityControls) {
        setShowQuantityControls(true);
      }
      if (numericalQuantity !== (cartItem?.quantity || 0)) {
        handleCartConfirmation(numericalQuantity);
      }
    }
  }, [
    quantity,
    cartItem?.quantity,
    showQuantityControls,
    handleCartConfirmation,
  ]);

  const handleQuantityFocus = useCallback(() => {
    setIsInputFocused(true);
    if (currentNumericalQuantity === 0) {
      setQuantity("");
    }
  }, [currentNumericalQuantity]);

  const handleQuantityButtonClick = useCallback(
    async (increment) => {
      const numPrev =
        typeof quantity === "string" ? parseInt(quantity, 10) || 0 : quantity;
      let newQty;

      if (increment) {
        newQty = Math.min(product.stock, numPrev + 1);
        if (numPrev >= product.stock) {
          showToast(`Max stock reached (${product.stock})`, "info");
          return;
        }
      } else {
        newQty = Math.max(0, numPrev - 1);
      }

      setQuantity(newQty);
      await handleCartConfirmation(newQty);
    },
    [quantity, product.stock, handleCartConfirmation, showToast]
  );

  if (!product._id) {
    return null;
  }

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [-60, 0],
    extrapolate: "clamp",
  });

  const renderImageGallery = () => {
    const imageUrls = (product.images || []).map((image) => ({ url: image }));

    if (imageUrls.length === 0) {
      return (
        <View style={styles.imageContainer}>
          <View style={styles.noImageContainer}>
            <Ionicons
              name="image-outline"
              size={60}
              color={Colors.textSecondary}
            />
            <Text style={styles.noImageTextDetail}>No Image Available</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.imageContainer}>
        <Swiper
          style={styles.wrapper}
          showsButtons={false}
          loop={true}
          autoplay={true}
          autoplayTimeout={3000}
          dotStyle={styles.dotStyle}
          activeDotStyle={styles.activeDotStyle}
          paginationStyle={styles.paginationStyle}
        >
          {product.images.map((image, index) => (
            <TouchableOpacity
              key={index}
              style={styles.slide}
              onPress={() => {
                setSelectedImageIndex(index);
                setIsModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: image }}
                style={styles.productImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </Swiper>
        <Modal
          visible={isModalVisible}
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <ImageViewer
            imageUrls={imageUrls}
            index={selectedImageIndex}
            onCancel={() => setIsModalVisible(false)}
            enableSwipeDown={true}
            renderIndicator={(currentIndex, allSize) => (
              <Text
                style={styles.imageZoomIndicator}
              >{`${currentIndex} / ${allSize}`}</Text>
            )}
            renderHeader={() => (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Ionicons name="close-circle-sharp" size={40} color="white" />
              </TouchableOpacity>
            )}
            onSwipeDown={() => setIsModalVisible(false)}
          />
        </Modal>
      </View>
    );
  };

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          opacity: headerOpacity,
          transform: [{ translateY: headerTranslateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.headerButton}>
        <Ionicons name="heart-outline" size={24} color={Colors.primary} />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderProductInfo = () => (
    <View style={styles.infoCard}>
      <Text style={styles.productName}>{product.name}</Text>

      {product.brand && (
        <Text style={styles.brandText}>{product.brand.toUpperCase()}</Text>
      )}

      <View style={styles.metaContainer}>
        <View style={styles.metaBadge}>
          <Ionicons name="star" size={16} color={Colors.accent} />
          <Text style={styles.metaText}>
            {product.rating?.toFixed(1) || "4.8"}
          </Text>
        </View>

        <View style={styles.metaBadge}>
          <Ionicons name="bag-handle" size={16} color={Colors.accent} />
          <Text style={styles.metaText}>{product.stock} in stock</Text>
        </View>
      </View>

      <Text style={styles.descriptionText}>
        {product.description ||
          "Premium product with exceptional quality and craftsmanship."}
      </Text>
    </View>
  );

  const renderPricing = () => (
    <View style={styles.pricingCard}>
      <View style={styles.priceRow}>
        <View>
          <Text style={styles.effectivePrice}>
            ₹{effectivePrice.toFixed(2)}
          </Text>

          {product.discountedPrice &&
            product.price > product.discountedPrice && (
              <Text style={styles.originalPrice}>
                ₹{product.price.toFixed(2)}
              </Text>
            )}
        </View>

        {product.discountedPrice && product.price > product.discountedPrice && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>
              SAVE ₹{(product.price - product.discountedPrice).toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {priceTiers.length > 1 && (
        <View style={styles.tiersContainer}>
          <Text style={styles.tiersTitle}>VOLUME PRICING</Text>

          <View style={styles.tiersGrid}>
            {priceTiers.map((tier, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.tierItem,
                  tier.isActive && styles.tierItemActive,
                ]}
                onPress={() => setQuantity(tier.minQty)}
              >
                <Text
                  style={[
                    styles.tierLabel,
                    tier.isActive && styles.tierLabelActive,
                  ]}
                >
                  {tier.label}
                </Text>
                <Text
                  style={[
                    styles.tierPrice,
                    tier.isActive && styles.tierPriceActive,
                  ]}
                >
                  ₹{tier.price.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderAddToCart = () => {
    if (!product.isAvailable || product.stock <= 0) {
      return (
        <View style={[styles.primaryButton, styles.disabledButton]}>
          <Ionicons name="close-circle" size={24} color="white" />
          <Text style={styles.buttonText}>OUT OF STOCK</Text>
        </View>
      );
    }

    if (!showQuantityControls || currentNumericalQuantity === 0) {
      return (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setShowQuantityControls(true);
            setQuantity(1);
            handleCartConfirmation(1);
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="cart" size={24} color="white" />
              <Text style={styles.buttonText}>ADD TO CART</Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleQuantityButtonClick(false)}
          disabled={isLoading || currentNumericalQuantity <= 0}
        >
          <Ionicons name="remove" size={24} color="white" />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.quantityInput,
            isInputFocused && styles.quantityInputFocused,
          ]}
          value={String(quantity)}
          onChangeText={handleQuantityChange}
          keyboardType="numeric"
          onBlur={handleQuantityBlur}
          onFocus={handleQuantityFocus}
          maxLength={String(product.stock).length + 2}
          editable={!isLoading}
          selectionColor={Colors.accent}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => handleQuantityButtonClick(true)}
          disabled={isLoading || currentNumericalQuantity >= product.stock}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.updateButton}
          onPress={() => handleCartConfirmation()}
          disabled={isLoading}
        >
          <Text style={styles.updateButtonText}>
            {cartItem?.quantity > 0 ? "UPDATE" : "ADD"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const isCartEmpty = Object.keys(cartItems).length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {renderImageGallery()}

      {renderHeader()}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          !isCartEmpty && styles.scrollContentWithCartBar,
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {renderProductInfo()}
        {renderPricing()}

        <View style={styles.actionCard}>{renderAddToCart()}</View>
      </ScrollView>

      {/* Conditionally render the floating cart bar */}
      {!isCartEmpty && <FloatingCartBar />}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  imageContainer: {
    height: width * 0.85,
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 15,
      },
    }),
  },
  wrapper: {
    height: "100%",
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  dotStyle: {
    backgroundColor: "rgba(255,255,255,0.5)",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDotStyle: {
    backgroundColor: Colors.accent,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  paginationStyle: {
    bottom: 20,
  },
  noImageContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageTextDetail: {
    color: Colors.textSecondary,
    marginTop: 10,
    fontSize: 16,
    fontWeight: "500",
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  scrollContentWithCartBar: {
    paddingBottom: 100, // Adjust this value based on your floating bar's height
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  productName: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
    lineHeight: 38,
  },
  brandText: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: "600",
    marginBottom: 16,
    letterSpacing: 1,
  },
  metaContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  metaBadge: {
    backgroundColor: "rgba(10, 61, 43, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  metaText: {
    marginLeft: 4,
    fontWeight: "600",
    color: Colors.primary,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  pricingCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  effectivePrice: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.primary,
  },
  originalPrice: {
    fontSize: 20,
    color: Colors.textSecondary,
    textDecorationLine: "line-through",
    marginTop: 4,
  },
  discountBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  discountBadgeText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  tiersContainer: {
    marginTop: 10,
  },
  tiersTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  tiersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  tierItem: {
    width: "48%",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tierItemActive: {
    borderColor: Colors.accent,
    backgroundColor: "rgba(212, 175, 55, 0.1)",
  },
  tierLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  tierLabelActive: {
    color: Colors.primary,
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
  },
  tierPriceActive: {
    color: Colors.primary,
  },
  actionCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  disabledButton: {
    backgroundColor: Colors.textSecondary,
  },
  buttonText: {
    color: Colors.card,
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quantityButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  quantityInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    paddingVertical: 12,
    marginHorizontal: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quantityInputFocused: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  updateButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginLeft: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  updateButtonText: {
    color: Colors.card,
    fontWeight: "600",
    fontSize: 16,
  },

  // --- Floating Cart Bar Styles ---
  floatingCartBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 20 : 10,
    left: 15,
    right: 15,
    backgroundColor: Colors.primary, // Using primary color for consistency
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 999,
    minHeight: 75,
  },
  floatingCartTextContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  floatingCartLabel: {
    color: Colors.card,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: 2,
  },
  floatingCartPrice: {
    color: Colors.card,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 20,
  },
  floatingCartButton: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingCartButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  // --- New Styles for Image Zoom Modal ---
  imageZoomIndicator: {
    color: "white",
    fontSize: 16,
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 20,
    zIndex: 1,
  },
});

export default ProductDetailsScreen;
