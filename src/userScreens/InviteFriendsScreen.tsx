import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image,
  TextInput,
} from "react-native";
import * as Contacts from "expo-contacts";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import {
  sendSmsInvites,
  syncContacts,
  RegisteredContact,
} from "../features/user/authSlice";
import { setActivePartner } from "../features/chat/chatSlice";
import { AppDispatch, RootState } from "../app/store";

interface ProcessedContact {
  id: string;
  name: string;
  phone: string;
  isRegistered: boolean;
  dbId?: string;
  role?: string;
  image?: string;
}

const InviteFriendsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();

  // Pulling syncing status from Redux
  const { isSyncingContacts, user } = useSelector(
    (state: RootState) => state.auth,
  );
  // 🔥 Find out if the CURRENT logged-in user is a vendor
  const { vendor } = useSelector((state: RootState) => state.vendorAuth);
  const isCurrentUserVendor = !!vendor;

  const [allContacts, setAllContacts] = useState<ProcessedContact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [sendingToId, setSendingToId] = useState<string | null>(null);

  useEffect(() => {
    loadAndSyncContacts();
  }, []);

  const loadAndSyncContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need access to your contacts to find friends.",
        );
        setLoadingLocal(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });

      if (data.length === 0) {
        setLoadingLocal(false);
        return;
      }

      const deviceContactsMap = new Map<string, any>();
      const rawPhoneNumbers: string[] = [];

      data.forEach((c) => {
        if (c.phoneNumbers && c.phoneNumbers.length > 0 && c.name) {
          const rawNum = c.phoneNumbers[0].number;
          const cleanNum = rawNum?.replace(/[\s\-\(\)]/g, "");

          if (cleanNum) {
            rawPhoneNumbers.push(cleanNum);
            deviceContactsMap.set(cleanNum.slice(-10), {
              id: c.id,
              name: c.name,
              phone: cleanNum,
            });
          }
        }
      });

      const syncedContacts = await dispatch(
        syncContacts(rawPhoneNumbers),
      ).unwrap();

      const processed: ProcessedContact[] = [];
      const registeredPhonesSet = new Set();

      if (syncedContacts && syncedContacts.length > 0) {
        syncedContacts.forEach((dbUser: RegisteredContact) => {
          const matchingDeviceContact = deviceContactsMap.get(
            dbUser.phone.slice(-10),
          );

          processed.push({
            id: dbUser.dbId,
            dbId: dbUser.dbId,
            name: matchingDeviceContact?.name || dbUser.name,
            phone: dbUser.phone,
            isRegistered: true,
            role: dbUser.role,
            image: dbUser.image,
          });
          registeredPhonesSet.add(dbUser.phone.slice(-10));
        });
      }

      deviceContactsMap.forEach((val, key) => {
        if (!registeredPhonesSet.has(key)) {
          processed.push({
            id: val.id,
            name: val.name,
            phone: val.phone,
            isRegistered: false,
          });
        }
      });

      const registered = processed.filter((c) => c.isRegistered);
      const unregistered = processed
        .filter((c) => !c.isRegistered)
        .sort((a, b) => a.name.localeCompare(b.name));

      setAllContacts([...registered, ...unregistered]);
    } catch (error) {
      console.error("Sync Error:", error);
      Alert.alert("Error", "Failed to sync contacts.");
    } finally {
      setLoadingLocal(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return allContacts;
    const lowerCaseQuery = searchQuery.toLowerCase();

    return allContacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(lowerCaseQuery) ||
        contact.phone.includes(lowerCaseQuery),
    );
  }, [searchQuery, allContacts]);

  // =========================================================
  // 🔥 FIX: PROPERLY NAVIGATE AND LOAD CHAT HISTORY
  // =========================================================
  const onPressChat = (contact: ProcessedContact) => {
    if (contact.dbId) {
      dispatch(setActivePartner(contact.dbId));

      // 1. Structure the partner data so the Chat Screen knows who they are
      const partnerData = {
        _id: contact.dbId,
        name: contact.role === "Vendor" ? undefined : contact.name,
        shopName: contact.role === "Vendor" ? contact.name : undefined,
        profilePic: contact.role === "User" ? contact.image : undefined,
        shopImage: contact.role === "Vendor" ? contact.image : undefined,
        role: contact.role,
      };

      // 2. Navigate to the correct screen based on who is logged in!
      if (isCurrentUserVendor) {
        // @ts-ignore
        navigation.navigate("VendorChatScreen", { partner: partnerData });
      } else {
        // @ts-ignore
        navigation.navigate("ChatScreen", { partner: partnerData });
      }
    }
  };

  const onPressInvite = async (contact: ProcessedContact) => {
    setSendingToId(contact.id);
    try {
      await dispatch(sendSmsInvites([contact.phone])).unwrap();
      Alert.alert("Invite Sent!", `An SMS was sent to ${contact.name}.`);
    } catch (error: any) {
      Alert.alert("Error", error || "Failed to send invite.");
    } finally {
      setSendingToId(null);
    }
  };

  const renderItem = ({ item }: { item: ProcessedContact }) => {
    const initial = item.name ? item.name.charAt(0).toUpperCase() : "#";
    const isSendingToThisUser = sendingToId === item.id;
    const isAnySending = sendingToId !== null;

    return (
      <View style={styles.contactRow}>
        {item.isRegistered && item.image ? (
          <Image source={{ uri: item.image }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              item.isRegistered && styles.avatarRegistered,
            ]}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>
            {item.isRegistered ? `Bluxury ${item.role}` : item.phone}
          </Text>
        </View>

        {item.isRegistered ? (
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => onPressChat(item)}
          >
            <Text style={styles.chatBtnText}>Chat</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.inviteBtn,
              isSendingToThisUser && styles.inviteBtnSending,
              isAnySending && !isSendingToThisUser && styles.inviteBtnDisabled,
            ]}
            onPress={() => onPressInvite(item)}
            disabled={isAnySending}
          >
            {isSendingToThisUser ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={[
                  styles.inviteBtnText,
                  isAnySending &&
                    !isSendingToThisUser &&
                    styles.inviteBtnTextDisabled,
                ]}
              >
                Invite
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const isLoading = loadingLocal || isSyncingContacts;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#075E54" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Select contact</Text>
          <Text style={styles.headerSub}>{allContacts.length} contacts</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#888"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or number..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {sendingToId && (
        <View style={styles.statusBarContainer}>
          <Text style={styles.statusText}>Sending Invite via SMS...</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: "100%" }]} />
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#075E54" />
          <Text style={styles.loadingText}>Finding friends on Bluxury...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={15}
          maxToRenderPerBatch={20}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No contacts found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    height: 60,
    backgroundColor: "#075E54",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  backButton: { paddingRight: 15, paddingVertical: 5 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerSub: { color: "#dfdfdf", fontSize: 13 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: "#333" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#666" },
  emptyContainer: { padding: 30, alignItems: "center" },
  emptyText: { color: "#888", fontSize: 16 },
  statusBarContainer: {
    backgroundColor: "#E8F5E9",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#C8E6C9",
  },
  statusText: {
    color: "#075E54",
    fontWeight: "bold",
    marginBottom: 5,
    fontSize: 12,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: "#C8E6C9",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#25D366" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  avatarRegistered: { backgroundColor: "#128C7E" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: "bold", color: "#000" },
  contactPhone: { fontSize: 13, color: "#666", marginTop: 2 },
  inviteBtn: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#075E54",
    minWidth: 70,
    alignItems: "center",
  },
  inviteBtnSending: { backgroundColor: "#075E54" },
  inviteBtnDisabled: { borderColor: "#ccc" },
  inviteBtnText: { color: "#075E54", fontWeight: "bold" },
  inviteBtnTextDisabled: { color: "#ccc" },
  chatBtn: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#25D366",
    minWidth: 70,
    alignItems: "center",
  },
  chatBtnText: { color: "#fff", fontWeight: "bold" },
});

export default InviteFriendsScreen;
