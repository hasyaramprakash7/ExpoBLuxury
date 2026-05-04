import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useRoute, useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as WebBrowser from "expo-web-browser";
import { fetchPropertyById } from "../features/propertySlice";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import { RootState } from "../app/store";

const { width } = Dimensions.get("window");

const Colors = {
  royalNavy: "#0B1021",
  champagneGold: "#D4AF37",
  offWhite: "#F8F9FA",
  pureWhite: "#FFFFFF",
  charcoal: "#2D3748",
  slate: "#64748B",
  lightBorder: "#EAEAEA",
  whatsapp: "#25D366",
};

interface RouteParams {
  propertyId: string;
}

const PropertyDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<any>();

  if (!route.params || !("propertyId" in route.params)) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Navigation Error: Property ID missing.
        </Text>
      </View>
    );
  }

  const { propertyId } = route.params as RouteParams;
  const dispatch = useDispatch();

  const {
    currentProperty,
    loading: propertyLoading,
    error,
  } = useSelector((state: RootState) => state.property);
  const { allVendors } = useSelector((state: RootState) => state.vendorAuth);

  useEffect(() => {
    if (propertyId) {
      dispatch(fetchPropertyById(propertyId) as any);
    }
    if (allVendors.length === 0) {
      dispatch(fetchAllVendors() as any);
    }
  }, [dispatch, propertyId, allVendors.length]);

  if (propertyLoading || !currentProperty) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.champagneGold} />
        <Text style={styles.loadingText}>Retrieving Estate Details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // DYNAMIC PRICING LOGIC (Lakhs & Crores)
  const unitLabel = currentProperty.priceUnit === "Lakhs" ? "Lakhs" : "Cr";
  const minVal = currentProperty.minPriceValue ?? currentProperty.minPriceCr;
  const maxVal =
    currentProperty.maxPriceValue ?? currentProperty.maxPriceCr ?? minVal;

  const isFixedPrice = minVal === maxVal;
  const displayPrice = isFixedPrice
    ? `₹${minVal} ${unitLabel}`
    : `₹${minVal} - ${maxVal} ${unitLabel}`;

  const formattedPossessionDate = new Date(
    currentProperty.possessionDate,
  ).toLocaleDateString("en-IN", { year: "numeric", month: "long" });
  const areaSqFt = currentProperty.areaOptions?.[0]?.superBuiltUpSqFt || "N/A";
  const ratePerSqFt = currentProperty.areaOptions?.[0]?.ratePerSqFt || "N/A";

  const config = currentProperty.configuration;
  const floorDisplay = config?.propertyFloor
    ? `Floor ${config.propertyFloor} of ${config.totalFloors}`
    : `${config.totalFloors} Floors`;

  const loc = currentProperty.location;
  const fullPropertyAddress = [
    loc?.address,
    loc?.locality,
    loc?.city,
    loc?.state,
    loc?.zipCode,
    loc?.country,
  ]
    .filter(Boolean)
    .join(", ");

  const handleOpenMap = () => {
    if (loc?.mapUrl) {
      Linking.openURL(loc.mapUrl).catch((err) =>
        console.error("Couldn't open map URL", err),
      );
      return;
    }

    const hasCoords =
      Array.isArray(loc?.coordinates?.coordinates) &&
      loc.coordinates.coordinates.length === 2;

    if (hasCoords) {
      const lng = loc.coordinates.coordinates[0];
      const lat = loc.coordinates.coordinates[1];
      const label = encodeURIComponent(
        currentProperty.title || "Property Location",
      );

      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${label})`,
      });

      Linking.canOpenURL(url as string).then((supported) => {
        if (supported) {
          return Linking.openURL(url as string);
        } else {
          return Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          );
        }
      });
    } else {
      const query = encodeURIComponent(fullPropertyAddress);
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${query}`,
      );
    }
  };

  const vendorId = currentProperty.vendor?.vendorId;
  const fullVendorDetails = allVendors.find((v) => v._id === vendorId);

  const displayPhone =
    fullVendorDetails?.phone || currentProperty.vendor?.phone;
  const displayShopName =
    fullVendorDetails?.shopName ||
    currentProperty.vendor?.shopName ||
    "Exclusive Seller";
  const displayVendorName =
    fullVendorDetails?.name || currentProperty.vendor?.name;
  const displayAvatar =
    fullVendorDetails?.shopImage ||
    currentProperty.vendor?.shopImage ||
    "https://via.placeholder.com/150";

  let displayAddress = "Address available upon request";
  if (fullVendorDetails?.address) {
    if (typeof fullVendorDetails.address === "string") {
      displayAddress = fullVendorDetails.address;
    } else {
      const { street, city, state, zip } = fullVendorDetails.address as any;
      displayAddress = [street, city, state, zip].filter(Boolean).join(", ");
    }
  }

  const openUrl = async (url?: string) => {
    if (url) {
      try {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          toolbarColor: Colors.royalNavy,
          controlsColor: Colors.champagneGold,
        });
      } catch (err) {
        console.error("Couldn't open link", err);
      }
    }
  };

  const handleCall = () => {
    if (displayPhone) Linking.openURL(`tel:${displayPhone}`);
  };

  const handleWhatsApp = () => {
    if (displayPhone) {
      const message = `Hello, I am interested in your property: "${currentProperty.title}" listed on BLuxury.`;
      Linking.openURL(
        `whatsapp://send?phone=${displayPhone}&text=${encodeURIComponent(message)}`,
      );
    }
  };

  const hasTags = Boolean(
    currentProperty.tags && currentProperty.tags.length > 0,
  );
  const hasAmenitiesOrHighlights = Boolean(
    currentProperty.projectHighlights?.length > 0 ||
    currentProperty.amenities?.length > 0,
  );
  const hasExternalLinks = Boolean(
    currentProperty.websiteUrl || currentProperty.virtualTourUrl,
  );

  return (
    <View style={styles.mainWrapper}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.imageWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {currentProperty.images && currentProperty.images.length > 0 ? (
              currentProperty.images.map((imgUri, index) => (
                <Image
                  key={index}
                  source={{ uri: imgUri }}
                  style={styles.carouselImage}
                />
              ))
            ) : (
              <Image
                source={{ uri: "https://via.placeholder.com/600x500" }}
                style={styles.carouselImage}
              />
            )}
          </ScrollView>
          <View style={styles.imageDarkGradient} />

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={26} color={Colors.pureWhite} />
          </TouchableOpacity>
          <View style={styles.imageIndicatorContainer}>
            <Ionicons
              name="camera-outline"
              size={14}
              color={Colors.pureWhite}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.imageIndicatorText}>
              1 / {currentProperty.images?.length || 1}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.headerInfo}>
            <View style={styles.tagRow}>
              <Text style={styles.propertyTypeTag}>
                {currentProperty.propertyType}
              </Text>
              <Text style={styles.statusTag}>{currentProperty.status}</Text>
            </View>
            <Text style={styles.title}>{currentProperty.title}</Text>
            <Text style={styles.locationSubText}>
              <Ionicons
                name="location-sharp"
                size={16}
                color={Colors.champagneGold}
              />{" "}
              {currentProperty.location.locality},{" "}
              {currentProperty.location.city}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceTag}>{displayPrice}</Text>
            <Text style={styles.rateText}>₹{ratePerSqFt} per sq.ft</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Estate Overview</Text>
          <View style={styles.detailsGrid}>
            <DetailBox
              icon="bed-outline"
              label={config?.bhk}
              subtitle="Configuration"
            />

            {config?.bathrooms ? (
              <DetailBox
                icon="water-outline"
                label={`${config.bathrooms} Baths`}
                subtitle="Bathrooms"
              />
            ) : null}

            {config?.balconies ? (
              <DetailBox
                icon="albums-outline"
                label={`${config.balconies} Balconies`}
                subtitle="Balconies"
              />
            ) : null}

            <DetailBox
              icon="scan-outline"
              label={`${areaSqFt} Sq.Ft`}
              subtitle="Super Area"
            />
            <DetailBox
              icon="business-outline"
              label={floorDisplay}
              subtitle="Level"
            />
            <DetailBox
              icon="car-outline"
              label={config?.carParkingAvailable ? "Available" : "None"}
              subtitle="Parking"
            />
            <DetailBox
              icon="compass-outline"
              label={config?.facing || "N/A"}
              subtitle="Facing"
            />
            <DetailBox
              icon="cube-outline"
              label={config?.furnishingStatus || "Unfurnished"}
              subtitle="Furnishing"
            />
            <DetailBox
              icon="document-text-outline"
              label={config?.ownershipType || "Freehold"}
              subtitle="Ownership"
            />
            <DetailBox
              icon="key-outline"
              label={formattedPossessionDate}
              subtitle="Possession"
            />
          </View>

          {/* LOCATION */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeader}>Location & Map</Text>
          <View style={styles.locationBox}>
            <View style={styles.locationTextContainer}>
              <Ionicons
                name="location"
                size={24}
                color={Colors.champagneGold}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.fullAddressText}>{fullPropertyAddress}</Text>
            </View>
            <TouchableOpacity style={styles.mapButton} onPress={handleOpenMap}>
              <Ionicons name="map-outline" size={18} color={Colors.pureWhite} />
              <Text style={styles.mapButtonText}>View on Map</Text>
            </TouchableOpacity>
          </View>

          {hasTags ? (
            <View style={styles.tagsContainer}>
              {currentProperty.tags?.map((tag, index) => (
                <View key={index} style={styles.tagPill}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {hasAmenitiesOrHighlights ? (
            <>
              <Text style={[styles.sectionHeader, { marginTop: 16 }]}>
                Premium Amenities
              </Text>
              <View style={styles.highlightsContainer}>
                {currentProperty.amenities?.map((amenity, index) => (
                  <View key={`am_${index}`} style={styles.highlightItem}>
                    <View style={styles.goldDot} />
                    <Text style={styles.highlightText}>{amenity}</Text>
                  </View>
                ))}
                {currentProperty.projectHighlights?.map((highlight, index) => (
                  <View key={`hl_${index}`} style={styles.highlightItem}>
                    <View style={styles.goldDot} />
                    <Text style={styles.highlightText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.divider} />
          <Text style={styles.sectionHeader}>Legal & Financials</Text>
          <View style={styles.legalBox}>
            <View style={styles.legalRow}>
              <Text style={styles.legalLabel}>Registration / RERA ID</Text>
              <Text style={styles.legalValue}>
                {currentProperty.registrationId || "Pending / Exempt"}
              </Text>
            </View>
            <View
              style={[
                styles.legalRow,
                { borderBottomWidth: 0, paddingBottom: 0 },
              ]}
            >
              <Text style={styles.legalLabel}>Maintenance Charges</Text>
              <Text style={styles.legalValue}>
                {currentProperty.maintenanceCharges
                  ? `₹ ${currentProperty.maintenanceCharges} / Month`
                  : "Not Specified"}
              </Text>
            </View>
          </View>

          {hasExternalLinks ? (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.sectionHeader}>Media & Links</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {currentProperty.virtualTourUrl ? (
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => openUrl(currentProperty.virtualTourUrl)}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={20}
                      color={Colors.royalNavy}
                    />
                    <Text style={styles.linkButtonText}>3D Virtual Tour</Text>
                  </TouchableOpacity>
                ) : null}

                {currentProperty.websiteUrl ? (
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => openUrl(currentProperty.websiteUrl)}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={20}
                      color={Colors.royalNavy}
                    />
                    <Text style={styles.linkButtonText}>Project Website</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Exclusive Seller</Text>
          <View style={styles.sellerCard}>
            <View style={styles.sellerHeaderRow}>
              <Image
                source={{ uri: displayAvatar }}
                style={styles.sellerAvatar}
              />
              <View style={styles.sellerNameContainer}>
                <Text style={styles.sellerShopName} numberOfLines={1}>
                  {displayShopName}
                </Text>
                <Text style={styles.sellerPersonName}>{displayVendorName}</Text>
              </View>
              {fullVendorDetails?.isApproved ||
              currentProperty.vendor?.isApproved ? (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={Colors.champagneGold}
                />
              ) : null}
            </View>

            <View style={styles.sellerInfoRow}>
              <Ionicons name="call-outline" size={18} color={Colors.slate} />
              <Text style={styles.sellerInfoText}>{displayPhone || "N/A"}</Text>
            </View>
            <View style={[styles.sellerInfoRow, { alignItems: "flex-start" }]}>
              <Ionicons
                name="map-outline"
                size={18}
                color={Colors.slate}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.sellerInfoText}>{displayAddress}</Text>
            </View>

            <View style={styles.sellerActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.callBtn]}
                onPress={handleCall}
              >
                <Ionicons name="call" size={18} color={Colors.pureWhite} />
                <Text style={styles.actionBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.waBtn]}
                onPress={handleWhatsApp}
              >
                <Ionicons
                  name="logo-whatsapp"
                  size={18}
                  color={Colors.pureWhite}
                />
                <Text style={styles.actionBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.vendorProfileSmall}>
          <Image
            source={{ uri: displayAvatar }}
            style={styles.bottomVendorImage}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomVendorSub}>LISTED BY</Text>
            <Text style={styles.bottomVendorName} numberOfLines={1}>
              {displayShopName}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.contactButton}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate("ChatScreen", {
              vendorId,
              vendorName: displayVendorName,
            })
          }
        >
          <Text style={styles.contactButtonText}>Chat in App</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Minimalist Luxury Detail Box
const DetailBox = ({
  icon,
  label,
  subtitle,
}: {
  icon: any;
  label: string;
  subtitle: string;
}) => (
  <View style={detailStyles.box}>
    <Ionicons
      name={icon}
      size={24}
      color={Colors.champagneGold}
      style={detailStyles.icon}
    />
    <View style={{ flex: 1 }}>
      <Text style={detailStyles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={detailStyles.subtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  </View>
);

const detailStyles = StyleSheet.create({
  box: {
    width: "48%",
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    shadowColor: Colors.royalNavy,
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  icon: { marginRight: 12 },
  label: { fontSize: 14, fontWeight: "600", color: Colors.royalNavy },
  subtitle: {
    fontSize: 10,
    color: Colors.slate,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

const styles = StyleSheet.create({
  // ... (Keep your exact same styles here, no changes needed to the stylesheet) ...
  mainWrapper: { flex: 1, backgroundColor: Colors.pureWhite },
  container: { flex: 1, backgroundColor: Colors.pureWhite },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.offWhite,
  },
  loadingText: {
    marginTop: 16,
    color: Colors.royalNavy,
    fontWeight: "600",
    letterSpacing: 1,
  },
  errorText: {
    color: "#E53E3E",
    padding: 20,
    textAlign: "center",
    fontSize: 16,
  },
  imageWrapper: {
    position: "relative",
    width: "100%",
    height: 380,
    backgroundColor: Colors.royalNavy,
  },
  carouselImage: { width: width, height: 380, resizeMode: "cover" },
  imageDarkGradient: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 100,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 20,
    backgroundColor: "rgba(11, 16, 33, 0.5)",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  imageIndicatorContainer: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "rgba(11, 16, 33, 0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  imageIndicatorText: {
    color: Colors.pureWhite,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  content: {
    padding: 24,
    marginTop: -20,
    backgroundColor: Colors.pureWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerInfo: { marginBottom: 20 },
  tagRow: { flexDirection: "row", marginBottom: 12 },
  propertyTypeTag: {
    color: Colors.champagneGold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginRight: 16,
  },
  statusTag: {
    color: Colors.slate,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "300",
    color: Colors.royalNavy,
    lineHeight: 36,
    letterSpacing: 0.5,
  },
  locationSubText: {
    fontSize: 15,
    color: Colors.charcoal,
    marginTop: 8,
    fontWeight: "400",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  priceTag: { fontSize: 28, fontWeight: "600", color: Colors.royalNavy },
  rateText: { fontSize: 14, color: Colors.slate, fontWeight: "500" },
  divider: {
    height: 1,
    backgroundColor: Colors.lightBorder,
    marginVertical: 24,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: "300",
    color: Colors.royalNavy,
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  locationBox: {
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    marginBottom: 16,
  },
  locationTextContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  fullAddressText: {
    fontSize: 15,
    color: Colors.charcoal,
    marginLeft: 10,
    flex: 1,
    lineHeight: 22,
  },
  mapButton: {
    flexDirection: "row",
    backgroundColor: Colors.royalNavy,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  mapButtonText: {
    color: Colors.pureWhite,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  legalBox: {
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightBorder,
  },
  legalLabel: { fontSize: 14, color: Colors.slate, fontWeight: "500" },
  legalValue: { fontSize: 14, color: Colors.royalNavy, fontWeight: "600" },
  linkButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.royalNavy,
    marginLeft: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginVertical: 8,
    gap: 10,
  },
  tagPill: {
    borderWidth: 1,
    borderColor: Colors.champagneGold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    color: Colors.champagneGold,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  highlightsContainer: { marginTop: 8 },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  goldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.champagneGold,
    marginRight: 16,
  },
  highlightText: {
    fontSize: 16,
    color: Colors.charcoal,
    fontWeight: "400",
    flex: 1,
  },
  sellerCard: {
    backgroundColor: Colors.offWhite,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  sellerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sellerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.champagneGold,
    marginRight: 16,
  },
  sellerNameContainer: { flex: 1 },
  sellerShopName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.royalNavy,
    marginBottom: 4,
  },
  sellerPersonName: { fontSize: 14, color: Colors.slate, fontWeight: "500" },
  sellerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sellerInfoText: {
    fontSize: 14,
    color: Colors.charcoal,
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  sellerActions: { flexDirection: "row", marginTop: 16, gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  callBtn: { backgroundColor: Colors.royalNavy },
  waBtn: { backgroundColor: Colors.whatsapp },
  actionBtnText: {
    color: Colors.pureWhite,
    fontWeight: "600",
    fontSize: 15,
    marginLeft: 8,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.royalNavy,
    padding: 20,
    paddingBottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  vendorProfileSmall: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  bottomVendorImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.champagneGold,
  },
  bottomVendorSub: {
    fontSize: 10,
    color: Colors.champagneGold,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  bottomVendorName: {
    fontSize: 16,
    fontWeight: "400",
    color: Colors.pureWhite,
  },
  contactButton: {
    backgroundColor: Colors.champagneGold,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignItems: "center",
    shadowColor: Colors.champagneGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  contactButtonText: {
    color: Colors.royalNavy,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.5,
  },
});

export default PropertyDetailScreen;
