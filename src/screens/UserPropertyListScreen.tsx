import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
// 🔥 ENTERPRISE UPGRADE: Imported shallowEqual to prevent infinite render loops
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import {
  Ionicons,
  FontAwesome,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { fetchProperties, Property } from "../features/propertySlice";
import { RootState } from "../app/store";

const { width } = Dimensions.get("window");

const Colors = {
  trueBlack: "#000000",
  luxuryGold: "#D4AF37",
  goldLight: "#F9E2AF",
  pureWhite: "#FFFFFF",
  slate: "#475569",
  glassBorder: "rgba(255, 255, 255, 0.15)",
};

// --- SUB-COMPONENT: ROYAL ANIMATED CTA ---
const ViewPropertyCTA = ({ onPress }: { onPress: () => void }) => {
  const arrowTranslateX = useSharedValue(0);

  useEffect(() => {
    arrowTranslateX.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 600 }),
        withTiming(0, { duration: 600 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowTranslateX.value }],
  }));

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.ctaButton}
    >
      <Text style={styles.ctaText}>VIEW PROPERTY</Text>
      <Animated.View style={animatedArrowStyle}>
        <Ionicons name="arrow-forward" size={18} color={Colors.pureWhite} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- REALISTIC CHIP ---
const RealisticChip = () => (
  <LinearGradient
    colors={["#8A6E2F", "#F9E2AF", "#C5A028", "#8A6E2F"]}
    style={styles.chipContainer}
  >
    <View style={[styles.chipLine, { top: "25%", width: "100%" }]} />
    <View style={[styles.chipLine, { top: "50%", width: "100%" }]} />
    <View style={[styles.chipLine, { top: "75%", width: "100%" }]} />
    <View style={[styles.chipLineVertical, { left: "33%", height: "100%" }]} />
    <View style={[styles.chipLineVertical, { left: "66%", height: "100%" }]} />
  </LinearGradient>
);

