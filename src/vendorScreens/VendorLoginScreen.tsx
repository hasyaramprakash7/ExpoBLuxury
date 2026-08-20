// FILE: ../screens/VendorLoginScreen.tsx
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
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome } from "@expo/vector-icons";
import axios from "axios";
import config from "../config/config";
import {
  loginVendor,
  loginVendorWithOtp,
} from "../features/vendor/vendorAuthSlice";
import { RootState, AppDispatch } from "../app/store";
import { registerForPushNotificationsAsync } from "../userScreens/utils/NotificationHelper";

type AuthStackParamList = {
  Login: undefined;
  SignupVendor: undefined;
  VendorLogin: undefined;
  UserTabs: undefined;
};
type VendorLoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "VendorLogin"
>;

export default function VendorLoginScreen() {
  const navigation = useNavigation<VendorLoginScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error, vendor } = useSelector(
    (state: RootState) => state.vendorAuth,
  );
  const { user } = useSelector((state: RootState) => state.auth);

  // --- STATE ---
  const [loginMethod, setLoginMethod] = useState<"otp" | "password">("otp");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // --- 🔥 LOG: Monitor vendor push token after login ---
  useEffect(() => {
    if (vendor) {
      console.log('📱 [VendorLoginScreen] Vendor logged in:', vendor._id);
      console.log('📱 [VendorLoginScreen] Vendor pushToken:', vendor.pushToken);
    }
  }, [vendor]);

  // --- HANDLERS ---
  const handlePasswordLogin = async () => {
    if (!identifier || !password) {
      Alert.alert("Validation Error", "Please enter your credentials.");
      return;
    }
    console.log('🔑 [VendorLoginScreen] Dispatching loginVendor with identifier:', identifier);
    const result = await dispatch(loginVendor({ identifier, password }));
    console.log('📦 [VendorLoginScreen] Login result:', result);
    if (loginVendor.rejected.match(result)) {
      const errorMessage =
        typeof result.payload === "string" ? result.payload : "Login failed.";
      Alert.alert("Login Failed", errorMessage);
    }
  };

  const handleSendOtp = async () => {
    if (!identifier)
      return Alert.alert("Error", "Please enter your phone number.");
    setSendingOtp(true);
    try {
      console.log('📤 [VendorLoginScreen] Sending OTP to:', identifier);
      await axios.post(`${config.apiUrl}/auth/send-otp`, { phone: identifier });
      setOtpSent(true);
      Alert.alert("Success", "OTP Sent to your phone");
    } catch (err: any) {
      console.error('❌ [VendorLoginScreen] OTP send error:', err.response?.data || err.message);
      Alert.alert("Error", err.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!identifier || !otpCode)
      return Alert.alert("Error", "Please enter phone and OTP.");
    console.log('🔑 [VendorLoginScreen] Dispatching loginVendorWithOtp for:', identifier);
    const result = await dispatch(
      loginVendorWithOtp({ phone: identifier, otp: otpCode }),
    );
    console.log('📦 [VendorLoginScreen] OTP Login result:', result);
    if (loginVendorWithOtp.rejected.match(result)) {
      const errorMessage =
        typeof result.payload === "string" ? result.payload : "Invalid OTP.";
      Alert.alert("Login Failed", errorMessage);
    }
  };

  // ✅ Handle navigation based on user authentication state
  const handleNavigateToUserLogin = () => {
    if (user?.token) {
      // ✅ User is already logged in, go to UserTabs
      console.log('👤 [VendorLoginScreen] User already logged in, navigating to UserTabs');
      navigation.navigate('UserTabs' as never);
    } else {
      // ✅ User is not logged in, go to Login screen
      console.log('👤 [VendorLoginScreen] User not logged in, navigating to Login');
      navigation.navigate('Login' as never);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
            {/* 🔥 LOGIN METHOD TOGGLE */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  loginMethod === "otp" && styles.activeToggle,
                ]}
                onPress={() => setLoginMethod("otp")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    loginMethod === "otp"
                      ? styles.activeToggleText
                      : styles.inactiveToggleText,
                  ]}
                >
                  OTP
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  loginMethod === "password" && styles.activeToggle,
                ]}
                onPress={() => {
                  setLoginMethod("password");
                  setOtpSent(false);
                }}
              >
                <Text
                  style={[
                    styles.toggleText,
                    loginMethod === "password"
                      ? styles.activeToggleText
                      : styles.inactiveToggleText,
                  ]}
                >
                  Password
                </Text>
              </TouchableOpacity>
            </View>

            {/* --- IDENTIFIER INPUT --- */}
            <TextInput
              style={styles.input}
              placeholder={
                loginMethod === "otp"
                  ? "Phone Number (e.g. 9876543210)"
                  : "Email or Phone Number"
              }
              placeholderTextColor="#888"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType={loginMethod === "otp" ? "phone-pad" : "default"}
              editable={!(loginMethod === "otp" && otpSent)}
            />

            {/* --- PASSWORD INPUT --- */}
            {loginMethod === "password" && (
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
            )}

            {/* --- OTP INPUT --- */}
            {loginMethod === "otp" && otpSent && (
              <TextInput
                style={[
                  styles.input,
                  { letterSpacing: 5, textAlign: "center", fontSize: 20 },
                ]}
                placeholder="Enter 6-Digit OTP"
                placeholderTextColor="#888"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
              />
            )}

            {error && <Text style={styles.errorText}>{error as string}</Text>}

            {/* --- BUTTONS --- */}
            {loginMethod === "password" ? (
              <TouchableOpacity
                style={styles.button}
                onPress={handlePasswordLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
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
                onPress={handleOtpSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Login</Text>
                )}
              </TouchableOpacity>
            )}

            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>Don't have a vendor account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("SignupVendor")}
              >
                <Text style={styles.link}>Register here</Text>
              </TouchableOpacity>
            </View>
            
            {/* ✅ Updated: "Login as User" - checks if user is already logged in */}
            <View style={styles.linkContainer}>
              <Text style={styles.linkText}>
                {user?.token ? "Switch to User Mode? " : "Not a vendor? "}
              </Text>
              <TouchableOpacity onPress={handleNavigateToUserLogin}>
                <Text style={styles.link}>
                  {user?.token ? "Go to User Dashboard" : "Login as User"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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

  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
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
  eyeIcon: { padding: 10 },
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
  errorText: { color: "#ef4444", textAlign: "center", marginBottom: 10 },
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