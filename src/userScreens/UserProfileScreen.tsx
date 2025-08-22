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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons"; // For icons
import { useSelector, useDispatch } from "react-redux"; // To check login status and dispatch actions
import { logout, updateUserProfile } from "../features/user/authSlice"; // Adjust path as per your project structure
import { RootState } from "../app/store"; // Adjust path as per your project structure

const { width, height } = Dimensions.get("window");

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state: RootState) => state.auth); // Get user info from Redux

  const [isEditing, setIsEditing] = useState(false);
  const [showProfileData, setShowProfileData] = useState(false); // New state to control visibility of profile data section
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: { district: "", state: "", country: "", pincode: "" },
  });

  // Define colors based on the image
  const colors = {
    backgroundTop: "#F5ECD7", // Light beige/peach
    backgroundBottom: "#FFFFFF", // White
    headerText: "#000000", // Black for header title
    iconColor: "#000000", // Black for icons
    starbucksGreen: "#009632", // Green for certain accents if needed
    loginButtonBg: "#000000", // Black for login button
    loginButtonText: "#FFFFFF", // White for login button text
    sectionText: "#4A4A4A", // Darker grey for section text
    versionText: "#888888", // Grey for version text
    borderColor: "#E0E0E0", // Light grey for borders
    leafColor: "#E2D3B7", // Color for the leaf illustrations (approximate)
    cupOutline: "#D4C7B3", // Outline for the cup image
    cupFill: "#EAE7E1", // Fill for the cup
    cupSleeve: "#009632", // Green sleeve for the cup
    cupDetails: "#999999", // For cup eyes and mouth (slightly darker than outline for contrast)
    profileGreen: "#009632", // A specific green for profile elements
  };

  useEffect(() => {
    // This effect synchronizes the form state with the user data from Redux.
    // It runs whenever the `user` object changes.
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "", // Email is not editable in the form but good to have in state
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
    // Create an object to hold only the fields that have changed.
    const updatedFields = {};

    // Compare form data with the original user data from the Redux store.
    if (formData.name !== user.name) {
      updatedFields.name = formData.name;
    }
    if (formData.phone !== user.phone) {
      updatedFields.phone = formData.phone;
    }
    // For the address object, stringify to easily compare if it has changed.
    if (JSON.stringify(formData.address) !== JSON.stringify(user.address)) {
      updatedFields.address = formData.address;
    }

    // If no fields have been changed, don't make an unnecessary API call.
    if (Object.keys(updatedFields).length === 0) {
      setIsEditing(false); // Simply exit the editing mode.
      return;
    }

    // Dispatch the update action with only the changed fields.
    const resultAction = await dispatch(updateUserProfile(updatedFields));

    if (updateUserProfile.fulfilled.match(resultAction)) {
      Alert.alert("Success", "Profile updated successfully!");
      setIsEditing(false);
      setShowProfileData(true); // Ensure profile data is shown after saving
    } else {
      // Show a detailed error message from the backend if available.
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
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          onPress: () => {
            dispatch(logout());
            setShowProfileData(false); // Hide profile data on logout
            // The AppNavigator will see that the user is no longer authenticated
            // and automatically redirect to the Login screen, or this screen will
            // display the "Please login" message.
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Function to explicitly "sync" the UI to the current user data
  // Now also controls the visibility of the profile data section
  const handleToggleProfileData = () => {
    setShowProfileData((prev) => !prev); // Toggle visibility
    setIsEditing(false); // Always show display mode first
    if (user) {
      // Reset form data to current user state
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons
            name="chevron-back"
            size={width * 0.07}
            color={colors.iconColor}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Account
        </Text>
        <View style={styles.headerRight}>
          {user?.token &&
            showProfileData && ( // Show sync button only if user is logged in AND profile data is visible
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleToggleProfileData} // Toggles visibility and syncs
              >
                <Ionicons
                  name="refresh-outline"
                  size={width * 0.065}
                  color={colors.iconColor}
                />
              </TouchableOpacity>
            )}
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons
              name="notifications-outline"
              size={width * 0.065}
              color={colors.iconColor}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { marginLeft: width * 0.02 }]}
          >
            <Ionicons
              name="settings-outline"
              size={width * 0.065}
              color={colors.iconColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Background illustrations (approximate, using simple View for shapes) */}
      <View
        style={[styles.leafTopLeft, { backgroundColor: colors.leafColor }]}
      />
      <View
        style={[styles.leafBottomRight, { backgroundColor: colors.leafColor }]}
      />
      <View
        style={[styles.leafSmallLeft, { backgroundColor: colors.leafColor }]}
      />

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.topContainer}>
          {/* Profile Image (Coffee Cup) */}
          <View
            style={[
              styles.profileImageContainer,
              { borderColor: colors.cupOutline },
            ]}
          >
            <View
              style={[styles.cupBase, { backgroundColor: colors.cupFill }]}
            />
            <View
              style={[styles.cupSleeve, { backgroundColor: colors.cupSleeve }]}
            />
            <View style={styles.cupFace}>
              <View
                style={[styles.cupEye, { backgroundColor: colors.cupDetails }]}
              />
              <View
                style={[styles.cupEye, { backgroundColor: colors.cupDetails }]}
              />
              <View
                style={[styles.cupMouth, { borderTopColor: colors.cupDetails }]}
              />
            </View>
          </View>

          {!user?.token ? ( // Only show if user is not logged in
            <>
              <Text style={styles.welcomeText}>Welcome to Starbucks</Text>
              <TouchableOpacity
                style={[
                  styles.loginButton,
                  { backgroundColor: colors.loginButtonBg },
                ]}
                onPress={() => navigation.navigate("Login")} // Navigate to LoginScreen
              >
                <Text
                  style={[
                    styles.loginButtonText,
                    { color: colors.loginButtonText },
                  ]}
                >
                  Login or Sign Up
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            // Show user's name if logged in
            <>
              <Text
                style={[styles.loggedInUserText, { color: colors.headerText }]}
              >
                Hello, {user.name || "Starbucks Member"}!
              </Text>
            </>
          )}
        </View>

        {/* Profile Card / Pop-up section */}
        {user?.token && showProfileData && (
          <View
            style={[
              styles.profileCard,
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
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderColor,
                      color: colors.sectionText,
                    },
                  ]}
                  placeholder="Full Name"
                  placeholderTextColor={colors.versionText}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderColor,
                      color: colors.sectionText,
                    },
                  ]}
                  placeholder="Phone"
                  placeholderTextColor={colors.versionText}
                  value={formData.phone}
                  onChangeText={(text) =>
                    setFormData({ ...formData, phone: text })
                  }
                  keyboardType="phone-pad"
                />
                <Text
                  style={[styles.addressLabel, { color: colors.sectionText }]}
                >
                  Address Details:
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderColor,
                      color: colors.sectionText,
                    },
                  ]}
                  placeholder="District"
                  placeholderTextColor={colors.versionText}
                  value={formData.address.district}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      address: { ...formData.address, district: text },
                    })
                  }
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderColor,
                      color: colors.sectionText,
                    },
                  ]}
                  placeholder="State"
                  placeholderTextColor={colors.versionText}
                  value={formData.address.state}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      address: { ...formData.address, state: text },
                    })
                  }
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderColor,
                      color: colors.sectionText,
                    },
                  ]}
                  placeholder="Country"
                  placeholderTextColor={colors.versionText}
                  value={formData.address.country}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      address: { ...formData.address, country: text },
                    })
                  }
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderColor,
                      color: colors.sectionText,
                    },
                  ]}
                  placeholder="Pincode"
                  placeholderTextColor={colors.versionText}
                  value={formData.address.pincode}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      address: { ...formData.address, pincode: text },
                    })
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
        )}

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
          >
            <View style={styles.sectionLeft}>
              <Ionicons
                name="help-circle-outline"
                size={width * 0.05}
                color={colors.starbucksGreen}
              />
              <Text style={[styles.sectionText, { color: colors.sectionText }]}>
                HELP CENTER
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={width * 0.06}
              color={colors.sectionText} // Using sectionText for gray color
            />
          </TouchableOpacity>

          {/* New Profile Section (toggles visibility of the card) */}
          {user?.token && ( // Only show if user is logged in
            <TouchableOpacity
              style={[
                styles.sectionItem,
                { borderBottomColor: colors.borderColor },
              ]}
              onPress={handleToggleProfileData} // This now toggles the profile data card
            >
              <View style={styles.sectionLeft}>
                <Ionicons
                  name="person-outline"
                  size={width * 0.05}
                  color={colors.starbucksGreen}
                />
                <Text
                  style={[styles.sectionText, { color: colors.sectionText }]}
                >
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

          {/* Rate Us Section */}
          <TouchableOpacity
            style={[
              styles.sectionItem,
              { borderBottomColor: colors.borderColor },
            ]}
          >
            <View style={styles.sectionLeft}>
              <Ionicons
                name="star-outline"
                size={width * 0.05}
                color={colors.starbucksGreen}
              />
              <Text style={[styles.sectionText, { color: colors.sectionText }]}>
                RATE US ON THE APP STORE
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={width * 0.06}
              color={colors.sectionText} // Using sectionText for gray color
            />
          </TouchableOpacity>

          {user?.token && ( // Only show logout if user is logged in
            <TouchableOpacity
              style={[styles.actionButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Ionicons
                name="log-out-outline"
                size={width * 0.045}
                color="#fff"
              />
              <Text style={styles.actionButtonText}>Logout</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.versionText, { color: colors.versionText }]}>
            BLuxury version 1.0.0
          </Text>
        </View>
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
    backgroundColor: "transparent", // Background handled by SafeAreaView
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
    backgroundColor: "transparent", // Background handled by SafeAreaView
  },
  profileImageContainer: {
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2, // Half of width/height for perfect circle
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: height * 0.03,
    overflow: "hidden", // Ensure inner parts are clipped
  },
  cupBase: {
    width: "80%",
    height: "85%",
    borderRadius: 5,
    position: "absolute",
    bottom: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cupSleeve: {
    width: "90%",
    height: "40%",
    borderRadius: 5,
    position: "absolute",
    top: "30%",
    zIndex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cupFace: {
    position: "absolute",
    top: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "60%",
    zIndex: 2,
  },
  cupEye: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  cupMouth: {
    width: 25,
    height: 12,
    borderRadius: 15,
    borderTopWidth: 2,
    position: "absolute",
    top: 15, // Adjust vertical position of mouth
  },
  welcomeText: {
    fontSize: width * 0.06,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: height * 0.02,
    fontFamily: "sans-serif-medium", // Trying to match the font style
  },
  loggedInUserText: {
    fontSize: width * 0.055, // Slightly larger for logged-in name
    fontWeight: "bold",
    marginTop: height * 0.01,
    fontFamily: "sans-serif-medium",
    marginBottom: height * 0.03, // Add some space below the name
  },
  loginButton: {
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.08,
    borderRadius: 25, // More rounded corners
  },
  loginButtonText: {
    fontSize: width * 0.04,
    fontWeight: "bold",
    fontFamily: "sans-serif-medium",
  },
  profileCard: {
    width: "90%",
    borderRadius: 15,
    padding: width * 0.05,
    marginTop: height * 0.02, // Margin to separate from top section
    marginBottom: height * 0.02,
    alignSelf: "center", // Center the card
    elevation: 5, // For shadow effect on Android
    shadowColor: "#000", // For shadow effect on iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  editProfileIconButton: {
    padding: width * 0.02,
    alignSelf: "flex-end", // Aligns to the right within its parent
    position: "absolute", // Allows precise positioning within the card
    top: 0,
    right: 0,
    zIndex: 1, // Ensure it's above other content
  },
  displaySection: {
    // No specific styles needed here, as the card styles are on profileCard
  },
  editSection: {
    // No specific styles needed here, as the card styles are on profileCard
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: height * 0.02,
    paddingVertical: height * 0.005,
  },
  infoTextContainer: {
    marginLeft: width * 0.03,
    flex: 1, // Allows text to take available space
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
    backgroundColor: "#28a745", // Green for save
    flex: 1,
    marginRight: width * 0.015,
  },
  cancelButton: {
    backgroundColor: "#dc3545", // Red for cancel
    flex: 1,
    marginLeft: width * 0.015,
  },
  logoutButton: {
    backgroundColor: "#dc3545", // Red for logout
    marginTop: height * 0.03,
    alignSelf: "center",
    width: "60%", // Adjust width
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
    elevation: 5, // For shadow effect on Android
    shadowColor: "#000", // For shadow effect on iOS
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    marginTop: height * 0.02, // Adjust margin to separate from top container
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
    fontWeight: "600", // Semi-bold
    fontFamily: "sans-serif-medium",
  },
  versionText: {
    textAlign: "center",
    marginTop: height * 0.05,
    marginBottom: height * 0.1, // Add some bottom margin for spacing
    fontSize: width * 0.035,
    fontFamily: "sans-serif-light", // Lighter font for version
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
