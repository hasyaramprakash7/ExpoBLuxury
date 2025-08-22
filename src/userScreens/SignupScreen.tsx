// ---------------------------------------------------------------- //
// FILE: ../screens/SignupScreen.tsx
// ---------------------------------------------------------------- //
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, Platform,
} from "react-native";
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { FontAwesome } from "@expo/vector-icons";
import config from "../config/config";

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

type SignupScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Signup"
>;

export default function SignupScreen() {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: {
      latitude: "",
      longitude: "",
      pincode: "",
      state: "",
      district: "",
      country: "India",
    },
  });

  const [loadingAddress, setLoadingAddress] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  useEffect(() => {
    const fetchLocation = async () => {
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
        const position = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = position.coords;

        setForm((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            latitude: String(latitude),
            longitude: String(longitude),
          },
        }));

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
        setModalMessage("Address auto-filled from your location.");
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
        setModalMessage("Address details updated based on pincode.");
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

  const handleSubmit = async () => {
    if (
      !form.name || !form.email || !form.password || !form.phone || !form.address.pincode
    ) {
      setSignupError("Please fill in all required fields.");
      return;
    }

    setLoadingSubmit(true);
    setSignupError("");

    const payload = {
      ...form,
      address: {
        ...form.address,
        latitude: form.address.latitude ? parseFloat(form.address.latitude) : null,
        longitude: form.address.longitude ? parseFloat(form.address.longitude) : null,
      },
    };

    try {
      await axios.post(`${config.apiUrl}/auth/register`, payload);
      Alert.alert("Success", "Signup successful! Please proceed to login.", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Signup failed. Please try again.";
      setSignupError(errorMessage);
      console.error("Signup failed:", err.response?.data || err);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <ScrollView
      style={signupStyles.container}
      contentContainerStyle={signupStyles.contentContainer}
    >
      <Modal
        transparent={true}
        visible={!!modalMessage}
        onRequestClose={() => setModalMessage("")}
      >
        <View style={signupStyles.modalOverlay}>
          <View style={signupStyles.modalContent}>
            <Text style={signupStyles.modalText}>{modalMessage}</Text>
            <TouchableOpacity
              style={signupStyles.modalButton}
              onPress={() => setModalMessage("")}
            >
              <Text style={signupStyles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={signupStyles.logoContainer}>
        <View style={signupStyles.logoCircle}>
          <Text style={signupStyles.logoB}>B</Text>
        </View>
        <Text style={signupStyles.logoText}>Luxury</Text>
      </View>
      <Text style={signupStyles.subtitle}>Join us and explore amazing features!</Text>

      <View style={signupStyles.form}>
        <TextInput
          style={signupStyles.input}
          placeholder="Full Name"
          placeholderTextColor="#888"
          value={form.name}
          onChangeText={(value) => handleChange("name", value)}
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

        <View style={signupStyles.addressHeader}>
          <FontAwesome name="map-marker" size={24} color="#009632" />
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
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
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
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  modalText: {
    fontSize: 18,
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    color: "#1a1a1a",
    fontWeight: "bold",
  },
});

