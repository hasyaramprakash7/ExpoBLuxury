// src/screens/StoryViewerScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useDispatch, useSelector } from 'react-redux';

import api from '../userScreens/utils/api';
import { UserProfileModal } from '../components/AdModals';
import { RootState, AppDispatch } from '../app/store';
import {
  fetchUserProfile,
  fetchFollowers,
  fetchFollowing,
  toggleFollow,
} from '../features/adSlice';

const { width: W, height: H } = Dimensions.get('window');
const EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '😍'];
const STORY_DURATION_MS = 5000;
const PROGRESS_TICK_MS = 50;

// ═════════════════════════════════════════════════════════
// LOG HELPERS
// ═════════════════════════════════════════════════════════
const LOG_TAG = '📸[StoryViewer]';

const log = (...args: any[]) => {
  if (__DEV__) console.log(LOG_TAG, ...args);
};
const logWarn = (...args: any[]) => {
  if (__DEV__) console.warn(LOG_TAG, '⚠️', ...args);
};
const logError = (...args: any[]) => {
  if (__DEV__) console.error(LOG_TAG, '❌', ...args);
};

// ═════════════════════════════════════════════════════════
// URI VALIDATOR
// ═════════════════════════════════════════════════════════
const isUsableRemoteUri = (uri: any): boolean => {
  if (typeof uri !== 'string') return false;
  const s = uri.trim();
  if (!s) return false;
  if (/^(file|content|ph|assets-library|blob|data):/i.test(s)) return false;
  return /^https?:\/\//i.test(s);
};

// ═════════════════════════════════════════════════════════
// Extract the story owner's id from any of the fields the
// backend might use.
// ═════════════════════════════════════════════════════════
const extractOwnerId = (story: any): string => {
  if (!story) return '';
  const candidates = [
    story.userId,
    story.user?._id,
    story.user?.id,
    story.ownerId,
    story.vendorId,
    story.vendor?._id,
    story.vendor?.id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (c && typeof c === 'object' && c._id) return String(c._id);
  }
  return '';
};

