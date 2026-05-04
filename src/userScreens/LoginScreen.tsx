import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { loginWithOtp, loginUser } from "../features/user/authSlice";
import { StackNavigationProp } from "@react-navigation/stack";
import axios from "axios";
import config from "../config/config";

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  VendorLogin: undefined;
  DeliveryLogin: undefined;
  UserTabs: undefined;
  DeliveryBoyLogin: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Login"
>;

export default function LoginScreen() {
  // --- STATE ---
  // 🔥 Default is now "otp"
  const [loginMethod, setLoginMethod] = useState<"otp" | "password">("otp");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  const dispatch = useDispatch<any>();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { loading } = useSelector((state: any) => state.auth);

  const colors = {
    background: "#000000",
    text: "#FFFFFF",
    inputBg: "#1A1A1A",
    inputBorder: "#333333",
    primary: "#009632",
    inactiveText: "#888888",
  };

  // --- PASSWORD LOGIN HANDLER ---
  const handlePasswordLogin = async () => {
    if (!identifier || !password) {
      return Alert.alert(
        "Error",
        "Please enter your phone/email and password.",
      );
    }
    try {
      const resultAction = await dispatch(loginUser({ identifier, password }));
      if (loginUser.fulfilled.match(resultAction)) {
        console.log("Password login successful.");
      } else {
        Alert.alert(
          "Login Failed",
          (resultAction.payload as string) || "Invalid credentials",
        );
      }
    } catch (err) {
      Alert.alert("Error", "Unexpected error occurred.");
    }
  };

  // --- OTP SEND HANDLER ---
  const handleSendOtp = async () => {
    if (!identifier)
      return Alert.alert("Error", "Please enter your phone number.");
    setSendingOtp(true);
    try {
      await axios.post(`${config.apiUrl}/auth/send-otp`, { phone: identifier });
      setOtpSent(true);
      Alert.alert("Success", "OTP Sent to your phone");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  // --- OTP VERIFY HANDLER ---
  const handleOtpSubmit = async () => {
    if (!identifier || !otpCode)
      return Alert.alert("Error", "Please enter phone and OTP.");
    try {
      const resultAction = await dispatch(
        loginWithOtp({ phone: identifier, otp: otpCode }),
      );
      if (loginWithOtp.fulfilled.match(resultAction)) {
        console.log("OTP login successful.");
      } else {
        Alert.alert(
          "Login Failed",
          (resultAction.payload as string) || "Invalid OTP",
        );
      }
    } catch (err) {
      Alert.alert("Error", "Unexpected error occurred.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { backgroundColor: colors.background },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={[styles.logo, { backgroundColor: colors.primary }]}>
              <Text style={styles.logoText}>UT</Text>
            </View>
            <Text style={styles.title}>UsmanTrading</Text>
          </View>

          <Text style={[styles.subtitle, { color: colors.text }]}>
            Welcome back! Please login.
          </Text>

          {/* 🔥 LOGIN METHOD TOGGLE - OTP IS NOW FIRST */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                loginMethod === "otp" && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => {
                setLoginMethod("otp");
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  {
                    color:
                      loginMethod === "otp"
                        ? colors.primary
                        : colors.inactiveText,
                  },
                ]}
              >
                OTP
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleButton,
                loginMethod === "password" && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => {
                setLoginMethod("password");
                setOtpSent(false); // Reset OTP state if they switch away
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  {
                    color:
                      loginMethod === "password"
                        ? colors.primary
                        : colors.inactiveText,
                  },
                ]}
              >
                Password
              </Text>
            </TouchableOpacity>
          </View>

          {/* --- COMMON INPUT: PHONE/EMAIL --- */}
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.inputBorder,
              },
            ]}
            placeholder={
              loginMethod === "otp"
                ? "Phone Number (e.g. 9876543210)"
                : "Phone Number or Email"
            }
            placeholderTextColor="#888"
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType={loginMethod === "otp" ? "phone-pad" : "default"}
            autoCapitalize="none"
            editable={!(loginMethod === "otp" && otpSent)} // Disable if OTP sent
          />

          {/* --- CONDITIONAL INPUT: PASSWORD --- */}
          {loginMethod === "password" && (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.inputBorder,
                },
              ]}
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
          )}

          {/* --- CONDITIONAL INPUT: OTP --- */}
          {loginMethod === "otp" && otpSent && (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.inputBorder,
                  letterSpacing: 5,
                  textAlign: "center",
                  fontSize: 20,
                },
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

          {/* --- BUTTONS --- */}
          {loginMethod === "password" ? (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handlePasswordLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>
          ) : // OTP Button Flow
          !otpSent ? (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
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
              style={[styles.button, { backgroundColor: colors.primary }]}
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

          <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
            <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.text }]}>
              Are you a vendor or delivery partner?
            </Text>
            <View style={styles.footerLinks}>
              <TouchableOpacity
                onPress={() => navigation.navigate("VendorLogin")}
              >
                <Text style={styles.linkText}>Vendor Sign-in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate("DeliveryBoyLogin")}
              >
                <Text style={styles.linkText}>Delivery Partner Sign-in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, justifyContent: "center" },
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
  subtitle: { fontSize: 18, textAlign: "center", marginBottom: 20 },

  // 🔥 Toggle Styles
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  toggleButton: {
    paddingVertical: 10,
    flex: 1,
    alignItems: "center",
  },
  toggleText: {
    fontSize: 16,
    fontWeight: "bold",
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
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
