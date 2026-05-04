// src/components/NotificationBell.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ICON_SIZE = 60;

// Royal Palace Colors
const Colors = {
  royalGreenDark: "#004225", // Deep British Racing Green
  royalGold: "#fafaf9", // Metallic Gold
  royalWhite: "#FFFFFF", // Pure White
  royalOffWhite: "#F5F5F5", // For readability
  royalError: "#8B0000", // Deep Crimson for badges
  royalBorder: "rgba(212, 175, 55, 0.4)",
};

interface InAppNotification {
  id: string;
  title: string | null;
  body: string | null;
  data: any;
  date: Date;
}

export default function NotificationBell() {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  const { user } = useSelector((state: RootState) => state.auth);
  const { token: vendorAuthToken } = useSelector(
    (state: RootState) => state.vendorAuth,
  );

  // --- ALWAYS FIRST: ROYAL CONCIERGE CHAT ---
  const staticChatNotif: InAppNotification = {
    id: "static-chat-link",
    title: "Royal Concierge",
    body: "Speak with our luxury service team",
    data: { type: "chat" },
    date: new Date(),
  };

  const displayData = [staticChatNotif, ...notifications];

  // --- FLOATING DRAG LOGIC ---
  const pan = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - ICON_SIZE - 20,
      y: SCREEN_HEIGHT - 180, // Positioned near bottom right by default
    }),
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        let targetX =
          currentX < SCREEN_WIDTH / 2 ? 20 : SCREEN_WIDTH - ICON_SIZE - 20;
        let targetY = Math.min(Math.max(currentY, 60), SCREEN_HEIGHT - 140);

        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const newNotif: InAppNotification = {
          id: notification.request.identifier,
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data,
          date: new Date(),
        };
        setNotifications((prev) => [newNotif, ...prev]);
      },
    );
    return () => subscription.remove();
  }, []);

  const handleTap = (item: InAppNotification) => {
    if (item.id !== "static-chat-link") {
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
    }
    setModalVisible(false);

    if (item.data?.type === "chat" || item.id === "static-chat-link") {
      if (vendorAuthToken) {
        navigation.navigate("VendorChatScreen");
      } else if (user?.token) {
        navigation.navigate("ChatScreen");
      }
    }
  };

  return (
    <>
      {/* FLOATING CHAT BUTTON */}
      <Animated.View
        style={[
          styles.floatingContainer,
          { transform: pan.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.floatingButton}
          activeOpacity={0.9}
          onPress={() => setModalVisible(true)}
        >
          {/* Changed Icon to Chat */}
          <Ionicons name="chatbubbles" size={32} color={Colors.royalGold} />
          {notifications.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notifications.length > 9 ? "9+" : notifications.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Royal Inbox</Text>
                <View style={styles.titleUnderline} />
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons
                  name="close-circle"
                  size={32}
                  color={Colors.royalGold}
                />
              </TouchableOpacity>
            </View>

            <FlatList
              data={displayData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.notificationItem,
                    item.id === "static-chat-link" && styles.staticChatItem,
                  ]}
                  onPress={() => handleTap(item)}
                >
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={
                        item.data?.type === "chat"
                          ? "chatbubbles"
                          : "notifications"
                      }
                      size={22}
                      color={Colors.royalGold}
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>
                      {item.body}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.royalGold}
                  />
                </TouchableOpacity>
              )}
            />

            {notifications.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setNotifications([])}
              >
                <Text style={styles.clearText}>Clear History</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingContainer: { position: "absolute", zIndex: 9999 },
  floatingButton: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: Colors.royalGreenDark,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.royalGold,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  badge: {
    position: "absolute",
    right: -2,
    top: -2,
    backgroundColor: Colors.royalError,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.royalGold,
  },
  badgeText: { color: Colors.royalWhite, fontSize: 10, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 30, 15, 0.9)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.royalGreenDark,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: "75%",
    padding: 24,
    borderTopWidth: 2,
    borderTopColor: Colors.royalGold,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  modalTitle: {
    color: Colors.royalWhite,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1,
  },
  titleUnderline: {
    height: 3,
    width: 40,
    backgroundColor: Colors.royalGold,
    marginTop: 4,
  },
  notificationItem: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.royalBorder,
  },
  staticChatItem: {
    backgroundColor: "rgba(212, 175, 55, 0.15)",
    borderColor: Colors.royalGold,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 1,
    borderColor: Colors.royalGold,
  },
  textContainer: { flex: 1 },
  notifTitle: { color: Colors.royalWhite, fontWeight: "bold", fontSize: 16 },
  notifBody: { color: Colors.royalOffWhite, fontSize: 13, opacity: 0.7 },
  clearButton: {
    marginTop: 10,
    padding: 15,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.royalGold,
  },
  clearText: {
    color: Colors.royalGold,
    fontWeight: "bold",
    textTransform: "uppercase",
    fontSize: 12,
  },
});
