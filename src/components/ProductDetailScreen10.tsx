import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import Swiper from "react-native-swiper";
import Ionicons from "@expo/vector-icons/Ionicons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Toast from "react-native-toast-message";
import ImageViewer from "react-native-image-zoom-viewer";

// Redux
import { addOrUpdateItem } from "../features/cart/cartSlice";
import { RootState } from "../app/store";

const { width } = Dimensions.get("window");

const Colors = {
  royalGreen: "#006400",
  greenDark: "#0A3D2B",
  textDark: "#1A1A1A",
  textGray: "#666666",
  accentGold: "#FFC107",
  white: "#FFFFFF",
  bgBeige: "#F4F0E8",
  redAlert: "#DC2626",
};

const ProductDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();

  const user = useSelector((state: RootState) => state.auth.user);
  const cartItems = useSelector((state: RootState) => state.cart.items);

  const product = useMemo(
    () => route.params?.product || {},
    [route.params?.product],
  );

  // --- UI States ---
  const [selectedSize, setSelectedSize] = useState<string | null>(
    product.sizes?.length > 0 ? product.sizes[0] : null,
  );
  const [quantity, setQuantity] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // 🔥 DYNAMIC VEG/NON-VEG DETECTOR
  const isNonVeg = useMemo(() => {
    const nonVegKeywords = /chicken|mutton|fish|egg|meat|prawn|crab|beef|pork/i;
    return (
      nonVegKeywords.test(product.name) ||
      nonVegKeywords.test(product.category || "")
    );
  }, [product.name, product.category]);

  // --- Logic: Cart & Price Sync ---
  const activeCartItem = useMemo(() => {
    const key = selectedSize ? `${product._id}_${selectedSize}` : product._id;
    return cartItems[key] || null;
  }, [cartItems, selectedSize, product._id]);

  // Initialize local quantity to 1 always, unless we want to show current cart value
  // To fix your "adding" issue, we keep local quantity independent for the "Add" action
  useEffect(() => {
    setQuantity("1");
  }, [selectedSize]);

  // Floating Cart Calculations
  const cartStats = useMemo(() => {
    const items = Object.values(cartItems);
    const count = items.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0,
    );
    const total = items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );
    return { count, total };
  }, [cartItems]);

  const currentNumericalQuantity = parseInt(quantity, 10) || 0;

  const priceTiers = useMemo(() => {
    const tiers = [];
    const bulkMin = product.bulkMinimumUnits || 10;
    const largeMin = product.largeQuantityMinimumUnits || 50;

    // Use currentNumericalQuantity OR currentNumericalQuantity + cartQuantity to find effective price
    const checkQty = activeCartItem
      ? activeCartItem.quantity
      : currentNumericalQuantity;

    tiers.push({
      minQty: 1,
      maxQty: bulkMin - 1,
      price: product.discountedPrice || product.price,
      label: `Retail (1 - ${bulkMin - 1} kg)`,
    });

    if (product.bulkPrice) {
      tiers.push({
        minQty: bulkMin,
        maxQty: largeMin - 1,
        price: product.bulkPrice,
        label: `Wholesale (${bulkMin}+ kg)`,
      });
    }

    if (product.largeQuantityPrice) {
      tiers.push({
        minQty: largeMin,
        maxQty: 9999,
        price: product.largeQuantityPrice,
        label: `Super Saver (${largeMin}+ kg)`,
      });
    }

    return tiers
      .map((t) => ({
        ...t,
        isActive: checkQty >= t.minQty && checkQty <= t.maxQty,
      }))
      .filter((t) => t.minQty <= t.maxQty);
  }, [currentNumericalQuantity, product, activeCartItem]);

  const effectivePrice = useMemo(() => {
    const active = priceTiers.find((t) => t.isActive);
    return active ? active.price : product.discountedPrice || product.price;
  }, [priceTiers, product]);

  const handleCartAction = async (isUpdateAction: boolean = false) => {
    if (!user?._id) {
      navigation.navigate("Login");
      return;
    }

    const inputQty = parseInt(quantity, 10) || 0;
    if (inputQty <= 0) return;

    // 🔥 LOGIC FIX:
    // If item exists and user clicks "Add to Cart", we ADD (qty + existing)
    // If item exists and user uses - / + buttons, we set absolute newVal (handled in adjustQty)
    let finalQty = inputQty;
    if (!isUpdateAction && activeCartItem) {
      finalQty = activeCartItem.quantity + inputQty;
    }

    Keyboard.dismiss();
    setIsLoading(true);
    try {
      await dispatch(
        addOrUpdateItem({
          productId: product._id,
          quantity: finalQty,
          price: effectivePrice,
          vendorId: product.vendorId || product.vendor?._id,
          size: selectedSize,
        }) as any,
      ).unwrap();

      // Reset input to 1 after adding
      if (!isUpdateAction) setQuantity("1");

      Toast.show({ type: "success", text1: "Cart updated" });
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  };

  const adjustQty = (inc: boolean) => {
    const newVal = inc
      ? currentNumericalQuantity + 1
      : Math.max(1, currentNumericalQuantity - 1);
    setQuantity(String(newVal));
  };

  const handleInputEndEditing = () => {
    if (isNaN(currentNumericalQuantity) || currentNumericalQuantity <= 0) {
      setQuantity("1");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: cartStats.count > 0 ? 180 : 120,
          }}
        >
          {/* Gallery */}
          <View style={styles.imageBox}>
            <Swiper activeDotStyle={styles.activeDot} loop={true}>
              {product.images?.map((img: string, i: number) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    setSelectedImageIndex(i);
                    setIsModalVisible(true);
                  }}
                >
                  <Image source={{ uri: img }} style={styles.mainImg} />
                </TouchableOpacity>
              ))}
            </Swiper>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsContainer}>
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

            <View style={styles.mainPriceRow}>
              {product.discountedPrice &&
                product.discountedPrice < product.price && (
                  <Text style={styles.originalMainPrice}>₹{product.price}</Text>
                )}
              <View style={styles.yellowPriceTag}>
                <Text style={styles.yellowPriceText}>₹{effectivePrice}</Text>
              </View>
            </View>

            {product.description ? (
              <Text style={styles.descriptionText}>{product.description}</Text>
            ) : null}

            {priceTiers.length > 0 && (
              <View style={styles.tierContainer}>
                <Text style={styles.sectionTitle}>Bulk Pricing</Text>
                {priceTiers.map((tier, idx) => (
                  <View
                    key={idx}
                    style={[styles.tierRow, tier.isActive && styles.tierActive]}
                  >
                    <Text
                      style={[
                        styles.tierText,
                        tier.isActive && styles.whiteText,
                      ]}
                    >
                      {tier.label}
                    </Text>
                    <Text
                      style={[
                        styles.tierPriceText,
                        tier.isActive && styles.whiteText,
                      ]}
                    >
                      ₹{tier.price}/kg
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {cartStats.count > 0 && (
          <TouchableOpacity
            style={styles.viewCartFloating}
            onPress={() => navigation.navigate("CartScreen")}
            activeOpacity={0.9}
          >
            <View style={styles.viewCartLeft}>
              <View style={styles.cartBadge}>
                <Text style={styles.badgeText}>{cartStats.count} Kg</Text>
              </View>
              <Text style={styles.viewCartTitle}>View Cart</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>
        )}

        <View style={styles.bottomBar}>
          <View style={styles.priceMeta}>
            <Text style={styles.priceLabel}>Price/kg</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {product.discountedPrice &&
                product.discountedPrice < product.price && (
                  <Text style={[styles.originalMainPrice, { fontSize: 13 }]}>
                    ₹{product.price}
                  </Text>
                )}
              <View style={styles.yellowPriceTag}>
                <Text style={styles.yellowPriceText}>
                  ₹{effectivePrice.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.controlsArea}>
            <View style={styles.qtyBox}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => adjustQty(false)}
              >
                <FontAwesome name="minus" size={14} color="white" />
              </TouchableOpacity>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ""))}
                  onEndEditing={handleInputEndEditing}
                  selectTextOnFocus={true}
                />
                <Text style={styles.kgLabel}>kg</Text>
              </View>

              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => adjustQty(true)}
              >
                <FontAwesome name="plus" size={14} color="white" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCartAction(false)} // Pass false to indicate this is an "ADD" intent
              disabled={isLoading || currentNumericalQuantity === 0}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.actionBtnText}>
                  Add to Cart{" "}
                  {activeCartItem ? `(${activeCartItem.quantity} in cart)` : ""}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={isModalVisible}
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <ImageViewer
          imageUrls={product.images?.map((u: string) => ({ url: u }))}
          index={selectedImageIndex}
          onCancel={() => setIsModalVisible(false)}
          enableSwipeDown={true}
          renderHeader={() => (
            <TouchableOpacity
              style={styles.closeModal}
              onPress={() => setIsModalVisible(false)}
            >
              <Ionicons name="close-circle" size={40} color="white" />
            </TouchableOpacity>
          )}
        />
      </Modal>
      <Toast />
    </KeyboardAvoidingView>
  );
};

