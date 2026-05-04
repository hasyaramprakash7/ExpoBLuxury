import React, { useMemo, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Animated,
  Platform,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { fetchUserAppointments } from "../features/appointmentSlice";

// --- Type Definitions (Passed down as Props) ---
interface InsuranceProduct {
  _id: string;
  name: string;
  description: string;
  mainImage?: string;
  categories?: {
    level1: { name: string };
  };
  shortDescription?: string;
}

interface Appointment {
  _id: string;
  insuranceProductId?: {
    _id: string;
    name: string;
    mainImage?: string;
  };
  vendorId?: {
    name: string;
  };
  createdAt: string;
}

interface CategoryItem {
  name: string | "My Appointments";
  imageUrl?: string;
}

interface ProductGridScreenProps {
  uniqueCategories: CategoryItem[];
  selectedCategory: string | "My Appointments" | null;
  setSelectedCategory: (category: string | "My Appointments" | null) => void;
  filteredProducts: InsuranceProduct[];
  userAppointments: Appointment[];
  brandLogo: any; // Type for image import
}

// --- Constants ---
const Colors = {
  brandGreen: "#0A3D2B",
  textDark: "#1F2937",
  textLight: "#FFFFFF",
  backgroundWhite: "#F8F5F0",
  borderGray: "#DDDDDD",
  placeholderGray: "#E0E0E0",
  pendingBackground: "#FFFBEB",
  pendingText: "#B45309",
  subtleText: "#6B7280",
  cardBackground: "#ffffffff",
};

// **Helper function** to format category names
const getCategoryName = (fullCategoryName: string): string => {
  const parts = fullCategoryName.split("_");
  let categoryPart = fullCategoryName;
  if (parts.length > 1) {
    categoryPart = parts[parts.length - 1];
  }

  const MAX_LENGTH = 7;
  if (categoryPart.length > MAX_LENGTH && categoryPart !== "My Appointments") {
    return categoryPart.substring(0, MAX_LENGTH) + "...";
  }

  return categoryPart;
};

// --- Product/Appointment Card Component (Grid Item) ---
const CardItem = ({
  item,
  isAppointment,
}: {
  item: InsuranceProduct | Appointment;
  isAppointment: boolean;
}) => {
  const navigation = useNavigation<any>();

  let title, imageUri, shortInfo, id;
  let isPending = false;

  if (isAppointment) {
    const appointment = item as Appointment;
    const product = appointment.insuranceProductId;

    isPending = !product?.name;

    title = product?.name || "Processing Request";
    imageUri = product?.mainImage || "";
    shortInfo = appointment.vendorId?.name
      ? `with ${appointment.vendorId.name}`
      : "Vendor Assigned";
    id = appointment._id;
  } else {
    const product = item as InsuranceProduct;
    title = product.name;
    imageUri = product.mainImage || "";

    if (product.shortDescription) {
      shortInfo = product.shortDescription;
    } else if (product.description) {
      const firstLine = product.description.split("\n")[0].trim();
      shortInfo =
        firstLine.length > 50 ? firstLine.substring(0, 47) + "..." : firstLine;
      if (shortInfo.length < 5) shortInfo = "Comprehensive Coverage";
    } else {
      shortInfo = "Explore Key Benefits";
    }

    id = product._id;
  }

  const finalImageUri =
    imageUri.length > 0
      ? { uri: imageUri }
      : require("../../assets/Gemini_Generated_Image_qpem77qpem77qpem.png");

  const navigateToDetails = () => {
    if (isAppointment) {
      console.log("Navigating to Appointment Details:", id);
      // navigation.navigate("AppointmentDetailScreen", { appointmentId: id });
    } else {
      navigation.navigate("ProductDetailScreen", { productId: id });
    }
  };

  const formattedDate = isAppointment
    ? new Date((item as Appointment).createdAt).toLocaleDateString()
    : "";

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={navigateToDetails}>
      <View
        style={[
          styles.cardImageWrapper,
          !imageUri && { backgroundColor: Colors.placeholderGray },
        ]}
      >
        {imageUri.length > 0 ? (
          <Image source={finalImageUri} style={styles.cardImage} />
        ) : (
          <Ionicons
            name="image-outline"
            size={40}
            color={Colors.borderGray}
            style={styles.imagePlaceholderIcon}
          />
        )}

        {isAppointment && (
          <View style={styles.appointmentBadge}>
            <Text style={styles.appointmentBadgeText}>APPOINTMENT</Text>
          </View>
        )}
      </View>
      <View style={styles.cardTextContent}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          {isPending && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>PENDING</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardShortInfo} numberOfLines={1}>
          {shortInfo}
        </Text>

        {isAppointment && formattedDate.length > 0 && (
          <Text style={styles.cardDate}>{formattedDate}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// --- Main Component ---
const ProductGridScreen: React.FC<ProductGridScreenProps> = ({
  uniqueCategories,
  selectedCategory,
  setSelectedCategory,
  filteredProducts,
  userAppointments,
  brandLogo,
}) => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const animatedValue = useRef(new Animated.Value(0)).current;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const animateContentIn = useCallback(() => {
    animatedValue.setValue(0);
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [animatedValue]);

  React.useEffect(() => {
    if (selectedCategory) {
      animateContentIn();
    }
  }, [selectedCategory, animateContentIn]);

  const handleRefresh = useCallback(async () => {
    if (selectedCategory === "My Appointments") {
      setIsRefreshing(true);
      try {
        await dispatch(fetchUserAppointments() as any).unwrap();
      } catch (error) {
        console.error("Failed to refresh appointments:", error);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [dispatch, selectedCategory]);

  const numColumns = useMemo(() => {
    return 3;
  }, []);

  const displayItems = useMemo(() => {
    if (selectedCategory === "My Appointments") {
      return userAppointments.filter((app) => app.insuranceProductId?._id);
    }
    return filteredProducts;
  }, [selectedCategory, filteredProducts, userAppointments]);

  const renderGridItem = ({
    item,
  }: {
    item: InsuranceProduct | Appointment;
  }) => {
    const isAppointment = selectedCategory === "My Appointments";
    return (
      <View style={styles.productCardContainer}>
        <CardItem item={item} isAppointment={isAppointment} />
      </View>
    );
  };

  const flatListKey = `grid-list-key-${numColumns}-${selectedCategory}`;

  const animatedStyle = {
    opacity: animatedValue,
    transform: [
      {
        translateY: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [50, 0],
        }),
      },
    ],
  };

  const isAppointmentScreen = selectedCategory === "My Appointments";

  return (
    <View style={mergedStyles.mainContainer}>
      <SafeAreaView style={mergedStyles.safeArea}>
        {/* Standard Navigation Header (Top) */}
       

        {/* --- Parent Container for Category Bar and List (Holds the Single Background Image) --- */}
        <View style={styles.scrollableArea}>
          {/* ABSOLUTE POSITIONED LOGO AS CLEAR BACKGROUND (Spans Category + List) */}
          <Image
            source={brandLogo}
            style={styles.backgroundLogo}
            resizeMode="cover"
          />

          {/* --- Horizontal Category Bar --- */}
          <View style={styles.horizontalBarContainer}>
            <FlatList
              horizontal
              data={uniqueCategories}
              keyExtractor={(item) => item.name}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalListContainer}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    selectedCategory === item.name && styles.activeCategoryItem,
                  ]}
                  onPress={() => setSelectedCategory(item.name)}
                >
                  <Image
                    source={{
                      uri: item.imageUrl || "https://via.placeholder.com/150",
                    }}
                    style={styles.categoryImage}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === item.name &&
                        styles.activeCategoryText,
                    ]}
                  >
                    {item.name === "My Appointments"
                      ? "My Appointments"
                      : getCategoryName(item.name)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Main Content Wrapper (Product List) */}
          <View style={styles.contentWrapper}>
            <Animated.View style={[styles.rightPanelFullWidth, animatedStyle]}>
              {/* Product/Appointment List */}
              {displayItems.length > 0 ? (
                <FlatList
                  key={flatListKey}
                  data={displayItems}
                  renderItem={renderGridItem}
                  keyExtractor={(item) => item._id}
                  numColumns={numColumns}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.productListContainer}
                  refreshControl={
                    isAppointmentScreen ? (
                      <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={Colors.brandGreen}
                        colors={[Colors.brandGreen]}
                      />
                    ) : undefined
                  }
                />
              ) : (
                <Text style={mergedStyles.noResultsText}>
                  {selectedCategory === "My Appointments"
                    ? "You have no scheduled appointments. Book one now!"
                    : `No products found for the '${selectedCategory}' category.`}
                </Text>
              )}
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

// --- STYLES ---

const cardStyles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardImageWrapper: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
    backgroundColor: Colors.placeholderGray,
    justifyContent: "center",
    alignItems: "center",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholderIcon: {
    position: "absolute",
    opacity: 0.5,
  },
  appointmentBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: Colors.brandGreen,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  appointmentBadgeText: {
    fontSize: 8,
    fontWeight: "bold",
    color: Colors.textLight,
  },
  cardTextContent: {
    padding: 8,
    minHeight: 50,
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textDark,
    flexShrink: 1,
    marginRight: 5,
  },
  cardShortInfo: {
    fontSize: 10,
    color: Colors.subtleText,
    fontWeight: "500",
    marginTop: 4,
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 9,
    fontWeight: "600",
    color: Colors.brandGreen,
  },
  pendingBadge: {
    backgroundColor: Colors.pendingBackground,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  pendingBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.pendingText,
  },
});

