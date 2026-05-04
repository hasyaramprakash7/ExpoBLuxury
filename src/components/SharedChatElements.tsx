// SharedChatElements.tsx
import React from "react";
import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import Ionicons from "@expo/vector-icons/Ionicons";

// 1. REUSABLE COMPONENT: Makes links in chat messages clickable
interface ParsedMessageProps {
  text: string;
  isMe: boolean;
}

export const ParsedMessageText: React.FC<ParsedMessageProps> = ({
  text,
  isMe,
}) => {
  // Regex to find http, https, or www links
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <Text style={{ color: isMe ? "#fff" : "#000", fontSize: 16 }}>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          // Ensure www. links have https:// attached so the browser doesn't crash
          const urlToOpen = part.startsWith("www.") ? `https://${part}` : part;

          return (
            <Text
              key={index}
              style={{
                color: isMe ? "#cce4ff" : "#0056b3", // Highlight color for links
                textDecorationLine: "underline",
              }}
              onPress={async () => {
                await WebBrowser.openBrowserAsync(urlToOpen);
              }}
            >
              {part}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
};

// 2. REUSABLE COMPONENT: Web Shortcut Buttons for your platforms
// export const WebBrowserShortcuts: React.FC = () => {
//   return (
//     <View style={styles.shortcutContainer}>
//       <TouchableOpacity
//         style={styles.shortcutBtn}
//         onPress={() =>
//           WebBrowser.openBrowserAsync("https://your-vendor-website.com")
//         }
//       >
//         <Ionicons name="storefront" size={20} color="#075E54" />
//         <Text style={styles.shortcutText}>Vendors</Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={styles.shortcutBtn}
//         onPress={() =>
//           WebBrowser.openBrowserAsync("https://your-user-website.com")
//         }
//       >
//         <Ionicons name="person" size={20} color="#075E54" />
//         <Text style={styles.shortcutText}>Users</Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={styles.shortcutBtn}
//         onPress={() => WebBrowser.openBrowserAsync("https://www.google.com")}
//       >
//         <Ionicons name="search" size={20} color="#075E54" />
//         <Text style={styles.shortcutText}>Search</Text>
//       </TouchableOpacity>
//     </View>
//   );
// };

const styles = StyleSheet.create({
  shortcutContainer: {
    flexDirection: "row",
    padding: 10,
    justifyContent: "space-around",
    backgroundColor: "#ECE5DD",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  shortcutBtn: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderRadius: 20,
    minWidth: "30%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shortcutText: {
    marginTop: 4,
    fontSize: 12,
    color: "#333",
    fontWeight: "bold",
  },
});
