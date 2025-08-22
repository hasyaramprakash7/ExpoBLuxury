import React, { useState, useEffect } from "react";
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
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";

import { useDispatch } from "react-redux";
import { registerDeliveryBoy } from "../features/deliveryBoy/deliveryBoyOrderSlice";
import { AppDispatch } from "../app/store";

// Define the type for your navigation stack
type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  DeliveryBoyLogin: undefined;
};

type SignupScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Signup"
>;

/**
 * Signup screen for a Delivery Boy.
 * This component handles user input for registration, fetches location
 * automatically, and submits the data to the backend via a Redux thunk.
 */
export default function SignupScreen() {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();

  // Form state to hold all user inputs, including nested address details.
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    shopName: "", // The delivery boy's shop/business name
    businessType: "", // The type of business (e.g., grocery, restaurant)
    vehicleNo: "",
    licenseNo: "",
    address: {
      latitude: "",
      longitude: "",
      pincode: "",
      state: "",
      district: "",
      country: "India",
    },
  });

  // State for image picker, loading indicators, and error messages
  const [shopImage, setShopImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupError, setSignupError] = useState("");

  // Effect to automatically fetch the user's location on component mount.
  useEffect(() => {
    const fetchLocation = async () => {
      // Request permission to access the device's location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission to access location was denied. Please enter your address manually."
        );
        return;
      }

      setLoadingAddress(true);
      try {
        // Get the current geographic position
        const position = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = position.coords;

        // Update form state with latitude and longitude
        setForm((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            latitude: String(latitude),
            longitude: String(longitude),
          },
        }));

        // Use a reverse geocoding API to get address details from coordinates.
        // We are using Nominatim here, a free and open-source service.
        const response = await axios.get(
          "https://nominatim.openstreetmap.org/reverse",
          {
            headers: { "User-Agent": "BLuxuryApp/1.0 (contact@bluxury.com)" },
            params: {
              lat: latitude,
              lon: longitude,
              format: "json",
              addressdetails: 1,
            },
          }
        );

        const address = response.data.address || {};
        // Auto-fill address fields from the API response
        setForm((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            pincode: address.postcode || "",
            state: address.state || "",
            district: address.county || address.city_district || "",
            country: address.country || "India",
          },
        }));
        Alert.alert(
          "Location Auto-filled",
          "Address auto-filled from your location."
        );
      } catch (error) {
        console.error("Error fetching location/address:", error);
        Alert.alert(
          "Error",
          "Could not fetch address details automatically. Please enter manually."
        );
      } finally {
        setLoadingAddress(false);
      }
    };

    fetchLocation();
  }, []);

  /**
   * Fetches address details from a pincode when the pincode input field loses focus.
   * This provides a fallback or alternative to location-based autofill.
   */
  const handlePincodeBlur = async () => {
    const { pincode } = form.address;
    if (!pincode || pincode.length !== 6) return;

    setLoadingAddress(true);
    try {
      const res = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          headers: { "User-Agent": "BLuxuryApp/1.0 (contact@bluxury.com)" },
          params: {
            postalcode: pincode,
            format: "json",
            addressdetails: 1,
            countrycodes: "in",
          },
        }
      );

      if (res.data.length > 0) {
        const address = res.data[0].address;
        setForm((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            state: address.state || "",
            district: address.county || address.city_district || "",
            country: address.country || "India",
          },
        }));
        Alert.alert(
          "Pincode Matched",
          "Address details updated based on pincode."
        );
      } else {
        Alert.alert("Not Found", "No address found for this pincode.");
      }
    } catch (err) {
      console.error("Error fetching address from pincode:", err);
      Alert.alert("Error", "Failed to fetch address from pincode.");
    } finally {
      setLoadingAddress(false);
    }
  };

  // Handles selecting an image from the device's library.
  const handleImagePicker = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setShopImage(result.assets[0]);
    }
  };

  // Generic handler for form input changes.
  const handleChange = (name: string, value: string) => {
    setSignupError("");
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

  // Handles form submission, including validation and API call.
  const handleSubmit = async () => {
    // Basic validation to ensure all required fields are filled.
    if (
      !form.name ||
      !form.email ||
      !form.password ||
      !form.phone ||
      !form.address.pincode ||
      !form.vehicleNo ||
      !form.licenseNo ||
      !form.shopName ||
      !form.businessType
    ) {
      setSignupError("Please fill in all required fields.");
      return;
    }

    setLoadingSubmit(true);
    setSignupError("");

    // Use FormData to handle the file upload and other form data.
    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("email", form.email);
    formData.append("password", form.password);
    formData.append("phone", form.phone);
    formData.append("vehicleNo", form.vehicleNo);
    formData.append("licenseNo", form.licenseNo);
    formData.append("shopName", form.shopName);
    formData.append("businessType", form.businessType);

    // Append the image data if an image was selected.
    if (shopImage) {
      const uri = shopImage.uri;
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename || "");
      const type = match ? `image/${match[1]}` : `image`;

      formData.append("shopImage", {
        uri: uri,
        name: filename,
        type: type,
      } as any);
    }

    // Append the address as a JSON string.
    formData.append(
      "address",
      JSON.stringify({
        ...form.address,
        latitude: form.address.latitude
          ? parseFloat(form.address.latitude)
          : null,
        longitude: form.address.longitude
          ? parseFloat(form.address.longitude)
          : null,
      })
    );

    try {
      const resultAction = await dispatch(registerDeliveryBoy(formData));

      if (registerDeliveryBoy.fulfilled.match(resultAction)) {
        Alert.alert("Success", "Signup successful! Please proceed to login.", [
          {
            text: "OK",
            onPress: () => navigation.navigate("DeliveryBoyLogin"),
          },
        ]);
      } else if (registerDeliveryBoy.rejected.match(resultAction)) {
        const errorMessage =
          resultAction.payload || "Signup failed. Please try again.";
        setSignupError(errorMessage);
        console.error("Signup failed:", errorMessage);
      }
    } catch (err: any) {
      setSignupError("An unexpected error occurred during signup.");
      console.error("Signup failed (unexpected error):", err);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <ScrollView
      style={signupStyles.container}
      contentContainerStyle={signupStyles.contentContainer}
    >
      <View style={signupStyles.logoContainer}>
        <View style={signupStyles.logoCircle}>
          <Text style={signupStyles.logoB}>B</Text>
        </View>
        <Text style={signupStyles.logoText}>Luxury</Text>
      </View>
      <Text style={signupStyles.subtitle}>
        Join us and explore amazing features!
      </Text>

      <View style={signupStyles.form}>
        <TextInput
          style={signupStyles.input}
          placeholder="Full Name"
          placeholderTextColor="#888"
          value={form.name}
          onChangeText={(value) => handleChange("name", value)}
          autoCapitalize="words"
        />
        <TextInput
          style={signupStyles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={form.email}
          onChangeText={(value) => handleChange("email", value)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={signupStyles.passwordContainer}>
          <TextInput
            style={signupStyles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#888"
            value={form.password}
            onChangeText={(value) => handleChange("password", value)}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={signupStyles.eyeIcon}
          >
            <FontAwesome
              name={showPassword ? "eye-slash" : "eye"}
              size={20}
              color="white"
            />
          </TouchableOpacity>
        </View>
        <TextInput
          style={signupStyles.input}
          placeholder="Phone Number"
          placeholderTextColor="#888"
          value={form.phone}
          onChangeText={(value) => handleChange("phone", value)}
          keyboardType="phone-pad"
        />
        <TextInput
          style={signupStyles.input}
          placeholder="Shop Name"
          placeholderTextColor="#888"
          value={form.shopName}
          onChangeText={(value) => handleChange("shopName", value)}
        />
        <TextInput
          style={signupStyles.input}
          placeholder="Business Type"
          placeholderTextColor="#888"
          value={form.businessType}
          onChangeText={(value) => handleChange("businessType", value)}
        />
        <TouchableOpacity
          style={signupStyles.imagePickerButton}
          onPress={handleImagePicker}
        >
          <Text style={signupStyles.imagePickerButtonText}>
            {shopImage ? "Change Shop Image" : "Select Shop Image (Optional)"}
          </Text>
        </TouchableOpacity>
        {shopImage && (
          <Image
            source={{ uri: shopImage.uri }}
            style={signupStyles.shopImagePreview}
          />
        )}

        <TextInput
          style={signupStyles.input}
          placeholder="Vehicle Number (e.g., AP01AB1234)"
          placeholderTextColor="#888"
          value={form.vehicleNo}
          onChangeText={(value) => handleChange("vehicleNo", value)}
          autoCapitalize="characters"
        />
        <TextInput
          style={signupStyles.input}
          placeholder="License Number"
          placeholderTextColor="#888"
          value={form.licenseNo}
          onChangeText={(value) => handleChange("licenseNo", value)}
          autoCapitalize="characters"
        />

        <View style={signupStyles.addressHeader}>
          <MaterialCommunityIcons name="map-marker" size={24} color="#009632" />
          <Text style={signupStyles.addressTitle}>Your Address</Text>
          {loadingAddress && (
            <ActivityIndicator style={{ marginLeft: 10 }} color="#009632" />
          )}
        </View>

        <TextInput
          style={signupStyles.input}
          placeholder="Pincode"
          placeholderTextColor="#888"
          value={form.address.pincode}
          onChangeText={(value) => handleChange("address.pincode", value)}
          onBlur={handlePincodeBlur}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TextInput
          style={signupStyles.input}
          placeholder="State"
          placeholderTextColor="#888"
          value={form.address.state}
          onChangeText={(v) => handleChange("address.state", v)}
        />
        <TextInput
          style={signupStyles.input}
          placeholder="District"
          placeholderTextColor="#888"
          value={form.address.district}
          onChangeText={(v) => handleChange("address.district", v)}
        />
        <TextInput
          style={signupStyles.input}
          placeholder="Country"
          placeholderTextColor="#888"
          value={form.address.country}
          onChangeText={(v) => handleChange("address.country", v)}
        />

        {signupError ? (
          <Text style={signupStyles.errorText}>{signupError}</Text>
        ) : null}

        <TouchableOpacity
          style={signupStyles.button}
          onPress={handleSubmit}
          disabled={loadingSubmit}
        >
          {loadingSubmit ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={signupStyles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={signupStyles.loginLinkContainer}>
          <Text style={signupStyles.loginText}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("DeliveryBoyLogin")}
          >
            <Text style={signupStyles.loginLink}>Log in here</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const signupStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
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
  logoB: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  logoText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#009632",
    marginLeft: 12,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  subtitle: {
    color: "white",
    fontSize: 16,
    marginBottom: 30,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  form: {
    width: "100%",
  },
  input: {
    backgroundColor: "black",
    color: "white",
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#555",
    paddingHorizontal: 5,
    marginBottom: 15,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#555",
    marginBottom: 15,
  },
  passwordInput: {
    flex: 1,
    backgroundColor: "black",
    color: "white",
    height: 50,
    paddingHorizontal: 5,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  eyeIcon: {
    padding: 10,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
  },
  addressTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 10,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  imagePickerButton: {
    backgroundColor: "#333",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  imagePickerButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  shopImagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
    resizeMode: "cover",
  },
  button: {
    backgroundColor: "#007722",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 10,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  loginText: {
    color: "white",
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  loginLink: {
    color: "#009632",
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
});