const extractOwnerName = (story: any): string => {
  if (!story) return 'User';
  const candidates = [
    story.userName,
    story.user?.name,
    story.vendorName,
    story.vendor?.shopName,
    story.vendor?.name,
    story.ownerName,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return 'User';
};

const extractOwnerAvatar = (story: any): string => {
  if (!story) return '';
  const candidates = [
    story.userAvatar,
    story.user?.avatar,
    story.user?.profilePic,
    story.vendorAvatar,
    story.vendor?.avatar,
    story.vendor?.logo,
    story.vendor?.shopImage,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
};

const StoryViewerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch<AppDispatch>();

  // ✅ Snapshot route params ONCE so churn doesn't trigger renders
  const storiesRef = useRef<any[]>(
    Array.isArray(route.params?.stories) ? route.params.stories : []
  );
  const stories = storiesRef.current;
  const startIndex = Number(route.params?.startIndex) || 0;

  log('🟢 RENDER StoryViewerScreen', {
    storiesCount: stories.length,
    startIndex,
  });

  const activeRole = useSelector((s: RootState) => s.session.activeRole);
  const isVendorRole = activeRole === 'vendor';

  const authUser = useSelector((state: RootState) => state.auth.user);
  const vendor = useSelector((s: RootState) => (s as any).vendorAuth?.vendor);

  const currentUserId = isVendorRole
    ? (vendor as any)?._id || (vendor as any)?.id || ''
    : (authUser as any)?._id || (authUser as any)?.id || '';

  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [followModalVisible, setFollowModalVisible] = useState(false);
  const [followModalType, setFollowModalType] = useState<'followers' | 'following'>('followers');
  const [followModalUsers, setFollowModalUsers] = useState<any[]>([]);
  const [followModalLoading, setFollowModalLoading] = useState(false);

  // ✅ Track which story we've already marked viewed to avoid repeats
  const viewedIdsRef = useRef<Set<string>>(new Set());

  // ✅ Stable refs for callbacks used inside the timer
  const indexRef = useRef(index);
  const isPausedRef = useRef(false);
  const goNextRef = useRef<() => void>(() => {});
  const goPrevRef = useRef<() => void>(() => {});

  const current = stories[index];
  const isPaused = showProfileModal || followModalVisible;

  // keep refs in sync
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // ────────────────────────────────────────────────
  // Log current story
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!current) return;
    log('📸 Current story', {
      index,
      storyId: current._id,
      ownerId: extractOwnerId(current),
      userName: extractOwnerName(current),
      userAvatar: extractOwnerAvatar(current),
      mediaType: current.mediaType,
      hasCaption: !!current.caption,
    });
  }, [index, current]);

  // ────────────────────────────────────────────────
  // Progress timer — stable, uses refs only
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!current) return;
    setProgress(0);

    const step = PROGRESS_TICK_MS / STORY_DURATION_MS;
    const timer = setInterval(() => {
      if (isPausedRef.current) return;
      setProgress((p) => {
        const next = p + step;
        if (next >= 1) {
          // ✅ Do NOT call goNext inside the updater.
          // Schedule it on the next tick to avoid setState-in-render.
          clearInterval(timer);
          setTimeout(() => goNextRef.current(), 0);
          return 1;
        }
        return next;
      });
    }, PROGRESS_TICK_MS);

    return () => clearInterval(timer);
  }, [index, current?._id]);

  // ────────────────────────────────────────────────
  // Mark viewed once per story
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!current?._id) return;
    if (viewedIdsRef.current.has(current._id)) return;
    viewedIdsRef.current.add(current._id);

    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const vendorToken = await AsyncStorage.getItem('vendorToken');
        const authToken = token || vendorToken;
        log('👁️ Marking story viewed', { storyId: current._id });
        await api.post(
          `/ads/stories/${current._id}/view`,
          {},
          { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} }
        );
      } catch (e) {
        logWarn('👁️ view tracking failed (non-blocking)', e);
      }
    })();
  }, [current?._id]);

  // ────────────────────────────────────────────────
  // Navigation — stable via refs
  // ────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (isPausedRef.current) return;
    const i = indexRef.current;
    if (i < stories.length - 1) {
      log('➡️ goNext', { from: i, to: i + 1 });
      setIndex(i + 1);
    } else {
      log('➡️ goNext — last story, closing');
      navigation.goBack();
    }
  }, [stories.length, navigation]);

  const goPrev = useCallback(() => {
    if (isPausedRef.current) return;
    const i = indexRef.current;
    if (i > 0) {
      log('⬅️ goPrev', { from: i, to: i - 1 });
      setIndex(i - 1);
    }
  }, []);

  // Wire the refs
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);
  useEffect(() => { goPrevRef.current = goPrev; }, [goPrev]);

  // ────────────────────────────────────────────────
  // React
  // ────────────────────────────────────────────────
  const react = async (emoji: string) => {
    if (!current?._id) return;
    log('💬 Reacting to story', { storyId: current._id, emoji });
    try {
      const token = await AsyncStorage.getItem('token');
      const vendorToken = await AsyncStorage.getItem('vendorToken');
      const authToken = token || vendorToken;
      await api.post(
        `/ads/stories/${current._id}/react`,
        { emoji },
        { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} }
      );
      setReplyText('');
    } catch (e) {
      logError('💬 react failed', e);
    }
  };

  const handleAvatarError = useCallback((uri?: string) => {
    if (!uri) return;
    logWarn('🖼️ Avatar load error, marking broken', { uri });
    setBrokenAvatars((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, []);

  const handleOpenProfile = useCallback(() => {
    const uid = extractOwnerId(current);
    log('👤 handleOpenProfile →', { userId: uid, userName: extractOwnerName(current) });
    if (!uid) {
      logWarn('👤 No userId on story — cannot open profile');
      return;
    }
    setProfileUserId(uid);
    setShowProfileModal(true);
    dispatch(fetchUserProfile(uid));
  }, [current, dispatch]);

  const handleToggleFollow = useCallback(
    async (targetUserId: string) => {
      const uid = String(targetUserId || '').trim();
      if (!uid) return;
      try {
        await dispatch(toggleFollow(uid)).unwrap();
        if (profileUserId) dispatch(fetchUserProfile(profileUserId));
      } catch (e) {
        logError('toggleFollow failed', e);
      }
    },
    [dispatch, profileUserId]
  );

  const openFollowers = useCallback(
    async (uid: string) => {
      setFollowModalType('followers');
      setFollowModalVisible(true);
      setFollowModalLoading(true);
      try {
        const res = await dispatch(
          fetchFollowers({ userId: uid, page: 1, limit: 50 })
        ).unwrap();
        setFollowModalUsers(res?.followers || []);
      } catch (e) {
        logError('openFollowers failed', e);
        setFollowModalUsers([]);
      } finally {
        setFollowModalLoading(false);
      }
    },
    [dispatch]
  );

  const openFollowing = useCallback(
    async (uid: string) => {
      setFollowModalType('following');
      setFollowModalVisible(true);
      setFollowModalLoading(true);
      try {
        const res = await dispatch(
          fetchFollowing({ userId: uid, page: 1, limit: 50 })
        ).unwrap();
        setFollowModalUsers(res?.following || []);
      } catch (e) {
        logError('openFollowing failed', e);
        setFollowModalUsers([]);
      } finally {
        setFollowModalLoading(false);
      }
    },
    [dispatch]
  );

  if (!current) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  const avatarCandidate = extractOwnerAvatar(current);
  const ownerName = extractOwnerName(current);
  const avatarOk =
    isUsableRemoteUri(avatarCandidate) &&
    !brokenAvatars.has(avatarCandidate);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {current.mediaType === 'video' ? (
          <StoryVideo
            key={`story-video-${current._id}`}
            uri={current.media}
            onEnd={() => goNextRef.current()}
            paused={isPaused}
          />
        ) : (
          <ExpoImage
            source={{ uri: current.media }}
            style={styles.media}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            onError={(e) => logError('🖼️ Story media load error', e)}
          />
        )}

        <View style={styles.progressRow}>
          {stories.map((_: any, i: number) => (
            <View key={i} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < index
                        ? '100%'
                        : i === index
                        ? `${progress * 100}%`
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={handleOpenProfile}
            activeOpacity={0.75}
          >
            {avatarOk ? (
              <ExpoImage
                source={{ uri: avatarCandidate }}
                style={styles.avatar}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
                onError={() => handleAvatarError(avatarCandidate)}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>
                  {(ownerName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerTextWrap}>
              <Text style={styles.userName} numberOfLines={1}>
                {ownerName}
              </Text>
              <Text style={styles.userSubtitle} numberOfLines={1}>
                Tap to view profile
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        {current.caption ? (
          <View style={styles.captionWrap}>
            <Text style={styles.caption}>{current.caption}</Text>
          </View>
        ) : null}

        <View style={styles.tapZones} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.tapLeft}
            onPress={() => goPrevRef.current()}
            activeOpacity={1}
          />
          <TouchableOpacity
            style={styles.tapRight}
            onPress={() => goNextRef.current()}
            activeOpacity={1}
          />
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.emojiRow}>
            {EMOJIS.map((e) => (
              <TouchableOpacity
                key={e}
                style={styles.emojiBtn}
                onPress={() => react(e)}
              >
                <Text style={styles.emoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.replyRow}>
            <TextInput
              style={styles.replyInput}
              placeholder={`Reply to ${ownerName}...`}
              placeholderTextColor="#CCC"
              value={replyText}
              onChangeText={setReplyText}
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => {
                if (replyText.trim()) {
                  log('📤 Sending reply', { text: replyText });
                  react('💬');
                }
              }}
            >
              <Ionicons name="paper-plane" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <UserProfileModal
        visible={showProfileModal}
        onClose={() => {
          log('👤 Closing profile modal');
          setShowProfileModal(false);
          setProfileUserId(null);
        }}
        userId={profileUserId}
        onOpenComments={() => {}}
        onOpenFollowers={openFollowers}
        onOpenFollowing={openFollowing}
        onToggleFollow={handleToggleFollow}
        onOpenMessage={(participant) => {
          log('💬 onOpenMessage from story viewer →', participant);
          setShowProfileModal(false);
          setProfileUserId(null);
          navigation.navigate('MessagesTab', {
            screen: 'Messages',
            params: { targetUserId: participant.userId },
          });
        }}
      />
    </View>
  );
};

// ═════════════════════════════════════════════════════════
// VIDEO SUB-COMPONENT
// ═════════════════════════════════════════════════════════
const StoryVideo: React.FC<{
  uri: string;
  onEnd: () => void;
  paused?: boolean;
}> = ({ uri, onEnd, paused = false }) => {
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  log('🎬 StoryVideo mount', { uri });

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    try {
      player.play();
      log('🎬 Video playing', { uri });
    } catch (e) {
      logError('🎬 play failed', e);
    }
    const sub = player.addListener?.('playToEnd', () => {
      log('🎬 Video ended', { uri });
      onEndRef.current();
    });
    return () => {
      try {
        sub?.remove?.();
        player.pause();
      } catch {}
    };
  }, [player, uri]);

  useEffect(() => {
    try {
      if (paused) {
        player.pause();
        log('🎬 Video paused', { uri });
      } else {
        player.play();
        log('🎬 Video resumed', { uri });
      }
    } catch (e) {
      logError('🎬 pause/resume failed', e);
    }
  }, [paused, player, uri]);

  return (
    <VideoView
      player={player}
      style={styles.media}
      contentFit="cover"
      nativeControls={false}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loader: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: { width: W, height: H, position: 'absolute' },

  progressRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 24,
    gap: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingVertical: 4,
    paddingRight: 8,
  },
  headerTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A3D2B',
  },
  avatarLetter: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  userName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  captionWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 130,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 12,
  },
  caption: { color: '#FFF', fontSize: 14, lineHeight: 19 },

  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 1,
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },

  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 12,
    gap: 12,
    zIndex: 10,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: { fontSize: 22 },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#FFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StoryViewerScreen;