const PropertyCard = ({ item }: { item: any }) => {
  const navigation = useNavigation<any>();
  const [flipped, setFlipped] = useState(false);
  const rotateY = useSharedValue(0);

  const handleFlip = () => {
    const nextValue = !flipped;
    setFlipped(nextValue);
    rotateY.value = withSpring(nextValue ? 180 : 0, {
      damping: 12,
      stiffness: 90,
    });
  };

  const navigateToDetails = () => {
    console.log(
      `[PropertyCard] Navigating to PropertyDetailScreen for ID: ${item._id}`,
    );
    navigation.navigate("PropertyDetailScreen", { propertyId: item._id });
  };

  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotateY.value}deg` }],
    zIndex: rotateY.value > 90 ? 0 : 1,
    opacity: rotateY.value > 90 ? 0 : 1,
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${rotateY.value + 180}deg` },
    ],
    zIndex: rotateY.value > 90 ? 1 : 0,
    opacity: rotateY.value > 90 ? 1 : 0,
    position: "absolute",
    top: 0,
    width: "100%",
    height: "100%",
  }));

  const displayPrice =
    item.minPriceCr === item.maxPriceCr
      ? `₹${item.minPriceCr} CR`
      : `₹${item.minPriceCr} - ${item.maxPriceCr} CR`;

  return (
    <View style={styles.cardWrapper}>
      {/* FRONT */}
      <Animated.View style={[styles.cardBase, frontAnimatedStyle]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleFlip}
          style={{ flex: 1 }}
        >
          <Image
            source={{ uri: item.images?.[0] }}
            style={styles.cardBgImage}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.6)", "#000"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.frontHeader}>
            <View style={styles.chipBrandGroup}>
              <RealisticChip />
              <Text style={styles.brandText}>BLACK EDITION</Text>
            </View>
            <View style={styles.glassBadge}>
              <Text style={styles.badgeText}>
                {item.propertyType?.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.frontBody}>
            <Text style={styles.miniLabel}>ESTATE VALUATION</Text>
            <Text style={styles.priceValue}>{displayPrice}</Text>
          </View>

          <View style={styles.frontFooter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>PROPERTY TITLE</Text>
              <Text style={styles.boldTitle} numberOfLines={1}>
                {item.title?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.specColumn}>
              <Text style={styles.specText}>{item.configuration?.bhk} BHK</Text>
              <Text style={styles.specTextSub}>
                {item.areaOptions?.[0]?.superBuiltUpSqFt} SQFT
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* BACK */}
      <Animated.View
        style={[styles.cardBase, styles.cardBack, backAnimatedStyle]}
      >
        <View style={styles.vCardContainer}>
          <View style={styles.vCardHeader}>
            <View style={styles.vCardLogoArea}>
              <MaterialCommunityIcons
                name="rhombus-split"
                size={22}
                color={Colors.luxuryGold}
              />
              <Text style={styles.vCardBrandName}>BLUXURY</Text>
            </View>
            <TouchableOpacity onPress={handleFlip} style={styles.flipIcon}>
              <Ionicons name="refresh-circle" size={24} color={Colors.slate} />
            </TouchableOpacity>
          </View>

          <View style={styles.vCardMainInfo}>
            <Text style={styles.vendorName} numberOfLines={1}>
              {item.vendor?.name?.toUpperCase() || "VIP AGENT"}
            </Text>
            <Text style={styles.vendorTitle} numberOfLines={1}>
              {item.vendor?.shopName?.toUpperCase() || "ESTATE CONSULTANT"}
            </Text>
            <View style={styles.goldDivider} />
          </View>

          <View style={styles.contactGrid}>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => {
                console.log(
                  `[PropertyCard] Calling Vendor: ${item.vendor?.phone}`,
                );
                Linking.openURL(`tel:${item.vendor?.phone}`);
              }}
            >
              <Ionicons name="call" size={13} color={Colors.luxuryGold} />
              <Text style={styles.contactText}>
                +91 {item.vendor?.phone || "00000 00000"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => {
                console.log(
                  `[PropertyCard] Messaging Vendor on WhatsApp: ${item.vendor?.phone}`,
                );
                Linking.openURL(`whatsapp://send?phone=${item.vendor?.phone}`);
              }}
            >
              <FontAwesome
                name="whatsapp"
                size={14}
                color={Colors.luxuryGold}
              />
              <Text style={styles.contactText}>WHATSAPP BUSINESS</Text>
            </TouchableOpacity>

            <View style={styles.contactItem}>
              <Ionicons
                name="location-sharp"
                size={14}
                color={Colors.luxuryGold}
              />
              <Text style={styles.contactText} numberOfLines={1}>
                {item.location?.locality?.toUpperCase()},{" "}
                {item.location?.city?.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.vCardFooter}>
            <ViewPropertyCTA onPress={navigateToDetails} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const UserPropertyListScreen: React.FC = () => {
  const dispatch = useDispatch<any>();

  // 🔥 ENTERPRISE UPGRADE: Inline Selector using shallowEqual to stop the constant array re-renders
  const properties = useSelector((state: RootState) => {
    const ids = state.property.ids as string[];
    const entities = state.property.entities;
    return ids.map((id) => entities[id] as Property);
  }, shallowEqual); // <--- Prevents [Selector unknown returned a different result] warning!

  // Pulling pagination state from Redux
  const { loading, currentPage, hasMore } = useSelector(
    (state: RootState) => state.property,
  );

  const [refreshing, setRefreshing] = useState(false);

  // 🔥 THE FIX: Scroll guard state to prevent runaway fetching
  const [isScrolling, setIsScrolling] = useState(false);

  // LOG STATE CHANGES
  useEffect(() => {
    console.log(
      `[UserPropertyList] Current State -> Properties Count: ${properties.length} | Loading: ${loading} | Current Page: ${currentPage} | Has More: ${hasMore}`,
    );
  }, [properties.length, loading, currentPage, hasMore]);

  // Initial Load with AbortSignal
  useEffect(() => {
    let promise: any;
    console.log(
      "[UserPropertyList] Component Mounted. Dispatching initial fetch (Page 1)...",
    );
    promise = dispatch(fetchProperties({ page: 1, limit: 10 }));

    // Cleanup kills network request instantly if user navigates away
    return () => {
      if (promise) promise.abort();
    };
  }, [dispatch]);

  // Pull down to refresh
  const onRefresh = useCallback(async () => {
    console.log(
      "[UserPropertyList] Pull-to-refresh triggered. Fetching Page 1...",
    );
    setRefreshing(true);
    await dispatch(fetchProperties({ page: 1, limit: 10 }));
    console.log("[UserPropertyList] Pull-to-refresh completed.");
    setRefreshing(false);
  }, [dispatch]);

  // Scroll to bottom to load more
  const handleLoadMore = () => {
    console.log(
      `[UserPropertyList] onEndReached triggered! Check -> hasMore: ${hasMore}, loading: ${loading}, refreshing: ${refreshing}`,
    );

    if (hasMore && !loading && !refreshing) {
      const nextPage = currentPage + 1;
      console.log(
        `[UserPropertyList] Conditions met! Dispatching fetch for Page: ${nextPage}`,
      );
      dispatch(fetchProperties({ page: nextPage, limit: 10 }));
    } else {
      console.log(
        "[UserPropertyList] Ignoring load more request (either no more data, or already loading).",
      );
    }
  };

  // Spinner shown at the bottom of the list when loading the NEXT page
  const renderFooter = () => {
    if (!loading || properties.length === 0) return null;
    console.log("[UserPropertyList] Rendering footer activity indicator...");
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="small" color={Colors.luxuryGold} />
      </View>
    );
  };

  if (loading && properties.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.luxuryGold} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.screenHeader}>
        <Text style={styles.supText}>PRIVATE COLLECTION</Text>
        <Text style={styles.mainHeaderT}>BLUXURY LISTINGS</Text>
      </View>
      <FlatList
        data={properties}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => <PropertyCard item={item} />}
        showsVerticalScrollIndicator={false}
        // 🔥 THE FIX: Pagination Props with Scroll Guard
        onMomentumScrollBegin={() => setIsScrolling(true)}
        onEndReached={() => {
          if (isScrolling) {
            handleLoadMore();
            setIsScrolling(false);
          }
        }}
        onEndReachedThreshold={0.3} // Triggers when user is 30% away from the bottom
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.luxuryGold}
            colors={[Colors.luxuryGold]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  screenHeader: { paddingTop: 60, paddingBottom: 20, alignItems: "center" },
  supText: {
    color: Colors.luxuryGold,
    letterSpacing: 4,
    fontSize: 10,
    fontWeight: "bold",
  },
  mainHeaderT: {
    color: "#fff",
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: "200",
  },
  listPadding: { padding: 16 },

  cardWrapper: { width: "100%", aspectRatio: 1.586, marginBottom: 25 },
  cardBase: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    backgroundColor: Colors.trueBlack,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backfaceVisibility: "hidden",
  },
  cardBack: { backgroundColor: "#000000" },
  cardBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.65,
  },

  chipContainer: { width: 40, height: 28, borderRadius: 5, overflow: "hidden" },
  chipLine: {
    position: "absolute",
    height: 0.5,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  chipLineVertical: {
    position: "absolute",
    width: 0.5,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  chipBrandGroup: { flexDirection: "row", alignItems: "center" },
  frontHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
    alignItems: "center",
  },
  brandText: {
    color: Colors.pureWhite,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "bold",
    marginLeft: 10,
  },
  glassBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "bold" },
  frontBody: { paddingHorizontal: 22, flex: 1, justifyContent: "center" },
  miniLabel: {
    color: Colors.luxuryGold,
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  priceValue: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "300",
    letterSpacing: 1,
  },
  frontFooter: { flexDirection: "row", alignItems: "flex-end", padding: 18 },
  boldTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  specColumn: { alignItems: "flex-end" },
  specText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  specTextSub: { color: Colors.luxuryGold, fontSize: 8, fontWeight: "bold" },

  vCardContainer: { padding: 16, flex: 1, justifyContent: "space-between" },
  vCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vCardLogoArea: { flexDirection: "row", alignItems: "center" },
  vCardBrandName: {
    color: Colors.pureWhite,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 3,
    marginLeft: 6,
  },
  flipIcon: { padding: 4 },

  vCardMainInfo: { marginTop: 4 },
  vendorName: { color: Colors.pureWhite, fontSize: 18, fontWeight: "bold" },
  vendorTitle: {
    color: Colors.slate,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 1,
  },
  goldDivider: {
    width: 30,
    height: 2,
    backgroundColor: Colors.luxuryGold,
    marginTop: 6,
  },

  contactGrid: { marginVertical: 8 },
  contactItem: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  contactText: {
    color: "#E0E0E0",
    fontSize: 9.5,
    marginLeft: 10,
    fontWeight: "500",
  },

  vCardFooter: { width: "100%" },
  ctaButton: {
    backgroundColor: Colors.trueBlack,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  ctaText: {
    color: Colors.pureWhite,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginRight: 10,
  },
});

export default UserPropertyListScreen;
