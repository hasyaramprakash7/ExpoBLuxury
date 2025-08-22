// ---------------------------------------------------------------- //
// FILE: ../screens/LoginScreen.tsx
// ---------------------------------------------------------------- //
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../features/user/authSlice";
import { Ionicons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";

// Define your root stack navigator parameters if you haven't already
// This is typically done in your navigator setup file
type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  VendorLogin: undefined;
  DeliveryLogin: undefined;
  UserTabs: undefined; // Make sure 'UserTabs' is defined here
  // ... other routes in your root stack
};

type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Login"
>;

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const dispatch = useDispatch();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { loading, error } = useSelector((state: any) => state.auth);

  const colors = {
    background: "#000000",
    text: "#FFFFFF",
    inputBg: "#1A1A1A",
    inputBorder: "#333333",
    primary: "#009632",
    error: "#ef4444",
  };

  const handleSubmit = async () => {
    if (!identifier || !password) {
      Alert.alert("Missing Information", "Please enter your credentials.");
      return;
    }

    try {
      const resultAction = await dispatch(loginUser({ identifier, password }));

      if (loginUser.fulfilled.match(resultAction)) {
        // Login successful.
        // DO NOT MANUALLY NAVIGATE HERE.
        // The AppNavigator (in App.tsx) will automatically
        // transition to 'UserTabs' because the Redux user token state
        // has changed, which causes AppNavigator to re-evaluate its initialRouteName.
        console.log("Login successful. AppNavigator will handle navigation.");
      } else {
        const errorMessage =
          resultAction.payload ||
          "Login failed. Please check your credentials.";
        Alert.alert("Login Failed", errorMessage);
      }
    } catch (err) {
      Alert.alert("Login Error", "An unexpected error occurred.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>B</Text>
        </View>
        <Text style={styles.title}>BLuxury</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.text }]}>
        Welcome back!
      </Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            color: colors.text,
            borderColor: colors.inputBorder,
          },
        ]}
        placeholder="Email or Phone Number"
        placeholderTextColor="#888"
        value={identifier}
        onChangeText={setIdentifier}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View
        style={[
          styles.input,
          styles.passwordContainer,
          { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
        ]}
      >
        <TextInput
          style={{ flex: 1, color: colors.text }}
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? "eye-off" : "eye"}
            size={24}
            color="#888"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.text }]}>
          Are you a vendor or delivery partner?
        </Text>
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => navigation.navigate("VendorLogin")}>
            <Text style={styles.linkText}>Vendor Sign-in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("DeliveryBoyLogin")}
          >
            <Text style={styles.linkText}>Delivery Partner Sign-in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  title: { fontSize: 32, fontWeight: "bold", marginLeft: 10, color: "#FFFFFF" },
  subtitle: { fontSize: 18, textAlign: "center", marginBottom: 30 },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: { flexDirection: "row", alignItems: "center" },
  button: {
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  linkText: {
    color: "#009632",
    textAlign: "center",
    marginTop: 20,
    fontWeight: "bold",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#333333",
    paddingTop: 20,
    marginTop: 30,
    alignItems: "center",
  },
  footerText: { marginBottom: 10 },
  footerLinks: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
});
