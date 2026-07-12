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
  LayoutAnimation,
  BackHandler,
  StatusBar,
  Modal,
  Dimensions,
  ScrollView,
} from "react-native";
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import * as Contacts from "expo-contacts";

// Audio & Image libraries
import { useAudioRecorder, useAudioPlayer, AudioModule } from "expo-audio";
import * as ImagePicker from "expo-image-picker";

// 🔥 Import Notification Helper
import { sendChatNotification } from "../userScreens/utils/NotificationHelper";

// Shared Browser Components
import { ParsedMessageText } from "../components/SharedChatElements";
// import InstamartHeader from "../components/InstamartHeader";

// Redux
import { RootState, AppDispatch } from "../app/store";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import {
  fetchAllUsers,
  syncContacts,
  RegisteredContact,
} from "../features/user/authSlice";
import {
  fetchMessages,
  fetchGroupMessages,
  receiveMessage,
  setActivePartner,
  sendMessage,
  deleteMessageLocally,
  markMessagesAsRead,
  markGroupMessagesAsRead,
  setPartnerSeen,
  deleteMessage,
  clearMessages,
  fetchChatList,
  fetchMyGroups,
  createGroup,
  fetchStatusFeed,
  createStatus,
  reactToMessage,
  viewStatus,
  fetchMyStatuses,
  deleteOwnStatus,
  fetchGroupDetails,
  leaveGroup,
  deleteGroup,
} from "../features/chat/chatSlice";
import socket from "../userScreens/utils/socket";

const { width, height } = Dimensions.get("window");

