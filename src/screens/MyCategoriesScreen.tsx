import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";

import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import NewProductCard from "../components/NewProductCard11";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";

const Colors = {
  starbucksGreen: "#0A3D2B",
  textDarkBrown: "#4A2C2A",
  textLight: "#FFFFFF",
  backgroundWhite: "#F8F5F0",
  borderGray: "#DDDDDD",
};

const ALL_CATEGORIES_NAME = "All Categories";
const ALL_CATEGORIES_PATH = "ALL_CATEGORIES_DUMMY_PATH";

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getCategoryDisplayName = (name) => {
  if (name === ALL_CATEGORIES_PATH) return ALL_CATEGORIES_NAME;
  const parts = name.split("_");
  let label = parts.length > 1 ? parts[parts.length - 1] : name;
  return label.length > 8 ? label.substring(0, 8) + "..." : label;
};

const shuffleArray = (array) => {
  let newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// --- Floating Cart Bar ---
const FloatingCartBar = ({ cartItems }) => {
  const navigation = useNavigation();
  const getEffectivePrice = (product, qty) => {
    let price = product.discountedPrice || product.price || 0;
    if (product.largeQuantityPrice && qty >= product.largeQuantityMinimumUnits)
      price = product.largeQuantityPrice;
    return price;
  };

  const total = useMemo(() => {
    const subtotal = cartItems.reduce(
      (sum, item) =>
        sum +
        getEffectivePrice(item.productId || {}, item.quantity) * item.quantity,
      0,
    );
    return subtotal + subtotal * 0.03 + subtotal * 0.05; // Platform + GST
  }, [cartItems]);

  return (
    <View style={mergedStyles.floatingCartBar}>
      <View style={mergedStyles.floatingCartTextContainer}>
        <Text style={mergedStyles.floatingCartLabel}>
          {cartItems.length} {cartItems.length > 1 ? "Items" : "Item"}
        </Text>
        <Text style={mergedStyles.floatingCartPrice}>₹{total.toFixed(2)}</Text>
      </View>
      <TouchableOpacity
        style={mergedStyles.floatingCartButton}
        onPress={() => navigation.navigate("CartScreen")}
      >
        <Text style={mergedStyles.floatingCartButtonText}>View Cart</Text>
      </TouchableOpacity>
    </View>
  );
};

const MyCategoriesScreen = () => {
  const dispatch = useDispatch();
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES_PATH);
  const [sortOrder, setSortOrder] = useState("default_shuffled");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shuffleIndex, setShuffleIndex] = useState(0);

  const { location: userLocation, loading: isLocLoading } = useSelector(
    (state) => state.location,
  );
  const { allProducts, loading: prodLoading } = useSelector(
    (state) => state.vendorProducts,
  );
  const { allVendors, loading: vendLoading } = useSelector(
    (state) => state.vendorAuth,
  );
  const cartItems = useSelector((state) => state.cart.items);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchAllVendors()),
        dispatch(fetchAllVendorProducts()),
      ]);
      setShuffleIndex((v) => v + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (!allVendors?.length) fetchData();
  }, []);

  const vendorMap = useMemo(() => {
    const map = {};
    allVendors?.forEach((v) => (map[v._id] = v));
    return map;
  }, [allVendors]);

  const filteredProducts = useMemo(() => {
    let products =
      allProducts?.filter((p) => {
        const v = vendorMap[p.vendorId];
        if (!v || !v.isOnline || !userLocation) return false;
        const dist = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          v.address.latitude,
          v.address.longitude,
        );
        return dist <= (v.deliveryRange || 10);
      }) || [];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    if (selectedCategory !== ALL_CATEGORIES_PATH) {
      products = products.filter((p) => p.category === selectedCategory);
    }

    if (sortOrder === "default_shuffled") products = shuffleArray(products);
    else {
      products.sort((a, b) => {
        const pA = a.discountedPrice || a.price || 0;
        const pB = b.discountedPrice || b.price || 0;
        return sortOrder === "asc" ? pA - pB : pB - pA;
      });
    }
    return products;
  }, [
    allProducts,
    vendorMap,
    userLocation,
    searchQuery,
    selectedCategory,
    sortOrder,
    shuffleIndex,
  ]);

  const uniqueCategories = useMemo(() => {
    const map = new Map();
    allProducts?.forEach((p) => {
      if (p.category && !map.has(p.category))
        map.set(p.category, p.images?.[0]);
    });
    const list = Array.from(map, ([name, img]) => ({
      name,
      imageUrl: img || "https://via.placeholder.com/150",
    }));
    list.unshift({
      name: ALL_CATEGORIES_PATH,
      imageUrl: allProducts?.[0]?.images?.[0] || "https://via.placeholder.com/150",
    });
    return list;
  }, [allProducts]);

  const renderProductCard = ({ item }) => (
    <View style={styles.singleRowContainer}>
      <NewProductCard
        product={item}
        vendorShopName={vendorMap[item.vendorId]?.shopName || "Store"}
        isVendorOffline={!vendorMap[item.vendorId]?.isOnline}
        cardStyle={{ width: "100%" }}
      />
    </View>
  );

  const ListHeader = () => (
    <View style={{ backgroundColor: Colors.backgroundWhite }}>
      <View style={styles.horizontalBarContainer}>
        <FlatList
          horizontal
          data={uniqueCategories}
          keyExtractor={(item) => item.name}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryItem,
                selectedCategory === item.name && styles.activeCategoryItem,
              ]}
              onPress={() => setSelectedCategory(item.name)}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.categoryImage}
              />
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item.name && styles.activeCategoryText,
                ]}
              >
                {getCategoryDisplayName(item.name)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#666"
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, sortOrder === "asc" && styles.activeFilter]}
          onPress={() => setSortOrder("asc")}
        >
          <Text
            style={[
              styles.filterBtnText,
              sortOrder === "asc" && { color: "#FFF" },
            ]}
          >
            Price: Low to High
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            sortOrder === "desc" && styles.activeFilter,
          ]}
          onPress={() => setSortOrder("desc")}
        >
          <Text
            style={[
              styles.filterBtnText,
              sortOrder === "desc" && { color: "#FFF" },
            ]}
          >
            Price: High to Low
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if ((prodLoading || vendLoading) && !isRefreshing) {
    return (
      <ActivityIndicator
        size="large"
        color={Colors.starbucksGreen}
        style={{ flex: 1 }}
      />
    );
  }

  const hasCart = Object.keys(cartItems).length > 0;

  return (
    <SafeAreaView style={mergedStyles.mainContainer}>
      <FlatList
        ListHeaderComponent={ListHeader}
        data={filteredProducts}
        renderItem={renderProductCard}
        keyExtractor={(item) => item._id}
        numColumns={1} // SINGLE ROW
        key={`single-col-${shuffleIndex}`}
        contentContainerStyle={{ paddingBottom: hasCart ? 120 : 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={fetchData}
            tintColor={Colors.starbucksGreen}
          />
        }
      />
      {/* {hasCart && <FloatingCartBar cartItems={Object.values(cartItems)} />} */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  horizontalBarContainer: {
    paddingTop: 40,
    paddingVertical: 15,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  categoryItem: { alignItems: "center", marginHorizontal: 12 },
  activeCategoryItem: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.starbucksGreen,
  },
  categoryImage: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  categoryText: { fontSize: 10, color: "#444" },
  activeCategoryText: { fontWeight: "bold", color: Colors.starbucksGreen },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    margin: 2,
    paddingHorizontal: 15,
    height: 45,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  searchInput: { flex: 1, fontSize: 14 },

  filterRow: { flexDirection: "row", paddingHorizontal: 15, paddingBottom: 1 },
  filterBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    alignItems: "center",
    marginHorizontal: 4,
  },
  activeFilter: {
    backgroundColor: Colors.starbucksGreen,
    borderColor: Colors.starbucksGreen,
  },
  filterBtnText: { fontSize: 12, color: "#444" },

  singleRowContainer: {
    width: "100%",
    paddingHorizontal: 10,
    marginBottom: 15,
  },
});

const mergedStyles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: Colors.backgroundWhite },
  floatingCartBar: {
    position: "absolute",
    bottom: 25,
    left: 20,
    right: 20,
    backgroundColor: Colors.starbucksGreen,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    elevation: 10,
    shadowOpacity: 0.3,
  },
  floatingCartTextContainer: { flex: 1 },
  floatingCartLabel: { color: "#FFF", opacity: 0.8 },
  floatingCartPrice: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  floatingCartButton: {
    backgroundColor: "#FFF",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
  },
  floatingCartButtonText: { color: Colors.starbucksGreen, fontWeight: "bold" },
});

export default MyCategoriesScreen;