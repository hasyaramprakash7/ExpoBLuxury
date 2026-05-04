// ---------------------------------------------------------------- //
// FILE: ../screens/SignupVendorScreen.tsx
// ---------------------------------------------------------------- //
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";

// --- Redux Imports ---
import {
  registerVendor,
  registerVendorWithOtp,
} from "../features/vendor/vendorAuthSlice";
import { RootState, AppDispatch } from "../app/store";
import config from "../config/config";

// --- Type Definitions ---
type AuthStackParamList = {
  VendorLogin: undefined;
  SignupVendor: undefined;
};

type SignupVendorScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "SignupVendor"
>;

export default function SignupVendorScreen() {
  const navigation = useNavigation<SignupVendorScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector(
    (state: RootState) => state.vendorAuth,
  );

  // --- STATE ---
  const [registerMethod, setRegisterMethod] = useState<"otp" | "password">(
    "otp",
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    shopName: "",
    businessType: "",
    gstNo: "",
    shopImage: null as ImagePicker.ImagePickerAsset | null,
    address: {
      latitude: "",
      longitude: "",
      pincode: "",
      state: "",
      district: "",
      country: "",
    },
  });

  const [loadingAddress, setLoadingAddress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // --- Handlers ---
  const handleChange = (name: string, value: string) => {
    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setForm((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: value },
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setForm((prev) => ({ ...prev, shopImage: result.assets[0] }));
    }
  };

  const handleFetchLocation = async () => {
    setLoadingAddress(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Permission to access location was denied.",
      );
      setLoadingAddress(false);
      return;
    }
    try {
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse`,
        {
          headers: { "User-Agent": "BLuxuryApp/1.0" },
          params: {
            lat: latitude,
            lon: longitude,
            format: "json",
            addressdetails: 1,
          },
        },
      );
      const address = response.data.address || {};
      setForm((prev) => ({
        ...prev,
        address: {
          latitude: String(latitude),
          longitude: String(longitude),
          pincode: address.postcode || "",
          state: address.state || "",
          district: address.county || address.city_district || "",
          country: address.country || "",
        },
      }));
      Alert.alert("Success", "Address auto-filled from your location.");
    } catch (e) {
      Alert.alert(
        "Error",
        "Could not fetch address. Please enter it manually.",
      );
    } finally {
      setLoadingAddress(false);
    }
  };

  const validateForm = () => {
    if (
      !form.name ||
      !form.email ||
      !form.password ||
      !form.phone ||
      !form.shopName ||
      !form.businessType
    ) {
      Alert.alert("Validation Error", "Please fill all required fields.");
      return false;
    }
    if (
      !form.address.pincode ||
      !form.address.state ||
      !form.address.district ||
      !form.address.country
    ) {
      Alert.alert("Validation Error", "Please fill all address fields.");
      return false;
    }
    return true;
  };

  const handleSendOtp = async () => {
    if (!validateForm()) return;
    setSendingOtp(true);
    try {
      await axios.post(`${config.apiUrl}/auth/send-otp`, { phone: form.phone });
      setOtpSent(true);
      Alert.alert("Success", "OTP Sent to your phone");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (registerMethod === "otp" && !otpCode) {
      Alert.alert("Validation Error", "Please enter the OTP.");
      return;
    }

    const formData = new FormData();
    Object.keys(form).forEach((key) => {
      if (key === "gstNo" && form.gstNo === "") return;
      if (key === "address") {
        formData.append("address", JSON.stringify(form.address));
      } else if (key === "shopImage" && form.shopImage) {
        const uriParts = form.shopImage.uri.split(".");
        const fileType = uriParts[uriParts.length - 1];
        formData.append("shopImage", {
          uri: form.shopImage.uri,
          name: `photo.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      } else {
        formData.append(key, form[key as keyof typeof form] as string);
      }
    });

    if (registerMethod === "otp") {
      formData.append("otp", otpCode);
    }

    const action =
      registerMethod === "otp" ? registerVendorWithOtp : registerVendor;
    const result = await dispatch(action(formData as any));

    if (action.rejected.match(result)) {
      const errorMessage =
        typeof result.payload === "string"
          ? result.payload
          : "Registration failed.";
      Alert.alert("Registration Failed", errorMessage);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoB}>B</Text>
        </View>
        <Text style={styles.logoText}>Luxury</Text>
      </View>
      <Text style={styles.title}>Become a Vendor</Text>
      <Text style={styles.subtitle}>Register your shop and start selling!</Text>

      {/* 🔥 REGISTER METHOD TOGGLE */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            registerMethod === "otp" && styles.activeToggle,
          ]}
          onPress={() => setRegisterMethod("otp")}
        >
          <Text
            style={[
              styles.toggleText,
              registerMethod === "otp"
                ? styles.activeToggleText
                : styles.inactiveToggleText,
            ]}
          >
            Verify with OTP
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            registerMethod === "password" && styles.activeToggle,
          ]}
          onPress={() => {
            setRegisterMethod("password");
            setOtpSent(false);
          }}
        >
          <Text
            style={[
              styles.toggleText,
              registerMethod === "password"
                ? styles.activeToggleText
                : styles.inactiveToggleText,
            ]}
          >
            Standard Setup
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- Form --- */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#888"
          value={form.name}
          onChangeText={(val) => handleChange("name", val)}
          editable={!otpSent}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={form.email}
          onChangeText={(val) => handleChange("email", val)}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!otpSent}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#888"
            value={form.password}
            onChangeText={(val) => handleChange("password", val)}
            secureTextEntry={!showPassword}
            editable={!otpSent}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? "eye-off" : "eye"}
              size={24}
              color="#888"
            />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#888"
          value={form.phone}
          onChangeText={(val) => handleChange("phone", val)}
          keyboardType="phone-pad"
          editable={!otpSent}
        />
        <TextInput
          style={styles.input}
          placeholder="Shop Name"
          placeholderTextColor="#888"
          value={form.shopName}
          onChangeText={(val) => handleChange("shopName", val)}
          editable={!otpSent}
        />
        <TextInput
          style={styles.input}
          placeholder="Business Type (e.g., Electronics)"
          placeholderTextColor="#888"
          value={form.businessType}
          onChangeText={(val) => handleChange("businessType", val)}
          editable={!otpSent}
        />
        <TextInput
          style={styles.input}
          placeholder="GST Number (Optional)"
          placeholderTextColor="#888"
          value={form.gstNo}
          onChangeText={(val) => handleChange("gstNo", val)}
          editable={!otpSent}
        />

        <TouchableOpacity
          style={styles.imagePicker}
          onPress={handlePickImage}
          disabled={otpSent}
        >
          <FontAwesome name="image" size={24} color="#009632" />
          <Text style={styles.imagePickerText}>
            {form.shopImage ? "Change Shop Image" : "Select Shop Image"}
          </Text>
        </TouchableOpacity>
        {form.shopImage && (
          <Image
            source={{ uri: form.shopImage.uri }}
            style={styles.imagePreview}
          />
        )}

        <Text style={styles.sectionTitle}>Business Address</Text>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleFetchLocation}
          disabled={loadingAddress || otpSent}
        >
          {loadingAddress ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome name="map-marker" size={20} color="white" />
              <Text style={styles.locationButtonText}>
                Use Current Location
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Pincode"
          placeholderTextColor="#888"
          value={form.address.pincode}
          onChangeText={(val) => handleChange("address.pincode", val)}
          keyboardType="number-pad"
          editable={!otpSent}
        />
        <TextInput
          style={styles.input}
          placeholder="State"
          placeholderTextColor="#888"
          value={form.address.state}
          onChangeText={(val) => handleChange("address.state", val)}
          editable={!otpSent}
        />
        <TextInput
          style={styles.input}
          placeholder="District"
          placeholderTextColor="#888"
          value={form.address.district}
          onChangeText={(val) => handleChange("address.district", val)}
          editable={!otpSent}
        />
        <TextInput
          style={styles.input}
          placeholder="Country"
          placeholderTextColor="#888"
          value={form.address.country}
          onChangeText={(val) => handleChange("address.country", val)}
          editable={!otpSent}
        />

        {/* --- OTP INPUT --- */}
        {registerMethod === "otp" && otpSent && (
          <TextInput
            style={[
              styles.input,
              {
                letterSpacing: 5,
                textAlign: "center",
                fontSize: 20,
                marginTop: 15,
              },
            ]}
            placeholder="Enter 6-Digit OTP"
            placeholderTextColor="#888"
            value={otpCode}
            onChangeText={setOtpCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
          />
        )}

        {/* --- BUTTONS --- */}
        {registerMethod === "password" ? (
          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>
        ) : !otpSent ? (
          <TouchableOpacity
            style={styles.button}
            onPress={handleSendOtp}
            disabled={sendingOtp}
          >
            {sendingOtp ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get OTP</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify & Register</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.navigate("VendorLogin")}>
          <Text style={styles.link}>Already a vendor? Login here</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  contentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#005612",
    justifyContent: "center",
    alignItems: "center",
  },
  logoB: { color: "#FFFFFF", fontSize: 32, fontWeight: "bold" },
  logoText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#009632",
    marginLeft: 12,
  },
  title: { color: "white", fontSize: 28, fontWeight: "bold", marginTop: 20 },
  subtitle: { color: "white", fontSize: 16, marginBottom: 30 },

  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    width: "100%",
  },
  toggleButton: { paddingVertical: 10, flex: 1, alignItems: "center" },
  activeToggle: { borderBottomColor: "#009632", borderBottomWidth: 2 },
  toggleText: { fontSize: 16, fontWeight: "bold" },
  activeToggleText: { color: "#009632" },
  inactiveToggleText: { color: "#888888" },

  form: { width: "100%" },
  input: {
    backgroundColor: "black",
    color: "white",
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#555",
    paddingHorizontal: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#555",
    marginBottom: 15,
  },
  passwordInput: { flex: 1, color: "white", height: 50, fontSize: 16 },
  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    padding: 15,
    borderRadius: 8,
    justifyContent: "center",
    marginBottom: 15,
  },
  imagePickerText: { color: "#009632", marginLeft: 10, fontWeight: "bold" },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 15,
    borderTopColor: "#333",
    borderTopWidth: 1,
    paddingTop: 15,
  },
  locationButton: {
    flexDirection: "row",
    backgroundColor: "#005612",
    padding: 15,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  locationButtonText: { color: "white", fontWeight: "bold", marginLeft: 10 },
  button: {
    backgroundColor: "#009632",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  link: {
    color: "#009632",
    textAlign: "center",
    fontWeight: "bold",
    marginTop: 20,
  },
});
