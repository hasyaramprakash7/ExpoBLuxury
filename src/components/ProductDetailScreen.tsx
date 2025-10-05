import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { bookNewAppointment } from "../features/appointmentSlice";
import { fetchInsuranceProductById } from "../features/insuranceSlice";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons"; // Make sure you have this library installed

const ProductDetailScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const { productId } = route.params;

  useEffect(() => {
    if (productId) {
      dispatch(fetchInsuranceProductById(productId) as any);
    }
  }, [dispatch, productId]);

  const { currentProduct, loading } = useSelector((state) => state.insurance);
  const { loading: appointmentLoading } = useSelector(
    (state) => state.appointments
  );
  const currentUser = useSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id;

  if (loading || !currentProduct || currentProduct._id !== productId) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  const {
    name,
    mainImage,
    otherImages,
    badgeText,
    options,
    contactNumber,
    executiveContact,
    categories,
    description,
  } = currentProduct;

  const handleScheduleAppointment = async () => {
    if (!currentProduct || !currentUserId) {
      Alert.alert("Error", "No product selected or user not authenticated.");
      return;
    }
    const appointmentData = {
      vendorId: currentProduct.vendorId._id,
      userId: currentUserId,
      insuranceProductId: currentProduct._id,
    };
    try {
      await dispatch(bookNewAppointment(appointmentData) as any).unwrap();
      Alert.alert("Success", "Appointment scheduled successfully!");
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        "Failed to Schedule",
        `Failed to schedule appointment: ${err.message || err}`
      );
    }
  };

  const renderOtherImage = ({ item }) => (
    <View style={styles.otherImageItem}>
      <Image source={{ uri: item }} style={styles.otherImage} />
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        {/* Corrected Header Structure */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
          <Text style={styles.headerTitle}> TATA Product Details</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Brand Image at the top */}
        <View style={styles.imageSection}>
          {mainImage && (
            <Image source={{ uri: mainImage }} style={styles.mainImage} />
          )}
        </View>

        <View style={styles.detailsSection}>
          <Text style={styles.productName}>{name}</Text>
          {badgeText && badgeText !== "N/A" && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
          )}

          {/* Categories */}
          {categories?.level1?.name && (
            <View style={styles.infoRow}>
              <Text style={styles.infoText}>
                {categories.level1.name} / {categories.level2.name} /{" "}
                {categories.level3.name}
              </Text>
            </View>
          )}

          {/* Features */}
          {options && (
            <View style={styles.infoRow}>
              <View style={styles.featuresBadgeContainer}>
                {options.isNew && (
                  <Text style={styles.featureBadgeNew}> New</Text>
                )}
                {options.isPopular && (
                  <Text style={styles.featureBadgePopular}> Popular</Text>
                )}
                {options.isAwardWinning && (
                  <Text style={styles.featureBadgeAward}> Award-Winning</Text>
                )}
              </View>
            </View>
          )}

          {/* Contact Info */}
          {contactNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.infoTitle}>Contact:</Text>
              <Text style={styles.infoText}>{contactNumber}</Text>
            </View>
          )}

          {executiveContact && (
            <View style={styles.infoRow}>
              <Text style={styles.infoTitle}>Executive:</Text>
              <Text style={styles.infoText}>
                {executiveContact.pointOfContact} -{" "}
                {executiveContact.phoneNumber}
              </Text>
            </View>
          )}

          {/* Description */}
          {description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          )}

          {/* Schedule Button */}
          <TouchableOpacity
            style={[
              styles.scheduleButton,
              appointmentLoading && styles.disabledButton,
            ]}
            onPress={handleScheduleAppointment}
            disabled={appointmentLoading}
          >
            <Text style={styles.scheduleButtonText}>
              {appointmentLoading ? "Scheduling..." : "Schedule Appointment"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Other Images section */}
        {otherImages.length > 0 && (
          <View style={styles.otherImagesContainer}>
            <Text style={styles.otherImagesTitle}>More Images</Text>
            <FlatList
              data={otherImages}
              renderItem={renderOtherImage}
              keyExtractor={(item, index) => index.toString()}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingTop: 30,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  backButton: {
    flexDirection: "row", // This is important to align the icon and text
    alignItems: "center",
    paddingRight: 10,
    paddingVertical: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8, // Add some space between the icon and text
  },
  scrollContainer: {
    padding: 16,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6b7280",
  },
  imageSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  mainImage: {
    width: "100%",
    height: 300,
    resizeMode: "contain",
    borderRadius: 8,
  },
  detailsSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 24,
  },
  productName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  badge: {
    backgroundColor: "#3b82f6",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "center",
    marginBottom: 16,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  infoRow: {
    marginBottom: 12,
  },
  infoTitle: {
    fontWeight: "bold",
    color: "#6b7280",
    fontSize: 14,
  },
  infoText: {
    fontSize: 16,
    color: "#374151",
    marginTop: 4,
  },
  featuresBadgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  featureBadgeNew: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  featureBadgePopular: {
    backgroundColor: "#fef3c7",
    color: "#854d0e",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  featureBadgeAward: {
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  scheduleButton: {
    marginTop: 30,
    marginBottom: 30,
    backgroundColor: "#0A3D2B",
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  disabledButton: {
    backgroundColor: "#a0aec0",
    shadowOpacity: 0.1,
    elevation: 2,
  },
  scheduleButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  otherImagesContainer: {
    marginBottom: 24,
  },
  otherImagesTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 12,
  },
  otherImageItem: {
    marginBottom: 16,
    alignItems: "center",
  },
  otherImage: {
    width: "100%",
    height: 400,
    resizeMode: "contain",
    borderRadius: 8,
  },
  descriptionContainer: {
    paddingVertical: 10,
    marginTop: 10,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
});

export default ProductDetailScreen;
