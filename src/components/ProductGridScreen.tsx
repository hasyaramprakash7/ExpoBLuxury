import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

// Get screen width for responsive sizing
const { width } = Dimensions.get("window");

// A component for the brand logo banner
const BrandBanner = ({ brandLogo }) => {
  return (
    <View style={styles.brandLogoWrapper}>
      <Image
        source={brandLogo}
        style={styles.brandImage}
        resizeMode="contain"
      />
    </View>
  );
};

// --- New Discount Banner Component ---
const DiscountBanner = () => {
  return (
    <View style={styles.discountBannerContainer}>
      <Text style={styles.discountBannerText}>🎉 Congratulations! 🎉</Text>
      <Text style={styles.discountBannerSubText}>
        A recent appointment has been converted into a live policy. You've
        earned a 10% reward on your account!
      </Text>
    </View>
  );
};
// --- End New Discount Banner Component ---

const ProductGridScreen = ({
  uniqueCategories,
  selectedCategory,
  setSelectedCategory,
  filteredProducts,
  userAppointments,
  brandLogo,
  showDiscountBanner, // Add this new prop
}) => {
  const navigation = useNavigation();

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.leftPanelItem,
        selectedCategory === item.name && styles.selectedLeftPanelItem,
      ]}
      onPress={() => setSelectedCategory(item.name)}
    >
      <Image
        source={{ uri: item.imageUrl || "https://via.placeholder.com/150" }}
        style={styles.leftPanelImage}
      />
      <Text
        style={[
          styles.leftPanelText,
          selectedCategory === item.name && styles.selectedLeftPanelText,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item: product }) => (
    <View style={styles.productItemWrapper}>
      <TouchableOpacity
        style={styles.productCard}
        onPress={() =>
          navigation.navigate("ProductDetailScreen", { productId: product._id })
        }
      >
        {product.mainImage && (
          <Image
            source={{ uri: product.mainImage }}
            style={styles.productImage}
          />
        )}
        {product.badgeText && product.badgeText !== "N/A" && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.badgeText}</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{product.name}</Text>
          <Text style={styles.cardDescription}>{product.description}</Text>
        </View>
        <View style={styles.cardDetails}>
          {product.categories?.level1?.name && (
            <Text style={styles.cardCategory}>
              <Text style={styles.cardDetailLabel}>Category:</Text>
              {` ${product.categories.level1.name} / ${product.categories.level2.name}`}
            </Text>
          )}
          {product.contactNumber && (
            <Text style={styles.cardContact}>
              <Text style={styles.cardDetailLabel}>Contact:</Text>{" "}
              {product.contactNumber}
            </Text>
          )}
          {product.options && (
            <View style={styles.cardFeatures}>
              {product.options.isNew && (
                <Text style={styles.featureBadgeSmallNew}>✨ New</Text>
              )}
              {product.options.isPopular && (
                <Text style={styles.featureBadgeSmallPopular}>🔥 Popular</Text>
              )}
              {product.options.isAwardWinning && (
                <Text style={styles.featureBadgeSmallAward}>
                  🏆 Award-Winning
                </Text>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() =>
            navigation.navigate("ProductDetailScreen", {
              productId: product._id,
            })
          }
        >
          <Text style={styles.viewDetailsButtonText}>View Details</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );

  const renderAppointmentItem = ({ item: appointment }) => (
    <View style={styles.appointmentCard}>
      {appointment.insuranceProductId?.mainImage && (
        <Image
          source={{ uri: appointment.insuranceProductId.mainImage }}
          style={styles.appointmentImage}
        />
      )}
      <View>
        <Text style={styles.appointmentProductName}>
          Product: {appointment.insuranceProductId?.name || "N/A"}
        </Text>
        <Text style={styles.appointmentVendorName}>
          Vendor: {appointment.vendorId?.name || "N/A"}
        </Text>
        <Text style={styles.appointmentDate}>
          Date: {new Date(appointment.createdAt).toLocaleString()}
        </Text>
        <Text style={styles.appointmentStatus}>
          Status:
          <Text
            style={[
              styles.statusBadge,
              appointment.status === "scheduled"
                ? styles.scheduledBadge
                : styles.completedBadge,
            ]}
          >
            {` ${appointment.status || "N/A"}`}
          </Text>
        </Text>
      </View>
    </View>
  );

  // --- Updated Header Function ---
  const renderHeader = () => {
    // Check if the discount banner should be shown first
    if (showDiscountBanner) {
      return <DiscountBanner />;
    }

    // Only render the brand banner if a product category is selected and it's not "My Appointments"
    if (
      selectedCategory &&
      selectedCategory !== "My Appointments" &&
      brandLogo
    ) {
      return <BrandBanner brandLogo={brandLogo} />;
    }

    return null;
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.leftPanel}>
        <Text style={styles.panelTitle}>Categories</Text>
        {uniqueCategories.length > 0 ? (
          <FlatList
            data={uniqueCategories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.name}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <Text style={styles.noDataText}>No categories found.</Text>
        )}
      </View>

      <View style={styles.rightPanel}>
        <Text style={styles.panelTitle}>{selectedCategory || "Products"}</Text>
        {selectedCategory === "My Appointments" ? (
          userAppointments.length > 0 ? (
            <FlatList
              key="appointments-list"
              data={userAppointments}
              keyExtractor={(item) => item._id}
              renderItem={renderAppointmentItem}
              contentContainerStyle={styles.scrollableContent}
            />
          ) : (
            <View style={styles.noAppointmentsContainer}>
              <Text style={styles.noAppointmentsText}>
                You have no scheduled appointments.
              </Text>
            </View>
          )
        ) : filteredProducts.length > 0 ? (
          <FlatList
            key="products-list"
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{
              ...styles.scrollableContent,
              paddingBottom: 150,
            }}
            scrollEnabled={true}
            ListHeaderComponent={renderHeader}
          />
        ) : (
          <Text style={styles.noDataText}>
            No products found in this category.
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F8F5F0",
  },
  leftPanel: {
    width: "30%",
    backgroundColor: "#F8F5F0",
    borderRightWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: "#F8F5F0",
    padding: 10,
    paddingBottom: 30,
  },
  scrollableContent: {
    flexGrow: 1,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
    textAlign: "center",
  },
  leftPanelItem: {
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  selectedLeftPanelItem: {
    backgroundColor: "#f3f4f6",
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  leftPanelImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    resizeMode: "contain",
  },
  leftPanelText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 5,
    color: "#4b5563",
  },
  selectedLeftPanelText: {
    color: "#3b82f6",
  },
  noDataText: {
    textAlign: "center",
    marginTop: 20,
    color: "#9ca3af",
  },
  productItemWrapper: {
    width: "100%",
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flex: 1,
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: 150,
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#202329ff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },
  cardDetails: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  cardCategory: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 2,
  },
  cardContact: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 2,
  },
  cardDetailLabel: {
    fontWeight: "500",
  },
  cardFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  featureBadgeSmallNew: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#22c55e",
  },
  featureBadgeSmallPopular: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#eab308",
  },
  featureBadgeSmallAward: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#4f46e5",
  },
  viewDetailsButton: {
    backgroundColor: "#0A3D2B",
    paddingVertical: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  viewDetailsButtonText: {
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
  },
  noAppointmentsContainer: {
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  noAppointmentsText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
  appointmentCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  appointmentImage: {
    width: 60,
    height: 60,
    resizeMode: "cover",
    borderRadius: 8,
    marginRight: 16,
  },
  appointmentProductName: {
    fontWeight: "600",
    color: "#1f2937",
  },
  appointmentVendorName: {
    fontSize: 14,
    color: "#6b7280",
  },
  appointmentDate: {
    fontSize: 12,
    color: "#9ca3af",
  },
  appointmentStatus: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  statusBadge: {
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    overflow: "hidden",
  },
  scheduledBadge: {
    backgroundColor: "#e0f2fe",
    color: "#1e40af",
  },
  completedBadge: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
  },
  // --- New Styles for the Discount Banner ---
  discountBannerContainer: {
    backgroundColor: "#d1fae5", // A light green background
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  discountBannerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#065f46", // Dark green text
    textAlign: "center",
    marginBottom: 4,
  },
  discountBannerSubText: {
    fontSize: 14,
    color: "#1f2937",
    textAlign: "center",
    lineHeight: 20,
  },
  // --- Updated Styles for the Brand Banner ---
  brandLogoWrapper: {
    height: 100,
    width: "100%",
    marginTop: 40,
    marginBottom: 46,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  brandImage: {
    width: "100%",

    resizeMode: "contain",
  },
});

export default ProductGridScreen;