// ==========================================
// 🔥 ROYAL GREEN, BLACK & WHITE THEME
// ==========================================
const COLORS = {
  primaryDark: "#000000",
  primary: "#006A4E",
  primaryLight: "#128C7E",
  accent: "#25D366",
  chatBackground: "#000",
  surface: "#FFFFFF",
  surfaceDark: "#111111",
  textLight: "#FFFFFF",
  textDark: "#000000",
  textMutedLight: "#E0E0E0",
  textMutedDark: "#666666",
  borderDark: "#333333",
  borderLight: "#E2E8F0",
  selectionBg: "rgba(0, 106, 78, 0.2)",
  recordingRed: "#FF3B30",
  recordingBg: "rgba(255, 59, 48, 0.1)",
  readTick: "#34B7F1",
  unreadTick: "#888888",
  danger: "#FF3B30",
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

const ChatScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);

  // --- REDUX STATE ---
  const { allVendors, vendor: currentVendor } = useSelector(
    (state: RootState) => state.vendorAuth,
  );
  const { allUsers, user: normalUser } = useSelector(
    (state: RootState) => state.auth,
  );
  const {
    messages,
    conversations,
    groups,
    currentGroup,
    statusFeed,
    myStatuses,
  } = useSelector((state: RootState) => state.chat);

  const currentUser = currentVendor || normalUser;
  const currentUserId = currentUser?._id || currentUser?.id;
  const isVendor = !!currentVendor?.shopName;

  // --- UI TOGGLES ---
  const [activeTab, setActiveTab] = useState<"chats" | "groups">("chats");
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [showContacts, setShowContacts] = useState(false);

  // 🔥 NEW: Deep Reach Profile Toggle
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);

  // --- ADVANCED CRUD STATE ---
  const [viewingStatus, setViewingStatus] = useState<any>(null);
  const [statusIndex, setStatusIndex] = useState(0); // 🔥 NEW: For Story arrays

  const [showMyStatusModal, setShowMyStatusModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<ProcessedContact[]>(
    [],
  );
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const isSelectionMode = selectedMessages.length > 0;

  const [allContacts, setAllContacts] = useState<ProcessedContact[]>([]);
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
  useEffect(() => {
    partnerRef.current = selectedPartner;
  }, [selectedPartner]);

  // ==========================================
  // 🔥 INITIAL LOAD & SYNC
  // ==========================================
  useEffect(() => {
    loadAndSyncContacts();
    dispatch(fetchMyGroups());
    dispatch(fetchStatusFeed());
    dispatch(fetchMyStatuses());
    dispatch(fetchChatList());
  }, []);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) =>
        new Date(b.timestamp || 0).getTime() -
        new Date(a.timestamp || 0).getTime(),
    );
  }, [conversations]);

  const loadAndSyncContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") return setLoadingLocal(false);

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      if (data.length === 0) return setLoadingLocal(false);

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
            const match = deviceContactsMap.get(last10);
            processed.push({
              id: dbUser.dbId,
              dbId: dbUser.dbId,
              name: match?.name || dbUser.name,
              phone: last10,
              isRegistered: true,
              role: dbUser.role,
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
      console.log("Contact sync error", error);
    } finally {
      setLoadingLocal(false);
    }
  };

  const platformContacts = useMemo(() => {
    const sourceList = isVendor ? allUsers : allVendors;
    if (!sourceList) return [];
    return sourceList
      .map((u: any) => ({
        id: u._id,
        dbId: u._id,
        name: u.shopName || u.name || "Vendor",
        phone: u.phone ? u.phone.replace(/\D/g, "").slice(-10) : "",
        isRegistered: true,
        role: isVendor ? "User" : "Vendor",
        image: u.shopImage || u.profilePic,
      }))
      .filter(
        (u: ProcessedContact) =>
          u.dbId !== currentUserId &&
          !allContacts.some((c) => c.dbId === u.dbId),
      );
  }, [allVendors, allUsers, isVendor, allContacts, currentUserId]);

  const allAvailableContacts = useMemo(
    () => [...allContacts, ...platformContacts],
    [allContacts, platformContacts],
  );
  const registeredContacts = useMemo(
    () => allAvailableContacts.filter((c) => c.isRegistered),
    [allAvailableContacts],
  );

  const filteredConversations = useMemo(() => {
    if (!globalSearchQuery) return sortedConversations;
    const query = globalSearchQuery.toLowerCase();
    return sortedConversations.filter((item) => {
      const inboxPhoneLast10 = item.contact?.phone
        ?.replace(/\D/g, "")
        .slice(-10);
      const localContact = allAvailableContacts.find(
        (c) =>
          c.dbId === item.contact?._id ||
          (c.phone && inboxPhoneLast10 && c.phone === inboxPhoneLast10),
      );
      const convoName = (
        localContact?.name ||
        item.contact?.name ||
        item.contact?.shopName ||
        "Customer"
      ).toLowerCase();
      const phoneStr = (item.contact?.phone || "").toLowerCase();
      const lastMsg = (item.lastMessage || "").toLowerCase();
      return (
        convoName.includes(query) ||
        phoneStr.includes(query) ||
        lastMsg.includes(query)
      );
    });
  }, [sortedConversations, globalSearchQuery, allAvailableContacts]);

  // ==========================================
  // 🔥 NAVIGATION & CHAT SETUP
  // ==========================================
  const handleContactChat = (contact: ProcessedContact) => {
    setSelectedPartner({
      _id: contact.dbId,
      name: contact.role === "Vendor" ? undefined : contact.name,
      shopName: contact.role === "Vendor" ? contact.name : undefined,
      profilePic: contact.role === "User" ? contact.image : undefined,
      shopImage: contact.role === "Vendor" ? contact.image : undefined,
      role: contact.role,
      phone: contact.phone,
    });
    setShowContacts(false);
  };

  const handleGroupChat = (group: any) => {
    setSelectedPartner({
      _id: group._id,
      name: group.name,
      isGroup: true,
      avatarUrl: group.avatarUrl,
    });
  };

  const handleBackToInbox = () => {
    setSelectedPartner(null);
    setShowPartnerProfile(false);
    setShowContacts(false);
    setGlobalSearchQuery("");
    dispatch(setActivePartner(""));
    dispatch(clearMessages());
    dispatch(fetchChatList());
    dispatch(fetchMyGroups());
    dispatch(fetchStatusFeed());
    navigation.setParams({ partner: undefined } as any);
  };

  useEffect(() => {
    const onBackPress = () => {
      if (showPartnerProfile) {
        setShowPartnerProfile(false);
        return true;
      }
      if (viewingStatus) {
        setViewingStatus(null);
        return true;
      }
      if (showMyStatusModal) {
        setShowMyStatusModal(false);
        return true;
      }
      if (showGroupModal) {
        setShowGroupModal(false);
        return true;
      }
      if (actionMessageId) {
        setActionMessageId(null);
        return true;
      }
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
    return () => backHandler.remove();
  }, [
    selectedPartner,
    showContacts,
    viewingStatus,
    showGroupModal,
    showPartnerProfile,
    showMyStatusModal,
    actionMessageId,
  ]);

  // ==========================================
  // 🔥 SOCKET.IO
  // ==========================================
  useEffect(() => {
    if (isVendor) dispatch(fetchAllUsers());
    else dispatch(fetchAllVendors());

    const handleNewMessage = (msg: any) => {
      dispatch(receiveMessage(msg));
      const isFromPartner =
        partnerRef.current?._id &&
        (msg.sender === partnerRef.current._id ||
          msg.group === partnerRef.current._id);

      if (isFromPartner) {
        if (msg.isGroupMessage)
          dispatch(markGroupMessagesAsRead(partnerRef.current._id));
        else dispatch(markMessagesAsRead(partnerRef.current._id));
        setTimeout(
          () =>
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
          300,
        );
      } else if (msg.sender !== currentUserId) {
        sendChatNotification(
          msg.isGroupMessage ? "Group Message" : "New Message",
          msg.messageType === "text" ? msg.content : "Sent a file",
        );
      }
      if (!partnerRef.current) dispatch(fetchChatList());
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messageDeletedLocally", (id: string) =>
      dispatch(deleteMessageLocally(id)),
    );
    socket.on("messageUpdated", (msg: any) => dispatch(receiveMessage(msg)));
    socket.on("messagesSeen", ({ by }: { by: string }) => {
      if (partnerRef.current?._id === by) dispatch(setPartnerSeen());
    });

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messageDeletedLocally");
      socket.off("messageUpdated");
      socket.off("messagesSeen");
    };
  }, [dispatch, isVendor, currentUserId]);

  useEffect(() => {
    if (selectedPartner?._id) {
      dispatch(clearMessages());
      dispatch(setActivePartner(selectedPartner._id));
      if (selectedPartner.isGroup) {
        dispatch(fetchGroupMessages(selectedPartner._id));
        dispatch(markGroupMessagesAsRead(selectedPartner._id)).then(() =>
          dispatch(fetchChatList()),
        );
      } else {
        dispatch(fetchMessages(selectedPartner._id));
        dispatch(markMessagesAsRead(selectedPartner._id)).then(() =>
          dispatch(fetchChatList()),
        );
      }
    }
  }, [selectedPartner, dispatch]);

  // ==========================================
  // 🔥 ADVANCED ACTIONS (Status & Groups)
  // ==========================================

  // STATUS CRUD
  const handleAddStatus = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.7,
    });
    if (!result.canceled) {
      const formData = new FormData();
      const fileUri = result.assets[0].uri;
      const type = result.assets[0].type === "video" ? "video" : "image";
      const cleanUri =
        Platform.OS === "ios" ? fileUri.replace("file://", "") : fileUri;

      formData.append("messageType", type);
      formData.append("file", {
        uri: cleanUri,
        name: `status.${type === "video" ? "mp4" : "jpg"}`,
        type: type === "video" ? "video/mp4" : "image/jpeg",
      } as any);

      dispatch(createStatus(formData)).then(() => {
        Alert.alert("Success", "Status Uploaded!");
        dispatch(fetchStatusFeed());
        dispatch(fetchMyStatuses());
      });
    }
  };

  const handleViewStatus = (statusData: any) => {
    setViewingStatus(statusData);
    setStatusIndex(0);
    if (statusData?.statuses?.[0]?._id) {
      dispatch(viewStatus(statusData.statuses[0]._id));
    }
  };

  const handleDeleteMyStatus = (statusId: string) => {
    Alert.alert(
      "Delete Status",
      "Are you sure you want to delete this status?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            dispatch(deleteOwnStatus(statusId)).then(() => {
              dispatch(fetchMyStatuses());
              dispatch(fetchStatusFeed());
            });
          },
        },
      ],
    );
  };

  // GROUP CRUD
  const handleCreateGroupSubmit = () => {
    if (!newGroupName) return Alert.alert("Error", "Enter group name");
    const initialMembers = selectedMembers.map((m) => ({
      id: m.dbId,
      role: m.role || "User",
    }));

    dispatch(createGroup({ name: newGroupName, initialMembers })).then(() => {
      setShowGroupModal(false);
      setNewGroupName("");
      setSelectedMembers([]);
      dispatch(fetchMyGroups());
    });
  };

  // MESSAGE ACTIONS
  const executeReaction = (emoji: string) => {
    if (actionMessageId) {
      dispatch(reactToMessage({ messageId: actionMessageId, emoji }));
      setActionMessageId(null);
    }
  };

  const executeDelete = (type: "me" | "everyone") => {
    if (actionMessageId) {
      dispatch(deleteMessage({ messageId: actionMessageId, deleteType: type }));
      setActionMessageId(null);
      setSelectedMessages([]);
    }
  };

  const handleLongPress = (messageId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMessages([messageId]);
    setActionMessageId(messageId);
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

  // ==========================================
  // 🔥 SENDING & AUDIO
  // ==========================================
  const handleSend = async (
    type: "text" | "image" | "audio",
    fileUri?: string,
  ) => {
    if (!selectedPartner) return;
    const formData = new FormData();

    if (selectedPartner.isGroup) {
      formData.append("isGroupMessage", "true");
      formData.append("groupId", selectedPartner._id);
    } else {
      formData.append("receiverId", selectedPartner._id);
      formData.append(
        "receiverModel",
        selectedPartner.role || (isVendor ? "User" : "Vendor"),
      );
    }
    formData.append("messageType", type);

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
      formData.append("file", {
        uri: cleanUri,
        name: filename,
        type: type === "image" ? "image/jpeg" : "audio/m4a",
      } as any);
    }

    dispatch(sendMessage(formData)).then(() => {
      setTimeout(
        () =>
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
        200,
      );
      dispatch(fetchChatList());
    });
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) handleSend("image", result.assets[0].uri);
  };

  const startRecording = async () => {
    try {
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== "granted") return;
      shouldCancelRef.current = false;
      isPreparingRef.current = true;
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        playThroughEarpiece: false,
      });
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
    } catch (err) {}
  };

  const stopRecording = async () => {
    if (isPreparingRef.current) {
      shouldCancelRef.current = true;
      return;
    }
    if (!isRecording) return;
    if (timerInterval.current) clearInterval(timerInterval.current);
    setIsRecording(false);
    await audioRecorder.stop();
    if (durationRef.current > 0 && audioRecorder.uri)
      handleSend("audio", audioRecorder.uri);
  };

  const displayPartnerName =
    selectedPartner?.name || selectedPartner?.shopName || "Chat";
  const displayPartnerPhone = allAvailableContacts.find(
    (c) => c.dbId === selectedPartner?._id,
  )?.phone;
  const partnerImage =
    selectedPartner?.profilePic ||
    selectedPartner?.shopImage ||
    selectedPartner?.avatarUrl;
  const partnerInitial = displayPartnerName
    ? displayPartnerName.charAt(0).toUpperCase()
    : "U";

  return (
    <SafeAreaView
      style={[
        styles.container,
        !selectedPartner &&
          !showContacts && { backgroundColor: COLORS.surface },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={
          !selectedPartner && !showContacts
            ? COLORS.primaryDark
            : COLORS.primary
        }
      />

      {/* ========================================== */}
      {/* 🔥 MODAL 1: FULLSCREEN STATUS VIEWER */}
      {/* ========================================== */}
      <Modal visible={!!viewingStatus} transparent={true} animationType="fade">
        <View style={styles.statusViewer}>
          <View style={styles.statusViewerHeader}>
            <TouchableOpacity
              onPress={() => {
                setViewingStatus(null);
                setStatusIndex(0);
              }}
              style={{ padding: 15 }}
            >
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "bold" }}>
                {viewingStatus?.authorDetails?.name ||
                  viewingStatus?.authorDetails?.shopName}
              </Text>
              <Text style={{ color: COLORS.textMutedLight, fontSize: 12 }}>
                {new Date(
                  viewingStatus?.statuses?.[statusIndex]?.createdAt,
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>

          {/* Progress Bars */}
          <View
            style={{
              flexDirection: "row",
              position: "absolute",
              top: Platform.OS === "ios" ? 50 : 20,
              width: "100%",
              paddingHorizontal: 10,
              zIndex: 10001,
            }}
          >
            {viewingStatus?.statuses?.map((_: any, idx: number) => (
              <View
                key={idx}
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor:
                    idx <= statusIndex ? "#FFF" : "rgba(255,255,255,0.3)",
                  marginHorizontal: 2,
                  borderRadius: 2,
                }}
              />
            ))}
          </View>

          {viewingStatus?.statuses?.[statusIndex]?.mediaUrl && (
            <Image
              source={{ uri: viewingStatus.statuses[statusIndex].mediaUrl }}
              style={{ width: "100%", height: "100%", resizeMode: "contain" }}
            />
          )}

          {/* Tap Areas for Story Navigation */}
          <TouchableOpacity
            style={{
              position: "absolute",
              left: 0,
              width: "30%",
              height: "100%",
            }}
            onPress={() => setStatusIndex((prev) => Math.max(0, prev - 1))}
          />
          <TouchableOpacity
            style={{
              position: "absolute",
              right: 0,
              width: "70%",
              height: "100%",
            }}
            onPress={() => {
              if (statusIndex < viewingStatus.statuses.length - 1) {
                setStatusIndex((prev) => prev + 1);
              } else {
                setViewingStatus(null);
                setStatusIndex(0);
              }
            }}
          />
        </View>
      </Modal>

      {/* ========================================== */}
      {/* 🔥 MODAL 2: MY STATUS MANAGER */}
      {/* ========================================== */}
      <Modal visible={showMyStatusModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowMyStatusModal(false)}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textLight} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { marginLeft: 15 }]}>
              My Statuses
            </Text>
          </View>

          <FlatList
            data={myStatuses}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <Text style={styles.emptyText}>You have no active statuses.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.myStatusListRow}>
                <Image
                  source={{ uri: item.mediaUrl }}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 10,
                    backgroundColor: "#EEE",
                  }}
                />
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={{ fontSize: 16, fontWeight: "bold" }}>
                    {item.viewers?.length || 0} Views
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.textMutedDark }}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteMyStatus(item._id)}
                  style={{ padding: 10 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={24}
                    color={COLORS.danger}
                  />
                </TouchableOpacity>
              </View>
            )}
          />
          <TouchableOpacity
            style={styles.floatingActionBtn}
            onPress={handleAddStatus}
          >
            <Ionicons name="camera" size={28} color="#FFF" />
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* ========================================== */}
      {/* 🔥 MODAL 3: CONTACT INFO PROFILE (DEEP REACH) */}
      {/* ========================================== */}
      <Modal
        visible={showPartnerProfile}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.profileModalContainer}>
          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={() => setShowPartnerProfile(false)}>
              <Ionicons name="close" size={28} color={COLORS.textLight} />
            </TouchableOpacity>
            <Text style={styles.profileHeaderText}>
              {selectedPartner?.isGroup ? "Group Info" : "Contact Info"}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
          >
            {partnerImage ? (
              <Image
                source={{ uri: partnerImage }}
                style={styles.profileBigAvatar}
              />
            ) : (
              <View
                style={[
                  styles.profileBigAvatar,
                  styles.fallbackAvatar,
                  { width: 150, height: 150, borderRadius: 75 },
                ]}
              >
                <Text
                  style={{ fontSize: 60, color: "#FFF", fontWeight: "bold" }}
                >
                  {partnerInitial}
                </Text>
              </View>
            )}

            <Text style={styles.profileBigName}>{displayPartnerName}</Text>
            <Text style={styles.profilePhone}>
              {selectedPartner?.phone ||
                (selectedPartner?.isGroup ? "Group Chat" : "Registered User")}
            </Text>

            <View style={styles.profileActionsRow}>
              <TouchableOpacity style={styles.profileActionBtn}>
                <Ionicons name="call" size={24} color={COLORS.primary} />
                <Text style={styles.profileActionText}>Audio</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileActionBtn}>
                <Ionicons name="videocam" size={24} color={COLORS.primary} />
                <Text style={styles.profileActionText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileActionBtn}>
                <Ionicons name="search" size={24} color={COLORS.primary} />
                <Text style={styles.profileActionText}>Search</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileCard}>
              <Text style={styles.profileCardTitle}>
                {selectedPartner?.isGroup
                  ? "Description"
                  : "About and phone number"}
              </Text>
              <Text style={styles.profileCardDesc}>
                {selectedPartner?.isGroup
                  ? "Welcome to the group!"
                  : "Hey there! I am using BLuxury."}
              </Text>
            </View>

            {selectedPartner?.isGroup && currentGroup && (
              <View style={styles.profileCard}>
                <Text style={styles.profileCardTitle}>
                  {currentGroup.members.length} Participants
                </Text>
                {currentGroup.members.map((m: any) => (
                  <View
                    key={m.memberId?._id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                    }}
                  >
                    <Ionicons
                      name="person-circle"
                      size={40}
                      color={COLORS.textMutedDark}
                    />
                    <Text
                      style={{
                        color: COLORS.textLight,
                        fontSize: 16,
                        marginLeft: 10,
                      }}
                    >
                      {m.memberId?.name || m.memberId?.shopName || "Member"}
                    </Text>
                    {currentGroup.admin === m.memberId?._id && (
                      <Text
                        style={{
                          color: COLORS.primaryLight,
                          marginLeft: "auto",
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        Admin
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.profileCard}>
              <TouchableOpacity
                style={styles.dangerRow}
                onPress={
                  selectedPartner?.isGroup
                    ? () =>
                        dispatch(leaveGroup(selectedPartner._id)).then(() =>
                          handleBackToInbox(),
                        )
                    : undefined
                }
              >
                <Ionicons
                  name={selectedPartner?.isGroup ? "exit" : "ban"}
                  size={24}
                  color={COLORS.danger}
                />
                <Text style={styles.dangerText}>
                  {selectedPartner?.isGroup
                    ? "Exit Group"
                    : `Block ${displayPartnerName}`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerRow}>
                <Ionicons name="thumbs-down" size={24} color={COLORS.danger} />
                <Text style={styles.dangerText}>
                  Report {selectedPartner?.isGroup ? "Group" : "Contact"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* 🔥 MODAL 4: MESSAGE ACTION (Reactions & Delete) */}
      {/* ========================================== */}
      <Modal
        visible={!!actionMessageId}
        transparent={true}
        animationType="slide"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setActionMessageId(null)}
        >
          <View style={styles.actionModalContent}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                marginBottom: 20,
              }}
            >
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => executeReaction(emoji)}
                >
                  <Text style={{ fontSize: 30 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => executeDelete("me")}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              <Text
                style={{ color: COLORS.danger, marginLeft: 10, fontSize: 16 }}
              >
                Delete for Me
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => executeDelete("everyone")}
            >
              <Ionicons name="trash-bin" size={20} color={COLORS.danger} />
              <Text
                style={{ color: COLORS.danger, marginLeft: 10, fontSize: 16 }}
              >
                Delete for Everyone
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================== */}
      {/* 🔥 MODAL 5: GROUP CREATION */}
      {/* ========================================== */}
      <Modal visible={showGroupModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowGroupModal(false)}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textLight} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { marginLeft: 15 }]}>
              New Group
            </Text>
          </View>
          <View style={{ padding: 20 }}>
            <TextInput
              style={styles.groupInput}
              placeholder="Group Name"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <Text style={{ marginTop: 20, fontWeight: "bold", fontSize: 16 }}>
              Select Members
            </Text>
            <FlatList
              data={registeredContacts}
              keyExtractor={(item) => item.id}
              style={{ height: 300, marginTop: 10 }}
              renderItem={({ item }) => {
                const isSelected = selectedMembers.some(
                  (m) => m.dbId === item.dbId,
                );
                const initial = item.name
                  ? item.name.charAt(0).toUpperCase()
                  : "#";
                return (
                  <TouchableOpacity
                    style={[
                      styles.contactRow,
                      isSelected && { backgroundColor: COLORS.selectionBg },
                    ]}
                    onPress={() =>
                      setSelectedMembers((prev) =>
                        isSelected
                          ? prev.filter((m) => m.dbId !== item.dbId)
                          : [...prev, item],
                      )
                    }
                  >
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.fallbackAvatar]}>
                        <Text style={styles.fallbackAvatarText}>{initial}</Text>
                      </View>
                    )}
                    <Text style={styles.contactName}>{item.name}</Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={COLORS.primary}
                        style={{ marginLeft: "auto" }}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { width: "100%", borderRadius: 10, marginTop: 20 },
              ]}
              onPress={handleCreateGroupSubmit}
            >
              <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}>
                Create Group
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ========================================== */}
      {/* 🔥 HEADERS */}
      {/* ========================================== */}
      {selectedPartner ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBackToInbox}
            style={{ paddingRight: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
            onPress={() => {
              if (selectedPartner.isGroup)
                dispatch(fetchGroupDetails(selectedPartner._id));
              setShowPartnerProfile(true);
            }}
            activeOpacity={0.7}
          >
            {partnerImage ? (
              <Image
                source={{ uri: partnerImage }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={[styles.headerAvatar, styles.fallbackAvatar]}>
                <Text style={styles.fallbackAvatarText}>{partnerInitial}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {displayPartnerName}
              </Text>
              <Text style={styles.headerSub}>
                {selectedPartner.isGroup
                  ? "Tap here for group info"
                  : displayPartnerPhone || "tap here for contact info"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : showContacts ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowContacts(false)}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
          <View style={{ marginLeft: 15 }}>
            <Text style={styles.headerTitle}>Select Contact</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { justifyContent: "space-between" }]}>
          <Text style={styles.headerTitle}>Bluxury</Text>
          <TouchableOpacity onPress={() => setShowContacts(true)}>
            <Ionicons name="add-circle" size={26} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      )}

      {/* ========================================== */}
      {/* 🔥 MAIN TABS (Chats | Groups) - KEPT YOUR ORIGINAL ONES */}
      {/* ========================================== */}
      {!selectedPartner && !showContacts && (
        <View style={styles.tabBar}>
          {["chats", "groups"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabItem,
                activeTab === tab && styles.tabItemActive,
              ]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* 🔥 TAB 1: CHATS (With Status Bar at Top) */}
        {!selectedPartner && !showContacts && activeTab === "chats" && (
          <FlatList
            style={{ flex: 1 }}
            data={filteredConversations}
            keyExtractor={(item) => `convo-${item._id}`}
            ListHeaderComponent={() => (
              <View style={{ width: "100%" }}>
                {/* <InstamartHeader onSearchChange={setGlobalSearchQuery} /> */}

                {/* HORIZONTAL STATUS BAR */}
                <View style={styles.statusBarContainer}>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={[{ isMyStatus: true }, ...statusFeed]}
                    keyExtractor={(item: any, index) =>
                      item.isMyStatus ? "my-status" : item._id
                    }
                    renderItem={({ item }) => {
                      if (item.isMyStatus) {
                        const myInitial = (
                          currentUser?.name ||
                          currentUser?.shopName ||
                          "M"
                        )
                          .charAt(0)
                          .toUpperCase();
                        const myPic =
                          currentUser?.profilePic || currentUser?.shopImage;
                        return (
                          <TouchableOpacity
                            style={styles.statusItem}
                            onPress={() => setShowMyStatusModal(true)}
                          >
                            <View style={styles.myStatusRing}>
                              {myPic ? (
                                <Image
                                  source={{ uri: myPic }}
                                  style={styles.statusAvatar}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.statusAvatar,
                                    styles.fallbackAvatar,
                                  ]}
                                >
                                  <Text style={styles.fallbackAvatarText}>
                                    {myInitial}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.addStatusBadge}>
                                <Ionicons name="add" size={12} color="#FFF" />
                              </View>
                            </View>
                            <Text style={styles.statusText} numberOfLines={1}>
                              My Status
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                      const authorName =
                        item.authorDetails?.name ||
                        item.authorDetails?.shopName ||
                        "User";
                      const initial = authorName.charAt(0).toUpperCase();
                      const pic =
                        item.authorDetails?.profilePic ||
                        item.authorDetails?.shopImage;
                      return (
                        <TouchableOpacity
                          style={styles.statusItem}
                          onPress={() => handleViewStatus(item)}
                        >
                          <View style={styles.statusRing}>
                            {pic ? (
                              <Image
                                source={{ uri: pic }}
                                style={styles.statusAvatar}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.statusAvatar,
                                  styles.fallbackAvatar,
                                ]}
                              >
                                <Text style={styles.fallbackAvatarText}>
                                  {initial}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.statusText} numberOfLines={1}>
                            {authorName}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
                {filteredConversations.length > 0 && (
                  <Text style={styles.recentChatsTitle}>Recent Chats</Text>
                )}
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No recent chats.</Text>
            }
            renderItem={({ item }) => {
              const convoName =
                item.contact?.name || item.contact?.shopName || "Customer";
              const convoInitial = convoName.charAt(0).toUpperCase();
              const image = item.contact?.profilePic || item.contact?.shopImage;
              return (
                <TouchableOpacity
                  style={styles.convoRow}
                  onPress={() =>
                    setSelectedPartner({
                      ...item.contact,
                      _id: item._id,
                      isGroup: item.isGroup,
                    })
                  }
                >
                  {image ? (
                    <Image source={{ uri: image }} style={styles.convoAvatar} />
                  ) : (
                    <View style={[styles.convoAvatar, styles.fallbackAvatar]}>
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
                      <Text style={styles.convoTime}>
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                    <Text style={styles.convoLastMsg} numberOfLines={1}>
                      {item.lastMessage}
                    </Text>
                  </View>
                  {item.unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* 🔥 TAB 2: GROUPS */}
        {!selectedPartner && !showContacts && activeTab === "groups" && (
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={styles.createGroupBtn}
              onPress={() => setShowGroupModal(true)}
            >
              <Ionicons name="people" size={24} color="#FFF" />
              <Text
                style={{
                  color: "#FFF",
                  fontWeight: "bold",
                  marginLeft: 10,
                  fontSize: 16,
                }}
              >
                Create New Group
              </Text>
            </TouchableOpacity>
            <FlatList
              data={groups}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <Text style={styles.emptyText}>You aren't in any groups.</Text>
              }
              renderItem={({ item }) => {
                const initial = item.name
                  ? item.name.charAt(0).toUpperCase()
                  : "G";
                return (
                  <TouchableOpacity
                    style={styles.convoRow}
                    onPress={() => handleGroupChat(item)}
                  >
                    {item.avatarUrl ? (
                      <Image
                        source={{ uri: item.avatarUrl }}
                        style={styles.convoAvatar}
                      />
                    ) : (
                      <View style={[styles.convoAvatar, styles.fallbackAvatar]}>
                        <Text style={styles.fallbackAvatarText}>{initial}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, justifyContent: "center" }}>
                      <Text style={styles.convoName}>{item.name}</Text>
                      <Text style={styles.convoLastMsg} numberOfLines={1}>
                        {item.description || `${item.members.length} members`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* 🔥 VIEW: CONTACTS LIST */}
        {!selectedPartner && showContacts && (
          <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
            <SectionList
              sections={[
                { title: "Available Contacts", data: registeredContacts },
              ]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const initial = item.name
                  ? item.name.charAt(0).toUpperCase()
                  : "#";
                return (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => handleContactChat(item)}
                  >
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.fallbackAvatar]}>
                        <Text style={styles.fallbackAvatarText}>{initial}</Text>
                      </View>
                    )}
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactPhone}>{item.phone}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* 🔥 VIEW: ACTIVE CHAT ROOM */}
        {selectedPartner && (
          <View style={{ flex: 1, backgroundColor: COLORS.chatBackground }}>
            <FlatList
              ref={flatListRef}
              style={{ flex: 1 }}
              inverted={true}
              data={[...messages].reverse()}
              keyExtractor={(item) => item._id.toString()}
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
                      {/* 🔥 Group Sender Name */}
                      {selectedPartner.isGroup && !isMe && (
                        <Text
                          style={{
                            color: COLORS.primaryLight,
                            fontSize: 12,
                            fontWeight: "bold",
                            marginBottom: 2,
                          }}
                        >
                          ~ {item.senderModel}
                        </Text>
                      )}

                      {item.messageType === "image" && (
                        <Image
                          source={{ uri: item.mediaUrl }}
                          style={styles.msgImage}
                        />
                      )}
                      {item.content && (
                        <ParsedMessageText text={item.content} isMe={isMe} />
                      )}

                      {item.reactions && item.reactions.length > 0 && (
                        <View style={styles.reactionBox}>
                          <Text style={{ fontSize: 12 }}>
                            {item.reactions[0].emoji}
                          </Text>
                        </View>
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
                            size={16}
                            color={
                              item.read ? COLORS.readTick : COLORS.textMutedDark
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
            {/* Input Bar */}
            <View style={styles.inputContainer}>
              <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
                <Ionicons name="camera" size={24} color={COLORS.primary} />
              </TouchableOpacity>
              <View style={styles.textInputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Message..."
                  placeholderTextColor={COLORS.textMutedDark}
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                />
              </View>

              {messageText.trim() ? (
                <TouchableOpacity
                  onPress={() => handleSend("text")}
                  style={styles.sendBtn}
                >
                  <Ionicons name="send" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  style={[
                    styles.sendBtn,
                    isRecording && { backgroundColor: COLORS.danger },
                  ]}
                >
                  <Ionicons
                    name={isRecording ? "stop" : "mic"}
                    size={22}
                    color="#FFF"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingTop: Platform.OS === "android" ? 20 : 5,
  },
  header: {
    height: 60,
    backgroundColor: COLORS.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    width: "100%",
  },
  selectionHeader: {
    height: 60,
    backgroundColor: COLORS.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    width: "100%",
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  selectionCount: {
    color: COLORS.textLight,
    fontSize: 20,
    marginLeft: 25,
    fontWeight: "600",
  },
  headerTitle: { color: COLORS.textLight, fontSize: 22, fontWeight: "bold" },
  headerSub: { color: COLORS.textMutedLight, fontSize: 13 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginLeft: 10 },
  headerName: { color: COLORS.textLight, fontSize: 16, fontWeight: "bold" },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.primaryDark,
    elevation: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabItemActive: { borderBottomColor: COLORS.textLight },
  tabText: { color: COLORS.textMutedLight, fontWeight: "bold", fontSize: 14 },
  tabTextActive: { color: COLORS.textLight },

  // Status Bar UI
  statusBarContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  statusItem: { alignItems: "center", marginHorizontal: 10, width: 65 },
  statusRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
  },
  myStatusRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
  },
  statusAvatar: { width: 52, height: 52, borderRadius: 26 },
  addStatusBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  statusText: {
    fontSize: 11,
    color: COLORS.textDark,
    marginTop: 5,
    textAlign: "center",
  },

  // My Status List
  myStatusListRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  floatingActionBtn: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },

  convoRow: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: "center",
    backgroundColor: COLORS.surface,
  },
  convoAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  fallbackAvatar: {
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackAvatarText: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.textLight,
  },
  convoName: { fontSize: 16, fontWeight: "bold", color: COLORS.textDark },
  convoTime: { fontSize: 11, color: COLORS.textMutedDark },
  convoLastMsg: { fontSize: 14, color: COLORS.textMutedDark, marginTop: 2 },
  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 5,
  },
  badgeText: { color: COLORS.textLight, fontSize: 10, fontWeight: "bold" },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: COLORS.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: "bold", color: COLORS.textDark },
  contactPhone: { fontSize: 13, color: COLORS.textMutedDark, marginTop: 2 },

  chatArea: { flex: 1, width: "100%" },
  msgWrapper: { width: "100%", paddingVertical: 2 },
  selectedMsgRow: { backgroundColor: COLORS.selectionBg },
  bubble: {
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 12,
    maxWidth: "80%",
  },
  myBubble: { alignSelf: "flex-end", backgroundColor: COLORS.primary },
  theirBubble: { alignSelf: "flex-start", backgroundColor: COLORS.surface },
  msgImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 5 },
  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
  },
  timestamp: { fontSize: 10 },
  inputContainer: {
    flexDirection: "row",
    padding: 8,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
  iconBtn: { padding: 8 },
  textInputWrapper: {
    flex: 1,
    backgroundColor: COLORS.chatBackground,
    borderRadius: 20,
    paddingHorizontal: 15,
    minHeight: 45,
    justifyContent: "center",
    marginHorizontal: 5,
  },
  textInput: { fontSize: 16, color: COLORS.textDark },
  sendBtn: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  createGroupBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primaryLight,
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  groupInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
  },

  statusViewer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: width,
    height: height,
    backgroundColor: "#000",
    zIndex: 9999,
    justifyContent: "center",
  },
  statusViewerHeader: {
    position: "absolute",
    top: Platform.OS === "ios" ? 40 : 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10000,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionModalContent: {
    backgroundColor: "#FFF",
    width: "80%",
    padding: 20,
    borderRadius: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  reactionBox: {
    position: "absolute",
    bottom: -10,
    right: 10,
    backgroundColor: "#FFF",
    borderRadius: 15,
    padding: 2,
    elevation: 2,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMutedDark,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 30,
  },
  recentChatsTitle: {
    padding: 15,
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.textDark,
  },
  leaveGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    backgroundColor: "#FFEBEB",
    margin: 20,
    borderRadius: 10,
  },

  // 🔥 PROFILE MODAL (Contact Info - Deep Reach)
  profileModalContainer: { flex: 1, backgroundColor: "#111" },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  profileHeaderText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
    textAlign: "center",
  },
  profileBigAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginTop: 30,
    marginBottom: 20,
  },
  profileBigName: { color: "#FFF", fontSize: 24, fontWeight: "bold" },
  profilePhone: { color: "#AAA", fontSize: 18, marginTop: 5 },

  profileActionsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "80%",
    marginVertical: 30,
  },
  profileActionBtn: {
    alignItems: "center",
    backgroundColor: "#222",
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 15,
  },
  profileActionText: {
    color: COLORS.primaryLight,
    marginTop: 8,
    fontWeight: "bold",
  },

  profileCard: {
    backgroundColor: "#222",
    width: "100%",
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
    marginBottom: 10,
  },
  profileCardTitle: { color: "#AAA", fontSize: 14, marginBottom: 10 },
  profileCardDesc: { color: "#FFF", fontSize: 16 },

  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  dangerText: {
    color: COLORS.danger,
    fontSize: 18,
    marginLeft: 20,
    fontWeight: "500",
  },
});

export default ChatScreen;
