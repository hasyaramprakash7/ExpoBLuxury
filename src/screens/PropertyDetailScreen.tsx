import React, { useEffect, useRef } from "react";
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
  Share,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useRoute, useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as WebBrowser from "expo-web-browser";
import { fetchPropertyById } from "../features/propertySlice";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import { recordProductView } from "../features/productViewSlice";
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
  gradientStart: "#0B1021",
  gradientEnd: "#1A1F3A",
  success: "#10B981",
  warning: "#F59E0B",
  info: "#3B82F6",
};

interface RouteParams {
  propertyId: string;
}

// Helper to safely parse arrays
const safeParseArray = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (data.length === 1 && typeof data[0] === 'string' && data[0].startsWith('[') && data[0].endsWith(']')) {
      try {
        const parsed = JSON.parse(data[0]);
        return Array.isArray(parsed) ? parsed : data;
      } catch {
        return data;
      }
    }
    return data;
  }
  if (typeof data === 'string' && data.startsWith('[') && data.endsWith(']')) {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const PropertyDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<any>();

  if (!route.params || !("propertyId" in route.params)) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Navigation Error: Property ID missing.</Text>
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
  const { user } = useSelector((state: RootState) => state.auth);

  // Prevent duplicate recordings
  const viewRecorded = useRef(false);

  // Fetch property details
  useEffect(() => {
    if (propertyId) {
      dispatch(fetchPropertyById(propertyId) as any);
    }
    if (allVendors.length === 0) {
      dispatch(fetchAllVendors() as any);
    }
  }, [dispatch, propertyId, allVendors.length]);

  // Record view when property and user are available
  useEffect(() => {
    if (currentProperty && user?._id && currentProperty.vendor?.vendorId && !viewRecorded.current) {
      viewRecorded.current = true;

      const userName = user.name || user.username || user.email?.split('@')[0] || 'User';
      const userPhone = user.phone || user.mobile || 'N/A';

      dispatch(
        recordProductView({
          productId: currentProperty._id,
          productType: 'Property',
          viewerUserId: user._id,
          viewerName: userName,
          viewerPhone: userPhone,
          vendorId: currentProperty.vendor.vendorId,
        })
      );
    }
  }, [currentProperty, user, dispatch]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this property: ${currentProperty?.title}\nPrice: ${displayPrice}\nLocation: ${fullPropertyAddress}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Manual test button
  const handleTestRecord = () => {
    if (currentProperty && user?._id && currentProperty.vendor?.vendorId) {
      const payload = {
        productId: currentProperty._id,
        productType: 'Property' as const,
        viewerUserId: user._id,
        viewerName: user.name || 'TestUser',
        viewerPhone: user.phone || '9999999999',
        vendorId: currentProperty.vendor.vendorId,
      };
      console.log('🧪 Manual test record (Property):', payload);
      dispatch(recordProductView(payload));
    }
  };

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

  // Parse arrays safely
  const tags = safeParseArray(currentProperty.tags);
  const amenities = safeParseArray(currentProperty.amenities);
  const projectHighlights = safeParseArray(currentProperty.projectHighlights);

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
    loc?.pincode || loc?.zipCode,
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

  const hasTags = Boolean(tags.length > 0);
  const hasAmenities = Boolean(amenities.length > 0);
  const hasHighlights = Boolean(projectHighlights.length > 0);
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
        {/* Image Carousel */}
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
          
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={22} color={Colors.pureWhite} />
          </TouchableOpacity>

          <View style={styles.imageIndicatorContainer}>
            <Ionicons
              name="camera-outline"
              size={14}
              color={Colors.pureWhite}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.imageIndicatorText}>
              {currentProperty.images?.length || 0} Photos
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Header Info */}
          <View style={styles.headerInfo}>
            <View style={styles.tagRow}>
              <View style={styles.propertyTypeBadge}>
                <Text style={styles.propertyTypeTag}>
                  {currentProperty.propertyType}
                </Text>
              </View>
              <View style={[styles.statusBadge, 
                currentProperty.status === 'Ready to Move' && styles.statusReady,
                currentProperty.status === 'Under Construction' && styles.statusConstruction,
                currentProperty.status === 'New Launch' && styles.statusNew,
                currentProperty.status === 'Resale' && styles.statusResale,
              ]}>
                <Text style={styles.statusTagText}>{currentProperty.status}</Text>
              </View>
            </View>
            <Text style={styles.title}>{currentProperty.title}</Text>
            <Text style={styles.locationSubText}>
              <Ionicons
                name="location-sharp"
                size={16}
                color={Colors.champagneGold}
              />{" "}
              {currentProperty.location.locality}, {currentProperty.location.city}
            </Text>
          </View>

          {/* Price Section */}
          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceTag}>{displayPrice}</Text>
              <Text style={styles.rateText}>₹{ratePerSqFt}/sq.ft</Text>
            </View>
            <View style={styles.areaTag}>
              <Text style={styles.areaTagText}>{areaSqFt} Sq.Ft Super Area</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Estate Overview - Enhanced Grid */}
          <Text style={styles.sectionHeader}>
            <Ionicons name="apps-outline" size={22} color={Colors.champagneGold} /> Estate Overview
          </Text>
          <View style={styles.detailsGrid}>
            <DetailBox
              icon="bed-outline"
              label={config?.bhk || "N/A"}
              subtitle="Configuration"
            />

            {config?.bathrooms ? (
              <DetailBox
                icon="water-outline"
                label={`${config.bathrooms}`}
                subtitle="Bathrooms"
              />
            ) : null}

            {config?.balconies ? (
              <DetailBox
                icon="albums-outline"
                label={`${config.balconies}`}
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

          {/* Tags Section - Enhanced */}
          {hasTags && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionHeader}>
                <Ionicons name="pricetags-outline" size={22} color={Colors.champagneGold} /> Tags
              </Text>
              <View style={styles.tagsContainer}>
                {tags.map((tag, index) => (
                  <View key={index} style={styles.tagPill}>
                    <Ionicons name="pricetag-outline" size={12} color={Colors.champagneGold} />
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Amenities Section */}
          {hasAmenities && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionHeader}>
                <Ionicons name="grid-outline" size={22} color={Colors.champagneGold} /> Premium Amenities
              </Text>
              <View style={styles.amenitiesGrid}>
                {amenities.map((amenity, index) => (
                  <View key={`am_${index}`} style={styles.amenityItem}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Project Highlights Section */}
          {hasHighlights && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionHeader}>
                <Ionicons name="star-outline" size={22} color={Colors.champagneGold} /> Project Highlights
              </Text>
              <View style={styles.highlightsContainer}>
                {projectHighlights.map((highlight, index) => (
                  <View key={`hl_${index}`} style={styles.highlightItem}>
                    <View style={styles.goldDot} />
                    <Text style={styles.highlightText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Location */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={22} color={Colors.champagneGold} /> Location & Map
          </Text>
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

          {/* Legal & Financials */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={22} color={Colors.champagneGold} /> Legal & Financials
          </Text>
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

          {/* External Links */}
          {hasExternalLinks && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionHeader}>
                <Ionicons name="link-outline" size={22} color={Colors.champagneGold} /> Media & Links
              </Text>
              <View style={styles.linksContainer}>
                {currentProperty.virtualTourUrl && (
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
                )}

                {currentProperty.websiteUrl && (
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
                )}
              </View>
            </>
          )}

          {/* Seller Section */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={22} color={Colors.champagneGold} /> Exclusive Seller
          </Text>
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
                <View style={styles.verifiedBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={Colors.champagneGold}
                  />
                </View>
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

          {/* DEBUG: Manual test button – remove after verifying */}
          {/* <TouchableOpacity
            style={{ backgroundColor: 'red', padding: 10, margin: 20, borderRadius: 8 }}
            onPress={handleTestRecord}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>🧪 Test Record View (Property)</Text>
          </TouchableOpacity> */}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
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
        {/* <TouchableOpacity
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
        </TouchableOpacity> */}
      </View>
    </View>
  );
};

// Enhanced Detail Box Component
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
    <View style={detailStyles.iconContainer}>
      <Ionicons
        name={icon}
        size={22}
        color={Colors.champagneGold}
      />
    </View>
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
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    shadowColor: Colors.royalNavy,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.champagneGold}15`,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  label: { 
    fontSize: 15, 
    fontWeight: "700", 
    color: Colors.royalNavy,
  },
  subtitle: {
    fontSize: 10,
    color: Colors.slate,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(0,0,0,0.3)",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  shareBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    right: 20,
    backgroundColor: "rgba(11, 16, 33, 0.5)",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
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
  tagRow: { 
    flexDirection: "row", 
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  propertyTypeBadge: {
    backgroundColor: `${Colors.champagneGold}15`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.champagneGold,
  },
  propertyTypeTag: {
    color: Colors.champagneGold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusReady: {
    backgroundColor: `${Colors.success}15`,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  statusConstruction: {
    backgroundColor: `${Colors.warning}15`,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  statusNew: {
    backgroundColor: `${Colors.info}15`,
    borderWidth: 1,
    borderColor: Colors.info,
  },
  statusResale: {
    backgroundColor: `${Colors.slate}15`,
    borderWidth: 1,
    borderColor: Colors.slate,
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.royalNavy,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.royalNavy,
    lineHeight: 34,
    letterSpacing: 0.5,
  },
  locationSubText: {
    fontSize: 15,
    color: Colors.charcoal,
    marginTop: 8,
    fontWeight: "400",
  },
  priceSection: {
    marginBottom: 20,
    backgroundColor: `${Colors.champagneGold}08`,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.champagneGold}30`,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceTag: { 
    fontSize: 28, 
    fontWeight: "700", 
    color: Colors.royalNavy,
  },
  rateText: { 
    fontSize: 14, 
    color: Colors.slate, 
    fontWeight: "600",
  },
  areaTag: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: `${Colors.champagneGold}10`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  areaTagText: {
    fontSize: 12,
    color: Colors.champagneGold,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.lightBorder,
    marginVertical: 24,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "600",
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
  linksContainer: { 
    flexDirection: "row", 
    gap: 12,
    flexWrap: "wrap",
  },
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
    minWidth: "45%",
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
    gap: 10,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${Colors.champagneGold}10`,
    borderWidth: 1,
    borderColor: `${Colors.champagneGold}30`,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tagText: {
    color: Colors.royalNavy,
    fontSize: 13,
    fontWeight: "500",
  },
  amenitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  amenityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.offWhite,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    gap: 8,
    minWidth: "45%",
  },
  amenityText: {
    fontSize: 14,
    color: Colors.charcoal,
    fontWeight: "500",
  },
  highlightsContainer: { 
    marginTop: 4,
    gap: 12,
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: `${Colors.champagneGold}05`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${Colors.champagneGold}15`,
  },
  goldDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.champagneGold,
    marginRight: 14,
  },
  highlightText: {
    fontSize: 15,
    color: Colors.charcoal,
    fontWeight: "500",
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
  verifiedBadge: {
    marginLeft: 8,
  },
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
  sellerActions: { 
    flexDirection: "row", 
    marginTop: 16, 
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  callBtn: { 
    backgroundColor: Colors.royalNavy,
    shadowColor: Colors.royalNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  waBtn: { 
    backgroundColor: Colors.whatsapp,
    shadowColor: Colors.whatsapp,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
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
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
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
    marginRight: 12,
  },
  bottomVendorImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: Colors.champagneGold,
  },
  bottomVendorSub: {
    fontSize: 9,
    color: Colors.champagneGold,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  bottomVendorName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.pureWhite,
  },
  contactButton: {
    backgroundColor: Colors.champagneGold,
    paddingVertical: 12,
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
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

export default PropertyDetailScreen;