import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  SectionList,
  Image,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  BackHandler,
  StatusBar,
  Share,
  Linking,
  useWindowDimensions,
  Keyboard, // 🔥 Imported Keyboard
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Contacts from "expo-contacts";

// 🔥 Import the NEW Instamart Header
// import InstamartHeader from "../components/InstamartHeader";

// Audio & Image libraries
import { useAudioRecorder, useAudioPlayer, AudioModule } from "expo-audio";
import * as ImagePicker from "expo-image-picker";

// 🔥 Import Notification Helper
import { sendChatNotification } from "../userScreens/utils/NotificationHelper";

// Shared Browser Components
import {
  ParsedMessageText,
  WebBrowserShortcuts,
} from "../components/SharedChatElements";

// Redux
import { RootState, AppDispatch } from "../app/store";
import { syncContacts, RegisteredContact } from "../features/user/authSlice";
import {
  fetchMessages,
  receiveMessage,
  setActivePartner,
  sendMediaMessage,
  deleteMessageLocally,
  markMessagesAsRead,
  setPartnerSeen,
  deleteMessage,
  clearMessages,
  fetchChatList,
} from "../features/chat/chatSlice";
import socket from "../userScreens/utils/socket";

// ==========================================
// 🔥 CENTRALIZED ROYAL NAVY BLUE THEME
// ==========================================
const COLORS = {
  // Main Theme Colors
  primaryDark: "#02122B", // Deepest Navy (Main App Background / Inbox)
  primary: "#0A2540", // Rich Royal Navy (Headers)
  primaryLight: "#003366", // Royal Blue (Buttons, My Bubbles)
  accent: "#004AAD", // Lighter Royal Blue (FAB, Badges, Highlights)

  // Backgrounds
  chatBackground: "#F0F4F8", // Light luxury grayish-blue for chat area
  surface: "#FFFFFF", // Pure white for rows and their bubbles
  surfaceDark: "#11233A", // Slightly lighter navy for inbox rows

  // Text Colors
  textLight: "#FFFFFF", // White text (on dark backgrounds)
  textDark: "#1A202C", // Near black (on light backgrounds)
  textMutedLight: "#A0AEC0", // Muted gray for dark backgrounds
  textMutedDark: "#718096", // Muted gray for light backgrounds

  // UI Elements
  borderDark: "#1A365D", // Border color for dark sections
  borderLight: "#E2E8F0", // Border color for light sections
  readTick: "#38B2AC", // Cool teal/blue for read receipts
  unreadTick: "#A0AEC0", // Gray for unread
  avatarFallbackBg: "#E6F0FA", // Soft blue for avatars without images

  // States & Alerts
  recordingRed: "#E53E3E",
  recordingBg: "#FED7D7",
  searchBg: "#EDF2F7",
  selectionBg: "rgba(10, 37, 64, 0.15)", // Navy tint for selected messages
  overlay: "rgba(255,255,255,0.7)", // Loader overlay
};

interface ProcessedContact {
  id: string;
  name: string;
  phone: string;
  isRegistered: boolean;
  dbId?: string;
  role?: string;
  image?: string;
}

const VendorChatScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const flatListRef = useRef<FlatList>(null);
  const { width } = useWindowDimensions();

  // --- REDUX STATE (Vendor Specific Logic) ---
  const { vendor: currentVendor } = useSelector(
    (state: RootState) => state.vendorAuth,
  );
  const { isSyncingContacts } = useSelector((state: RootState) => state.auth);
  const { messages, isSending, conversations } = useSelector(
    (state: RootState) => state.chat,
  );

  const currentUserId = currentVendor?._id || currentVendor?.id;

  // --- UI TOGGLES ---
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [showContacts, setShowContacts] = useState(false);

  // --- CHAT & CONTACT STATE ---
  const [messageText, setMessageText] = useState("");
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const isSelectionMode = selectedMessages.length > 0;

  const [allContacts, setAllContacts] = useState<ProcessedContact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingLocal, setLoadingLocal] = useState(true);

  // --- AUDIO STATE ---
  const audioRecorder = useAudioRecorder({
    extension: ".m4a",
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  });
  const audioPlayer = useAudioPlayer();
  const [isRecording, setIsRecording] = useState(false);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const isPreparingRef = useRef(false);
  const shouldCancelRef = useRef(false);
  const durationRef = useRef(0);

  const partnerRef = useRef(selectedPartner);
  const contactsRef = useRef(allContacts);

  useEffect(() => {
    partnerRef.current = selectedPartner;
  }, [selectedPartner]);

  useEffect(() => {
    contactsRef.current = allContacts;
  }, [allContacts]);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [conversations]);

  useEffect(() => {
    loadAndSyncContacts();
  }, []);

  const loadAndSyncContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
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
        if (c.phoneNumbers && c.name) {
          c.phoneNumbers.forEach((pn) => {
            const cleanNum = pn.number?.replace(/\D/g, "");
            if (cleanNum && cleanNum.length >= 10) {
              const last10 = cleanNum.slice(-10);

              if (!deviceContactsMap.has(last10)) {
                deviceContactsMap.set(last10, {
                  id: c.id,
                  name: c.name,
                  phone: last10,
                });
                rawPhoneNumbers.push(last10);
              }
            }
          });
        }
      });

      const syncedContacts = await dispatch(
        syncContacts(rawPhoneNumbers),
      ).unwrap();

      const processed: ProcessedContact[] = [];
      const registeredPhonesSet = new Set();

      if (syncedContacts && syncedContacts.length > 0) {
        syncedContacts.forEach((dbUser: RegisteredContact) => {
          const last10 = dbUser.phone.replace(/\D/g, "").slice(-10);

          if (!registeredPhonesSet.has(last10)) {
            const matchingDeviceContact = deviceContactsMap.get(last10);
            processed.push({
              id: dbUser.dbId,
              dbId: dbUser.dbId,
              name: matchingDeviceContact?.name || dbUser.name,
              phone: last10,
              isRegistered: true,
              role: dbUser.role || "User",
              image: dbUser.image,
            });
            registeredPhonesSet.add(last10);
          }
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
          registeredPhonesSet.add(key);
        }
      });

      const registered = processed.filter((c) => c.isRegistered);
      const unregistered = processed
        .filter((c) => !c.isRegistered)
        .sort((a, b) => a.name.localeCompare(b.name));

      setAllContacts([...registered, ...unregistered]);
    } catch (error) {
      console.log("Contact sync skipped/failed", error);
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleContactChat = (contact: ProcessedContact) => {
    const partnerData = {
      _id: contact.dbId,
      name: contact.name,
      profilePic: contact.image,
      role: contact.role || "User",
      phone: contact.phone,
    };
    setSelectedPartner(partnerData);
    setShowContacts(false);
  };

  const handleShareContact = async (contact: ProcessedContact) => {
    const appLink =
      "https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury";
    const message = `Hey ${contact.name}! I'm using Bluxury chatting system to manage orders. Join me here: ${appLink}`;

    let cleanPhone = contact.phone.replace(/\D/g, "");

    if (cleanPhone.length === 10) {
      cleanPhone = "91" + cleanPhone;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) {
      cleanPhone = "91" + cleanPhone.substring(1);
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;

    try {
      await Linking.openURL(whatsappUrl);
    } catch (error) {
      console.log("WhatsApp failed to open. Falling back to native share.");
      Share.share({ message });
    }
  };

  useEffect(() => {
    if (route.params?.partner) {
      setSelectedPartner(route.params.partner);
    }
  }, [route.params?.partner]);

  const handleBackToInbox = () => {
    // 🔥 FIX: Dismiss Keyboard immediately before transitioning views
    Keyboard.dismiss();
    setSelectedPartner(null);
    setShowContacts(false);
    dispatch(setActivePartner(""));
    dispatch(clearMessages());
    dispatch(fetchChatList());
    navigation.setParams({ partner: undefined } as any);
  };

  useEffect(() => {
    const onBackPress = () => {
      if (selectedPartner || showContacts) {
        handleBackToInbox();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    const unsubscribeNav = navigation.addListener("beforeRemove", (e) => {
      if (!selectedPartner && !showContacts) return;
      e.preventDefault();
      handleBackToInbox();
    });
    return () => {
      backHandler.remove();
      unsubscribeNav();
    };
  }, [selectedPartner, showContacts, navigation]);

  useEffect(() => {
    if (currentUserId) {
      socket.emit("join", currentUserId);
      dispatch(fetchChatList());
    }

    const handleNewMessage = (msg: any) => {
      dispatch(receiveMessage(msg));

      const isFromPartner = msg.sender === partnerRef.current?._id;
      const isFromMe = msg.sender === currentUserId;

      if (isFromPartner) {
        dispatch(markMessagesAsRead(partnerRef.current._id));
        setTimeout(
          () =>
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
          300,
        );
      }

      if (!isFromMe && !isFromPartner) {
        const sender = contactsRef.current.find((c) => c.dbId === msg.sender);
        const senderName = sender?.name || "Customer";
        const bodyText =
          msg.messageType === "text" ? msg.content : "Sent an attachment";

        sendChatNotification(senderName, bodyText);
      }

      if (!partnerRef.current) {
        dispatch(fetchChatList());
      }
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messageDeleted", (messageId: string) =>
      dispatch(deleteMessageLocally(messageId)),
    );
    socket.on("messagesSeen", ({ by }: { by: string }) => {
      if (partnerRef.current?._id === by) dispatch(setPartnerSeen());
    });

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messageDeleted");
      socket.off("messagesSeen");
    };
  }, [dispatch, currentUserId]);

  useEffect(() => {
    if (selectedPartner?._id) {
      dispatch(clearMessages());
      dispatch(setActivePartner(selectedPartner._id));
      dispatch(fetchMessages(selectedPartner._id));

      dispatch(markMessagesAsRead(selectedPartner._id)).then(() => {
        dispatch(fetchChatList());
      });
    }
  }, [selectedPartner, dispatch]);

  const handleLongPress = (messageId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMessages([messageId]);
  };

  const handlePressMessage = (messageId: string) => {
    if (isSelectionMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSelectedMessages((prev) =>
        prev.includes(messageId)
          ? prev.filter((id) => id !== messageId)
          : [...prev, messageId],
      );
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete Message?",
      `Delete ${selectedMessages.length} message(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            selectedMessages.forEach((id) => dispatch(deleteMessage(id)));
            setSelectedMessages([]);
          },
        },
      ],
    );
  };

  const playSound = async (url: string) => {
    try {
      await AudioModule.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        playThroughEarpiece: false,
      });
      if (playingUri === url) {
        setPlayingUri(null);
        audioPlayer.pause();
      } else {
        setPlayingUri(url);
        audioPlayer.replace(url);
        audioPlayer.play();
      }
    } catch (error) {
      console.error("Audio error:", error);
      setPlayingUri(null);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return Alert.alert("Denied", "Access needed.");
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) handleSend("image", result.assets[0].uri);
  };

  const startRecording = async () => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== "granted") return Alert.alert("Mic access denied");
      shouldCancelRef.current = false;
      isPreparingRef.current = true;
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        playThroughEarpiece: false,
      });
      await new Promise((r) => setTimeout(r, 250));
      if (shouldCancelRef.current) {
        isPreparingRef.current = false;
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setRecordDuration(0);
      durationRef.current = 0;
      timerInterval.current = setInterval(() => {
        durationRef.current += 1;
        setRecordDuration(durationRef.current);
      }, 1000);
      isPreparingRef.current = false;
    } catch (err) {
      isPreparingRef.current = false;
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    if (isPreparingRef.current) {
      shouldCancelRef.current = true;
      return;
    }
    if (!isRecording) return;
    if (timerInterval.current) clearInterval(timerInterval.current);
    setIsRecording(false);
    audioRecorder.stop();
    if (durationRef.current < 1) return;
    if (audioRecorder.uri) handleSend("audio", audioRecorder.uri);
  };

  const handleSend = async (
    type: "text" | "image" | "audio",
    fileUri?: string,
  ) => {
    if (!selectedPartner) return;
    const formData = new FormData();
    formData.append("receiverId", selectedPartner._id);
    formData.append("messageType", type);
    formData.append("receiverModel", selectedPartner.role || "User");

    if (type === "text") {
      if (!messageText.trim()) return;
      formData.append("content", messageText);
      setMessageText("");
    } else if (fileUri) {
      let filename =
        fileUri.split("/").pop() ||
        (type === "image" ? "upload.jpg" : "voice.m4a");
      const cleanUri =
        Platform.OS === "ios" ? fileUri.replace("file://", "") : fileUri;
      // @ts-ignore
      formData.append("file", {
        uri: cleanUri,
        name: filename,
        type: type === "image" ? "image/jpeg" : "audio/m4a",
      });
    }

    dispatch(sendMediaMessage(formData)).then(() => {
      setTimeout(
        () =>
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
        200,
      );
      dispatch(fetchChatList());
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const selectedPhoneLast10 = selectedPartner?.phone
    ?.replace(/\D/g, "")
    .slice(-10);

  const localContactMatch = allContacts.find(
    (c) =>
      c.dbId === selectedPartner?._id ||
      (c.phone && selectedPhoneLast10 && c.phone === selectedPhoneLast10),
  );

  const displayPartnerName =
    localContactMatch?.name ||
    selectedPartner?.name ||
    selectedPartner?.shopName ||
    "Customer";

  let displayPartnerPhone =
    localContactMatch?.phone || selectedPartner?.phone || "";
  if (displayPartnerPhone) {
    displayPartnerPhone = displayPartnerPhone.replace(/\D/g, "").slice(-10);
  }

  const partnerImage =
    selectedPartner?.profilePic || selectedPartner?.shopImage || null;
  const partnerInitial = displayPartnerName
    ? displayPartnerName.charAt(0).toUpperCase()
    : "C";

  const getContactSections = () => {
    const sections = [];
    const query = searchQuery.toLowerCase();

    const filterFn = (c: ProcessedContact) =>
      !query || c.name.toLowerCase().includes(query) || c.phone.includes(query);

    const registered = allContacts.filter((c) => c.isRegistered && filterFn(c));
    if (registered.length > 0)
      sections.push({ title: "My Contacts on Bluxury", data: registered });

    const unregistered = allContacts.filter(
      (c) => !c.isRegistered && filterFn(c),
    );
    if (unregistered.length > 0)
      sections.push({ title: "Share Bluxury", data: unregistered });

    return sections;
  };

  // ==========================================
  // 🔥 INJECTING INSTAMART HEADER
  // ==========================================
  // const renderInboxHeader = () => (
  //   <View>
  //     <InstamartHeader />
  //     <Text style={styles.recentChatsTitle}>Recent Chats</Text>
  //   </View>
  // );

  // Set the StatusBar color based on the current view
  const statusColor =
    !selectedPartner && !showContacts ? COLORS.primaryDark : COLORS.primary;

  return (
    <SafeAreaView
      style={[
        styles.container,
        !selectedPartner &&
          !showContacts && { backgroundColor: COLORS.primaryDark },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={statusColor} />

      {/* --- HEADER RENDERING --- */}
      {isSelectionMode ? (
        <View style={styles.selectionHeader}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => setSelectedMessages([])}>
              <Ionicons name="close" size={22} color={COLORS.textLight} />
            </TouchableOpacity>
            <Text style={styles.selectionCount}>{selectedMessages.length}</Text>
          </View>
          <TouchableOpacity onPress={confirmDelete}>
            <Ionicons name="trash" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      ) : selectedPartner ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToInbox}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
          {partnerImage ? (
            <Image source={{ uri: partnerImage }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.fallbackAvatar]}>
              <Text style={styles.fallbackAvatarText}>{partnerInitial}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerName} numberOfLines={1}>
              {displayPartnerName}
            </Text>
            {displayPartnerPhone ? (
              <Text style={styles.headerSub}>{displayPartnerPhone}</Text>
            ) : null}
          </View>
          {displayPartnerPhone ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${displayPartnerPhone}`)}
            >
              <Ionicons
                name="call"
                size={18}
                color={COLORS.textLight}
                style={{ paddingHorizontal: 10 }}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : showContacts ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowContacts(false)}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
          <View style={{ marginLeft: 15 }}>
            <Text style={styles.headerTitle}>Select Contact</Text>
            <Text style={styles.headerSub}>{allContacts.length} total</Text>
          </View>
        </View>
      ) : (
        // 🔥 MAIN INBOX HEADER (MATCHES DARK BLUE COMPONENT)
        <View
          style={[
            styles.header,
            { backgroundColor: COLORS.primaryDark, justifyContent: "center" },
          ]}
        >
          <Text style={styles.headerTitle}>Bluxury</Text>
        </View>
      )}

      {/* --- BODY RENDERING --- */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        enabled={!!selectedPartner || showContacts} // 🔥 FIX: Disable when in inbox to prevent space glitch
      >
        {!selectedPartner ? (
          showContacts ? (
            // VIEW 2: CONTACTS LIST (White Background for contrast)
            <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
              <View style={styles.searchContainer}>
                <Ionicons
                  name="search"
                  size={16}
                  color={COLORS.textMutedDark}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search contacts..."
                  placeholderTextColor={COLORS.textMutedDark}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              {(loadingLocal || isSyncingContacts) &&
              allContacts.length === 0 ? (
                <View style={styles.center}>
                  <ActivityIndicator size="small" color={COLORS.primaryLight} />
                  <Text style={styles.loadingText}>Syncing contacts...</Text>
                </View>
              ) : (
                <SectionList
                  sections={getContactSections()}
                  keyExtractor={(item, index) =>
                    `${item.id || item.dbId}-${index}`
                  }
                  renderSectionHeader={({ section: { title } }) => (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{title}</Text>
                    </View>
                  )}
                  renderItem={({ item }) => {
                    const initial = item.name
                      ? item.name.charAt(0).toUpperCase()
                      : "#";
                    return (
                      <View style={styles.contactRow}>
                        {item.isRegistered && item.image ? (
                          <Image
                            source={{ uri: item.image }}
                            style={styles.avatar}
                          />
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
                            {item.isRegistered
                              ? `Available on Bluxury`
                              : item.phone}
                          </Text>
                        </View>
                        {item.isRegistered ? (
                          <TouchableOpacity
                            style={styles.chatBtn}
                            onPress={() => handleContactChat(item)}
                          >
                            <Text style={styles.chatBtnText}>Chat</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.inviteBtn}
                            onPress={() => handleShareContact(item)}
                          >
                            <Text style={styles.inviteBtnText}>Share</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  }}
                  stickySectionHeadersEnabled={true}
                />
              )}
            </View>
          ) : (
            // VIEW 1: MAIN INBOX
            <>
              <FlatList
                style={{ flex: 1, backgroundColor: COLORS.primaryDark }}
                data={sortedConversations}
                keyExtractor={(item) => `convo-${item._id}`}
                // ListHeaderComponent={renderInboxHeader}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text
                      style={[styles.emptyText, { color: COLORS.textLight }]}
                    >
                      No recent chats.
                    </Text>
                    <Text
                      style={[
                        styles.emptySubText,
                        { color: COLORS.textMutedLight },
                      ]}
                    >
                      Tap the chat button below to start!
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const inboxPhoneLast10 = item.contact?.phone
                    ?.replace(/\D/g, "")
                    .slice(-10);
                  const localContact = allContacts.find(
                    (c) =>
                      c.dbId === item.contact?._id ||
                      (c.phone &&
                        inboxPhoneLast10 &&
                        c.phone === inboxPhoneLast10),
                  );
                  const convoName =
                    localContact?.name ||
                    item.contact?.name ||
                    item.contact?.shopName ||
                    "Customer";
                  const convoInitial = convoName.charAt(0).toUpperCase();
                  const image =
                    item.contact?.profilePic || item.contact?.shopImage;
                  const timeString = item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <TouchableOpacity
                      style={styles.convoRow}
                      onPress={() =>
                        setSelectedPartner({ ...item.contact, _id: item._id })
                      }
                    >
                      {image ? (
                        <Image
                          source={{ uri: image }}
                          style={styles.convoAvatar}
                        />
                      ) : (
                        <View
                          style={[styles.convoAvatar, styles.fallbackAvatar]}
                        >
                          <Text style={styles.fallbackAvatarText}>
                            {convoInitial}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text style={styles.convoName}>{convoName}</Text>
                          {timeString ? (
                            <Text style={styles.convoTime}>{timeString}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.convoLastMsg} numberOfLines={1}>
                          {item.lastMessage}
                        </Text>
                      </View>
                      {item.unreadCount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {item.unreadCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />

              {/* 🔥 FLOATING ACTION BUTTON */}
              <TouchableOpacity
                style={styles.fab}
                activeOpacity={0.8}
                onPress={() => setShowContacts(true)}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={20}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
            </>
          )
        ) : (
          // VIEW 3: ACTIVE CHAT ROOM
          <View style={{ flex: 1, backgroundColor: COLORS.chatBackground }}>
            <FlatList
              ref={flatListRef}
              style={{ flex: 1 }}
              inverted={true}
              data={[...messages].reverse()}
              keyExtractor={(item) => item._id.toString()}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, paddingVertical: 10 }}
              ListEmptyComponent={() => (
                <View
                  style={[styles.placeholder, { transform: [{ scaleY: -1 }] }]}
                >
                  <Text style={styles.emptyText}>
                    Say hello to start the chat!
                  </Text>
                </View>
              )}
              renderItem={({ item }) => {
                const isMe = item.sender === currentUserId;
                const isSelected = selectedMessages.includes(item._id);
                return (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onLongPress={() => handleLongPress(item._id)}
                    onPress={() => handlePressMessage(item._id)}
                    style={[
                      styles.msgWrapper,
                      isSelected && styles.selectedMsgRow,
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        isMe ? styles.myBubble : styles.theirBubble,
                      ]}
                    >
                      {item.messageType === "image" && (
                        <Image
                          source={{ uri: item.mediaUrl }}
                          style={styles.msgImage}
                        />
                      )}
                      {item.messageType === "audio" && (
                        <TouchableOpacity
                          style={styles.audioRow}
                          onPress={() => playSound(item.mediaUrl!)}
                        >
                          <Ionicons
                            name={
                              playingUri === item.mediaUrl
                                ? "pause-circle"
                                : "play-circle"
                            }
                            size={28}
                            color={
                              isMe ? COLORS.textLight : COLORS.primaryLight
                            }
                          />
                          <View>
                            <Text
                              style={{
                                color: isMe
                                  ? COLORS.textLight
                                  : COLORS.textDark,
                                fontWeight: "bold",
                                fontSize: 12,
                              }}
                            >
                              Voice Note
                            </Text>
                            <Text
                              style={{
                                color: isMe
                                  ? COLORS.textLight
                                  : COLORS.textMutedDark,
                                fontSize: 9,
                              }}
                            >
                              Tap to play
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      {item.content && (
                        <ParsedMessageText text={item.content} isMe={isMe} />
                      )}
                      <View style={styles.statusRow}>
                        <Text
                          style={[
                            styles.timestamp,
                            {
                              color: isMe
                                ? COLORS.textLight
                                : COLORS.textMutedDark,
                            },
                          ]}
                        >
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                        {isMe && (
                          <Ionicons
                            name="checkmark-done"
                            size={12}
                            color={
                              item.read ? COLORS.readTick : COLORS.unreadTick
                            }
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {isSending && (
              <View style={styles.sendingLoader}>
                <ActivityIndicator size="small" color={COLORS.primaryLight} />
                <Text style={styles.sendingText}>Sending...</Text>
              </View>
            )}

            {!isSelectionMode && (
              <View style={styles.inputContainer}>
                <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
                  <Ionicons
                    name="camera"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                </TouchableOpacity>
                <View style={styles.textInputWrapper}>
                  {isRecording ? (
                    <View style={styles.recordingStatus}>
                      <View
                        style={[
                          styles.recordingDot,
                          { opacity: recordDuration % 2 === 0 ? 1 : 0.2 },
                        ]}
                      />
                      <Text style={styles.recordingText}>
                        Recording {formatTime(recordDuration)}
                      </Text>
                    </View>
                  ) : (
                    <TextInput
                      style={styles.textInput}
                      placeholder="Message..."
                      placeholderTextColor={COLORS.textMutedDark}
                      value={messageText}
                      onChangeText={setMessageText}
                      multiline
                    />
                  )}
                </View>
                <TouchableOpacity
                  onPressIn={
                    messageText.length === 0 ? startRecording : undefined
                  }
                  onPressOut={
                    messageText.length === 0 ? stopRecording : undefined
                  }
                  onPress={
                    messageText.length > 0
                      ? () => handleSend("text")
                      : undefined
                  }
                  style={[
                    styles.sendBtn,
                    isRecording && {
                      backgroundColor: COLORS.recordingRed,
                      transform: [{ scale: 1.1 }],
                    },
                  ]}
                  disabled={isSending}
                >
                  <Ionicons
                    name={messageText.length > 0 ? "send" : "mic"}
                    size={16}
                    color={COLORS.textLight}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 1 : 25,
    marginBottom: Platform.OS === "ios" ? 1 : 25,
  },
  header: {
    height: 50,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  selectionHeader: {
    height: 50,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  selectionCount: {
    color: COLORS.textLight,
    fontSize: 16,
    marginLeft: 20,
    fontWeight: "600",
  },
  headerTitle: { color: COLORS.textLight, fontSize: 16, fontWeight: "bold" },
  headerSub: { color: COLORS.textMutedLight, fontSize: 11 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, marginLeft: 8 },
  headerName: { color: COLORS.textLight, fontSize: 14, fontWeight: "bold" },

  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.accent,
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },

  recentChatsTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.textLight,
    marginTop: 10,
    marginBottom: 5,
    marginLeft: 12,
  },

  sectionHeader: {
    backgroundColor: COLORS.searchBg,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.primaryLight,
    textTransform: "uppercase",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.searchBg,
    margin: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 36,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.textDark },

  convoRow: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDark,
    alignItems: "center",
    backgroundColor: COLORS.surfaceDark,
  },
  convoAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  fallbackAvatar: {
    backgroundColor: COLORS.avatarFallbackBg,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackAvatarText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primaryLight,
  },
  convoName: { fontSize: 14, fontWeight: "bold", color: COLORS.textLight },
  convoTime: { fontSize: 10, color: COLORS.textMutedLight },
  convoLastMsg: { fontSize: 12, color: COLORS.textMutedLight, marginTop: 2 },
  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 5,
  },
  badgeText: { color: COLORS.textLight, fontSize: 9, fontWeight: "bold" },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarRegistered: { backgroundColor: COLORS.primaryLight },
  avatarText: { color: COLORS.textLight, fontSize: 14, fontWeight: "bold" },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: "bold", color: COLORS.textDark },
  contactPhone: { fontSize: 11, color: COLORS.textMutedDark, marginTop: 2 },

  inviteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    minWidth: 60,
    alignItems: "center",
  },
  inviteBtnText: {
    color: COLORS.primaryLight,
    fontWeight: "bold",
    fontSize: 11,
  },
  chatBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    minWidth: 60,
    alignItems: "center",
  },
  chatBtnText: { color: COLORS.textLight, fontWeight: "bold", fontSize: 11 },

  chatArea: { flex: 1 }, // Note: Background color moved to View wrapper above
  msgWrapper: { width: "100%", paddingVertical: 2 },
  selectedMsgRow: { backgroundColor: COLORS.selectionBg },
  bubble: {
    padding: 8,
    borderRadius: 10,
    marginHorizontal: 10,
    maxWidth: "80%",
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.primaryLight,
    borderTopRightRadius: 0,
  },
  theirBubble: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 0,
    elevation: 1, // Add slight luxury drop shadow for light theme
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  msgImage: { width: 150, height: 110, borderRadius: 6, marginBottom: 4 },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 2,
  },
  timestamp: { fontSize: 8 },

  inputContainer: {
    flexDirection: "row",
    padding: 8,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  iconBtn: { padding: 6 },
  textInputWrapper: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 12,
    minHeight: 36,
    maxHeight: 100,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginHorizontal: 6,
  },
  textInput: {
    fontSize: 13,
    paddingTop: 6,
    paddingBottom: 6,
    color: COLORS.textDark,
  },
  recordingStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.recordingBg,
    borderRadius: 18,
    padding: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.recordingRed,
    marginRight: 8,
  },
  recordingText: {
    color: COLORS.recordingRed,
    fontWeight: "bold",
    fontSize: 12,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },

  placeholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
  },
  loadingText: { marginTop: 8, color: COLORS.textMutedDark, fontSize: 12 },
  emptyText: { fontSize: 14, color: COLORS.textMutedDark, fontWeight: "bold" },
  emptySubText: { fontSize: 12, color: COLORS.textMutedDark, marginTop: 4 },
  sendingLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    backgroundColor: COLORS.overlay,
  },
  sendingText: { fontSize: 10, marginLeft: 6, color: COLORS.primaryLight },
});

export default VendorChatScreen;
