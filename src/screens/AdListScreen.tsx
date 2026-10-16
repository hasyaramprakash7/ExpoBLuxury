// src/screens/AdListScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  Linking,
  PanResponder,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootState, AppDispatch } from '../app/store';
import {
  fetchActiveAds,
  fetchMyPosts,
  toggleLikeAd,
  trackAdShare,
  fetchComments,
  addComment,
  deleteComment,
  toggleCommentLike,
  createAd,
  createStory,
  deleteAd,
  fetchActiveStories,
  fetchMyStories,
  fetchUserProfile,
  fetchNotifications,
  fetchConversations,
  fetchFollowers,
  fetchFollowing,
  toggleFollow,
  selectActiveAds,
  selectAdsLoading,
  selectAdsError,
  selectAdsRefreshing,
  selectMyPosts,
  selectActiveAdsLoaded,
  selectActiveAdsHasMore,
  selectActiveAdsLoadingMore,
  selectActiveAdsPage,
  selectStories,
  selectMyStories,
  selectUserProfile,
  selectUnreadNotifications,
  selectConversations,
} from '../features/adSlice';

import {
  fetchUserProfile as fetchAuthUserProfile,
} from '../features/user/authSlice';

import CommentsSheet from '../components/CommentsSheet';
import {
  GridCard,
  AdFeedPost,
  normalizePhone,
  downloadMediaLocally,
  deleteLocalFile,
  GRID_GAP,
  GRID_COLUMNS,
  pickVideoSource,
} from '../components/FeedCards';
import {
  CreatePostModal,
  UserProfileModal,
  StoryCreatorModal,
  FollowListModal,
  getProfileAvatar,
} from '../components/AdModals';
import ReelFeedScreen from './ReelFeedScreen';
import MessagesScreen from './MessagesScreen';

import { useSocket } from '../hooks/useSocket';

import {
  RESET_ADLIST_EVENT,
  HIDE_USER_TABBAR_EVENT,
  SHOW_USER_TABBAR_EVENT,
  ADLIST_REQUEST_SWIPE_EVENT,
  useTabBarVisibility,
} from '../navigation/UserTabNavigator';

const PAGE_SIZE = 20;
const SAVED_ITEMS_KEY = '@bluxury_saved_items_v1';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LOG_TAG = '🟦[AdListScreen]';

const log = (...args: any[]) => {
  if (__DEV__) console.log(LOG_TAG, ...args);
};
const logWarn = (...args: any[]) => {
  if (__DEV__) console.warn(LOG_TAG, '⚠️', ...args);
};
const logError = (...args: any[]) => {
  if (__DEV__) console.error(LOG_TAG, '❌', ...args);
};

const pickBestAvatar = (...candidates: any[]): string => {
  let fallback = '';
  for (const c of candidates) {
    if (typeof c !== 'string' || !c.trim()) continue;
    const s = c.trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (!fallback) fallback = s;
  }
  return fallback;
};

type ListMode = 'grid' | 'posts' | 'saved' | 'profile' | 'messages';
type ScreenMode = ListMode | 'feed';
type SwipeEntry = ListMode | 'shops';

const SWIPE_ORDER: SwipeEntry[] = ['posts', 'grid', 'messages', 'profile', 'shops'];

const Royal = {
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
  offWhite: '#F4F4F6',
  softWhite: '#F2F2F7',
  textPrimary: '#0B0B0F',
  textSecondary: 'rgba(11,11,15,0.55)',
  textTertiary: 'rgba(11,11,15,0.40)',
  borderLight: 'rgba(0,0,0,0.08)',
  borderMedium: 'rgba(0,0,0,0.15)',
  shadow: 'rgba(0,0,0,0.10)',
  redAlert: '#FF3040',
  blueAccent: '#0095F6',
  greenAccent: '#00C853',
  onlineGreen: '#4CD964',
  maroon: '#5C1A2B',
};

const URL_PATTERN =
  /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|io|co|in|app|dev|me|tech|site|xyz|store|shop|link|ai|us|uk|info|biz|online|cloud|live)(?:\/[^\s]*)?)/gi;

const openExternalUrl = async (raw: string) => {
  if (!raw) return;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert('Invalid Link', url);
  } catch (e) {
    logError('openExternalUrl failed:', e);
    Alert.alert('Error', 'Could not open this link.');
  }
};

type SavedItem = {
  ad: any;
  localUri: string;
  mediaType: 'image' | 'video';
  savedAt: number;
};

let savedItemsCache: Record<string, SavedItem> | null = null;
let savedItemsPromise: Promise<Record<string, SavedItem>> | null = null;

const loadSavedItemsOnce = (): Promise<Record<string, SavedItem>> => {
  if (savedItemsCache) return Promise.resolve(savedItemsCache);
  if (savedItemsPromise) return savedItemsPromise;
  savedItemsPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_ITEMS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, SavedItem>) : {};
      const safe = parsed && typeof parsed === 'object' ? parsed : {};
      savedItemsCache = safe;
      return safe;
    } catch (e) {
      logError('loadSavedItemsOnce failed:', e);
      savedItemsCache = {};
      return {};
    }
  })();
  return savedItemsPromise;
};

interface AdListScreenProps {
  products?: any[];
  title?: string;
  notificationsCount?: number;
  onPressNotifications?: () => void;
}

