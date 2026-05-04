import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

// Import all your Expo permission modules
import * as Contacts from "expo-contacts";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { AudioModule } from "expo-audio";

interface PermissionGateProps {
  onComplete: () => void; // Function to run when permissions are granted
}

const PermissionGate: React.FC<PermissionGateProps> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);

  const requestAllPermissions = async () => {
    setLoading(true);
    try {
      // 1. Request Contacts
      await Contacts.requestPermissionsAsync();

      // 2. Request Location
      await Location.requestForegroundPermissionsAsync();

      // 3. Request Camera
      await ImagePicker.requestCameraPermissionsAsync();

      // 4. Request Photo Library
      await ImagePicker.requestMediaLibraryPermissionsAsync();

      // 5. Request Microphone
      await AudioModule.requestRecordingPermissionsAsync();

      // Once all prompts have been shown/answered, move on
      onComplete();
    } catch (error) {
      console.error("Permission error:", error);
      Alert.alert("Error", "Something went wrong requesting permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={80} color="#075E54" />
        </View>

        <Text style={styles.title}>Welcome to Bluxury!</Text>
        <Text style={styles.subtitle}>
          To give you the best experience buying and selling, we need a few
          permissions:
        </Text>

        <View style={styles.list}>
          <View style={styles.listItem}>
            <Ionicons name="location" size={24} color="#075E54" />
            <Text style={styles.listText}>Location to find local vendors.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="camera" size={24} color="#075E54" />
            <Text style={styles.listText}>
              Camera & Photos to share products.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="mic" size={24} color="#075E54" />
            <Text style={styles.listText}>Microphone for voice notes.</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="people" size={24} color="#075E54" />
            <Text style={styles.listText}>
              Contacts to chat with your customers.
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={requestAllPermissions}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Please allow..." : "Continue & Allow"}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, padding: 25, justifyContent: "center" },
  iconContainer: { alignItems: "center", marginBottom: 30 },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  list: { backgroundColor: "#F8F5F0", padding: 20, borderRadius: 15 },
  listItem: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  listText: { fontSize: 15, color: "#333", marginLeft: 15, flex: 1 },
  button: {
    backgroundColor: "#075E54",
    padding: 18,
    margin: 20,
    borderRadius: 30,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});

export default PermissionGate;
