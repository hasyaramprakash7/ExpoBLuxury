// ---------------------------------------------------------------- //
// FILE: ../screens/VendorLoginScreen.tsx
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
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome } from "@expo/vector-icons";
import { loginVendor } from "../features/vendor/vendorAuthSlice";
import { RootState, AppDispatch } from "../app/store";

type AuthStackParamList = {
  Login: undefined;
  SignupVendor: undefined;
  VendorLogin: undefined;
};
type VendorLoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "VendorLogin"
>;

export default function VendorLoginScreen() {
  const navigation = useNavigation<VendorLoginScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector(
    (state: RootState) => state.vendorAuth
  );

  const [identifier, setIdentifier] = useState(""); // State changed from 'email'
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!identifier || !password) {
      Alert.alert("Validation Error", "Please enter your credentials.");
      return;
    }

    // Dispatch with the 'identifier' field
    const result = await dispatch(loginVendor({ identifier, password }));

    if (loginVendor.rejected.match(result)) {
      const errorMessage =
        typeof result.payload === "string"
          ? result.payload
          : "Login failed. Please check your credentials.";
      Alert.alert("Login Failed", errorMessage);
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
      <Text style={styles.title}>Vendor Login</Text>
      <Text style={styles.subtitle}>Access your vendor dashboard</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email or Phone Number" // Updated placeholder
          placeholderTextColor="#888"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            <FontAwesome
              name={showPassword ? "eye-slash" : "eye"}
              size={20}
              color="white"
            />
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error as string}</Text>}

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.linkContainer}>
          <Text style={styles.linkText}>Don't have a vendor account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignupVendor")}>
            <Text style={styles.link}>Register here</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.linkContainer}>
          <Text style={styles.linkText}>Not a vendor? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.link}>Login as User</Text>
          </TouchableOpacity>
        </View>
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
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  logoText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#009632",
    marginLeft: 12,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 20,
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
  linkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  linkText: {
    color: "white",
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  link: {
    color: "#009632",
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
});
