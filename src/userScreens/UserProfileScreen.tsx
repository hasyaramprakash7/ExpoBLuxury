import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image, // For the asset-based image
  Linking, // For opening the Play Store link and calling/emailing
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons"; // For icons
import { useSelector, useDispatch } from "react-redux";
import { logout, updateUserProfile } from "../features/user/authSlice";
import { RootState } from "../app/store";

const { width, height } = Dimensions.get("window");

// --- IMPORTANT: Replace this with the actual path to your local image asset ---
const PROFILE_IMAGE_ASSET = require('../../assets/Gemini_Generated_Image_z8uyflz8uyflz8uy.png'); 

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state: RootState) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [showProfileData, setShowProfileData] = useState(false);
  const [showHelpCenterDetails, setShowHelpCenterDetails] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: { district: "", state: "", country: "", pincode: "" },
  });

  // Define colors
  const colors = {
    backgroundTop: "#F5ECD7",
    backgroundBottom: "#FFFFFF",
    headerText: "#000000",
    iconColor: "#000000",
    starbucksGreen: "#009632",
    loginButtonBg: "#000000",
    loginButtonText: "#FFFFFF",
    sectionText: "#4A4A4A",
    versionText: "#888888",
    borderColor: "#E0E0E0",
    leafColor: "#E2D3B7",
    profileGreen: "#009632",
  };

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || {
          district: "",
          state: "",
          country: "",
          pincode: "",
        },
      });
    }
  }, [user]);

  const handleSave = async () => {
    const updatedFields = {};
    if (formData.name !== user.name) {
      updatedFields.name = formData.name;
    }
    if (formData.phone !== user.phone) {
      updatedFields.phone = formData.phone;
    }
    if (JSON.stringify(formData.address) !== JSON.stringify(user.address)) {
      updatedFields.address = formData.address;
    }

    if (Object.keys(updatedFields).length === 0) {
      setIsEditing(false);
      return;
    }

    const resultAction = await dispatch(updateUserProfile(updatedFields));

    if (updateUserProfile.fulfilled.match(resultAction)) {
      Alert.alert("Success", "Profile updated successfully!");
      setIsEditing(false);
      setShowProfileData(true);
    } else {
      Alert.alert(
        "Error",
        (resultAction.payload as string) || "Failed to update profile."
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          onPress: () => {
            dispatch(logout());
            setShowProfileData(false);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleToggleProfileData = () => {
    // Toggles visibility and resets form data when opening/closing
    setShowProfileData((prev) => !prev);
    setIsEditing(false); 
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || { district: "", state: "", country: "", pincode: "" },
      });
    }
  };

  const handleToggleHelpCenter = () => {
    setShowHelpCenterDetails(prev => !prev);
  };

  const handleRateUsPress = () => {
    const playStoreLink =
      "https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury";
    Linking.openURL(playStoreLink).catch((err) =>
      Alert.alert("Error", "Could not open link: " + err.message)
    );
  };

  // Helper function to render rows in the profile display.
  const renderInfoRow = (icon, label, value) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={width * 0.05} color={colors.profileGreen} />
      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || "Not provided"}</Text>
      </View>
    </View>
  );

  // RENDER FUNCTION FOR HELP CENTER DETAILS (unchanged)
  const renderHelpCenterDetails = () => (
    <View style={[styles.detailsContainer, { borderColor: colors.borderColor }]}>
      <TouchableOpacity 
        style={styles.detailItem} 
        onPress={() => Linking.openURL('tel:7893828468')}
      >
        <Ionicons name="call-outline" size={width * 0.05} color={colors.profileGreen} />
        <Text style={[styles.detailText, { color: colors.sectionText }]}>
          Call: 7893828468
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.detailItem} 
        onPress={() => Linking.openURL('mailto:bluxury1000@gmail.com')}
      >
        <Ionicons name="mail-outline" size={width * 0.05} color={colors.profileGreen} />
        <Text style={[styles.detailText, { color: colors.sectionText }]}>
          Email: bluxury1000@gmail.com
        </Text>
      </TouchableOpacity>
    </View>
  );

  // --- NEW RENDER FUNCTION FOR PROFILE CARD / EDITING SECTION ---
  const renderProfileCard = () => (
    <View
        style={[
            styles.profileCardInline, // Use new style for inline card
            { backgroundColor: colors.backgroundBottom },
        ]}
    >
      {/* Edit Profile Button (top of the card) */}
      <TouchableOpacity
        style={styles.editProfileIconButton}
        onPress={() => setIsEditing((prev) => !prev)} // Toggle edit mode
      >
        <Ionicons
          name="pencil-outline"
          size={width * 0.06}
          color={colors.iconColor}
        />
      </TouchableOpacity>

      {isEditing ? (
        // --- EDITING VIEW ---
        <View style={styles.editSection}>
          <TextInput
            style={[ styles.input, { borderColor: colors.borderColor, color: colors.sectionText } ]}
            placeholder="Full Name"
            placeholderTextColor={colors.versionText}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />
          <TextInput
            style={[ styles.input, { borderColor: colors.borderColor, color: colors.sectionText } ]}
            placeholder="Phone"
            placeholderTextColor={colors.versionText}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            keyboardType="phone-pad"
          />
          <Text style={[styles.addressLabel, { color: colors.sectionText }]}>
            Address Details:
          </Text>
          <TextInput
            style={[ styles.input, { borderColor: colors.borderColor, color: colors.sectionText } ]}
            placeholder="District"
            placeholderTextColor={colors.versionText}
            value={formData.address.district}
            onChangeText={(text) =>
              setFormData({ ...formData, address: { ...formData.address, district: text } })
            }
          />
          <TextInput
            style={[ styles.input, { borderColor: colors.borderColor, color: colors.sectionText } ]}
            placeholder="State"
            placeholderTextColor={colors.versionText}
            value={formData.address.state}
            onChangeText={(text) =>
              setFormData({ ...formData, address: { ...formData.address, state: text } })
            }
          />
          <TextInput
            style={[ styles.input, { borderColor: colors.borderColor, color: colors.sectionText } ]}
            placeholder="Country"
            placeholderTextColor={colors.versionText}
            value={formData.address.country}
            onChangeText={(text) =>
              setFormData({ ...formData, address: { ...formData.address, country: text } })
            }
          />
          <TextInput
            style={[ styles.input, { borderColor: colors.borderColor, color: colors.sectionText } ]}
            placeholder="Pincode"
            placeholderTextColor={colors.versionText}
            value={formData.address.pincode}
            onChangeText={(text) =>
              setFormData({ ...formData, address: { ...formData.address, pincode: text } })
            }
            keyboardType="number-pad"
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Save</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => setIsEditing(false)}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // --- DISPLAY VIEW ---
        <View style={styles.displaySection}>
          {renderInfoRow("person-outline", "Name", user.name)}
          {renderInfoRow("mail-outline", "Email", user.email)}
          {renderInfoRow("call-outline", "Phone", user.phone)}
          {renderInfoRow(
            "location-outline",
            "Address",
            user.address?.district && user.address?.pincode
              ? `${user.address.district}, ${user.address.state}, ${user.address.country} - ${user.address.pincode}`
              : "Not provided"
          )}
        </View>
      )}
    </View>
  );

  // Show a loading indicator while the user profile is being fetched.
  if (loading && !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.starbucksGreen} />
        <Text style={{ marginTop: 10, color: colors.sectionText }}>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundTop }}>
      {/* Header (unchanged) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={width * 0.07} color={colors.iconColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Account</Text>
        <View style={styles.headerRight}>
          {user?.token && showProfileData && (
            <TouchableOpacity style={styles.headerButton} onPress={handleToggleProfileData}>
              <Ionicons name="refresh-outline" size={width * 0.065} color={colors.iconColor} />
            </TouchableOpacity>
          )}
          {/* <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={width * 0.065} color={colors.iconColor} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerButton, { marginLeft: width * 0.02 }]}>
            <Ionicons name="settings-outline" size={width * 0.065} color={colors.iconColor} />
          </TouchableOpacity> */}
        </View>
      </View>

      {/* Background illustrations (unchanged) */}
      <View style={[styles.leafTopLeft, { backgroundColor: colors.leafColor }]} />
      <View style={[styles.leafBottomRight, { backgroundColor: colors.leafColor }]} />
      <View style={[styles.leafSmallLeft, { backgroundColor: colors.leafColor }]} />

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        {/* Top Container with Profile Image and Login/Welcome Message */}
        <View style={styles.topContainer}>
          <View style={styles.profileImageContainer}>
            <Image source={PROFILE_IMAGE_ASSET} style={styles.profileImage} resizeMode="cover" />
          </View>
          
          {!user?.token ? (
            <>
              <Text style={styles.welcomeText}>Welcome to BLuxury</Text>
              <TouchableOpacity
                style={[ styles.loginButton, { backgroundColor: colors.loginButtonBg } ]}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={[ styles.loginButtonText, { color: colors.loginButtonText } ]}>
                  Login or Sign Up
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.loggedInUserText, { color: colors.headerText }]}>
                Hello, {user.name || "BLuxury Member"}!
              </Text>
            </>
          )}
        </View>

        {/* --- BOTTOM CONTAINER MOVED TO BE PART OF SCROLLVIEW CONTENT --- */}
        <View
          style={[
            styles.bottomContainer,
            { backgroundColor: colors.backgroundBottom },
          ]}
        >
          {/* Help Center Section */}
          <TouchableOpacity
            style={[
              styles.sectionItem,
              { borderBottomColor: colors.borderColor },
            ]}
            onPress={handleToggleHelpCenter}
          >
            <View style={styles.sectionLeft}>
              <Ionicons name="help-circle-outline" size={width * 0.05} color={colors.starbucksGreen} />
              <Text style={[styles.sectionText, { color: colors.sectionText }]}>
                HELP CENTER
              </Text>
            </View>
            <Ionicons
              name={showHelpCenterDetails ? "chevron-down" : "chevron-forward"}
              size={width * 0.06}
              color={colors.sectionText}
            />
          </TouchableOpacity>
          
          {/* Conditional rendering of Help Center Details */}
          {showHelpCenterDetails && renderHelpCenterDetails()}

          {/* Profile Section - Toggles visibility of the card */}
          {user?.token && (
            <TouchableOpacity
              style={[
                styles.sectionItem,
                { borderBottomColor: colors.borderColor },
              ]}
              onPress={handleToggleProfileData}
            >
              <View style={styles.sectionLeft}>
                <Ionicons name="person-outline" size={width * 0.05} color={colors.starbucksGreen} />
                <Text style={[styles.sectionText, { color: colors.sectionText }]}>
                  PROFILE
                </Text>
              </View>
              <Ionicons
                name={showProfileData ? "chevron-down" : "chevron-forward"}
                size={width * 0.06}
                color={colors.sectionText}
              />
            </TouchableOpacity>
          )}

          {/* Conditional rendering of Profile Card */}
          {user?.token && showProfileData && renderProfileCard()}

          {/* Rate Us Section */}
          <TouchableOpacity
            style={[
              styles.sectionItem,
              { borderBottomColor: colors.borderColor },
            ]}
            onPress={handleRateUsPress}
          >
            <View style={styles.sectionLeft}>
              <Ionicons name="star-outline" size={width * 0.05} color={colors.starbucksGreen} />
              <Text style={[styles.sectionText, { color: colors.sectionText }]}>
                RATE US ON THE APP STORE
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={width * 0.06}
              color={colors.sectionText}
            />
          </TouchableOpacity>

          {user?.token && (
            <TouchableOpacity
              style={[styles.actionButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={width * 0.045} color="#fff" />
              <Text style={styles.actionButtonText}>Logout</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.versionText, { color: colors.versionText }]}>
            BLuxury version 1.0.0
          </Text>
        </View>
        {/* --- END BOTTOM CONTAINER --- */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5ECD7",
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: width * 0.04,
    paddingVertical: height * 0.015,
    backgroundColor: "transparent",
  },
  headerButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: width * 0.05,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
  },
  topContainer: {
    alignItems: "center",
    paddingTop: height * 0.03,
    paddingBottom: height * 0.04,
    backgroundColor: "transparent",
  },
  profileImageContainer: {
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    borderWidth: 2,
    borderColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: height * 0.03,
    overflow: "hidden",
    backgroundColor: "#E0E0E0",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  welcomeText: {
    fontSize: width * 0.06,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: height * 0.02,
    fontFamily: "sans-serif-medium",
  },
  loggedInUserText: {
    fontSize: width * 0.055,
    fontWeight: "bold",
    marginTop: height * 0.01,
    fontFamily: "sans-serif-medium",
    marginBottom: height * 0.03,
  },
  loginButton: {
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.08,
    borderRadius: 25,
  },
  loginButtonText: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    fontFamily: "sans-serif-medium",
  },
  // --- NEW STYLE for inline profile card ---
  profileCardInline: {
    width: "100%", // Take up full width of bottomContainer padding area
    borderRadius: 15,
    padding: width * 0.05,
    paddingTop: height * 0.02,
    marginTop: height * 0.01, 
    marginBottom: height * 0.01,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    position: 'relative', // Necessary for the edit icon to be positioned correctly
  },
  editProfileIconButton: {
    padding: width * 0.02,
    position: "absolute",
    top: 5, // Adjusted to fit inside the new card style
    right: 5,
    zIndex: 1,
  },
  displaySection: {
    // No specific styles needed here
  },
  editSection: {
    // No specific styles needed here
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: height * 0.02,
    paddingVertical: height * 0.005,
  },
  infoTextContainer: {
    marginLeft: width * 0.03,
    flex: 1,
  },
  infoLabel: {
    fontSize: width * 0.035,
    color: "#666",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: width * 0.045,
    fontWeight: "500",
    color: "#000",
  },
  input: {
    borderWidth: 1,
    padding: width * 0.03,
    borderRadius: 10,
    marginBottom: height * 0.015,
    fontSize: width * 0.04,
    fontFamily: "sans-serif-regular",
  },
  addressLabel: {
    fontSize: width * 0.038,
    fontWeight: "600",
    marginBottom: height * 0.01,
    marginTop: height * 0.01,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: height * 0.02,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.04,
    borderRadius: 25,
  },
  saveButton: {
    backgroundColor: "#28a745",
    flex: 1,
    marginRight: width * 0.015,
  },
  cancelButton: {
    backgroundColor: "#dc3545",
    flex: 1,
    marginLeft: width * 0.015,
  },
  logoutButton: {
    backgroundColor: "#dc3545",
    marginTop: height * 0.03,
    alignSelf: "center",
    width: "60%",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: width * 0.015,
    fontSize: width * 0.04,
  },
  bottomContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.04,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    marginTop: height * 0.02,
  },
  sectionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: height * 0.02,
    borderBottomWidth: 1,
    marginBottom: height * 0.01,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionText: {
    fontSize: width * 0.04,
    marginLeft: width * 0.03,
    fontWeight: "600",
    fontFamily: "sans-serif-medium",
  },
  versionText: {
    textAlign: "center",
    marginTop: height * 0.05,
    marginBottom: height * 0.1,
    fontSize: width * 0.035,
    fontFamily: "sans-serif-light",
  },
  // Help Center Details Styles
  detailsContainer: {
    paddingHorizontal: width * 0.05,
    paddingVertical: height * 0.01,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    marginBottom: height * 0.01,
    borderWidth: 1,
    borderTopWidth: 0,
    marginHorizontal: width * 0.02, // Adjust to fit inside the padding of bottomContainer
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: height * 0.01,
  },
  detailText: {
    fontSize: width * 0.04,
    marginLeft: width * 0.03,
    textDecorationLine: 'underline',
  },
  // Simple leaf illustrations (approximations)
  leafTopLeft: {
    position: "absolute",
    top: height * 0.08,
    left: width * 0.03,
    width: width * 0.1,
    height: height * 0.05,
    borderRadius: 50,
    transform: [{ rotate: "-30deg" }],
  },
  leafBottomRight: {
    position: "absolute",
    top: height * 0.15,
    right: width * 0.05,
    width: width * 0.08,
    height: height * 0.04,
    borderRadius: 50,
    transform: [{ rotate: "45deg" }],
  },
  leafSmallLeft: {
    position: "absolute",
    top: height * 0.18,
    left: width * 0.15,
    width: width * 0.05,
    height: height * 0.025,
    borderRadius: 50,
    transform: [{ rotate: "15deg" }],
  },
});