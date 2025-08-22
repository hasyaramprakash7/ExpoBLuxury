// screens/DeliveryBoyLogin.tsx
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";

import { loginDeliveryBoy } from "../features/deliveryBoy/deliveryBoyOrderSlice";
import { AppDispatch, RootState } from "../app/store";

type AuthStackParamList = {
  DeliveryBoyLogin: undefined;
  DeliveryBoySignup: undefined;
  DeliveryBoyDashboard: undefined;
  Login: undefined;
};

type DeliveryBoyLoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "DeliveryBoyLogin"
>;

export default function DeliveryBoyLogin() {
  const navigation = useNavigation<DeliveryBoyLoginScreenNavigationProp>();
  const dispatch: AppDispatch = useDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { loading: reduxLoading, error: reduxError } = useSelector(
    (state: RootState) => state.deliveryBoyAuth
  );

  const showNativeAlert = (
    title: string,
    message: string,
    onOk?: () => void
  ) => {
    Alert.alert(title, message, [{ text: "OK", onPress: onOk }], {
      cancelable: false,
    });
  };

  const handleSubmit = async () => {
    setLoginError("");
    setLoading(true);

    if (!email || !password) {
      setLoginError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      const resultAction = await dispatch(
        loginDeliveryBoy({ email, password })
      ).unwrap();

      const { deliveryBoy } = resultAction;

      await AsyncStorage.setItem("deliveryBoyId", deliveryBoy._id);

      showNativeAlert("Success", "Login successful!", () => {
        navigation.replace("DeliveryBoyDashboard");
      });
    } catch (error: any) {
      const errorMessage = error || "Login failed. Please try again.";
      setLoginError(errorMessage);
      console.error("Delivery Boy Login failed:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={loginStyles.container}
      contentContainerStyle={loginStyles.contentContainer}
    >
      <View style={loginStyles.logoContainer}>
        <View style={loginStyles.logoCircle}>
          <Text style={loginStyles.logoB}>B</Text>
        </View>
        <Text style={loginStyles.logoText}>Luxury</Text>
      </View>
      <Text style={loginStyles.subtitle}>Delivery Partner Login</Text>

      <View style={loginStyles.form}>
        {/* Email Field */}
        <View>
          <Text style={loginStyles.label}>Email</Text>
          <View style={loginStyles.inputContainer}>
            <MaterialCommunityIcons
              name="email"
              size={18}
              color="#888"
              style={loginStyles.icon}
            />
            <TextInput
              style={loginStyles.input}
              placeholder="Enter your email"
              placeholderTextColor="#888"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setLoginError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Password Field */}
        <View>
          <Text style={loginStyles.label}>Password</Text>
          <View style={loginStyles.inputContainer}>
            <MaterialCommunityIcons
              name="lock"
              size={18}
              color="#888"
              style={loginStyles.icon}
            />
            <TextInput
              style={loginStyles.input}
              placeholder="Enter your password"
              placeholderTextColor="#888"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setLoginError("");
              }}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={loginStyles.eyeIcon}
            >
              <FontAwesome
                name={showPassword ? "eye-slash" : "eye"}
                size={20}
                color="#888"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Message */}
        {(loginError || reduxError) && (
          <Text style={loginStyles.errorText}>{loginError || reduxError}</Text>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={loginStyles.button}
          onPress={handleSubmit}
          disabled={loading || reduxLoading}
        >
          {loading || reduxLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={loginStyles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        {/* Link to Register */}
        <View style={loginStyles.signupLinkContainer}>
          <Text style={loginStyles.signupText}>
            Don’t have a delivery account?{" "}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("DeliveryBoySignup")}
          >
            <Text style={loginStyles.signupLink}>Register here</Text>
          </TouchableOpacity>
        </View>

        {/* Link to User Login (optional) */}
        <View style={loginStyles.userLoginLinkContainer}>
          <Text style={loginStyles.userLoginText}>
            Not a delivery partner?{" "}
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={loginStyles.userLoginLink}>Login as User</Text>
            </TouchableOpacity>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// --- Stylesheet ---
const loginStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
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
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: "#1a1a1a",
    fontSize: 16,
    marginBottom: 30,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  form: {
    width: "100%",
    maxWidth: 400,
  },
  label: {
    color: "#1a1a1a",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginBottom: 15,
    paddingHorizontal: 10,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#1a1a1a",
    height: 50,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    backgroundColor: "#009632",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
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
    fontSize: 14,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "#ef4444",
    borderWidth: 1,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  signupLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  signupText: {
    color: "#1a1a1a",
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  signupLink: {
    color: "#009632",
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  userLoginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 5,
  },
  userLoginText: {
    color: "#1a1a1a",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
  userLoginLink: {
    color: "#1a1a1a",
    textDecorationLine: "underline",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Playfair Display" : "serif",
  },
});