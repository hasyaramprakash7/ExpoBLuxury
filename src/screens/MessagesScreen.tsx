// src/screens/MessagesScreen.tsx
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, StatusBar, Platform, Keyboard, Alert,
  Modal, ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { RootState, AppDispatch } from '../app/store';
import {
  fetchConversations, fetchMessages, sendMessage,
  getOrCreateConversation, deleteMessage,
  selectConversations, selectMessages,
  selectSuggestedUsers, fetchSuggestedUsers,
  updateMessageInConversation, incrementUnreadCount,
  searchIdentities, resolveIdentities, clearIdentitySearch,
  selectIdentitySearchResults, selectIdentitySearchQuery,
  selectIdentitySearchLoading, selectResolvedIdentities,
} from '../features/adSlice';
import { useSocket } from '../hooks/useSocket';
import api from '../userScreens/utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═════════════════════════════════════════════════════════
// LOG HELPERS
// ═════════════════════════════════════════════════════════
const LOG_TAG = '💬[MessagesScreen]';

const log = (...args: any[]) => {
  if (__DEV__) console.log(LOG_TAG, ...args);
};
const logWarn = (...args: any[]) => {
  if (__DEV__) console.warn(LOG_TAG, '⚠️', ...args);
};
const logError = (...args: any[]) => {
  if (__DEV__) console.error(LOG_TAG, '❌', ...args);
};

const Royal = {
  pureBlack: '#000000', pureWhite: '#FFFFFF',
  offWhite: '#F4F4F6', softWhite: '#F2F2F7',
  textPrimary: '#0B0B0F',
  textSecondary: 'rgba(11,11,15,0.55)',
  textTertiary: 'rgba(11,11,15,0.40)',
  borderLight: 'rgba(0,0,0,0.08)',
  redAlert: '#FF3040',
  blueAccent: '#0095F6',
  greenAccent: '#00C853',
  bubbleMe: '#0B0B0F', bubbleOther: '#F4F4F6',
  onlineGreen: '#4CD964',
  vendorPurple: '#6C63FF',
};

const ADLIST_NAVBAR_RESERVED = 76;
const INPUT_BOTTOM_GAP = 22;

// ═════════════════════════════════════════════════════════
// IDENTITY KIND NORMALIZATION
// ═════════════════════════════════════════════════════════
type IdentityKind = 'User' | 'Vendor';

const normalizeIdentityKind = (raw: any): IdentityKind | null => {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'vendor' || s === 'shop') return 'Vendor';
  if (s === 'user' || s === 'customer') return 'User';
  return null;
};

// ═════════════════════════════════════════════════════════
// URI VALIDATOR — only accept remote http(s) URLs.
// ═════════════════════════════════════════════════════════
const isUsableRemoteUri = (uri: any): boolean => {
  if (typeof uri !== 'string') return false;
  const s = uri.trim();
  if (!s) return false;
  if (/^(file|content|ph|assets-library|blob|data):/i.test(s)) return false;
  return /^https?:\/\//i.test(s);
};

// ═════════════════════════════════════════════════════════
// Phone-based vendor detection (optional fixed list)
// ═════════════════════════════════════════════════════════
const KNOWN_VENDOR_PHONES = new Set<string>([
  // '7893828468',
]);

const normalizePhone = (phone: any) =>
  phone ? String(phone).replace(/^\+91/, '').replace(/\D/g, '') : '';

const isKnownVendorPhone = (phone: any) =>
  KNOWN_VENDOR_PHONES.has(normalizePhone(phone));

// ─────────────────────────────────────────────────────────
// Time helpers
// ─────────────────────────────────────────────────────────
const timeAgo = (date?: string) => {
  if (!date) return '';
  const t = new Date(date).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return 'now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
};

const formatTime = (date?: string) => {
  if (!date) return '';
  const d = new Date(date);
  const hrs = d.getHours();
  const mins = d.getMinutes();
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const h = hrs % 12 || 12;
  const m = mins < 10 ? `0${mins}` : mins;
  return `${h}:${m} ${ampm}`;
};

