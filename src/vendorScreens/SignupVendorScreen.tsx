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
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";

// --- Redux Imports ---
import { registerVendor } from "../features/vendor/vendorAuthSlice";
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

// --- Main Component ---
export default function SignupVendorScreen() {
  const navigation = useNavigation<SignupVendorScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector(
    (state: RootState) => state.vendorAuth
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    shopName: "",
    businessType: "",
    gstNo: "", // <--- ADDED: New state for GST Number
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
        "Permission to access location was denied."
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
        }
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
        "Could not fetch address. Please enter it manually."
      );
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleSubmit = async () => {
    // --- Validation ---
    // Perform basic validation for required fields
    if (
      !form.name ||
      !form.email ||
      !form.password ||
      !form.phone ||
      !form.shopName ||
      !form.businessType
    ) {
      Alert.alert("Validation Error", "Please fill all required fields.");
      return;
    }
    if (
      !form.address.pincode ||
      !form.address.state ||
      !form.address.district ||
      !form.address.country
    ) {
      Alert.alert("Validation Error", "Please fill all address fields.");
      return;
    }

    const formData = new FormData();
    Object.keys(form).forEach((key) => {
      // Handle the case where the key is gstNo and the value is empty
      if (key === "gstNo" && form.gstNo === "") {
        // Do not append gstNo to FormData if it's an empty string.
        // The backend will handle this as a null value.
        return;
      }

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

    const result = await dispatch(registerVendor(formData as any));

    if (registerVendor.rejected.match(result)) {
      const errorMessage =
        typeof result.payload === "string"
          ? result.payload
          : "Registration failed. Please try again.";
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

      {/* --- Form --- */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#888"
          value={form.name}
          onChangeText={(val) => handleChange("name", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={form.email}
          onChangeText={(val) => handleChange("email", val)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#888"
            value={form.password}
            onChangeText={(val) => handleChange("password", val)}
            secureTextEntry={!showPassword}
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
        />
        <TextInput
          style={styles.input}
          placeholder="Shop Name"
          placeholderTextColor="#888"
          value={form.shopName}
          onChangeText={(val) => handleChange("shopName", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="Business Type (e.g., Electronics)"
          placeholderTextColor="#888"
          value={form.businessType}
          onChangeText={(val) => handleChange("businessType", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="GST Number (Optional)" // <--- ADDED: New Input Field
          placeholderTextColor="#888"
          value={form.gstNo}
          onChangeText={(val) => handleChange("gstNo", val)}
        />

        {/* --- Image Picker --- */}
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
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

        {/* --- Address Section --- */}
        <Text style={styles.sectionTitle}>Business Address</Text>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleFetchLocation}
          disabled={loadingAddress}
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
        />
        <TextInput
          style={styles.input}
          placeholder="State"
          placeholderTextColor="#888"
          value={form.address.state}
          onChangeText={(val) => handleChange("address.state", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="District"
          placeholderTextColor="#888"
          value={form.address.district}
          onChangeText={(val) => handleChange("address.district", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="Country"
          placeholderTextColor="#888"
          value={form.address.country}
          onChangeText={(val) => handleChange("address.country", val)}
        />

        {/* --- Submit Button --- */}
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

        <TouchableOpacity onPress={() => navigation.navigate("VendorLogin")}>
          <Text style={styles.link}>Already a vendor? Login here</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
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
  },
  logoText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#009632",
    marginLeft: 12,
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 20,
  },
  subtitle: {
    color: "white",
    fontSize: 16,
    marginBottom: 30,
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
    color: "white",
    height: 50,
    fontSize: 16,
  },
  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    padding: 15,
    borderRadius: 8,
    justifyContent: "center",
    marginBottom: 15,
  },
  imagePickerText: {
    color: "#009632",
    marginLeft: 10,
    fontWeight: "bold",
  },
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
  locationButtonText: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 10,
  },
  button: {
    backgroundColor: "#009632",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  link: {
    color: "#009632",
    textAlign: "center",
    fontWeight: "bold",
    marginTop: 20,
  },
});
