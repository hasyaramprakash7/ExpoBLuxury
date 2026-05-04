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
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

// Assuming this import points to your Redux slice
import { addOrUpdateItem } from "../features/cart/cartSlice";

const { width } = Dimensions.get("window");

const CARD_WIDTH = width * 0.45;

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
  sizes?: string[]; // <-- Uses 'sizes' for the card component
}

interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  size?: string;
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

const NewProductCard1: React.FC<NewProductCardProps> = ({
  product,
  isVendorOffline = false,
  isVendorOutOfRange = false,
  vendorDistance,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<ProductCardNavigationProp>();

  // Use a type for state.cart if available, using 'any' as fallback
  const cartItemsByProduct = useSelector(
    (state: any) => state.cart.items as { [key: string]: CartItem },
  );

  const requiresSizeSelection = product.sizes && product.sizes.length > 0;

  // FIX 1A: Automatically select the first size if available
  const [selectedSize, setSelectedSize] = useState<string | null>(() => {
    return requiresSizeSelection ? product.sizes![0] : null;
  });

  // ************ NEW STATE FOR SIZE TOGGLE ************
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  // **************************************************

  // Function to determine the unique cart key based on product ID and size
  const getCartKey = useCallback(
    (size: string | null) => {
      return size ? `${product._id}_${size}` : product._id;
    },
    [product._id],
  );

  // Refined cartItem lookup based on selected size for accurate Qty display/update
  const activeCartItem = useMemo(() => {
    const cartKey = getCartKey(selectedSize);
    return cartItemsByProduct[cartKey] || null;
  }, [cartItemsByProduct, selectedSize, getCartKey]);

  // Initial state derived from the active cart item
  const initialQuantity =
    activeCartItem?.quantity > 0 ? String(activeCartItem.quantity) : "";

  const [quantity, setQuantity] = useState(initialQuantity);
  const [effectivePrice, setEffectivePrice] = useState(
    product.discountedPrice || product.price,
  );
  const [showQuantityInput, setShowQuantityInput] = useState(
    (activeCartItem?.quantity || 0) > 0,
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
        (tier.maxQty === Infinity || currentNumericalQuantity <= tier.maxQty),
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

  // FIX 2C: Update local state when the active cart item or selected size changes
  useEffect(() => {
    const currentCartQty = activeCartItem?.quantity || 0;
    setQuantity(currentCartQty > 0 ? String(currentCartQty) : "");
    setShowQuantityInput(currentCartQty > 0);
  }, [activeCartItem, selectedSize]); // Added selectedSize as a dependency to react to size switch

  const showToast = useCallback(
    (msg: string, type: "success" | "error" | "info" | "warn") => {
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
    },
    [],
  );

  const handleCartAction = useCallback(
    async (qtyToDispatch: number) => {
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

      // NEW CHECK: Ensure a size is selected if product has sizes
      if (requiresSizeSelection && !selectedSize) {
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
        // NOTE: Passing selectedSize to dispatch payload
        await dispatch(
          addOrUpdateItem({
            productId: product._id,
            quantity: numericalQuantity,
            price: effectivePrice,
            vendorId: product.vendorId || product.vendor?._id,
            size: selectedSize, // <--- Include selected size
          }) as any, // Type assertion to handle the async thunk return type
        ).unwrap();

        const sizeText = selectedSize ? ` (${selectedSize})` : "";

        if (numericalQuantity === 0) {
          showToast(`Removed ${product.name}${sizeText} from cart.`, "info");
        } else if (!activeCartItem || activeCartItem.quantity === 0) {
          showToast(
            `Added ${numericalQuantity} x ${product.name}${sizeText} to cart!`,
            "success",
          );
        } else {
          showToast(
            `Updated cart: ${numericalQuantity} x ${product.name}${sizeText}`,
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
    },
    [
      isVendorOffline,
      isVendorOutOfRange,
      requiresSizeSelection,
      selectedSize,
      displayStock,
      product.name,
      product._id,
      product.vendorId,
      product.vendor?._id,
      effectivePrice,
      activeCartItem,
      dispatch,
      showToast,
    ],
  );

  const handleSizeSelect = useCallback(
    async (size: string) => {
      // 1. Update the selected size state immediately
      setSelectedSize(size);

      // ************ NEW: Hide selector after selection ************
      setShowSizeSelector(false);
      // **********************************************************

      const currentCartQty = activeCartItem?.quantity || 0;
      // 2. If the user was editing quantity for the old size, commit that change first (optional cleanup)
      if (currentNumericalQuantity !== currentCartQty) {
        await handleCartAction(currentNumericalQuantity);
      }

      // The useEffect listening to [activeCartItem, selectedSize] will handle the UI update.
    },
    [selectedSize, currentNumericalQuantity, activeCartItem, handleCartAction],
  );

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
        "error",
      );
      return;
    }

    // NEW CHECK: Prevent adding without selecting size
    if (requiresSizeSelection && !selectedSize) {
      showToast("Please select a size before adding to cart.", "warn");
      // ************ NEW: Show size selector if none is selected ************
      setShowSizeSelector(true);
      // *******************************************************************
      return;
    }

    if (!showQuantityInput || currentNumericalQuantity === 0) {
      setQuantity("1");
      setShowQuantityInput(true);
      await handleCartAction(1);
    }
  };

  const handleShare = async () => {
    if (Platform.OS === "web") {
      showToast("Sharing is not available on web platform.", "error");
      return;
    }

    if (isVendorOffline || isVendorOutOfRange) {
      showToast(
        "Cannot share product: Vendor is offline or out of range.",
        "error",
      );
      return;
    }

    const imageUrl = product.images?.[0];
    const deepLinkUrl = `bluxury://product/${product._id}`;

    const discountPercent =
      product.discountedPrice && product.price
        ? ((product.price - product.discountedPrice) / product.price) * 100
        : 0;
    const discountText =
      discountPercent > 0 ? ` (${discountPercent.toFixed(0)}% OFF!)` : "";

    const message = `Check out this amazing product: ${product.name}! 🤩
Price: ₹${effectivePrice.toFixed(2)}${discountText}
\nGet it now on our app!
${deepLinkUrl}`;

    try {
      let shareOptions: any = {
        message: message,
        title: "Product from BLuxury Store",
        url: deepLinkUrl,
      };

      if (imageUrl && FileSystem.downloadAsync && Sharing.isAvailableAsync) {
        const { uri: localUri } = await FileSystem.downloadAsync(
          imageUrl,
          FileSystem.cacheDirectory + "share.jpg",
        );
        shareOptions.url = localUri;
      }

      if (!(await Sharing.isAvailableAsync())) {
        showToast("Sharing is not available on your device.", "error");
        return;
      }

      await Sharing.shareAsync(shareOptions.url, shareOptions);
    } catch (error) {
      console.error("Error sharing product:", error);
      showToast("Failed to share product. Please try again.", "error");
    }
  };

  const isDisabled = isVendorOffline || isVendorOutOfRange;

  const truncatedName = useMemo(() => {
    const maxLen = 15;
    if (product.name.length > maxLen) {
      return `${product.name.slice(0, maxLen)}...`;
    }
    return product.name;
  }, [product.name]);

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
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          disabled={isDisabled}
        >
          <Ionicons
            name="share-social-outline"
            size={20}
            color={Colors.greenDark}
          />
        </TouchableOpacity>
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
        <Text style={styles.productName}>{truncatedName}</Text>

        {/* ************ START NEW SIZE SELECTION TOGGLE UI ************ */}
        {/* {requiresSizeSelection && selectedSize && (
          <TouchableOpacity
            style={[styles.sizeToggleContainer, isDisabled && { opacity: 0.6 }]}
            onPress={() => setShowSizeSelector((prev) => !prev)}
            disabled={isDisabled || displayStock === 0}
          >
            <Text style={styles.sizeToggleText}>Size: {selectedSize}</Text>
            <Text style={styles.sizeToggleChangeText}>
              {showSizeSelector ? "Done" : "Change"}
            </Text>
            {/* <Ionicons
              name={showSizeSelector ? "chevron-up" : "chevron-forward"}
              size={16}
              color={Colors.yellowHighlight}
              style={styles.sizeToggleIcon}
            /> */}
          </TouchableOpacity>
        )} */}

        {/* Size Pills List - Only visible if requiresSizeSelection is true AND showSizeSelector is true */}
        {requiresSizeSelection && showSizeSelector && (
          <View style={styles.sizeSelectorWrapper}>
            <View style={styles.sizePillsContainer}>
              {product.sizes?.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizePill,
                    selectedSize === size && styles.sizePillActive,
                  ]}
                  onPress={() => handleSizeSelect(size)} // Use handler
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
            </View>
          </View>
        )}
        {/* ************ END NEW SIZE SELECTION TOGGLE UI ************ */}

        {/* The original size selector logic for the case when no size is selected should be adapted 
            to use the new toggle, but the current state management handles defaulting to the first size, 
            so the only way to see the list is via 'Change'. 
            If selectedSize is NULL, we should probably just show the list immediately.
        */}
        {!selectedSize && requiresSizeSelection && (
          <View style={styles.sizeSelectorWrapper}>
            <Text style={styles.sizeSelectorLabel}>Select Size:</Text>
            <View style={styles.sizePillsContainer}>
              {product.sizes?.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizePill,
                    selectedSize === size && styles.sizePillActive,
                  ]}
                  onPress={() => handleSizeSelect(size)}
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
            </View>
          </View>
        )}

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
          {priceTiers.map((tier) => (
            <View
              key={tier.minQty} // FIX 2D: Use minQty for a unique, stable key
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
            {!!(activeCartItem?.quantity || 0) && (
              <View style={styles.addedToCartMessage}>
                <Ionicons
                  name="checkmark-circle"
                  size={10}
                  color={Colors.textLight}
                />
                <Text style={styles.addedToCartMessageText}>
                  Added ({activeCartItem.quantity})
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
              activeCartItem?.quantity !== currentNumericalQuantity) ||
              (currentNumericalQuantity === 0 &&
                (activeCartItem?.quantity || 0) > 0)) && (
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
              !product.isAvailable ||
              displayStock === 0 ||
              isAddingToCart ||
              (requiresSizeSelection && !selectedSize) // Disable if size required but not selected
            }
            style={[
              styles.addToCartButton,
              (!product.isAvailable ||
                displayStock === 0 ||
                isAddingToCart ||
                (requiresSizeSelection && !selectedSize)) &&
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
                <Text style={styles.addToCartButtonText}>
                  {requiresSizeSelection && !selectedSize
                    ? "Select Size"
                    : "Add to Cart"}
                </Text>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
  },
  cardDisabled: {
    opacity: 0.6,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: 220,
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
  shareButton: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: Colors.textLight,
    borderRadius: 50,
    padding: 6,
    zIndex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
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
    textAlign: "center",
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
  // NEW SIZE SELECTION TOGGLE STYLES
  sizeToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.cardBackground, // Dark Green background
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginBottom: 10,
    width: "100%",
  },
  sizeToggleText: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.greenDark, // White text for size
  },
  sizeToggleChangeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: Colors.greenDark, // Yellow text for 'Change'
    marginLeft: "auto", // Pushes 'Change' and icon to the right
    marginRight: 4,
  },
  sizeToggleIcon: {
    // Styling for the icon
  },
  // END NEW SIZE SELECTION TOGGLE STYLES

  // SIZE PILLS STYLES (Used when the selector is open)
  sizeSelectorWrapper: {
    flexDirection: "column",
    marginBottom: 10,
    width: "100%",
    alignItems: "center",
    gap: 5,
  },
  sizeSelectorLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: Colors.grayDark,
  },
  sizePillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 0,
  },
  sizePill: {
    width: "22%",
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.grayLight,
    margin: 3,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
  },
  sizePillActive: {
    borderColor: Colors.greenDark,
    backgroundColor: Colors.greenDark,
  },
  sizePillText: {
    fontSize: 10,
    color: Colors.grayDark,
    fontWeight: "600",
    textAlign: "center",
  },
  sizePillTextActive: {
    color: Colors.textLight,
  },
  // END SIZE PILLS STYLES

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

export default NewProductCard1;
