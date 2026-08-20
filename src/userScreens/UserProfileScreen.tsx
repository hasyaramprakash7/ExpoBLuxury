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
  Image,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSelector, useDispatch } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";

import { logoutUser, updateUserProfile } from "../features/user/authSlice";
import { resetChatState } from "../features/chat/chatSlice";
import socket from "./utils/socket";
import config from "../config/config"; // Fixed path
import { RootState } from "../app/store";

const { width, height } = Dimensions.get("window");

const PROFILE_IMAGE_ASSET = require("../../assets/Gemini_Generated_Image_z8uyflz8uyflz8uy.png");

// 🔥 ROYAL THEME COLORS 🔥
const Colors = {
  background: "#050505", // Deep Royal Black
  card: "#151515", // Elevated dark gray for cards
  textPrimary: "#FFFFFF",
  textSecondary: "#A0A0A0",
  royalGreen: "#00A651",
  royalGreenMuted: "rgba(0, 166, 81, 0.15)",
  danger: "#FF3B30",
  border: "#2A2A2A",
  inputBg: "#1E1E1E",
};

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch<any>();
  const { user, loading } = useSelector((state: RootState) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [showProfileData, setShowProfileData] = useState(false);
  const [showHelpCenterDetails, setShowHelpCenterDetails] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    profilePic: null as string | null,
    isNewProfilePic: false,
    address: { district: "", state: "", country: "", pincode: "" },
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        profilePic: user.profilePic || null,
        isNewProfilePic: false,
        address: user.address || {
          district: "",
          state: "",
          country: "",
          pincode: "",
        },
      });
    }
  }, [user]);

  const handlePickImage = async () => {
    if (!isEditing) return;
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets && result.assets[0].uri) {
      setFormData({
        ...formData,
        profilePic: result.assets[0].uri,
        isNewProfilePic: true,
      });
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, profilePic: null, isNewProfilePic: false });
  };

  const handleSave = async () => {
    const form = new FormData();
    let hasChanges = false;

    if (formData.name !== user?.name) {
      form.append("name", formData.name);
      hasChanges = true;
    }
    if (formData.phone !== user?.phone) {
      form.append("phone", formData.phone);
      hasChanges = true;
    }
    if (JSON.stringify(formData.address) !== JSON.stringify(user?.address)) {
      form.append("address", JSON.stringify(formData.address));
      hasChanges = true;
    }

    if (formData.isNewProfilePic && formData.profilePic) {
      const uri = formData.profilePic;
      const filename = uri.split("/").pop() || "profile.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      form.append("profilePic", { uri, name: filename, type } as any);
      hasChanges = true;
    } else if (formData.profilePic === null && user?.profilePic) {
      form.append("profilePic", "null");
      hasChanges = true;
    }

    if (!hasChanges) return setIsEditing(false);

    const resultAction = await dispatch(updateUserProfile(form));
    if (updateUserProfile.fulfilled.match(resultAction)) {
      Alert.alert("Success", "Profile updated successfully!");
      setIsEditing(false);
    } else {
      Alert.alert(
        "Error",
        (resultAction.payload as string) || "Failed to update.",
      );
    }
  };

  const handleChangePassword = async () => {
    if (
      !passwordData.oldPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    )
      return Alert.alert("Error", "Please fill in all password fields.");
    if (passwordData.newPassword !== passwordData.confirmPassword)
      return Alert.alert("Error", "New passwords do not match.");

    setIsChangingPassword(true);
    try {
      const response = await axios.put(
        `${config.apiUrl}/auth/update-password`,
        {
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword,
        },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      if (response.data.success) {
        Alert.alert("Success", "Password changed successfully!");
        setShowPasswordChange(false);
        setPasswordData({
          oldPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Update failed.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          const currentUserId = user?._id || user?.id;
          if (currentUserId) socket.emit("leave", currentUserId);
          dispatch(resetChatState());
          await dispatch(logoutUser());
          setShowProfileData(false);
          setShowPasswordChange(false);
        },
      },
    ]);
  };

  const renderInfoRow = (
    label: string,
    value: string | undefined,
    isLast: boolean = false,
  ) => (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value || "Not provided"}
      </Text>
    </View>
  );

  if (loading && !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.royalGreen} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
          >
            <Ionicons name="chevron-back" size={28} color={Colors.royalGreen} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* PROFILE CARD */}
          <View style={styles.profileHeaderCard}>
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={!isEditing}
              style={styles.imageContainer}
            >
              <Image
                source={
                  formData.profilePic
                    ? { uri: formData.profilePic }
                    : PROFILE_IMAGE_ASSET
                }
                style={styles.profileImage}
              />
              {isEditing && (
                <View style={styles.imageEditOverlay}>
                  <Ionicons name="camera" size={26} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>

            {isEditing && formData.profilePic && (
              <TouchableOpacity
                onPress={handleRemoveImage}
                style={styles.removePhotoBtn}
              >
                <Text style={styles.removePhotoText}>Remove Photo</Text>
              </TouchableOpacity>
            )}

            {!user?.token ? (
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.loginBtnText}>Sign In / Register</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.userName}>
                  {user.name || "BLuxury Member"}
                </Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </>
            )}
          </View>

          {user?.token && (
            <View style={styles.sectionContainer}>
              {/* PROFILE TAB */}
              <View style={styles.cardGroup}>
                <TouchableOpacity
                  style={styles.cardRow}
                  onPress={() => {
                    setShowProfileData(!showProfileData);
                    setShowPasswordChange(false);
                    setIsEditing(false);
                  }}
                >
                  <View style={styles.cardRowLeft}>
                    <View style={styles.iconBox}>
                      <Ionicons
                        name="person"
                        size={20}
                        color={Colors.royalGreen}
                      />
                    </View>
                    <Text style={styles.cardRowText}>Personal Information</Text>
                  </View>
                  <Ionicons
                    name={showProfileData ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>

                {showProfileData && (
                  <View style={styles.expandedContent}>
                    <View style={styles.expandHeader}>
                      <Text style={styles.expandTitle}>Your Details</Text>
                      <TouchableOpacity
                        onPress={() => setIsEditing(!isEditing)}
                      >
                        <Text style={styles.editActionText}>
                          {isEditing ? "Cancel" : "Edit"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {isEditing ? (
                      <View style={styles.formContainer}>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <TextInput
                          style={styles.input}
                          value={formData.name}
                          onChangeText={(t) =>
                            setFormData({ ...formData, name: t })
                          }
                          placeholderTextColor={Colors.textSecondary}
                        />

                        <Text style={styles.inputLabel}>Phone Number</Text>
                        <TextInput
                          style={styles.input}
                          value={formData.phone}
                          keyboardType="phone-pad"
                          onChangeText={(t) =>
                            setFormData({ ...formData, phone: t })
                          }
                        />

                        <Text style={styles.inputLabel}>District</Text>
                        <TextInput
                          style={styles.input}
                          value={formData.address.district}
                          onChangeText={(t) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address, district: t },
                            })
                          }
                        />

                        <Text style={styles.inputLabel}>State</Text>
                        <TextInput
                          style={styles.input}
                          value={formData.address.state}
                          onChangeText={(t) =>
                            setFormData({
                              ...formData,
                              address: { ...formData.address, state: t },
                            })
                          }
                        />

                        <TouchableOpacity
                          style={styles.saveBtn}
                          onPress={handleSave}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color="#FFF" />
                          ) : (
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.infoDisplayBox}>
                        {renderInfoRow("Name", user.name)}
                        {renderInfoRow("Phone", user.phone)}
                        {renderInfoRow(
                          "Address",
                          user.address?.district
                            ? `${user.address.district}, ${user.address.state}`
                            : "Not provided",
                          true,
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* SECURITY TAB */}
              <View style={styles.cardGroup}>
                <TouchableOpacity
                  style={styles.cardRow}
                  onPress={() => {
                    setShowPasswordChange(!showPasswordChange);
                    setShowProfileData(false);
                  }}
                >
                  <View style={styles.cardRowLeft}>
                    <View style={styles.iconBox}>
                      <Ionicons
                        name="lock-closed"
                        size={20}
                        color={Colors.royalGreen}
                      />
                    </View>
                    <Text style={styles.cardRowText}>Security</Text>
                  </View>
                  <Ionicons
                    name={
                      showPasswordChange ? "chevron-down" : "chevron-forward"
                    }
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>

                {showPasswordChange && (
                  <View style={styles.expandedContent}>
                    <TextInput
                      style={styles.input}
                      placeholder="Current Password"
                      placeholderTextColor={Colors.textSecondary}
                      secureTextEntry
                      value={passwordData.oldPassword}
                      onChangeText={(t) =>
                        setPasswordData({ ...passwordData, oldPassword: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="New Password"
                      placeholderTextColor={Colors.textSecondary}
                      secureTextEntry
                      value={passwordData.newPassword}
                      onChangeText={(t) =>
                        setPasswordData({ ...passwordData, newPassword: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor={Colors.textSecondary}
                      secureTextEntry
                      value={passwordData.confirmPassword}
                      onChangeText={(t) =>
                        setPasswordData({ ...passwordData, confirmPassword: t })
                      }
                    />

                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={handleChangePassword}
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.saveBtnText}>Update Password</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* HELP & LOGOUT */}
              <View style={styles.cardGroup}>
                <TouchableOpacity
                  style={styles.cardRow}
                  onPress={() =>
                    Linking.openURL("mailto:bluxury1000@gmail.com")
                  }
                >
                  <View style={styles.cardRowLeft}>
                    <View style={styles.iconBox}>
                      <Ionicons
                        name="help-buoy"
                        size={20}
                        color={Colors.royalGreen}
                      />
                    </View>
                    <Text style={styles.cardRowText}>Help & Support</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerButton: { padding: 5, marginLeft: -5 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 10 },

  profileHeaderCard: { alignItems: "center", marginBottom: 35 },
  imageContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: Colors.royalGreen,
    overflow: "hidden",
    shadowColor: Colors.royalGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  profileImage: { width: "100%", height: "100%" },
  imageEditOverlay: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.5)",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  removePhotoBtn: { marginTop: 15 },
  removePhotoText: { color: Colors.danger, fontSize: 14, fontWeight: "600" },

  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 20,
    letterSpacing: 0.5,
  },
  userEmail: { fontSize: 15, color: Colors.textSecondary, marginTop: 5 },

  loginBtn: {
    marginTop: 20,
    backgroundColor: Colors.royalGreen,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  loginBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },

  sectionContainer: { width: "100%" },

  cardGroup: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
  },
  cardRowLeft: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.royalGreenMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  cardRowText: { fontSize: 16, fontWeight: "500", color: Colors.textPrimary },

  expandedContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  expandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
  },
  expandTitle: { fontSize: 18, fontWeight: "600", color: Colors.textPrimary },
  editActionText: { fontSize: 16, color: Colors.royalGreen, fontWeight: "500" },

  infoDisplayBox: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 15,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 15, color: Colors.textSecondary },
  infoValue: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: "500",
    maxWidth: "60%",
  },

  formContainer: { marginTop: 5 },
  inputLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.inputBg,
    color: Colors.textPrimary,
    fontSize: 16,
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  saveBtn: {
    backgroundColor: Colors.royalGreen,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  logoutBtn: {
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  logoutBtnText: { color: Colors.danger, fontSize: 17, fontWeight: "600" },
});
