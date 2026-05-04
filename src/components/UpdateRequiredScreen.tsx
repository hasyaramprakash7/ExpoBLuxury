// src/components/UpdateRequiredScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  SafeAreaView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

// Matching your BLuxury design colors
const Colors = {
  luxuryBackground: "#0A0A0A",
  luxuryCard: "#1C1C1C",
  luxuryTextPrimary: "#E0E0E0",
  luxuryTextSecondary: "#B0B0B0",
  luxuryAccent: "#FFD700", // Gold
};

const UpdateRequiredScreen = () => {
  const handleUpdatePress = () => {
    if (Platform.OS === "android") {
      // Kicks user to Play Store
      Linking.openURL("market://details?id=com.ram1234567890.BLuxury");
    } else {
      // Placeholder for App Store
      Linking.openURL("itms-apps://itunes.apple.com/app/idYOUR_APP_ID");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {/* Logo / Rocket Icon */}
        <View style={styles.iconCircle}>
          <Ionicons
            name="rocket-outline"
            size={60}
            color={Colors.luxuryAccent}
          />
        </View>

        <Text style={styles.title}>Update Required</Text>

        <Text style={styles.description}>
          A new version of **BLuxury** is available with exciting new chat
          features and better performance. Please update to the latest version
          to continue.
        </Text>

        {/* Feature Highlights */}
        <View style={styles.featureBox}>
          <View style={styles.featureRow}>
            <Ionicons
              name="chatbubbles-outline"
              size={20}
              color={Colors.luxuryAccent}
            />
            <Text style={styles.featureText}>Brand new Chat System</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="speedometer-outline"
              size={20}
              color={Colors.luxuryAccent}
            />
            <Text style={styles.featureText}>Faster loading speeds</Text>
          </View>
          <View style={styles.featureRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={Colors.luxuryAccent}
            />
            <Text style={styles.featureText}>Improved security & fixes</Text>
          </View>
        </View>

        {/* The Action Button */}
        <TouchableOpacity style={styles.button} onPress={handleUpdatePress}>
          <Text style={styles.buttonText}>UPDATE NOW</Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color="#000"
            style={{ marginLeft: 10 }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.luxuryBackground,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: Colors.luxuryCard,
    width: "100%",
    borderRadius: 25,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.luxuryTextPrimary,
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: Colors.luxuryTextSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 25,
  },
  featureBox: {
    width: "100%",
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureText: {
    color: Colors.luxuryTextPrimary,
    fontSize: 14,
    marginLeft: 15,
  },
  button: {
    flexDirection: "row",
    backgroundColor: Colors.luxuryAccent,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});

export default UpdateRequiredScreen;