const AdListScreen: React.FC<AdListScreenProps> = ({
  products: externalProducts,
  title = '',
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { hide: hideUserTabBar, show: showUserTabBar } = useTabBarVisibility();

  useEffect(() => {
    return () => log('👋 AdListScreen unmounted');
  }, []);

  const {
    isConnected,
    onUserOnline,
    onUserOffline,
    onOnlineUsers,
    checkOnline,
    onFollowRevision,
  } = useSocket();

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const isOnline = useCallback(
    (uid?: string | null) => {
      if (!uid) return false;
      return onlineUsers.has(String(uid));
    },
    [onlineUsers]
  );

  const isFollowing = useCallback(
    (uid?: string | null) => {
      if (!uid) return false;
      return !!followingMap[String(uid)];
    },
    [followingMap]
  );

  const activeAds = useSelector(selectActiveAds);
  const loading = useSelector(selectAdsLoading);
  const error = useSelector(selectAdsError);
  const refreshing = useSelector(selectAdsRefreshing);
  const myPosts = useSelector(selectMyPosts);
  const activeAdsLoaded = useSelector(selectActiveAdsLoaded);
  const activeAdsHasMore = useSelector(selectActiveAdsHasMore);
  const loadingMoreAds = useSelector(selectActiveAdsLoadingMore);
  const activeAdsPage = useSelector(selectActiveAdsPage);
  const stories = useSelector(selectStories);
  const myStories = useSelector(selectMyStories);
  const userProfile = useSelector(selectUserProfile);
  const unreadNotifications = useSelector(selectUnreadNotifications);
  const conversations = useSelector(selectConversations);

  const unreadMessagesCount = useMemo(() => {
    if (!Array.isArray(conversations) || conversations.length === 0) return 0;
    return conversations.reduce((sum: number, c: any) => {
      const count =
        c?.unreadCount ??
        c?.unreadMessagesCount ??
        c?.unread ??
        c?.unreadCountForUser ??
        0;
      return sum + (Number(count) || 0);
    }, 0);
  }, [conversations]);

  const authUser = useSelector((state: RootState) => state.auth.user);
  const userId = (authUser as any)?._id || (authUser as any)?.id || '';
  const authUserName = authUser?.name || '';
  const authUserAvatar = authUser?.profilePic || '';
  const authUserPhone = authUser?.phone || '';
  const isSpecialUser = normalizePhone(authUserPhone) === '7893828468';

  const [mode, setMode] = useState<ScreenMode>('posts');
  const previousListModeRef = useRef<ListMode>('posts');
  const [feedStartIndex, setFeedStartIndex] = useState(0);
  const [feedData, setFeedData] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<Record<string, SavedItem>>(
    () => savedItemsCache || {}
  );
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const postsListRef = useRef<FlatList<any>>(null);
  const gridListRef = useRef<FlatList<any>>(null);
  const savedListRef = useRef<FlatList<any>>(null);
  const profileListRef = useRef<FlatList<any>>(null);
  const postsScrollYRef = useRef(0);
  const gridScrollYRef = useRef(0);
  const savedScrollYRef = useRef(0);
  const profileScrollYRef = useRef(0);
  const postsReadyRef = useRef(false);
  const gridReadyRef = useRef(false);
  const savedReadyRef = useRef(false);
  const profileReadyRef = useRef(false);

  const [commentsAd, setCommentsAd] = useState<any | null>(null);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [activeGridVideoId, setActiveGridVideoId] = useState<string | null>(null);
  const [activePostVideoId, setActivePostVideoId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [autoOpenParticipant, setAutoOpenParticipant] = useState<{
    userId: string;
    name: string;
    avatar?: string;
    userType?: 'User' | 'Vendor';
  } | null>(null);

  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalType, setFollowModalType] = useState<'followers' | 'following'>('followers');
  const [followModalUsers, setFollowModalUsers] = useState<any[]>([]);
  const [followModalLoading, setFollowModalLoading] = useState(false);

  const shopsReturnRef = useRef<ListMode>('profile');

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const unsubOnlineUsers = onOnlineUsers((ids: string[]) => {
      setOnlineUsers(new Set(ids.map(String)));
    });

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

    return () => {
      unsubOnlineUsers?.();
      unsubOnline?.();
      unsubOffline?.();
    };
  }, [userId, onUserOnline, onUserOffline, onOnlineUsers]);

  const lastFollowRevRef = useRef(0);
  useEffect(() => {
    const unsub = onFollowRevision(async (rev) => {
      if (rev === lastFollowRevRef.current) return;
      lastFollowRevRef.current = rev;

      if (userId) {
        dispatch(fetchUserProfile(userId));
        dispatch(fetchAuthUserProfile());
      }

      if (followModalVisible && userId) {
        setFollowModalLoading(true);
        try {
          if (followModalType === 'followers') {
            const res = await dispatch(
              fetchFollowers({ userId, page: 1, limit: 50 })
            ).unwrap();
            setFollowModalUsers(res?.followers || []);
          } else {
            const res = await dispatch(
              fetchFollowing({ userId, page: 1, limit: 50 })
            ).unwrap();
            setFollowModalUsers(res?.following || []);
          }
        } catch (e) {
          logWarn('follow modal refresh failed:', e);
        } finally {
          setFollowModalLoading(false);
        }
      }

      if (showProfileModal && profileUserId) {
        dispatch(fetchUserProfile(profileUserId));
      }
    });

    return unsub;
  }, [
    onFollowRevision,
    dispatch,
    userId,
    followModalVisible,
    followModalType,
    showProfileModal,
    profileUserId,
  ]);

  useEffect(() => {
    if (!isConnected) return;
    const ids = new Set<string>();
    feedData.forEach((ad) => {
      const isUserPost = ad?.postType === 'user';
      const isVendorPost = ad?.postType === 'vendor';
      if (isUserPost || isVendorPost) {
        const uid = typeof ad?.userId === 'object' ? ad?.userId?._id : ad?.userId;
        const vid = typeof ad?.vendorId === 'object' ? ad?.vendorId?._id : ad?.vendorId;
        const targetId = isUserPost ? uid : vid;
        if (targetId && String(targetId) !== String(userId)) {
          ids.add(String(targetId));
        }
      }
    });
    if (ids.size === 0) return;
    checkOnline(Array.from(ids), (status) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        Object.entries(status || {}).forEach(([uid, on]) => {
          if (on) next.add(String(uid));
          else next.delete(String(uid));
        });
        return next;
      });
    });
  }, [isConnected, feedData, checkOnline, userId]);

  useEffect(() => {
    if (savedItemsCache) return;
    let mounted = true;
    loadSavedItemsOnce().then((items) => {
      if (mounted) setSavedItems(items);
    });
    return () => { mounted = false; };
  }, []);

  const persistSavedItems = useCallback((next: Record<string, SavedItem>) => {
    savedItemsCache = next;
    AsyncStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(next)).catch((e) =>
      logError('persistSavedItems failed:', e)
    );
  }, []);

  const handleToggleSave = useCallback(
    async (ad: any) => {
      const id: string = ad?._id;
      if (!id) return;
      if (savedItems[id]) {
        const item = savedItems[id];
        deleteLocalFile(item.localUri);
        const next = { ...savedItems };
        delete next[id];
        setSavedItems(next);
        persistSavedItems(next);
        return;
      }
      if (savingIds.has(id)) return;
      setSavingIds((prev) => {
        const s = new Set(prev);
        s.add(id);
        return s;
      });
      try {
        const dl = await downloadMediaLocally(ad);
        if (!dl) {
          Alert.alert('Save failed', 'Could not download this media.');
          return;
        }
        const nextItem: SavedItem = {
          ad,
          localUri: dl.uri,
          mediaType: dl.mediaType,
          savedAt: Date.now(),
        };
        setSavedItems((prev) => {
          const next = { ...prev, [id]: nextItem };
          persistSavedItems(next);
          return next;
        });
      } catch (e) {
        logError('handleToggleSave failed:', e);
      } finally {
        setSavingIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    },
    [savedItems, savingIds, persistSavedItems]
  );

  useEffect(() => {
    if (!feedData || feedData.length === 0) return;

    setFollowingMap((prev) => {
      let changed = false;
      const next = { ...prev };
      feedData.forEach((ad) => {
        if (ad?.postType === 'user' || ad?.postType === 'vendor') {
          const uid = typeof ad?.userId === 'object' ? ad?.userId?._id : ad?.userId;
          const vid = typeof ad?.vendorId === 'object' ? ad?.vendorId?._id : ad?.vendorId;
          const targetId = ad?.postType === 'user' ? uid : vid;
          if (!targetId) return;
          const key = String(targetId);
          if (!(key in next) && typeof ad.isFollowing === 'boolean') {
            next[key] = ad.isFollowing;
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [feedData]);

  useEffect(() => {
    if (externalProducts) return;
    if (activeAdsLoaded) return;
    if (loading || refreshing) return;
    dispatch(fetchActiveAds({ page: 1, limit: PAGE_SIZE }));
    dispatch(fetchActiveStories());
    if (userId) {
      dispatch(fetchUserProfile(userId));
      dispatch(fetchAuthUserProfile());
      dispatch(fetchNotifications());
      dispatch(fetchConversations());
    }
  }, [dispatch, externalProducts, activeAdsLoaded, loading, refreshing, userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        dispatch(fetchAuthUserProfile());
        dispatch(fetchConversations());
      }
      return () => {};
    }, [dispatch, userId])
  );

  useEffect(() => {
    if (mode === 'profile') {
      dispatch(fetchMyPosts());
      if (userId) {
        dispatch(fetchUserProfile(userId));
        dispatch(fetchAuthUserProfile());
      }
    }
    if (mode === 'messages' && userId) {
      dispatch(fetchConversations());
    }
  }, [mode, dispatch, userId]);

  useEffect(() => {
    let ads = activeAds || [];
    ads = ads.filter((ad) => !!ad.image || !!ad.video);
    setFeedData(ads);
  }, [activeAds]);

  const savedListData = useMemo(() => {
    const arr = Object.values(savedItems);
    arr.sort((a, b) => b.savedAt - a.savedAt);
    return arr.map((item) => {
      const isVideo = item.mediaType === 'video';
      return {
        ...item.ad,
        image: isVideo ? item.ad.image : item.localUri,
        video: isVideo ? item.localUri : item.ad.video,
        mediaType: item.mediaType,
        _localUri: item.localUri,
      };
    });
  }, [savedItems]);

  const savedCount = Object.keys(savedItems).length;

  const profilePosts = useMemo(
    () => (myPosts || []).filter((ad) => !!ad.image || !!ad.video),
    [myPosts]
  );

  const onRefresh = useCallback(async () => {
    if (externalProducts) return;
    await Promise.all([
      dispatch(fetchActiveAds({ page: 1, limit: PAGE_SIZE })),
      dispatch(fetchActiveStories()),
      dispatch(fetchAuthUserProfile()),
    ]);
  }, [dispatch, externalProducts]);

  const onProfileRefresh = useCallback(async () => {
    await dispatch(fetchMyPosts());
    if (userId) {
      dispatch(fetchUserProfile(userId));
      dispatch(fetchAuthUserProfile());
    }
  }, [dispatch, userId]);

  const lastLoadMoreAt = useRef(0);
  const handleLoadMore = useCallback(() => {
    if (externalProducts) return;
    if (!activeAdsHasMore) return;
    if (loadingMoreAds) return;
    const t = Date.now();
    if (t - lastLoadMoreAt.current < 300) return;
    lastLoadMoreAt.current = t;
    dispatch(fetchActiveAds({ page: activeAdsPage + 1, limit: PAGE_SIZE }));
  }, [dispatch, externalProducts, activeAdsHasMore, loadingMoreAds, activeAdsPage]);

  const enterFeed = useCallback(
    (adId: string) => {
      const idx = feedData.findIndex((a) => a._id === adId);
      const safeIdx = idx >= 0 ? idx : 0;

      previousListModeRef.current = (mode === 'feed' ? 'posts' : mode) as ListMode;
      setFeedStartIndex(safeIdx);
      setActiveGridVideoId(null);
      setActivePostVideoId(null);
      setMode('feed');
    },
    [feedData, mode]
  );

  const exitFeed = useCallback(() => {
    setMode(previousListModeRef.current);
    setFeedStartIndex(0);
  }, []);

  const handleAdPress = useCallback((ad: any) => enterFeed(ad._id), [enterFeed]);

  const handleOpenShop = useCallback(
    (vendor: any) => {
      navigation.navigate('ShopDetails', { vendor });
    },
    [navigation]
  );

  const handleOpenProfile = useCallback((uid: string) => {
    setProfileUserId(uid);
    setShowProfileModal(true);
  }, []);

  const handleOpenMessage = useCallback(
    (participant: {
      userId: string;
      name: string;
      avatar: string;
      userType?: 'User' | 'Vendor';
    }) => {
      log('💬 handleOpenMessage →', participant);
      if (!participant?.userId) {
        logWarn('handleOpenMessage: missing userId — aborting');
        return;
      }
      setAutoOpenParticipant({
        userId: String(participant.userId),
        name: participant.name || 'Chat',
        avatar: participant.avatar || '',
        userType: participant.userType,
      });
      setShowProfileModal(false);
      setProfileUserId(null);
      switchMode('messages');
    },
    []
  );

  const handleAutoOpenHandled = useCallback(() => {
    log('💬 autoOpen handled — clearing');
    setAutoOpenParticipant(null);
  }, []);

  const handleLike = useCallback(
    (adId: string) => dispatch(toggleLikeAd(adId)),
    [dispatch]
  );

  const handleShareTracked = useCallback(
    (adId: string) => dispatch(trackAdShare(adId)),
    [dispatch]
  );

  const handleToggleFollow = useCallback(
    async (targetUserId: string, nextFollowing: boolean) => {
      const uid = String(targetUserId || '').trim();

      if (!uid || uid === 'undefined' || uid === 'null') {
        logWarn('handleToggleFollow: missing target id — skipping');
        return;
      }

      setFollowingMap((prev) => ({ ...prev, [uid]: nextFollowing }));
      try {
        const result = await dispatch(toggleFollow(uid)).unwrap();
        const serverFollowing = !!result?.following;
        setFollowingMap((prev) => ({ ...prev, [uid]: serverFollowing }));
      } catch (e: any) {
        logError('toggleFollow failed:', e);
        setFollowingMap((prev) => ({ ...prev, [uid]: !nextFollowing }));
        Alert.alert('Error', e?.message || 'Failed to update follow');
      }
    },
    [dispatch]
  );

  const handleOpenComments = useCallback(
    (ad: any) => {
      setCommentsAd(ad);
      setCommentsVisible(true);
      dispatch(fetchComments(ad._id));
    },
    [dispatch]
  );
  const handleCloseComments = useCallback(() => {
    setCommentsVisible(false);
    setCommentsAd(null);
  }, []);
  const handleSubmitComment = useCallback(
    (text: string, parentId?: string) => {
      if (!commentsAd) return;
      dispatch(addComment({ adId: commentsAd._id, text, parentId }));
    },
    [dispatch, commentsAd]
  );
  const handleDeleteComment = useCallback(
    (commentId: string) => {
      if (!commentsAd) return;
      dispatch(deleteComment({ adId: commentsAd._id, commentId }));
    },
    [dispatch, commentsAd]
  );
  const handleToggleCommentLike = useCallback(
    (commentId: string) => {
      if (!commentsAd) return;
      dispatch(toggleCommentLike({ adId: commentsAd._id, commentId }));
    },
    [dispatch, commentsAd]
  );

  const handleCreatePost = useCallback(
    async (formData: FormData) => {
      setIsCreating(true);
      try {
        await dispatch(createAd(formData)).unwrap();
        setShowCreateModal(false);
        Alert.alert('Success', 'Post created successfully!');
        dispatch(fetchActiveAds({ page: 1, limit: PAGE_SIZE }));
        dispatch(fetchMyPosts());
        if (userId) {
          dispatch(fetchUserProfile(userId));
          dispatch(fetchAuthUserProfile());
        }
      } catch (err: any) {
        logError('create post failed:', err);
        Alert.alert('Error', err || 'Failed to create post');
      } finally {
        setIsCreating(false);
      }
    },
    [dispatch, userId]
  );

  const handleCreateStory = useCallback(
    async (formData: FormData) => {
      setIsCreatingStory(true);
      try {
        await dispatch(createStory(formData)).unwrap();
        setShowStoryModal(false);
        Alert.alert('Success', 'Story added!');
        dispatch(fetchActiveStories());
        dispatch(fetchMyStories());
        if (userId) {
          dispatch(fetchUserProfile(userId));
          dispatch(fetchAuthUserProfile());
        }
      } catch (err: any) {
        logError('create story failed:', err);
        Alert.alert('Error', err || 'Failed to create story');
      } finally {
        setIsCreatingStory(false);
      }
    },
    [dispatch, userId]
  );

  const handleDeletePost = useCallback(
    async (adId: string) => {
      try {
        await dispatch(deleteAd(adId)).unwrap();
        Alert.alert('Success', 'Post deleted successfully');
        dispatch(fetchMyPosts());
        dispatch(fetchActiveAds({ page: 1, limit: PAGE_SIZE }));
      } catch (err: any) {
        logError('delete post failed:', err);
        Alert.alert('Error', err || 'Failed to delete post');
      }
    },
    [dispatch]
  );

  const openFollowers = useCallback(async (uid: string) => {
    setFollowModalType('followers');
    setFollowModalVisible(true);
    setFollowModalLoading(true);
    try {
      const res = await dispatch(fetchFollowers({ userId: uid, page: 1, limit: 50 })).unwrap();
      setFollowModalUsers(res?.followers || []);
    } catch (e) {
      logError('openFollowers failed:', e);
      setFollowModalUsers([]);
    } finally {
      setFollowModalLoading(false);
    }
  }, [dispatch]);

  const openFollowing = useCallback(async (uid: string) => {
    setFollowModalType('following');
    setFollowModalVisible(true);
    setFollowModalLoading(true);
    try {
      const res = await dispatch(fetchFollowing({ userId: uid, page: 1, limit: 50 })).unwrap();
      setFollowModalUsers(res?.following || []);
    } catch (e) {
      logError('openFollowing failed:', e);
      setFollowModalUsers([]);
    } finally {
      setFollowModalLoading(false);
    }
  }, [dispatch]);

  const handleToggleFollowUser = useCallback(
    async (targetId: string) => {
      const current = !!followModalUsers.find((u) => u._id === targetId)?.isFollowing;
      const next = !current;
      setFollowModalUsers((prev) =>
        prev.map((u) => (u._id === targetId ? { ...u, isFollowing: next } : u))
      );
      await handleToggleFollow(targetId, next);
    },
    [followModalUsers, handleToggleFollow]
  );

  useEffect(() => {
    if (mode === 'posts') {
      postsReadyRef.current = false;
      const t = setTimeout(() => {
        postsListRef.current?.scrollToOffset({ offset: postsScrollYRef.current || 0, animated: false });
        postsReadyRef.current = true;
      }, 50);
      return () => clearTimeout(t);
    }
    if (mode === 'grid') {
      gridReadyRef.current = false;
      const t = setTimeout(() => {
        gridListRef.current?.scrollToOffset({ offset: gridScrollYRef.current || 0, animated: false });
        gridReadyRef.current = true;
      }, 50);
      return () => clearTimeout(t);
    }
    if (mode === 'saved') {
      savedReadyRef.current = false;
      const t = setTimeout(() => {
        savedListRef.current?.scrollToOffset({ offset: savedScrollYRef.current || 0, animated: false });
        savedReadyRef.current = true;
      }, 50);
      return () => clearTimeout(t);
    }
    if (mode === 'profile') {
      profileReadyRef.current = false;
      const t = setTimeout(() => {
        profileListRef.current?.scrollToOffset({ offset: profileScrollYRef.current || 0, animated: false });
        profileReadyRef.current = true;
      }, 50);
      return () => clearTimeout(t);
    }
  }, [mode]);

  const onPostsScroll = useCallback((e: any) => {
    if (!postsReadyRef.current) return;
    postsScrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onGridScroll = useCallback((e: any) => {
    if (!gridReadyRef.current) return;
    gridScrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onSavedScroll = useCallback((e: any) => {
    if (!savedReadyRef.current) return;
    savedScrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);
  const onProfileScroll = useCallback((e: any) => {
    if (!profileReadyRef.current) return;
    profileScrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (followModalVisible) { setFollowModalVisible(false); return true; }
      if (showProfileModal) { setShowProfileModal(false); return true; }
      if (showCreateModal) { setShowCreateModal(false); return true; }
      if (showStoryModal) { setShowStoryModal(false); return true; }
      if (commentsVisible) { setCommentsVisible(false); setCommentsAd(null); return true; }
      if (mode === 'feed') { exitFeed(); return true; }
      if (mode !== 'posts') { setMode('posts'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [mode, exitFeed, showCreateModal, showProfileModal, showStoryModal, followModalVisible, commentsVisible]);

  useEffect(() => {
    const unsub = navigation.addListener(RESET_ADLIST_EVENT, () => {
      if (mode === 'feed') {
        setMode(previousListModeRef.current);
        setFeedStartIndex(0);
      }
      setMode('posts');
      setActiveGridVideoId(null);
      setActivePostVideoId(null);
      setCommentsVisible(false);
      setCommentsAd(null);
      setShowProfileModal(false);
      setShowCreateModal(false);
      setShowStoryModal(false);
      postsScrollYRef.current = 0;
      postsReadyRef.current = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          postsListRef.current?.scrollToOffset({ offset: 0, animated: false });
        });
      });
    });
    return unsub;
  }, [navigation, mode]);

  const switchMode = useCallback(
    (next: ListMode) => {
      hideUserTabBar();
      setMode(next);
      navigation?.emit?.({ type: HIDE_USER_TABBAR_EVENT, canPreventDefault: false });
    },
    [hideUserTabBar, navigation]
  );

  useFocusEffect(
    useCallback(() => {
      hideUserTabBar();
      navigation?.emit?.({ type: HIDE_USER_TABBAR_EVENT, canPreventDefault: false });
      return () => {
        showUserTabBar();
        navigation?.emit?.({ type: SHOW_USER_TABBAR_EVENT, canPreventDefault: false });
        setActiveGridVideoId(null);
        setActivePostVideoId(null);
      };
    }, [hideUserTabBar, showUserTabBar, navigation])
  );

  const openShops = useCallback(() => {
    if (SWIPE_ORDER.includes(mode as SwipeEntry) && mode !== 'feed') {
      shopsReturnRef.current = mode as ListMode;
    }
    showUserTabBar();
    navigation?.emit?.({ type: SHOW_USER_TABBAR_EVENT, canPreventDefault: false });
    navigation.navigate('Shops');
  }, [mode, navigation, showUserTabBar]);

  useFocusEffect(
    useCallback(() => {
      if (mode !== 'feed') {
        const validModes: ScreenMode[] = ['posts', 'grid', 'messages', 'profile', 'saved'];
        if (!validModes.includes(mode)) {
          setMode(shopsReturnRef.current || 'posts');
        }
      }
    }, [mode])
  );

  const modeRef = useRef<ScreenMode>(mode);
  const keyboardVisibleRef = useRef(keyboardVisible);
  const swipeGateRef = useRef({
    followModalVisible,
    showProfileModal,
    showCreateModal,
    showStoryModal,
    commentsVisible,
  });

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { keyboardVisibleRef.current = keyboardVisible; }, [keyboardVisible]);
  useEffect(() => {
    swipeGateRef.current = {
      followModalVisible,
      showProfileModal,
      showCreateModal,
      showStoryModal,
      commentsVisible,
    };
  }, [
    followModalVisible,
    showProfileModal,
    showCreateModal,
    showStoryModal,
    commentsVisible,
  ]);

  const canSwipeNow = useCallback(() => {
    const m = modeRef.current;
    if (m === 'feed') return false;
    if (keyboardVisibleRef.current) return false;
    const g = swipeGateRef.current;
    if (
      g.followModalVisible ||
      g.showProfileModal ||
      g.showCreateModal ||
      g.showStoryModal ||
      g.commentsVisible
    ) {
      return false;
    }
    return SWIPE_ORDER.includes(m as SwipeEntry);
  }, []);

  const canSwipeRef = useRef(canSwipeNow);
  useEffect(() => { canSwipeRef.current = canSwipeNow; }, [canSwipeNow]);

  const performSwipe = useCallback(
    (direction: 'next' | 'prev') => {
      const currentMode = modeRef.current;
      const idx = SWIPE_ORDER.indexOf(currentMode as SwipeEntry);
      if (idx < 0) return;
      const nextIdx = direction === 'next' ? idx + 1 : idx - 1;

      if (nextIdx < 0) {
        navigation?.emit?.({ type: ADLIST_REQUEST_SWIPE_EVENT, direction: 'prev' } as any);
        return;
      }
      if (nextIdx >= SWIPE_ORDER.length) {
        navigation?.emit?.({ type: ADLIST_REQUEST_SWIPE_EVENT, direction: 'next' } as any);
        return;
      }

      const next = SWIPE_ORDER[nextIdx];
      if (next === 'shops') {
        shopsReturnRef.current = currentMode as ListMode;
        showUserTabBar();
        navigation?.emit?.({ type: SHOW_USER_TABBAR_EVENT, canPreventDefault: false });
        navigation.navigate('Shops');
        return;
      }
      switchMode(next as ListMode);
    },
    [navigation, showUserTabBar, switchMode]
  );

  const performSwipeRef = useRef(performSwipe);
  useEffect(() => { performSwipeRef.current = performSwipe; }, [performSwipe]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (_evt, g) => {
        if (!canSwipeRef.current()) return false;
        return Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6;
      },

      onMoveShouldSetPanResponderCapture: (_evt, g) => {
        if (!canSwipeRef.current()) return false;
        const absX = Math.abs(g.dx);
        const absY = Math.abs(g.dy);
        return absX > 20 && absX > absY * 2;
      },

      onPanResponderMove: () => {},

      onPanResponderRelease: (_evt, g) => {
        if (!canSwipeRef.current()) return;
        const { dx, vx, dy } = g;
        if (Math.abs(dy) > Math.abs(dx)) return;

        const SWIPE_DISTANCE = SCREEN_WIDTH * 0.18;
        const SWIPE_VELOCITY = 0.35;
        const isLeftSwipe =
          (dx < -SWIPE_DISTANCE || vx < -SWIPE_VELOCITY) && Math.abs(dx) > 40;
        const isRightSwipe =
          (dx > SWIPE_DISTANCE || vx > SWIPE_VELOCITY) && Math.abs(dx) > 40;

        if (isLeftSwipe) performSwipeRef.current('next');
        else if (isRightSwipe) performSwipeRef.current('prev');
      },

      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {},
      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  // ✅ FIXED: Grid viewability — 80% threshold
  const onGridViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (!viewableItems || viewableItems.length === 0) { setActiveGridVideoId(null); return; }
    const videoItems = viewableItems
      .filter((v) => v.item?.mediaType === 'video' && (v.item?.video || v.item?.hlsUrl))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const nextId = videoItems[0]?.item?._id || null;
    setActiveGridVideoId((prev) => (prev === nextId ? prev : nextId));
  }).current;

  const gridViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 400,
  }).current;

  // ✅ FIXED: Posts viewability — 80% threshold
  const onPostsViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (!viewableItems || viewableItems.length === 0) { setActivePostVideoId(null); return; }
    const videoItems = viewableItems
      .filter((v) => v.item?.mediaType === 'video' && (v.item?.video || v.item?.hlsUrl))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const nextId = videoItems[0]?.item?._id || null;
    setActivePostVideoId((prev) => (prev === nextId ? prev : nextId));
  }).current;

  const postsViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 500,
  }).current;

  if (loading && !refreshing && feedData.length === 0 && !externalProducts) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Royal.pureBlack} />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }
  if (error && !externalProducts && feedData.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load posts</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayTitle =
    mode === 'saved' ? 'Saved'
    : mode === 'profile' ? 'My Profile'
    : mode === 'messages' ? 'Messages'
    : title || 'BLuxury';

  const renderStoriesRow = () => {
    const myAvatar = pickBestAvatar(
      authUserAvatar,
      getProfileAvatar(userProfile)
    );
    const myName = authUserName || userProfile?.name || 'Your Story';

    const allStories: any[] = [
      {
        _id: 'my-story',
        isMyStory: true,
        userName: myName,
        userAvatar: myAvatar,
        hasUnseen: false,
      },
      ...stories.map((s: any) => ({
        _id: s.userId,
        userName: s.userName,
        userAvatar: getProfileAvatar(s),
        stories: s.stories,
        hasUnseen: s.hasUnseen,
        isMyStory: false,
      })),
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
        style={styles.storiesScroll}
      >
        {allStories.map((item: any) => (
          <TouchableOpacity
            key={item._id}
            style={styles.storyItem}
            onPress={() => {
              if (item.isMyStory) {
                setShowStoryModal(true);
              } else if (item.stories?.length) {
                navigation.navigate('StoryViewer', {
                  stories: item.stories,
                  startIndex: 0,
                });
              }
            }}
            onLongPress={() => {
              if (!item.isMyStory && item._id) handleOpenProfile(String(item._id));
            }}
          >
            <View style={styles.storyAvatarRingWrap}>
              <View
                style={[
                  styles.storyAvatarRing,
                  item.hasUnseen && styles.storyAvatarRingUnseen,
                ]}
              >
                {item.userAvatar ? (
                  <ExpoImage
                    source={{ uri: item.userAvatar }}
                    style={styles.storyAvatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={`story-avatar:${item._id}`}
                    transition={120}
                  />
                ) : (
                  <View style={[styles.storyAvatar, styles.storyAvatarFallback]}>
                    <Text style={styles.storyAvatarLetter}>
                      {(item.userName || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {item.isMyStory ? (
                  <View style={styles.storyAddBadge}>
                    <Ionicons name="add" size={14} color={Royal.pureWhite} />
                  </View>
                ) : null}
              </View>
              {!item.isMyStory && isOnline(item._id) ? (
                <View style={styles.storyOnlineDot} />
              ) : null}
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
              {item.isMyStory ? 'Your Story' : item.userName}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const showTopBar = mode !== 'feed' && mode !== 'messages';
  const showBottomBar = mode !== 'feed' && !keyboardVisible;

  const renderProfileHeader = () => {
    const displayName = authUserName || userProfile?.name || 'User';
    const displayAvatar = pickBestAvatar(
      authUserAvatar,
      getProfileAvatar(userProfile)
    );
    const displayBio = userProfile?.bio || '';
    const displayUsername = userProfile?.username || '';
    const displayWebsite = userProfile?.website || '';

    const bioSegments: { value: string; isLink: boolean }[] = [];
    if (displayBio.trim()) {
      const regex = new RegExp(URL_PATTERN.source, 'gi');
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(displayBio)) !== null) {
        if (m.index > last) bioSegments.push({ value: displayBio.slice(last, m.index), isLink: false });
        bioSegments.push({ value: m[0], isLink: true });
        last = m.index + m[0].length;
      }
      if (last < displayBio.length) bioSegments.push({ value: displayBio.slice(last), isLink: false });
    }

    return (
      <View style={styles.profileHeader}>
        <View style={styles.profileTopRow}>
          <View style={styles.profileAvatarWrap}>
            {displayAvatar ? (
              <ExpoImage
                source={{ uri: displayAvatar }}
                style={styles.profileAvatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={`profile-header-avatar:${userId || 'me'}`}
                transition={120}
              />
            ) : (
              <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                <Text style={styles.profileAvatarLetter}>
                  {(displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {userId ? <View style={styles.profileOnlineDot} /> : null}
          </View>
          <View style={styles.profileStatsRow}>
            <View style={styles.profileStatItem}>
              <Text style={styles.profileStatNumber}>{userProfile?.postsCount || 0}</Text>
              <Text style={styles.profileStatLabel}>posts</Text>
            </View>
            <TouchableOpacity
              style={styles.profileStatItem}
              onPress={() => {
                if (userId) openFollowers(userId);
              }}
            >
              <Text style={styles.profileStatNumber}>{userProfile?.followersCount || 0}</Text>
              <Text style={styles.profileStatLabel}>followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileStatItem}
              onPress={() => {
                if (userId) openFollowing(userId);
              }}
            >
              <Text style={styles.profileStatNumber}>{userProfile?.followingCount || 0}</Text>
              <Text style={styles.profileStatLabel}>following</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.profileName}>{displayName}</Text>
        {displayUsername ? (
          <Text style={styles.profileUsername}>@{displayUsername}</Text>
        ) : null}

        {bioSegments.length > 0 ? (
          <Text style={styles.profileBio}>
            {bioSegments.map((seg, i) =>
              seg.isLink ? (
                <Text
                  key={`bl-${i}`}
                  style={styles.profileBioLink}
                  onPress={() => openExternalUrl(seg.value)}
                >
                  {seg.value}
                </Text>
              ) : (
                <Text key={`bt-${i}`}>{seg.value}</Text>
              )
            )}
          </Text>
        ) : null}

        {displayWebsite ? (
          <TouchableOpacity
            style={styles.profileWebsiteRow}
            onPress={() => openExternalUrl(displayWebsite)}
            activeOpacity={0.7}
          >
            <Ionicons name="link-outline" size={14} color={Royal.blueAccent} />
            <Text style={styles.profileWebsite} numberOfLines={1}>
              {displayWebsite.replace(/^https?:\/\//i, '')}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.profileActionsRow}>
          <TouchableOpacity
            style={styles.profileActionBtn}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.profileActionBtnText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileActionBtn}>
            <Text style={styles.profileActionBtnText}>Share profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileActionIconBtn}
            onPress={() => setShowStoryModal(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={Royal.pureBlack} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileDashboardCard}>
          <Text style={styles.profileDashboardTitle}>Your dashboard</Text>
          <Text style={styles.profileDashboardStat}>
            📈 {userProfile?.viewsLast30Days || 0} views in the last 30 days.
          </Text>
          <Text style={styles.profileDashboardStat}>
            👥 {userProfile?.reachLast30Days || 0} accounts reached.
          </Text>
          <Text style={styles.profileDashboardStat}>
            ❤️ {userProfile?.totalLikesCount || 0} total likes.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.swipeWrapper} {...panResponder.panHandlers}>
          {showTopBar ? (
            <View style={styles.topBar}>
              <Text style={styles.topBarTitle} numberOfLines={1}>{displayTitle}</Text>
              <View style={styles.topBarRight}>
                {/* ⚙️ NEW: Video & Data Settings */}
                <TouchableOpacity
                  style={styles.topBarIconBtn}
                  onPress={() => navigation.navigate('VideoSettings')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="settings-outline" size={22} color={Royal.pureBlack} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.topBarIconBtn}
                  onPress={() => navigation.navigate('Notifications')}
                >
                  <Ionicons name="heart-outline" size={24} color={Royal.pureBlack} />
                  {unreadNotifications > 0 ? (
                    <View style={styles.topBarBadge}>
                      <Text style={styles.topBarBadgeText}>
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity style={styles.topBarIconBtn} onPress={() => switchMode('saved')}>
                  <Ionicons name="bookmark-outline" size={24} color={Royal.pureBlack} />
                  {savedCount > 0 ? (
                    <View style={styles.topBarBadge}>
                      <Text style={styles.topBarBadgeText}>
                        {savedCount > 9 ? '9+' : savedCount}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                {mode === 'profile' ? (
                  <TouchableOpacity style={styles.topBarIconBtn} onPress={() => setShowCreateModal(true)}>
                    <Ionicons name="add-circle-outline" size={26} color={Royal.pureBlack} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {mode === 'posts' ? renderStoriesRow() : null}

          {mode === 'posts' ? (
            <FlatList
              key="posts-feed"
              ref={postsListRef}
              data={feedData}
              keyExtractor={(item, i) => `post-${item._id || i}`}
              numColumns={1}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              bounces={false}
              contentContainerStyle={styles.postsListContainer}
              contentInset={Platform.OS === 'ios' ? { bottom: 100 } : undefined}
              scrollIndicatorInsets={Platform.OS === 'ios' ? { bottom: 100 } : undefined}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onScroll={onPostsScroll}
              scrollEventThrottle={32}
              onViewableItemsChanged={onPostsViewableItemsChanged}
              viewabilityConfig={postsViewabilityConfig}
              onEndReachedThreshold={1.5}
              onEndReached={handleLoadMore}
              initialNumToRender={2}
              maxToRenderPerBatch={3}
              windowSize={3}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={true}
              renderItem={({ item }) => {
                const isUserPost = item?.postType === 'user';
                const ownerUid = String(
                  (isUserPost
                    ? typeof item?.userId === 'object' ? item?.userId?._id : item?.userId
                    : typeof item?.vendorId === 'object' ? item?.vendorId?._id : item?.vendorId) || ''
                );
                return (
                  <AdFeedPost
                    ad={item}
                    isActive={item.mediaType === 'video' && activePostVideoId === item._id}
                    onPress={handleAdPress}
                    onOpenShop={handleOpenShop}
                    onOpenProfile={handleOpenProfile}
                    onLike={handleLike}
                    onOpenComments={handleOpenComments}
                    onShareTracked={handleShareTracked}
                    isSaved={!!savedItems[item._id]}
                    isSaving={savingIds.has(item._id)}
                    onToggleSave={handleToggleSave}
                    userId={userId}
                    isOnline={isOnline(ownerUid)}
                    isFollowing={isFollowing(ownerUid)}
                    onToggleFollow={handleToggleFollow}
                  />
                );
              }}
              ListFooterComponent={
                loadingMoreAds ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={Royal.pureBlack} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="newspaper-outline" size={60} color={Royal.textTertiary} />
                  <Text style={styles.emptyText}>No posts yet</Text>
                  <Text style={styles.emptySubText}>Check back later</Text>
                </View>
              }
            />
          ) : mode === 'grid' ? (
            <FlatList
              key="grid-feed"
              ref={gridListRef}
              data={feedData}
              keyExtractor={(item, i) => `grid-${item._id || i}`}
              numColumns={GRID_COLUMNS}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridListContainer}
              contentInset={Platform.OS === 'ios' ? { bottom: 100 } : undefined}
              scrollIndicatorInsets={Platform.OS === 'ios' ? { bottom: 100 } : undefined}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onScroll={onGridScroll}
              scrollEventThrottle={32}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              bounces={false}
              onViewableItemsChanged={onGridViewableItemsChanged}
              viewabilityConfig={gridViewabilityConfig}
              onEndReachedThreshold={1.5}
              onEndReached={handleLoadMore}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={3}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={true}
              renderItem={({ item }) => {
                const isUserPost = item?.postType === 'user';
                const ownerUid = String(
                  (isUserPost
                    ? typeof item?.userId === 'object' ? item?.userId?._id : item?.userId
                    : typeof item?.vendorId === 'object' ? item?.vendorId?._id : item?.vendorId) || ''
                );
                return (
                  <GridCard
                    ad={item}
                    onPress={handleAdPress}
                    isActiveVideo={item.mediaType === 'video' && activeGridVideoId === item._id}
                    isOnline={isOnline(ownerUid)}
                  />
                );
              }}
              ListFooterComponent={
                loadingMoreAds ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={Royal.pureBlack} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="images-outline" size={60} color={Royal.textTertiary} />
                  <Text style={styles.emptyText}>No posts yet</Text>
                  <Text style={styles.emptySubText}>Check back later</Text>
                </View>
              }
            />
          ) : mode === 'saved' ? (
            <FlatList
              key="saved-feed"
              ref={savedListRef}
              data={savedListData}
              keyExtractor={(item, i) => `saved-${item._id || i}`}
              numColumns={1}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              bounces={false}
              contentContainerStyle={styles.postsListContainer}
              contentInset={Platform.OS === 'ios' ? { bottom: 100 } : undefined}
              scrollIndicatorInsets={Platform.OS === 'ios' ? { bottom: 100 } : undefined}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onScroll={onSavedScroll}
              scrollEventThrottle={32}
              onViewableItemsChanged={onPostsViewableItemsChanged}
              viewabilityConfig={postsViewabilityConfig}
              initialNumToRender={2}
              maxToRenderPerBatch={3}
              windowSize={3}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={true}
              renderItem={({ item }) => {
                const isUserPost = item?.postType === 'user';
                const ownerUid = String(
                  (isUserPost
                    ? typeof item?.userId === 'object' ? item?.userId?._id : item?.userId
                    : typeof item?.vendorId === 'object' ? item?.vendorId?._id : item?.vendorId) || ''
                );
                return (
                  <AdFeedPost
                    ad={item}
                    isActive={item.mediaType === 'video' && activePostVideoId === item._id}
                    onPress={handleAdPress}
                    onOpenShop={handleOpenShop}
                    onOpenProfile={handleOpenProfile}
                    onLike={handleLike}
                    onOpenComments={handleOpenComments}
                    onShareTracked={handleShareTracked}
                    isSaved={true}
                    isSaving={false}
                    onToggleSave={handleToggleSave}
                    userId={userId}
                    isOnline={isOnline(ownerUid)}
                    isFollowing={isFollowing(ownerUid)}
                    onToggleFollow={handleToggleFollow}
                  />
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="bookmark-outline" size={60} color={Royal.textTertiary} />
                  <Text style={styles.emptyText}>No saved posts yet</Text>
                  <Text style={styles.emptySubText}>
                    Tap the bookmark icon on any post to save it here
                  </Text>
                </View>
              }
            />
          ) : mode === 'profile' ? (
            <FlatList
              key="profile-feed"
              ref={profileListRef}
              data={profilePosts}
              keyExtractor={(item, i) => `profile-${item._id || i}`}
              numColumns={1}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              bounces={false}
              contentContainerStyle={styles.postsListContainer}
              contentInset={Platform.OS === 'ios' ? { bottom: 100 } : undefined}
              scrollIndicatorInsets={Platform.OS === 'ios' ? { bottom: 100 } : undefined}
              refreshing={loading}
              onRefresh={onProfileRefresh}
              onScroll={onProfileScroll}
              scrollEventThrottle={32}
              initialNumToRender={2}
              maxToRenderPerBatch={3}
              windowSize={3}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={true}
              ListHeaderComponent={(authUser || userProfile) ? renderProfileHeader() : null}
              renderItem={({ item }) => (
                <AdFeedPost
                  ad={item}
                  isActive={item.mediaType === 'video' && activePostVideoId === item._id}
                  onPress={handleAdPress}
                  onOpenShop={handleOpenShop}
                  onOpenProfile={handleOpenProfile}
                  onLike={handleLike}
                  onOpenComments={handleOpenComments}
                  onShareTracked={handleShareTracked}
                  isSaved={!!savedItems[item._id]}
                  isSaving={savingIds.has(item._id)}
                  onToggleSave={handleToggleSave}
                  userId={userId}
                  isOwner={true}
                  onDelete={handleDeletePost}
                  isOnline={true}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="person-circle-outline" size={80} color={Royal.textTertiary} />
                  <Text style={styles.emptyText}>No posts yet</Text>
                  <Text style={styles.emptySubText}>
                    Share your first post with the community
                  </Text>
                  <TouchableOpacity
                    style={styles.createPostEmptyBtn}
                    onPress={() => setShowCreateModal(true)}
                  >
                    <Ionicons name="add" size={20} color={Royal.pureWhite} />
                    <Text style={styles.createPostEmptyBtnText}>Create Post</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          ) : mode === 'messages' ? (
            <View style={styles.messagesWrapper}>
              <MessagesScreen
                autoOpenParticipant={autoOpenParticipant}
                onAutoOpenHandled={handleAutoOpenHandled}
              />
            </View>
          ) : (
            <View style={styles.feedWrapper}>
              <ReelFeedScreen
                key={`reel-${feedStartIndex}-${feedData.length}`}
                data={feedData}
                initialIndex={feedStartIndex}
                onExit={exitFeed}
                onPress={handleAdPress}
                onOpenShop={handleOpenShop}
                onOpenProfile={handleOpenProfile}
                onLike={handleLike}
                onOpenComments={handleOpenComments}
                onShareTracked={handleShareTracked}
                refreshing={refreshing}
                onRefresh={onRefresh}
                onEndReached={handleLoadMore}
                hasMore={activeAdsHasMore}
                loadingMore={loadingMoreAds}
                showOwner={isSpecialUser}
                userId={userId}
                isFollowing={isFollowing}
                isOnline={isOnline}
                onToggleFollow={handleToggleFollow}
              />
            </View>
          )}
        </View>

        {showBottomBar ? (
          <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
            <TouchableOpacity style={styles.navItem} onPress={() => switchMode('posts')} activeOpacity={0.7}>
              <Ionicons
                name={mode === 'posts' ? 'home' : 'home-outline'}
                size={24}
                color={mode === 'posts' ? Royal.pureBlack : Royal.textSecondary}
              />
              <Text style={[styles.navLabel, { color: mode === 'posts' ? Royal.pureBlack : Royal.textSecondary }]}>
                Home
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => switchMode('grid')} activeOpacity={0.7}>
              <Ionicons
                name={mode === 'grid' ? 'grid' : 'grid-outline'}
                size={24}
                color={mode === 'grid' ? Royal.pureBlack : Royal.textSecondary}
              />
              <Text style={[styles.navLabel, { color: mode === 'grid' ? Royal.pureBlack : Royal.textSecondary }]}>
                Grid
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => switchMode('messages')} activeOpacity={0.7}>
              <Ionicons
                name="paper-plane-outline"
                size={24}
                color={mode === 'messages' ? Royal.pureBlack : Royal.textSecondary}
              />
              {unreadMessagesCount > 0 ? (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText} numberOfLines={1}>
                    {unreadMessagesCount > 99 ? '99+' : String(unreadMessagesCount)}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.navLabel, { color: mode === 'messages' ? Royal.pureBlack : Royal.textSecondary }]}>
                Messages
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => switchMode('profile')} activeOpacity={0.7}>
              <Ionicons
                name={mode === 'profile' ? 'person' : 'person-outline'}
                size={24}
                color={mode === 'profile' ? Royal.pureBlack : Royal.textSecondary}
              />
              {unreadNotifications > 0 ? (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText} numberOfLines={1}>
                    {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.navLabel, { color: mode === 'profile' ? Royal.pureBlack : Royal.textSecondary }]}>
                Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={openShops} activeOpacity={0.7}>
              <Ionicons name="storefront-outline" size={24} color={Royal.textSecondary} />
              <Text style={[styles.navLabel, { color: Royal.textSecondary }]}>Shops</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <CommentsSheet
        visible={commentsVisible}
        onClose={handleCloseComments}
        ad={commentsAd}
        currentUserId={userId}
        onSubmit={handleSubmitComment}
        onDelete={handleDeleteComment}
        onToggleLike={handleToggleCommentLike}
      />

      <CreatePostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePost}
        loading={isCreating}
      />

      <StoryCreatorModal
        visible={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        onSubmit={handleCreateStory}
        loading={isCreatingStory}
      />

      <UserProfileModal
        visible={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setProfileUserId(null);
        }}
        userId={profileUserId}
        onOpenComments={handleOpenComments}
        onOpenFollowers={openFollowers}
        onOpenFollowing={openFollowing}
        onToggleFollow={handleToggleFollow}
        onOpenMessage={handleOpenMessage}
      />

      <FollowListModal
        visible={followModalVisible}
        onClose={() => setFollowModalVisible(false)}
        title={followModalType === 'followers' ? 'Followers' : 'Following'}
        users={followModalUsers}
        loading={followModalLoading}
        currentUserId={userId}
        onToggleFollow={handleToggleFollowUser}
        onOpenProfile={(uid) => {
          setFollowModalVisible(false);
          setProfileUserId(uid);
          setShowProfileModal(true);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Royal.pureWhite },
  container: { flex: 1, backgroundColor: Royal.pureWhite },
  swipeWrapper: { flex: 1 },
  messagesWrapper: { flex: 1 },
  feedWrapper: { flex: 1, backgroundColor: '#0B0B0F', overflow: 'hidden' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Royal.pureWhite,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  topBarTitle: { fontSize: 22, fontWeight: '800', color: Royal.pureBlack, flex: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarIconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  topBarBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14,
    borderRadius: 7, backgroundColor: Royal.redAlert,
    paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center',
  },
  topBarBadgeText: { color: Royal.pureWhite, fontSize: 9, fontWeight: '800', lineHeight: 11 },
  storiesScroll: {
    maxHeight: 110,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
    backgroundColor: Royal.pureWhite,
  },
  storiesRow: { paddingHorizontal: 8, paddingVertical: 8, gap: 12 },
  storyItem: { alignItems: 'center', width: 72, marginBottom: 34 },
  storyAvatarRingWrap: { position: 'relative' },
  storyAvatarRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: Royal.borderLight,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  storyAvatarRingUnseen: { borderColor: Royal.redAlert },
  storyAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: Royal.offWhite },
  storyAvatarFallback: {
    justifyContent: 'center', alignItems: 'center', backgroundColor: Royal.pureBlack,
  },
  storyAvatarLetter: { color: Royal.pureWhite, fontSize: 22, fontWeight: '800' },
  storyAddBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10, backgroundColor: Royal.blueAccent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Royal.pureWhite,
  },
  storyOnlineDot: {
    position: 'absolute', bottom: 0, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Royal.onlineGreen,
    borderWidth: 2, borderColor: Royal.pureWhite,
  },
  storyName: { color: Royal.pureBlack, fontSize: 11, marginTop: 4, textAlign: 'center' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: 8, paddingVertical: 12,
    backgroundColor: Royal.pureWhite,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Royal.borderLight,
    zIndex: 100,
    shadowColor: Royal.shadow, shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 12,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  navLabel: { fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.2 },
  navBadge: {
    position: 'absolute', top: 0, right: '28%',
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Royal.redAlert,
    paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Royal.pureWhite,
  },
  navBadgeText: { color: Royal.pureWhite, fontSize: 9, fontWeight: '800', lineHeight: 12 },
  gridListContainer: { paddingBottom: Platform.OS === 'ios' ? 140 : 160 },
  gridRow: { justifyContent: 'flex-start', marginBottom: GRID_GAP },
  postsListContainer: { paddingBottom: Platform.OS === 'ios' ? 140 : 160 },
  footerLoader: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  loaderContainer: {
    flex: 1, backgroundColor: Royal.pureWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: Royal.pureBlack, marginTop: 12, fontSize: 16, fontWeight: '700' },
  errorContainer: {
    flex: 1, backgroundColor: Royal.pureWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  errorText: { color: Royal.redAlert, fontSize: 16, marginBottom: 12, fontWeight: '700' },
  retryButton: {
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: Royal.pureBlack, borderRadius: 20,
  },
  retryText: { color: Royal.pureWhite, fontWeight: '700' },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    color: Royal.pureBlack, fontSize: 18, fontWeight: '700', marginTop: 16,
  },
  emptySubText: {
    color: Royal.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center',
  },
  createPostEmptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 20, paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: Royal.pureBlack, borderRadius: 24,
  },
  createPostEmptyBtnText: { color: Royal.pureWhite, fontSize: 15, fontWeight: '700' },
  profileHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  profileTopRow: { flexDirection: 'row', alignItems: 'center' },
  profileAvatarWrap: { marginRight: 24, position: 'relative' },
  profileAvatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: Royal.offWhite },
  profileAvatarFallback: {
    justifyContent: 'center', alignItems: 'center', backgroundColor: Royal.pureBlack,
  },
  profileAvatarLetter: { color: Royal.pureWhite, fontSize: 32, fontWeight: '800' },
  profileOnlineDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Royal.onlineGreen,
    borderWidth: 3, borderColor: Royal.pureWhite,
  },
  profileStatsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  profileStatItem: { alignItems: 'center' },
  profileStatNumber: { color: Royal.pureBlack, fontSize: 17, fontWeight: '800' },
  profileStatLabel: { color: Royal.textSecondary, fontSize: 12, marginTop: 2 },
  profileName: { color: Royal.pureBlack, fontSize: 15, fontWeight: '700', marginTop: 12 },
  profileUsername: { color: Royal.textSecondary, fontSize: 13, marginTop: 2 },
  profileBio: { color: Royal.textPrimary, fontSize: 13, marginTop: 6, lineHeight: 19 },
  profileBioLink: {
    color: Royal.blueAccent,
    textDecorationLine: 'underline',
  },
  profileWebsiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  profileWebsite: {
    color: Royal.blueAccent,
    fontSize: 13,
    fontWeight: '600',
  },
  profileActionsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  profileActionBtn: {
    flex: 1, paddingVertical: 8, backgroundColor: Royal.offWhite,
    borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  profileActionBtnText: { color: Royal.pureBlack, fontSize: 14, fontWeight: '700' },
  profileActionIconBtn: {
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Royal.offWhite,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  profileDashboardCard: {
    backgroundColor: Royal.offWhite, borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  profileDashboardTitle: { color: Royal.pureBlack, fontSize: 14, fontWeight: '700' },
  profileDashboardStat: { color: Royal.greenAccent, fontSize: 12, marginTop: 4, fontWeight: '600' },
});

export default AdListScreen;