// ... Styles remain the same as your previous version ...
const styles = StyleSheet.create({
  imageBox: { height: 380, backgroundColor: "#F4EAE2" },
  mainImg: { width: "100%", height: "100%", resizeMode: "cover" },
  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    backgroundColor: "white",
    padding: 8,
    borderRadius: 20,
    elevation: 5,
  },
  detailsContainer: {
    padding: 20,
    marginTop: -30,
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  typeIcon: {
    width: 14,
    height: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  typeIconVeg: { borderColor: Colors.royalGreen },
  typeIconNonVeg: { borderColor: Colors.redAlert },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.royalGreen,
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
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textDark,
    marginBottom: 8,
  },
  mainPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  originalMainPrice: {
    fontSize: 16,
    color: Colors.textGray,
    textDecorationLine: "line-through",
    marginRight: 8,
  },
  yellowPriceTag: {
    backgroundColor: Colors.accentGold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  yellowPriceText: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.textDark,
  },
  descriptionText: {
    color: Colors.textGray,
    lineHeight: 22,
    fontSize: 14,
    marginBottom: 20,
  },
  tierContainer: { marginBottom: 20 },
  tierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
    marginBottom: 8,
  },
  tierActive: { backgroundColor: Colors.greenDark },
  tierText: { fontSize: 13, color: Colors.textGray },
  tierPriceText: { fontSize: 14, fontWeight: "bold", color: Colors.greenDark },
  whiteText: { color: "white" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: Colors.textDark,
  },
  viewCartFloating: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 125 : 135,
    left: 15,
    right: 15,
    backgroundColor: Colors.greenDark,
    height: 60,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    elevation: 10,
  },
  viewCartLeft: { flexDirection: "row", alignItems: "center" },
  cartBadge: {
    backgroundColor: Colors.accentGold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 10,
  },
  badgeText: { color: Colors.greenDark, fontWeight: "bold", fontSize: 12 },
  viewCartTitle: { color: "white", fontWeight: "bold", fontSize: 14 },
  bottomBar: {
    backgroundColor: "white",
    flexDirection: "row",
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    paddingBottom: Platform.OS === "ios" ? 35 : 15,
    alignItems: "center",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  priceMeta: { flex: 0.6 },
  priceLabel: { fontSize: 11, color: Colors.textGray, marginBottom: 4 },
  controlsArea: { flex: 1.4, gap: 10 },
  qtyBox: {
    flexDirection: "row",
    backgroundColor: Colors.greenDark,
    borderRadius: 10,
    height: 45,
    overflow: "hidden",
  },
  qtyBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
  inputWrapper: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    margin: 4,
    borderRadius: 8,
    justifyContent: "center",
  },
  qtyInput: {
    fontWeight: "bold",
    color: Colors.greenDark,
    fontSize: 16,
    textAlign: "center",
    minWidth: 40,
  },
  kgLabel: { fontSize: 14, color: Colors.greenDark, fontWeight: "600" },
  actionBtn: {
    backgroundColor: Colors.royalGreen,
    height: 45,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnText: { color: "white", fontWeight: "bold" },
  btnDisabled: { opacity: 0.4 },
  closeModal: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  activeDot: {
    backgroundColor: Colors.accentGold,
    width: 20,
    height: 8,
    borderRadius: 4,
  },
});

export default ProductDetailsScreen;