const styles = StyleSheet.create({
  ...cardStyles,

  // --- New parent container for background stretching ---
  scrollableArea: {
    flex: 1,
    position: 'relative', // CRUCIAL: Must be relative for absolute children to position correctly
    width: '100%', // Ensures full width
    height: '100%', // Ensures full height (of the area below the header)
  },

  // --- SINGLE BACKGROUND LOGO STYLES (Applies to scrollableArea) ---
  backgroundLogo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 1, 
    resizeMode: "cover", 
    height: "100%",
    width:"100%"
    // width and height are handled by absolute positioning covering the entire parent (scrollableArea)
  },
  // --- END SINGLE BACKGROUND LOGO STYLES ---

  contentWrapper: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "transparent", 
  },
  horizontalBarContainer: {
    paddingVertical: 8,
    backgroundColor: "transparent", // Transparent to show background image
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  horizontalListContainer: {
    paddingHorizontal: 1,
    backgroundColor: "transparent", 
  },
  categoryItem: {
    alignItems: "center",
    marginHorizontal: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.cardBackground, 
    borderRadius: 8,
  },
  activeCategoryItem: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.brandGreen,
  },
  categoryImage: {
    width: 60,
    height: 50,
    borderRadius: 8,
    resizeMode: "cover",
    marginBottom: 3,
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    color: Colors.textDark,
  },
  activeCategoryText: {
    fontWeight: "bold",
    color: Colors.brandGreen,
  },
  rightPanelFullWidth: {
    flex: 1,
    backgroundColor: "transparent", 
  },
  productListContainer: {
    paddingHorizontal: 5,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 100 : 150,
    backgroundColor: "transparent", 
  },
  productCardContainer: {
    flex: 1 / 3,
    marginHorizontal: 5,
    marginBottom: 10,
  },
});

const mergedStyles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: Colors.backgroundWhite,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  title: {
    paddingTop: 5,
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.brandGreen,
    textAlign: "center",
  },
  noResultsText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
    fontWeight: "500",
    color: Colors.textDark,
    width: "100%",
    paddingHorizontal: 20,
    backgroundColor: Colors.textLight,
    padding: 20,
    borderRadius: 8,
  },
});

export default ProductGridScreen;