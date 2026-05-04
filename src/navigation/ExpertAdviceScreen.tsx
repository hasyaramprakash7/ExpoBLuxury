import React from "react";
import { StyleSheet, SafeAreaView } from "react-native";
import { WebView } from "react-native-webview";

// --- External URL ---
const EXTERNAL_APPOINTMENT_URL =
  "https://pentakotahashyaramprakash.tataaiapartner.com/site/?camp_id=S0RNMlNUVXRKRlV4THpOVVlBcGdDZz09&content=Social&channel_type=WhatsApp&pid=S0RNMlNURXNSRmxLTlROZ1lBcGdDZz09";

const ExpertAdviceScreen = () => {
  return (
    <SafeAreaView style={styles.webViewContainer}>
      {/* The webpage loads immediately when this screen is opened */}
      <WebView
        source={{ uri: EXTERNAL_APPOINTMENT_URL }}
        style={styles.webView}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  webViewContainer: {
    flex: 1,
    backgroundColor: "#F8F5F0", // Matches your app's background
  },
  webView: {
    flex: 1,
  },
});

export default ExpertAdviceScreen;
