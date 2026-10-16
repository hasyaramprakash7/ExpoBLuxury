import React, { useState, useEffect, useRef } from "react";
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
import {
  registerForPushNotificationsAsync,
  setupNotifications,a
} from "../userScreens/utils/NotificationHelper";

// SMS Retriever API — no SMS permission needed
import {
  getAppSignature,
  startSmsRetriever,
  addSmsListener,
  removeListener,
} from "@pushpendersingh/react-native-otp-verify";

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
  const [loginMethod, setLoginMethod] = useState<"otp" | "password">("otp");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  const dispatch = useDispatch<any>();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { loading, user } = useSelector((state: any) => state.auth);

  const pushRegisteredForUserRef = useRef<string | null>(null);
  const otpListenerActive = useRef(false);
  const autoSubmittedRef = useRef(false);

  const colors = {
    background: "#FFFFFF",
    text: "#0A0A0A",
    subText: "#6B7280",
    inputBg: "#F9FAFB",
    inputBorder: "#E5E7EB",
    primary: "#009632",
    placeholder: "#9CA3AF",
    inactiveText: "#6B7280",
    disabled: "#A7F3C6",
  };

  // ─────────────────────────────────────────────────
  // 1️⃣ Log the SMS Retriever hash once on mount
  //    Give this to your backend — the OTP SMS must end with it.
  // ─────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    getAppSignature()
      .then((hash: string) => {
        console.log("🔑 SMS Retriever Hash:", hash);
        console.log(
          "📌 Send this hash to your backend — the OTP SMS must end with it.",
        );
      })
      .catch(() => {
        console.log(
          "⚠️ SMS Retriever not available (this is OK on iOS or when Play Services is missing)",
        );
      });
  }, []);

  // ─────────────────────────────────────────────────
  // 2️⃣ Listen for OTP only after user taps "Get OTP"
  // ─────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;

    if (loginMethod === "otp" && otpSent && !otpListenerActive.current) {
      otpListenerActive.current = true;

      startSmsRetriever()
        .then(() => {
          addSmsListener((message: string) => {
            const match = /(\d{4,6})/.exec(message);
            if (match && match[1]) {
              const code = match[1];
              console.log("✅ OTP auto-detected:", code);
              setOtpCode(code);
              if (!autoSubmittedRef.current) {
                autoSubmittedRef.current = true;
                setTimeout(() => handleOtpSubmit(code), 300);
              }
            }
          });
        })
        .catch((err: any) => console.log("OTP listener error:", err));
    }

    return () => {
      if (Platform.OS === "android" && otpListenerActive.current) {
        try {
          removeListener();
        } catch {}
        otpListenerActive.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpSent, loginMethod]);

  // ─────────────────────────────────────────────────
  // 3️⃣ Push register + auto-navigate after login
  // ─────────────────────────────────────────────────
  useEffect(() => {
    const uid = user?._id || user?.id;
    if (!uid) return;

    if (pushRegisteredForUserRef.current !== String(uid)) {
      pushRegisteredForUserRef.current = String(uid);
      (async () => {
        try {
          await setupNotifications();
          await registerForPushNotificationsAsync(String(uid));
        } catch (e) {
          console.warn("⚠️ Push registration failed (non-fatal):", e);
        }
      })();
    }

    navigation.reset({
      index: 0,
      routes: [{ name: "UserTabs" }],
    });
  }, [user?._id, user?.id, navigation]);

  // ─────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────
  const handlePasswordLogin = async () => {
    if (!identifier || !password) {
      return Alert.alert(
        "Missing details",
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
    } catch {
      Alert.alert("Error", "Unexpected error occurred.");
    }
  };

  const handleSendOtp = async () => {
    if (!identifier)
      return Alert.alert("Missing number", "Please enter your phone number.");
    if (identifier.length !== 10)
      return Alert.alert("Invalid number", "Enter a valid 10-digit number.");

    setSendingOtp(true);
    try {
      await axios.post(`${config.apiUrl}/auth/send-otp`, { phone: identifier });
      setOtpSent(true);
      autoSubmittedRef.current = false;
      // Swiggy-style: don't show a disruptive alert, just inline feedback
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpSubmit = async (overrideCode?: string) => {
    const code = overrideCode ?? otpCode;
    if (!identifier || !code)
      return Alert.alert("Missing OTP", "Please enter the OTP.");
    try {
      const resultAction = await dispatch(
        loginWithOtp({ phone: identifier, otp: code }),
      );
      if (loginWithOtp.fulfilled.match(resultAction)) {
        console.log("OTP login successful.");
      } else {
        Alert.alert(
          "Login Failed",
          (resultAction.payload as string) || "Invalid OTP",
        );
      }
    } catch {
      Alert.alert("Error", "Unexpected error occurred.");
    }
  };

  const handleResendOtp = async () => {
    setOtpCode("");
    autoSubmittedRef.current = false;
    await handleSendOtp();
  };

  const handleChangeNumber = () => {
    setOtpSent(false);
    setOtpCode("");
    autoSubmittedRef.current = false;
  };

  // ─────────────────────────────────────────────────
  // RENDER — Swiggy-style minimal UI
  // ─────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <Text style={styles.brandName}>BLuxury</Text>
            <Text style={styles.tagline}>Premium delivery, at your door</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {!otpSent ? (
              <>
                <Text style={styles.welcomeTitle}>
                  {loginMethod === "otp" ? "Enter your phone" : "Welcome back"}
                </Text>
                <Text style={styles.welcomeSub}>
                  {loginMethod === "otp"
                    ? "We'll send you a verification code"
                    : "Login to continue to your account"}
                </Text>

                {/* Tabs */}
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.toggleButton,
                      loginMethod === "otp" && styles.toggleButtonActive,
                    ]}
                    onPress={() => setLoginMethod("otp")}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        loginMethod === "otp"
                          ? styles.toggleTextActive
                          : styles.toggleTextInactive,
                      ]}
                    >
                      OTP Login
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.toggleButton,
                      loginMethod === "password" && styles.toggleButtonActive,
                    ]}
                    onPress={() => setLoginMethod("password")}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        loginMethod === "password"
                          ? styles.toggleTextActive
                          : styles.toggleTextInactive,
                      ]}
                    >
                      Password
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Phone input */}
                <Text style={styles.inputLabel}>
                  {loginMethod === "otp" ? "Phone Number" : "Phone or Email"}
                </Text>
                <View style={styles.inputWrapper}>
                  {loginMethod === "otp" && (
                    <Text style={styles.prefix}>+91</Text>
                  )}
                  <TextInput
                    style={styles.input}
                    placeholder={
                      loginMethod === "otp" ? "98765 43210" : "you@example.com"
                    }
                    placeholderTextColor={colors.placeholder}
                    value={identifier}
                    onChangeText={setIdentifier}
                    keyboardType={
                      loginMethod === "otp" ? "phone-pad" : "default"
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={loginMethod === "otp" ? 10 : 60}
                  />
                </View>

                {/* Password input */}
                {loginMethod === "password" && (
                  <>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your password"
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="none"
                      />
                    </View>
                    <TouchableOpacity style={styles.forgotBtn}>
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Primary button */}
                {loginMethod === "password" ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.primaryButton,
                      loading && { backgroundColor: colors.disabled },
                    ]}
                    onPress={handlePasswordLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Login</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.primaryButton,
                      sendingOtp && { backgroundColor: colors.disabled },
                    ]}
                    onPress={handleSendOtp}
                    disabled={sendingOtp}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {/* OTP sent — Swiggy-style clean screen */}
                <Text style={styles.welcomeTitle}>Verify your number</Text>
                <Text style={styles.welcomeSub}>
                  Enter the 6-digit code sent to{" "}
                  <Text style={styles.boldText}>+91 {identifier}</Text>
                </Text>

                <View style={[styles.inputWrapper, styles.otpWrapper]}>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="– – – – – –"
                    placeholderTextColor={colors.placeholder}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    maxLength={6}
                    autoFocus
                  />
                </View>

                <View style={styles.otpActions}>
                  <TouchableOpacity onPress={handleChangeNumber}>
                    <Text style={styles.otpActionText}>Change number</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleResendOtp}>
                    <Text style={styles.otpActionText}>Resend OTP</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.primaryButton,
                    loading && { backgroundColor: colors.disabled },
                  ]}
                  onPress={() => handleOtpSubmit()}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Login</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Signup link — only show before OTP sent */}
            {!otpSent && (
              <TouchableOpacity
                onPress={() => navigation.navigate("Signup")}
                style={styles.signupRow}
              >
                <Text style={styles.signupText}>
                  Don't have an account?{" "}
                  <Text style={styles.signupLink}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Business partner?</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footerLinks}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.footerPill}
                onPress={() => navigation.navigate("VendorLogin")}
              >
                <Text style={styles.footerPillText}>Vendor Sign-in</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.footerPill}
                onPress={() => navigation.navigate("DeliveryBoyLogin")}
              >
                <Text style={styles.footerPillText}>Delivery Partner</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to our{" "}
            <Text style={styles.termsLink}>Terms</Text> &{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: "#FFFFFF",
  },
  header: { alignItems: "center", marginBottom: 28 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#009632",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#009632",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
  },
  logoText: { color: "#FFFFFF", fontSize: 34, fontWeight: "800" },
  brandName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0A0A0A",
    letterSpacing: 0.3,
  },
  tagline: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0A0A0A",
    marginBottom: 4,
  },
  welcomeSub: { fontSize: 13, color: "#6B7280", marginBottom: 20 },
  boldText: { fontWeight: "700", color: "#0A0A0A" },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 22,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 9,
  },
  toggleButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleText: { fontSize: 14, fontWeight: "600" },
  toggleTextActive: { color: "#009632" },
  toggleTextInactive: { color: "#6B7280" },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 52,
  },
  prefix: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A0A0A",
    marginRight: 8,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  input: { flex: 1, fontSize: 16, color: "#0A0A0A", paddingVertical: 0 },
  otpWrapper: { justifyContent: "center" },
  otpInput: {
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
  },
  otpActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -8,
    marginBottom: 20,
  },
  otpActionText: {
    color: "#009632",
    fontSize: 13,
    fontWeight: "600",
  },
  forgotBtn: { alignSelf: "flex-end", marginTop: -8, marginBottom: 16 },
  forgotText: { color: "#009632", fontSize: 13, fontWeight: "600" },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#009632",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#009632",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  signupRow: { marginTop: 18, alignItems: "center" },
  signupText: { fontSize: 14, color: "#6B7280" },
  signupLink: { color: "#009632", fontWeight: "700" },
  footer: { marginTop: 30 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  footerLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  footerPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#009632",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  footerPillText: { color: "#009632", fontSize: 13, fontWeight: "700" },
  terms: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 16,
  },
  termsLink: { color: "#009632", fontWeight: "600" },
});