// ✅ Generate a unique token for THIS mounted instance of the screen.
//    Two simultaneous MessagesScreens (user + vendor) get different tokens,
//    so they can never collide in expo-image's shared native cache.
const makeInstanceId = () =>
  `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface MessagesScreenProps {
  embedded?: boolean;
  autoOpenParticipant?: {
    userId: string;
    name: string;
    avatar?: string;
    userType?: 'User' | 'Vendor';
  } | null;
  onAutoOpenHandled?: () => void;
}

const MessagesScreen: React.FC<MessagesScreenProps> = ({
  embedded = true,
  autoOpenParticipant = null,
  onAutoOpenHandled,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  // ✅ Stable per-mount identity for cache keying.
  const screenInstanceIdRef = useRef<string>('');
  if (!screenInstanceIdRef.current) {
    screenInstanceIdRef.current = makeInstanceId();
  }
  const screenInstanceId = screenInstanceIdRef.current;

  log('🟢 RENDER MessagesScreen', {
    screenInstanceId,
    embedded,
    autoOpenParticipant,
    ts: Date.now(),
  });

  // ═════════════════════════════════════════════════════════
  // ROLE DETECTION
  // ═════════════════════════════════════════════════════════
  const activeRole = useSelector((s: RootState) => s.session.activeRole);
  const isVendorRole = activeRole === 'vendor';

  const user = useSelector((state: RootState) => state.auth.user);
  const userIdFromUser = (user as any)?._id || (user as any)?.id || '';
  const userNameFromUser = user?.name || '';

  const vendor = useSelector((s: RootState) => (s as any).vendorAuth?.vendor);
  const userIdFromVendor =
    (vendor as any)?._id ||
    (vendor as any)?.id ||
    (vendor as any)?.vendorId ||
    '';
  const userNameFromVendor =
    (vendor as any)?.shopName ||
    (vendor as any)?.name ||
    (vendor as any)?.ownerName ||
    '';

  const userId = isVendorRole ? userIdFromVendor : userIdFromUser;
  const userName = isVendorRole ? userNameFromVendor : userNameFromUser;

  log('👤 Role resolved', { screenInstanceId, activeRole, isVendorRole, userId, userName });

  const {
    isConnected,
    joinConversation, leaveConversation,
    emitTyping, emitStopTyping, emitMessageRead,
    onNewMessage, onUserTyping, onUserStoppedTyping,
    onMessageReadReceipt, onUserOnline, onUserOffline, onOnlineUsers,
    checkOnline,
  } = useSocket();

  const conversations = useSelector(selectConversations);
  const suggestedUsers = useSelector(selectSuggestedUsers);

  const identityResults = useSelector(selectIdentitySearchResults);
  const identitySearchLoading = useSelector(selectIdentitySearchLoading);
  const identitySearchQuery = useSelector(selectIdentitySearchQuery);
  const resolvedIdentities = useSelector(selectResolvedIdentities);

  const messagesByConv = useSelector(
    (s: RootState) => (s as any).ads?.messages || {}
  );

  log('📦 Redux state snapshot', {
    screenInstanceId,
    conversationsCount: conversations?.length || 0,
    suggestedUsersCount: suggestedUsers?.length || 0,
    identityResultsCount: identityResults?.length || 0,
    identitySearchLoading,
    identitySearchQuery,
    resolvedIdentitiesKeys: Object.keys(resolvedIdentities || {}),
    messagesConvKeys: Object.keys(messagesByConv || {}),
  });

  useEffect(() => {
    log('🔄 resolvedIdentities changed', {
      screenInstanceId,
      keys: Object.keys(resolvedIdentities || {}),
    });
  }, [resolvedIdentities, screenInstanceId]);

  const messagesForConv = useCallback(
    (cid: string) => (cid && messagesByConv[cid]) ? messagesByConv[cid] : [],
    [messagesByConv]
  );

  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [activeParticipant, setActiveParticipant] = useState<any>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());
  const [chatRefreshing, setChatRefreshing] = useState(false);

  const messagesSelector = useMemo(
    () => selectMessages(activeConversation || ''),
    [activeConversation]
  );
  const messages = useSelector(messagesSelector);

  const listRef = useRef<FlatList<any>>(null);
  const typingTimerRef = useRef<any>(null);
  const isTypingRef = useRef(false);

  const activeConvRef = useRef<string | null>(null);
  const activePartRef = useRef<any>(null);
  const userIdRef = useRef<string>('');
  useEffect(() => { activeConvRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { activePartRef.current = activeParticipant; }, [activeParticipant]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // ─────────────────────────────────────────────────────────
  // DEBUG — dump first 5 messages whenever a chat loads
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!__DEV__ || !activeConversation) return;
    console.log(
      `${LOG_TAG} 📨 messages loaded for ${activeConversation} [instance=${screenInstanceId}]:`,
      (messages || []).slice(0, 5).map((m: any) => ({
        id: m._id ? String(m._id).slice(-6) : null,
        senderId: m.senderId,
        senderName: m.senderName,
        senderAvatar: m.senderAvatar,
        isRemote: isUsableRemoteUri(m.senderAvatar),
        text: (m.text || '').slice(0, 30),
      }))
    );
  }, [messages, activeConversation, screenInstanceId]);

  // ═════════════════════════════════════════════════════════
  // Batch-resolve participants
  // ═════════════════════════════════════════════════════════
  const resolvedIdsRef = useRef<Set<string>>(new Set());
  const resolvedRef = useRef(resolvedIdentities);
  useEffect(() => { resolvedRef.current = resolvedIdentities; }, [resolvedIdentities]);

  useEffect(() => {
    const ids: string[] = [];

    conversations.forEach((c: any) => {
      const p = c?.participant;
      if (!p) return;
      ['userId', '_id', 'id'].forEach((k) => {
        const v = String(p[k] || '').trim();
        if (v) ids.push(v);
      });
    });

    suggestedUsers.forEach((u: any) => {
      const v = String(u?._id || u?.userId || u?.id || '').trim();
      if (v) ids.push(v);
    });

    if (activeParticipant) {
      ['userId', '_id', 'id'].forEach((k) => {
        const v = String(activeParticipant[k] || '').trim();
        if (v) ids.push(v);
      });
    }

    const allIds = Array.from(new Set(ids));
    const missing = allIds.filter(
      (id) => id && !resolvedIdsRef.current.has(id) && !resolvedRef.current[id]
    );

    log('🔍 Batch-resolve effect triggered', {
      screenInstanceId,
      totalIds: allIds.length,
      alreadyResolved: allIds.filter((id) => resolvedRef.current[id]).length,
      missing,
    });

    if (missing.length === 0) return;

    missing.forEach((id) => resolvedIdsRef.current.add(id));
    log('🚀 Dispatching resolveIdentities', { screenInstanceId, ids: missing });
    dispatch(resolveIdentities(missing));
  }, [conversations, suggestedUsers, activeParticipant, dispatch, screenInstanceId]);

  // ═════════════════════════════════════════════════════════
  // SOCKET LISTENERS
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
    if (!userId || !isConnected) return;

    log('🔌 Registering socket listeners', { screenInstanceId });

    const unsubMsg = onNewMessage((data: any) => {
      const { conversationId, message } = data || {};
      log('📨 onNewMessage', { screenInstanceId, conversationId, messageId: message?._id });
      if (!conversationId || !message?._id) return;

      if (conversationId === activeConvRef.current) {
        dispatch(updateMessageInConversation({ conversationId, message }));
        emitMessageRead({
          conversationId,
          messageId: message._id,
          userId: userIdRef.current,
          senderId: message.senderId,
        });
      } else {
        dispatch(incrementUnreadCount({
          conversationId,
          userId: userIdRef.current,
        }));
      }

      dispatch(fetchConversations());
    });

    const unsubTyping = onUserTyping((data: any) => {
      const { conversationId, userId: typingUserId, userName: typingUserName } = data || {};
      if (conversationId === activeConvRef.current && String(typingUserId) !== String(userIdRef.current)) {
        setTypingUsers((prev) => ({ ...prev, [conversationId]: typingUserName || 'Someone' }));
      }
    });

    const unsubStopTyping = onUserStoppedTyping((data: any) => {
      const { conversationId, userId: typingUserId } = data || {};
      if (conversationId === activeConvRef.current && String(typingUserId) !== String(userIdRef.current)) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[conversationId];
          return next;
        });
      }
    });

    const unsubRead = onMessageReadReceipt(() => {});

    const unsubOnline = onUserOnline((data: any) => {
      if (!data?.userId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(String(data.userId));
        return next;
      });
    });

    const unsubOffline = onUserOffline((data: any) => {
      if (!data?.userId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(String(data.userId));
        return next;
      });
    });

    const unsubOnlineUsers = onOnlineUsers((ids: string[]) => {
      setOnlineUsers(new Set(ids.map(String)));
    });

    return () => {
      log('🔌 Unregistering socket listeners', { screenInstanceId });
      unsubMsg?.(); unsubTyping?.(); unsubStopTyping?.(); unsubRead?.();
      unsubOnline?.(); unsubOffline?.(); unsubOnlineUsers?.();
    };
  }, [
    userId, isConnected,
    onNewMessage, onUserTyping, onUserStoppedTyping,
    onMessageReadReceipt, onUserOnline, onUserOffline, onOnlineUsers,
    emitMessageRead, dispatch, screenInstanceId,
  ]);

  useEffect(() => {
    if (!activeConversation) return;
    log('🔗 Joining conversation', { screenInstanceId, conversationId: activeConversation });
    joinConversation(activeConversation);
    return () => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        const part = activePartRef.current;
        if (part?.userId) {
          emitStopTyping({
            conversationId: activeConversation,
            userId: userIdRef.current,
            receiverId: part.userId,
          });
        }
      }
      log('🔗 Leaving conversation', { screenInstanceId, conversationId: activeConversation });
      leaveConversation(activeConversation);
    };
  }, [activeConversation, joinConversation, leaveConversation, emitStopTyping, screenInstanceId]);

  useEffect(() => {
    if (!isConnected || conversations.length === 0) return;
    const ids = conversations
      .map((c: any) => c?.participant?.userId)
      .filter(Boolean)
      .map(String);
    if (ids.length === 0) return;
    checkOnline(ids, (status) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        Object.entries(status || {}).forEach(([uid, isOn]) => {
          if (isOn) next.add(String(uid));
          else next.delete(String(uid));
        });
        return next;
      });
    });
  }, [isConnected, conversations, checkOnline]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => { setKeyboardVisible(true); setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120); }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const bottomReserved = keyboardVisible ? 8 : embedded ? ADLIST_NAVBAR_RESERVED : Math.max(insets.bottom, 10);
  const inputBottomPadding = bottomReserved + INPUT_BOTTOM_GAP;

  useEffect(() => {
    (async () => {
      setLoading(true);
      await dispatch(fetchConversations());
      setLoading(false);
    })();
  }, [dispatch]);

  useEffect(() => {
    if (!loading && conversations.length === 0 && !activeConversation) {
      setSuggestLoading(true);
      dispatch(fetchSuggestedUsers())
        .unwrap()
        .then(() => setSuggestLoading(false))
        .catch(() => setSuggestLoading(false));
    }
  }, [loading, conversations.length, activeConversation, dispatch]);

  useEffect(() => {
    if (activeConversation) {
      dispatch(fetchMessages({ conversationId: activeConversation, page: 1, limit: 50 }));
    }
  }, [activeConversation, dispatch]);

  useEffect(() => {
    const cid = route.params?.conversationId;
    const targetUserId = route.params?.targetUserId;
    if (cid) {
      const convo = conversations.find((c: any) => c._id === cid);
      if (convo) {
        setActiveParticipant(convo.participant);
        setActiveConversation(cid);
      } else {
        setActiveConversation(cid);
        dispatch(fetchConversations());
      }
    } else if (targetUserId) {
      (async () => {
        try {
          const convo = await dispatch(getOrCreateConversation(targetUserId)).unwrap();
          setActiveParticipant(convo.participant || null);
          setActiveConversation(convo._id);
        } catch {}
      })();
    }
  }, [route.params?.conversationId, route.params?.targetUserId, conversations, dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (userId) dispatch(fetchConversations());
    }, [dispatch, userId])
  );

  // ═════════════════════════════════════════════════════════
  // Debounced identity search
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
    if (!showNewChatModal) return;
    const q = searchQuery.trim();
    if (!q) {
      dispatch(clearIdentitySearch());
      return;
    }
    const t = setTimeout(() => {
      dispatch(searchIdentities(q));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, showNewChatModal, dispatch]);

  // ═════════════════════════════════════════════════════════
  // Auto-open a conversation when parent passes a target
  // ═════════════════════════════════════════════════════════
  useEffect(() => {
    if (!autoOpenParticipant?.userId) return;
    log('🚪 autoOpenParticipant received', { screenInstanceId, autoOpenParticipant });

    let cancelled = false;
    (async () => {
      try {
        const targetId = String(autoOpenParticipant.userId);
        const cached = resolvedIdentities[targetId];
        let resolvedType =
          autoOpenParticipant.userType ||
          (cached ? normalizeIdentityKind((cached as any).type) || undefined : undefined);

        log('🚪 Auto-opening conversation', {
          screenInstanceId,
          targetId,
          resolvedType,
        });

        const convo = await dispatch(
          getOrCreateConversation(
            resolvedType
              ? { targetUserId: targetId, targetUserType: resolvedType }
              : targetId
          )
        ).unwrap();

        if (cancelled) return;

        log('🚪 Auto-open conversation ready', { screenInstanceId, id: (convo as any)?._id });

        setActiveParticipant({
          userId: targetId,
          name: autoOpenParticipant.name || 'Chat',
          avatar: autoOpenParticipant.avatar || '',
          userType: resolvedType,
        });
        setActiveConversation((convo as any)._id);
        dispatch(fetchConversations());
      } catch (e) {
        logError('🚪 autoOpen failed', e);
      } finally {
        onAutoOpenHandled?.();
      }
    })();

    return () => { cancelled = true; };
  }, [
    autoOpenParticipant,
    dispatch,
    resolvedIdentities,
    onAutoOpenHandled,
    screenInstanceId,
  ]);

  // ═════════════════════════════════════════════════════════
  // Pull-to-refresh handler for the active chat
  // ═════════════════════════════════════════════════════════
  const onRefreshChat = useCallback(async () => {
    if (!activeConversation) return;
    log('🔁 onRefreshChat — reloading thread', { screenInstanceId, conversationId: activeConversation });
    setChatRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchMessages({
          conversationId: activeConversation,
          page: 1,
          limit: 50,
        })).unwrap().catch(() => null),
        dispatch(fetchConversations()).unwrap().catch(() => null),
      ]);
    } finally {
      setTimeout(() => setChatRefreshing(false), 400);
    }
  }, [activeConversation, dispatch, screenInstanceId]);

  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    const conv = activeConvRef.current;
    const part = activePartRef.current;
    if (!conv || !part?.userId) return;

    if (!isTypingRef.current && text.length > 0) {
      isTypingRef.current = true;
      emitTyping({
        conversationId: conv,
        userId: userIdRef.current,
        userName,
        receiverId: part.userId,
      });
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitStopTyping({
          conversationId: conv,
          userId: userIdRef.current,
          receiverId: part.userId,
        });
      }
    }, 1500);
  }, [userName, emitTyping, emitStopTyping]);

  const handleSend = useCallback(async () => {
    const conv = activeConvRef.current;
    const part = activePartRef.current;
    if (!conv) return;
    if (!inputText.trim() && !selectedMedia) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('conversationId', conv);
      if (inputText.trim()) formData.append('text', inputText.trim());
      if (selectedMedia) {
        const filename = selectedMedia.split('/').pop() || 'media.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(ext);
        const type = isVideo
          ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4')
          : (ext === 'png' ? 'image/png' : 'image/jpeg');
        // @ts-ignore
        formData.append('media', { uri: selectedMedia, name: filename, type });
      }

      const sent = await dispatch(sendMessage(formData)).unwrap();

      if (sent?._id) {
        dispatch(updateMessageInConversation({ conversationId: conv, message: sent }));
      }

      setInputText('');
      setSelectedMedia(null);

      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitStopTyping({
          conversationId: conv,
          userId: userIdRef.current,
          receiverId: part?.userId,
        });
      }

      dispatch(fetchConversations());
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('Error', e || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [inputText, selectedMedia, dispatch, emitStopTyping]);

  const openConversationWithUser = useCallback(async (
    targetUserId: string,
    name: string,
    avatar: string,
    targetUserType?: 'User' | 'Vendor'
  ) => {
    try {
      let resolvedType = targetUserType;
      if (!resolvedType) {
        const idStr = String(targetUserId);
        const fromMap = resolvedIdentities[idStr];
        if (fromMap) {
          resolvedType = normalizeIdentityKind((fromMap as any).type) || undefined;
        }
      }

      const convo = await dispatch(
        getOrCreateConversation(
          resolvedType
            ? { targetUserId, targetUserType: resolvedType }
            : targetUserId
        )
      ).unwrap();
      setActiveParticipant({
        userId: targetUserId,
        name,
        avatar,
        userType: resolvedType,
      });
      setActiveConversation(convo._id);
      dispatch(fetchConversations());
      setShowNewChatModal(false);
      setSearchQuery('');
      dispatch(clearIdentitySearch());
    } catch (e: any) {
      Alert.alert('Error', e || 'Could not open conversation');
    }
  }, [dispatch, resolvedIdentities]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    Alert.alert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await dispatch(deleteMessage(messageId)).unwrap(); }
          catch (e: any) { Alert.alert('Error', e || 'Failed to delete'); }
        },
      },
    ]);
  }, [dispatch]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Please allow access to your photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedMedia(result.assets[0].uri);
      setShowAttachMenu(false);
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Please allow access to your photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'], allowsEditing: false, quality: 1, videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedMedia(result.assets[0].uri);
      setShowAttachMenu(false);
    }
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c: any) => {
      const name = c.participant?.name?.toLowerCase() || '';
      const lastMsg = c.lastMessage?.text?.toLowerCase() || '';
      return name.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, searchQuery]);

  const filteredSuggestedUsers = useMemo(() => {
    if (!searchQuery.trim()) return suggestedUsers;
    const q = searchQuery.toLowerCase();
    return suggestedUsers.filter((u: any) => {
      const name = u.name?.toLowerCase() || '';
      const username = u.username?.toLowerCase() || '';
      return name.includes(q) || username.includes(q);
    });
  }, [suggestedUsers, searchQuery]);

  // ═════════════════════════════════════════════════════════
  // Vendor detection
  // ═════════════════════════════════════════════════════════
  const isVendor = useCallback((p: any): boolean => {
    if (!p) return false;

    const keys = [
      String(p.userId || '').trim(),
      String(p._id || '').trim(),
      String(p.id || '').trim(),
    ].filter(Boolean);

    for (const k of keys) {
      const r = resolvedIdentities[k];
      if (r) {
        const t =
          normalizeIdentityKind((r as any).type) ||
          normalizeIdentityKind((r as any).userType) ||
          normalizeIdentityKind((r as any).identityType);
        if (t === 'Vendor') return true;
        if (t === 'User') return false;
      }
    }

    const explicit =
      normalizeIdentityKind(p.userType) ||
      normalizeIdentityKind(p.type) ||
      normalizeIdentityKind(p.identityType);
    if (explicit === 'Vendor') return true;
    if (explicit === 'User') return false;

    if (isKnownVendorPhone(p.phone)) return true;

    if (p.shopName || p.businessType || p.businessName || p.vendorId) {
      return true;
    }

    return false;
  }, [resolvedIdentities]);

  // ═════════════════════════════════════════════════════════
  // Resolve the best avatar for a participant
  // ═════════════════════════════════════════════════════════
  const resolveParticipantAvatar = useCallback(
    (p: any, conv?: any): string => {
      if (!p) {
        return '';
      }

      const candidateFields = ['avatar', 'profilePic', 'logo'];

      for (const f of candidateFields) {
        const v = p?.[f];
        if (isUsableRemoteUri(v) && !brokenAvatars.has(v as string)) {
          return v as string;
        }
      }

      const keys = [
        String(p.userId || '').trim(),
        String(p._id || '').trim(),
        String(p.id || '').trim(),
      ].filter(Boolean);

      for (const k of keys) {
        const r = resolvedIdentities[k];
        if (!r) continue;
        for (const f of candidateFields) {
          const v = (r as any)?.[f];
          if (isUsableRemoteUri(v) && !brokenAvatars.has(v as string)) {
            return v as string;
          }
        }
      }

      const cid = conv?._id || activeConversation || '';
      if (cid) {
        const list = messagesForConv(cid);
        const targetId = String(p.userId || p._id || '').trim();

        for (let i = list.length - 1; i >= 0; i--) {
          const m = list[i];
          if (
            targetId &&
            String(m.senderId) === targetId &&
            isUsableRemoteUri(m.senderAvatar) &&
            !brokenAvatars.has(m.senderAvatar as string)
          ) {
            return m.senderAvatar as string;
          }
        }
        for (let i = list.length - 1; i >= 0; i--) {
          const m = list[i];
          if (
            String(m.senderId) !== String(userId) &&
            isUsableRemoteUri(m.senderAvatar) &&
            !brokenAvatars.has(m.senderAvatar as string)
          ) {
            return m.senderAvatar as string;
          }
        }
      }

      return '';
    },
    [resolvedIdentities, messagesForConv, activeConversation, userId, brokenAvatars]
  );

  const handleAvatarError = useCallback((uri?: string) => {
    if (!uri) return;
    logWarn(`❌ Avatar failed to load [instance=${screenInstanceId}]:`, uri);
    setBrokenAvatars((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, [screenInstanceId]);

  // ═════════════════════════════════════════════════════════
  // ACTIVE CHAT VIEW
  // ═════════════════════════════════════════════════════════
  if (activeConversation) {
    const convo = conversations.find((c: any) => c._id === activeConversation);
    const participant = activeParticipant || convo?.participant;
    const isOnline = participant?.userId ? onlineUsers.has(String(participant.userId)) : false;
    const typingName = typingUsers[activeConversation];
    const showShopBadge = isVendor(participant);
    const headerAvatar = resolveParticipantAvatar(participant, convo);

    // ✅ Instance-scoped recycling key — unique to this mounted screen.
    const headerAvatarKey = `chat-header-avatar:${screenInstanceId}:${participant?.userId || activeConversation}`;

    const otherSideAvatar =
      headerAvatar && !brokenAvatars.has(headerAvatar) ? headerAvatar : '';

    return (
      <View style={styles.flex}>
        <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />

        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={() => {
              setActiveConversation(null);
              setActiveParticipant(null);
              dispatch(fetchConversations());
            }}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Royal.pureBlack} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.chatHeaderCenter} activeOpacity={0.7}>
            <View style={styles.chatAvatarWrap}>
              {headerAvatar && !brokenAvatars.has(headerAvatar) ? (
                <ExpoImage
                  source={{
                    uri: headerAvatar,
                    cacheKey: `chat-header-avatar:${screenInstanceId}:${participant?.userId || activeConversation}:${headerAvatar}`,
                  }}
                  style={styles.headerAvatar}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                  recyclingKey={headerAvatarKey}
                  onError={() => handleAvatarError(headerAvatar)}
                />
              ) : (
                <View style={[styles.headerAvatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>
                    {(participant?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {isOnline ? <View style={styles.onlineDot} /> : null}
              {showShopBadge ? (
                <View style={styles.headerVendorBadge}>
                  <Ionicons name="storefront" size={9} color={Royal.pureWhite} />
                </View>
              ) : null}
            </View>
            <View style={styles.chatHeaderText}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.headerName} numberOfLines={1}>{participant?.name || 'Chat'}</Text>
                {showShopBadge ? (
                  <View style={styles.headerVendorChip}>
                    <Text style={styles.headerVendorChipText}>SHOP</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.headerStatus} numberOfLines={1}>
                {typingName ? `${typingName} is typing...` : isOnline ? 'Active now' : 'Offline'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerActionBtn} activeOpacity={0.7}>
            <Ionicons name="information-circle-outline" size={24} color={Royal.pureBlack} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item: any) => item._id}
          style={styles.flex}
          contentContainerStyle={{
            padding: 12,
            paddingBottom: keyboardVisible ? 12 : bottomReserved + 12,
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshing={chatRefreshing}
          onRefresh={onRefreshChat}
          renderItem={({ item }: any) => {
            const isMe = String(item.senderId) === String(userId);
            const isDeleted = item.isDeleted;

            const rawSenderAvatar =
              isUsableRemoteUri(item.senderAvatar) ? item.senderAvatar : '';
            const incomingAvatar = rawSenderAvatar || otherSideAvatar;
            const incomingAvatarOk =
              !!incomingAvatar && !brokenAvatars.has(incomingAvatar);

            // ✅ Instance-scoped key so two mounted screens never collide.
            const senderAvatarKey = `msg-avatar:${screenInstanceId}:${item.senderId || 'unknown'}`;

            return (
              <View
                style={[
                  styles.messageRow,
                  isMe ? styles.messageRowMe : styles.messageRowOther,
                ]}
              >
                {!isMe ? (
                  <TouchableOpacity
                    onLongPress={() => handleDeleteMessage(item._id)}
                    activeOpacity={0.85}
                  >
                    {incomingAvatarOk ? (
                      <ExpoImage
                        source={{
                          uri: incomingAvatar,
                          cacheKey: `msg-avatar:${screenInstanceId}:${item.senderId || 'unknown'}:${incomingAvatar}`,
                        }}
                        style={styles.msgAvatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={senderAvatarKey}
                        transition={120}
                        onError={() => handleAvatarError(incomingAvatar)}
                      />
                    ) : (
                      <View style={[styles.msgAvatar, styles.avatarFallback]}>
                        <Text style={styles.msgAvatarLetter}>
                          {(item.senderName || participant?.name || 'U')
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.msgAvatarSpacer} />
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isMe ? styles.bubbleMe : styles.bubbleOther,
                    isDeleted && styles.bubbleDeleted,
                  ]}
                >
                  {item.media && !isDeleted ? (
                    <ExpoImage
                      source={{
                        uri: item.media,
                        cacheKey: `msg-media:${screenInstanceId}:${item._id}:${item.media}`,
                      }}
                      style={styles.msgMedia}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                      recyclingKey={`msg-media:${screenInstanceId}:${item._id}`}
                    />
                  ) : null}
                  {item.text ? (
                    <Text
                      style={[
                        styles.msgText,
                        isMe ? styles.msgTextMe : styles.msgTextOther,
                        isDeleted && styles.msgTextDeleted,
                      ]}
                    >
                      {item.text}
                    </Text>
                  ) : null}
                  <View style={styles.msgMeta}>
                    <Text
                      style={[
                        styles.msgTime,
                        isMe ? styles.msgTimeMe : styles.msgTimeOther,
                      ]}
                    >
                      {formatTime(item.createdAt)}
                    </Text>
                    {isMe && !isDeleted ? (
                      <Ionicons
                        name={item.isRead ? 'checkmark-done' : 'checkmark'}
                        size={14}
                        color={
                          item.isRead
                            ? Royal.blueAccent
                            : 'rgba(255,255,255,0.6)'
                        }
                        style={{ marginLeft: 4 }}
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Start the conversation — say hi! 👋</Text>
            </View>
          }
        />

        {chatRefreshing ? (
          <View style={styles.chatRefreshOverlay} pointerEvents="none">
            <View style={styles.chatRefreshPill}>
              <ActivityIndicator size="small" color={Royal.pureWhite} />
              <Text style={styles.chatRefreshText}>Reloading…</Text>
            </View>
          </View>
        ) : null}

        {typingName ? (
          <View style={styles.typingBubble}>
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
          </View>
        ) : null}

        {selectedMedia ? (
          <View style={styles.mediaPreviewRow}>
            <View style={styles.mediaPreviewWrap}>
              <ExpoImage
                source={{
                  uri: selectedMedia,
                  cacheKey: `local-preview:${screenInstanceId}:${selectedMedia}`,
                }}
                style={styles.mediaPreview}
                contentFit="cover"
                recyclingKey={`local-preview:${screenInstanceId}:${selectedMedia}`}
              />
              <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => setSelectedMedia(null)}>
                <Ionicons name="close-circle" size={22} color={Royal.redAlert} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {showAttachMenu ? (
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachItem} onPress={pickImage} activeOpacity={0.7}>
              <View style={styles.attachIconWrap}>
                <Ionicons name="image" size={22} color={Royal.pureWhite} />
              </View>
              <Text style={styles.attachText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={pickVideo} activeOpacity={0.7}>
              <View style={[styles.attachIconWrap, { backgroundColor: '#E4405F' }]}>
                <Ionicons name="videocam" size={22} color={Royal.pureWhite} />
              </View>
              <Text style={styles.attachText}>Video</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.inputRow, { paddingBottom: inputBottomPadding }]}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setShowAttachMenu((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={26} color={Royal.pureBlack} />
          </TouchableOpacity>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={Royal.textTertiary}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={2000}
            />
          </View>
          {inputText.trim() || selectedMedia ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.7}
            >
              {sending ? <ActivityIndicator size="small" color={Royal.pureWhite} /> :
                <Ionicons name="send" size={18} color={Royal.pureWhite} />}
            </TouchableOpacity>
          ) : (<View style={styles.sendBtnPlaceholder} />)}
        </View>
      </View>
    );
  }

  // ═════════════════════════════════════════════════════════
  // CONVERSATION LIST
  // ═════════════════════════════════════════════════════════
  const modalData = searchQuery.trim() ? identityResults : filteredSuggestedUsers;
  const modalLoading = searchQuery.trim() ? identitySearchLoading : suggestLoading;

  return (
    <View style={styles.flex}>
      <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => { embedded ? navigation?.goBack?.() : navigation.goBack(); }}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Royal.pureBlack} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>
          {isVendorRole ? 'Shop Messages' : 'Messages'}
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setShowNewChatModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={24} color={Royal.pureBlack} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Royal.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages"
          placeholderTextColor={Royal.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Royal.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Royal.pureBlack} />
        </View>
      ) : filteredConversations.length === 0 && searchQuery ? (
        <View style={styles.center}>
          <Ionicons name="search" size={60} color={Royal.textTertiary} />
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      ) : conversations.length === 0 ? (
        <ScrollableSuggestions
          users={filteredSuggestedUsers}
          loading={suggestLoading}
          onOpen={(u) => openConversationWithUser(u._id, u.name, u.avatar, u.type)}
          bottomPadding={bottomReserved}
          isVendor={isVendor}
          screenInstanceId={screenInstanceId}
        />
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item: any) => item._id}
          extraData={[resolvedIdentities, brokenAvatars]}
          contentContainerStyle={{ paddingBottom: bottomReserved + 8 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => dispatch(fetchConversations())}
          renderItem={({ item }: any) => {
            const isOnline = item.participant?.userId
              ? onlineUsers.has(String(item.participant.userId))
              : false;
            const hasUnread = (item.unreadCount || 0) > 0;
            const showShopBadge = isVendor(item.participant);
            const rowAvatar = resolveParticipantAvatar(item.participant, item);
            const rowAvatarOk = !!rowAvatar && !brokenAvatars.has(rowAvatar);

            const rowAvatarKey = `convo-avatar:${screenInstanceId}:${item.participant?.userId || item._id}`;

            return (
              <TouchableOpacity
                style={styles.convoRow}
                onPress={() => {
                  setActiveParticipant(item.participant);
                  setActiveConversation(item._id);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.convoAvatarWrap}>
                  {rowAvatarOk ? (
                    <ExpoImage
                      source={{
                        uri: rowAvatar,
                        cacheKey: `convo-avatar:${screenInstanceId}:${item.participant?.userId || item._id}:${rowAvatar}`,
                      }}
                      style={styles.convoAvatar}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                      recyclingKey={rowAvatarKey}
                      onError={() => handleAvatarError(rowAvatar)}
                    />
                  ) : (
                    <View style={[styles.convoAvatar, styles.avatarFallback]}>
                      <Text style={styles.avatarLetter}>
                        {(item.participant?.name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {isOnline ? <View style={styles.onlineDotLarge} /> : null}
                  {showShopBadge ? (
                    <View style={styles.convoVendorBadge}>
                      <Ionicons name="storefront" size={9} color={Royal.pureWhite} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.convoInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.convoName, hasUnread && styles.convoNameUnread]} numberOfLines={1}>
                      {item.participant?.name || 'User'}
                    </Text>
                    {showShopBadge ? (
                      <View style={styles.convoVendorChip}>
                        <Text style={styles.convoVendorChipText}>SHOP</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.convoLast, hasUnread && styles.convoLastUnread]} numberOfLines={1}>
                    {item.lastMessage?.senderId === userId ? 'You: ' : ''}
                    {item.lastMessage?.text || 'No messages yet'}
                  </Text>
                </View>
                <View style={styles.convoRight}>
                  {item.lastMessageAt ? (
                    <Text style={[styles.convoTime, hasUnread && styles.convoTimeUnread]}>
                      {timeAgo(item.lastMessageAt)}
                    </Text>
                  ) : null}
                  {hasUnread ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText} numberOfLines={1}>
                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={60} color={Royal.textTertiary} />
              <Text style={styles.emptyText}>No conversations yet</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showNewChatModal}
        animationType="slide"
        onRequestClose={() => {
          setShowNewChatModal(false);
          setSearchQuery('');
          dispatch(clearIdentitySearch());
        }}
      >
        <View style={styles.newChatModal}>
          <View style={styles.newChatHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowNewChatModal(false);
                setSearchQuery('');
                dispatch(clearIdentitySearch());
              }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color={Royal.pureBlack} />
            </TouchableOpacity>
            <Text style={styles.newChatTitle}>New Message</Text>
            <View style={styles.backBtn} />
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Royal.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people"
              placeholderTextColor={Royal.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {identitySearchLoading && searchQuery.trim() ? (
              <ActivityIndicator size="small" color={Royal.textTertiary} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                dispatch(clearIdentitySearch());
              }}>
                <Ionicons name="close-circle" size={18} color={Royal.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
          {modalLoading && modalData.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Royal.pureBlack} />
            </View>
          ) : (
            <FlatList
              data={modalData}
              keyExtractor={(item: any) => String(item._id || item.userId)}
              keyboardShouldPersistTaps="handled"
              extraData={[resolvedIdentities, brokenAvatars]}
              renderItem={({ item }: any) => {
                const showShopBadge = isVendor(item);
                const itemId = item._id || item.userId;
                const itemAvatar =
                  (isUsableRemoteUri(item.avatar) ? item.avatar : '') ||
                  resolveParticipantAvatar(item) ||
                  '';
                const itemAvatarOk = !!itemAvatar && !brokenAvatars.has(itemAvatar);

                const itemAvatarKey = `newchat-avatar:${screenInstanceId}:${itemId}`;

                return (
                  <TouchableOpacity
                    style={styles.convoRow}
                    onPress={() => openConversationWithUser(itemId, item.name, itemAvatar, item.type)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.convoAvatarWrap}>
                      {itemAvatarOk ? (
                        <ExpoImage
                          source={{
                            uri: itemAvatar,
                            cacheKey: `newchat-avatar:${screenInstanceId}:${itemId}:${itemAvatar}`,
                          }}
                          style={styles.convoAvatar}
                          contentFit="cover"
                          transition={150}
                          cachePolicy="memory-disk"
                          recyclingKey={itemAvatarKey}
                          onError={() => handleAvatarError(itemAvatar)}
                        />
                      ) : (
                        <View style={[styles.convoAvatar, styles.avatarFallback]}>
                          <Text style={styles.avatarLetter}>
                            {(item.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {showShopBadge ? (
                        <View style={styles.convoVendorBadge}>
                          <Ionicons name="storefront" size={9} color={Royal.pureWhite} />
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.convoInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.convoName} numberOfLines={1}>{item.name || 'User'}</Text>
                        {showShopBadge ? (
                          <View style={styles.convoVendorChip}>
                            <Text style={styles.convoVendorChipText}>SHOP</Text>
                          </View>
                        ) : null}
                      </View>
                      {item.username ? (
                        <Text style={styles.convoLast} numberOfLines={1}>@{item.username}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Ionicons name="people-outline" size={60} color={Royal.textTertiary} />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'No results found' : 'Type a name to search'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const ScrollableSuggestions: React.FC<{
  users: any[];
  loading: boolean;
  onOpen: (u: any) => void;
  bottomPadding?: number;
  isVendor: (p: any) => boolean;
  screenInstanceId: string;
}> = ({ users, loading, onOpen, bottomPadding = 0, isVendor, screenInstanceId }) => {
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Royal.pureBlack} /></View>;
  if (users.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="chatbubbles-outline" size={60} color={Royal.textTertiary} />
        <Text style={styles.emptyText}>No conversations yet</Text>
        <Text style={styles.emptySubText}>Tap the compose icon to find people</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={users}
      keyExtractor={(item: any) => String(item._id || item.userId)}
      contentContainerStyle={{ paddingBottom: bottomPadding + 8 }}
      ListHeaderComponent={<Text style={styles.suggestHeader}>Suggested for you</Text>}
      renderItem={({ item }: any) => {
        const showShopBadge = isVendor(item);
        const okAvatar = isUsableRemoteUri(item.avatar) ? item.avatar : '';

        const itemAvatarKey = `suggest-avatar:${screenInstanceId}:${item._id || item.userId}`;

        return (
          <TouchableOpacity style={styles.convoRow} onPress={() => onOpen(item)}>
            <View style={styles.convoAvatarWrap}>
              {okAvatar ? (
                <ExpoImage
                  source={{
                    uri: okAvatar,
                    cacheKey: `suggest-avatar:${screenInstanceId}:${item._id || item.userId}:${okAvatar}`,
                  }}
                  style={styles.convoAvatar}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                  recyclingKey={itemAvatarKey}
                />
              ) : (
                <View style={[styles.convoAvatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>
                    {(item.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {showShopBadge ? (
                <View style={styles.convoVendorBadge}>
                  <Ionicons name="storefront" size={9} color={Royal.pureWhite} />
                </View>
              ) : null}
            </View>
            <View style={styles.convoInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.convoName} numberOfLines={1}>{item.name || 'User'}</Text>
                {showShopBadge ? (
                  <View style={styles.convoVendorChip}>
                    <Text style={styles.convoVendorChipText}>SHOP</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.convoLast} numberOfLines={1}>Tap to message</Text>
            </View>
            <Ionicons name="paper-plane-outline" size={20} color={Royal.pureBlack} />
          </TouchableOpacity>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Royal.pureWhite },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
    backgroundColor: Royal.pureWhite,
  },
  topTitle: { color: Royal.pureBlack, fontSize: 18, fontWeight: '700' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Royal.offWhite,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginHorizontal: 12, marginVertical: 10, gap: 8,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  searchInput: { flex: 1, color: Royal.pureBlack, fontSize: 14, padding: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { padding: 40, alignItems: 'center' },
  emptyText: { color: Royal.textSecondary, fontSize: 15, marginTop: 12 },
  emptySubText: { color: Royal.textTertiary, fontSize: 13, marginTop: 6, textAlign: 'center' },
  suggestHeader: {
    color: Royal.pureBlack, fontSize: 15, fontWeight: '700',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  convoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
    backgroundColor: Royal.pureWhite,
  },
  convoAvatarWrap: { position: 'relative' },
  convoAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Royal.offWhite },
  avatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: Royal.pureBlack },
  avatarLetter: { color: Royal.pureWhite, fontSize: 20, fontWeight: '800' },
  onlineDotLarge: {
    position: 'absolute', bottom: 2, right: 2, width: 14, height: 14,
    borderRadius: 7, backgroundColor: Royal.onlineGreen,
    borderWidth: 2, borderColor: Royal.pureWhite,
  },
  convoVendorBadge: {
    position: 'absolute', top: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Royal.vendorPurple,
    borderWidth: 2, borderColor: Royal.pureWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  convoVendorChip: {
    backgroundColor: Royal.vendorPurple,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4,
  },
  convoVendorChipText: { color: Royal.pureWhite, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  convoInfo: { flex: 1, marginLeft: 12 },
  convoName: { color: Royal.pureBlack, fontSize: 15, fontWeight: '600' },
  convoNameUnread: { fontWeight: '800' },
  convoLast: { color: Royal.textSecondary, fontSize: 13, marginTop: 2 },
  convoLastUnread: { color: Royal.pureBlack, fontWeight: '600' },
  convoRight: { alignItems: 'flex-end', gap: 4 },
  convoTime: { color: Royal.textTertiary, fontSize: 11 },
  convoTimeUnread: { color: Royal.blueAccent, fontWeight: '700' },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Royal.redAlert,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  unreadText: { color: Royal.pureWhite, fontSize: 11, fontWeight: '700' },

  chatHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
    backgroundColor: Royal.pureWhite,
  },
  chatHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  chatAvatarWrap: { position: 'relative' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Royal.offWhite },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6,
    backgroundColor: Royal.onlineGreen, borderWidth: 2, borderColor: Royal.pureWhite,
  },
  headerVendorBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Royal.vendorPurple,
    borderWidth: 2, borderColor: Royal.pureWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  headerVendorChip: {
    backgroundColor: Royal.vendorPurple,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4,
  },
  headerVendorChipText: { color: Royal.pureWhite, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  chatHeaderText: { flex: 1 },
  headerName: { color: Royal.pureBlack, fontSize: 15, fontWeight: '700' },
  headerStatus: { color: Royal.textSecondary, fontSize: 12, marginTop: 1 },
  headerActionBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  chatRefreshOverlay: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  chatRefreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(11,11,15,0.85)',
    shadowColor: Royal.pureBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  chatRefreshText: {
    color: Royal.pureWhite,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  messageRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 6, backgroundColor: Royal.offWhite },
  msgAvatarSpacer: { width: 34 },
  msgAvatarLetter: { color: Royal.pureWhite, fontSize: 12, fontWeight: '800' },
  messageBubble: {
    maxWidth: '75%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
    borderRadius: 18, position: 'relative',
  },
  bubbleMe: { backgroundColor: Royal.bubbleMe, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Royal.bubbleOther, borderBottomLeftRadius: 4 },
  bubbleDeleted: { opacity: 0.55 },
  msgText: { fontSize: 14, lineHeight: 19 },
  msgTextMe: { color: Royal.pureWhite },
  msgTextOther: { color: Royal.pureBlack },
  msgTextDeleted: { fontStyle: 'italic' },
  msgMedia: { width: 200, height: 200, borderRadius: 12, marginBottom: 6, backgroundColor: Royal.offWhite },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  msgTime: { fontSize: 10, fontWeight: '600' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)' },
  msgTimeOther: { color: Royal.textTertiary },

  typingBubble: {
    position: 'absolute', bottom: 90, left: 16,
    flexDirection: 'row', gap: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Royal.offWhite, borderRadius: 18,
  },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Royal.textSecondary },

  mediaPreviewRow: {
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: Royal.pureWhite,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Royal.borderLight,
  },
  mediaPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  mediaPreview: { width: 80, height: 80, borderRadius: 8 },
  mediaRemoveBtn: {
    position: 'absolute', top: -8, right: -8,
    backgroundColor: Royal.pureWhite, borderRadius: 12,
  },
  attachMenu: {
    flexDirection: 'row', gap: 24,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Royal.pureWhite,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Royal.borderLight,
  },
  attachItem: { alignItems: 'center', gap: 6 },
  attachIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Royal.blueAccent,
    justifyContent: 'center', alignItems: 'center',
  },
  attachText: { color: Royal.pureBlack, fontSize: 12, fontWeight: '600' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 8, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Royal.borderLight,
    gap: 6, backgroundColor: Royal.pureWhite,
  },
  attachBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  inputContainer: {
    flex: 1, backgroundColor: Royal.offWhite, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: Royal.borderLight,
    minHeight: 40, justifyContent: 'center',
  },
  input: { color: Royal.pureBlack, fontSize: 15, paddingVertical: 8, maxHeight: 100 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Royal.pureBlack,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnPlaceholder: { width: 40, height: 40 },

  newChatModal: { flex: 1, backgroundColor: Royal.pureWhite },
  newChatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  newChatTitle: { color: Royal.pureBlack, fontSize: 17, fontWeight: '700' },
});

export default MessagesScreen;