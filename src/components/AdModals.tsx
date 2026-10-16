// src/components/AdModals.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  FlatList,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView, createVideoPlayer } from 'expo-video';

import api from '../userScreens/utils/api';
import {
  compressVideo,
  cleanupCompressed,
  formatBytes,
} from '../utils/videoCompressor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  vendorPurple: '#6C63FF',
};

// ═════════════════════════════════════════════════════════
// ✅ AVATAR RESOLVER — always prefers http(s) URLs
// ═════════════════════════════════════════════════════════
export function getProfileAvatar(profile: any): string {
  if (!profile) return '';

  const candidates = [
    profile.user?.avatar,
    profile.user?.profilePic,
    profile.user?.profileImage,
    profile.vendor?.avatar,
    profile.vendor?.logo,
    profile.vendor?.shopImage,
    profile.vendor?.profileImage,
    profile.avatar,
    profile.profilePic,
    profile.profileImage,
    profile.profilePicture,
    profile.shopImage,
    profile.logo,
    profile.image,
    profile.userAvatar,
    profile.vendorAvatar,
  ];

  let fallback = '';
  for (const c of candidates) {
    if (typeof c !== 'string' || !c.trim()) continue;
    const s = c.trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (!fallback) fallback = s;
  }
  return fallback;
}

// ─────────────────────────────────────────────────────────────
// URL LINKIFIER HELPERS
// ─────────────────────────────────────────────────────────────
const URL_PATTERN =
  /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|io|co|in|app|dev|me|tech|site|xyz|store|shop|link|ai|us|uk|info|biz|online|cloud|live)(?:\/[^\s]*)?)/gi;

const normalizeUrl = (raw: string): string => {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const openExternalUrl = async (raw: string) => {
  const url = normalizeUrl(raw);
  if (!url) return;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Invalid Link', `Cannot open:\n${url}`);
    }
  } catch (e) {
    Alert.alert('Error', 'Could not open this link.');
  }
};

const LinkifiedText: React.FC<{
  text?: string;
  numberOfLines?: number;
  style?: any;
  linkStyle?: any;
}> = ({ text, numberOfLines, style, linkStyle }) => {
  if (!text || !text.trim()) return null;

  const segments: { value: string; isLink: boolean }[] = [];
  const regex = new RegExp(URL_PATTERN.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ value: text.slice(lastIndex, match.index), isLink: false });
    }
    segments.push({ value: match[0], isLink: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ value: text.slice(lastIndex), isLink: false });
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) =>
        seg.isLink ? (
          <Text
            key={`l-${i}`}
            style={[style, linkStyle]}
            onPress={() => openExternalUrl(seg.value)}
            suppressHighlighting={false}
          >
            {seg.value}
          </Text>
        ) : (
          <Text key={`t-${i}`}>{seg.value}</Text>
        )
      )}
    </Text>
  );
};

const extractPosterFrame = async (videoUri: string): Promise<string | null> => {
  let player: any = null;
  try {
    player = createVideoPlayer(videoUri);
    player.muted = true;
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      try {
        const sub = player.addListener?.('statusChange', (status: any) => {
          if (status?.status === 'readyToPlay' || status?.status === 'error') {
            sub?.remove?.();
            finish();
          }
        });
        setTimeout(finish, 1500);
      } catch { finish(); }
    });
    const thumbnails = await player.generateThumbnailsAsync([0.5], {
      maxWidth: 1080,
      maxHeight: 1350,
    });
    if (thumbnails && thumbnails.length > 0) return thumbnails[0]?.uri || null;
    return null;
  } catch {
    return null;
  } finally {
    try { player?.release?.(); } catch {}
  }
};

const InlineVideoPreview: React.FC<{ uri: string; style?: any }> = ({ uri, style }) => {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  useEffect(() => {
    if (!player) return;
    try { player.play(); } catch {}
    return () => { try { player.pause(); player.currentTime = 0; } catch {} };
  }, [player]);
  return (
    <VideoView player={player} style={style} contentFit="cover" nativeControls />
  );
};

// ═════════════════════════════════════════════════════════
// CREATE POST MODAL
// ✅ Video compression before upload (42 MB → ~3 MB)
// ═════════════════════════════════════════════════════════
export const CreatePostModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  loading: boolean;
  defaultPostKind?: 'post' | 'reel' | 'story';
}> = ({ visible, onClose, onSubmit, loading, defaultPostKind = 'post' }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState('');
  const [postKind, setPostKind] = useState<'post' | 'reel' | 'story' | 'igtv'>(defaultPostKind);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  // 🎬 Video compression state
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setTitle(''); setDescription(''); setCategory(''); setTags('');
      setLocation(''); setPostKind(defaultPostKind); setMediaType('image');
      setImageUri(null); setVideoUri(null); setPosterUri(null); setExtracting(false);
      setIsCompressing(false); setCompressionProgress(0);
    } else setPostKind(defaultPostKind);
  }, [visible, defaultPostKind]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setVideoUri(null); setPosterUri(null); setMediaType('image');
    }
  };

  const handlePickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'], allowsEditing: true, quality: 1,
      videoMaxDuration: postKind === 'reel' ? 90 : 60,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setVideoUri(uri); setImageUri(null); setMediaType('video');
      setExtracting(true);
      try { setPosterUri(await extractPosterFrame(uri)); }
      finally { setExtracting(false); }
    }
  };

  // ═════════════════════════════════════════════════════════
  // 🎬 SUBMIT — with video compression
  // ═════════════════════════════════════════════════════════
  const handleSubmit = async () => {
    if (!imageUri && !videoUri) {
      Alert.alert('Error', 'Please select an image or video.');
      return;
    }
    if (mediaType === 'video' && extracting) {
      Alert.alert('Please wait', 'Preparing your video…');
      return;
    }
    if (isCompressing) {
      Alert.alert('Please wait', 'Video compression in progress…');
      return;
    }

    let compressedUri: string | null = null;

    try {
      const formData = new FormData();
      if (title.trim()) formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (category.trim()) formData.append('category', category.trim());
      if (tags.trim()) {
        formData.append(
          'tags',
          JSON.stringify(tags.split(',').map((t) => t.trim()))
        );
      }
      if (location.trim()) {
        formData.append(
          'location',
          JSON.stringify({ name: location.trim() })
        );
      }
      formData.append('mediaType', mediaType);
      formData.append('postKind', postKind);
      formData.append('isActive', 'true');
      formData.append('isProductAd', 'false');

      // ═════════════════════════════════════════════════════════
      // 🎬 VIDEO: compress before upload
      // ═════════════════════════════════════════════════════════
      if (mediaType === 'video' && videoUri) {
        setIsCompressing(true);
        setCompressionProgress(0);

        console.log('🎬 Starting video compression for post...');

        const result = await compressVideo(
          videoUri,
          (progress) => setCompressionProgress(progress),
          {
            maxSize: 1280,        // 720p max resolution
            bitrate: 2000000,     // 2 Mbps
            compressionMethod: 'auto',
          }
        );

        compressedUri = result.compressed ? result.uri : null;

        console.log('════════════════════════════════════');
        console.log('  POST COMPRESSION RESULT');
        console.log('  original  :', formatBytes(result.originalSize));
        console.log('  compressed:', formatBytes(result.compressedSize));
        console.log('  saved     :', `${result.savedPercent}%`);
        console.log('  duration  :', `${result.durationMs}ms`);
        console.log('  final uri :', result.uri.slice(0, 80));
        console.log('════════════════════════════════════');

        setIsCompressing(false);

        const finalVideoUri = result.uri;
        const filename =
          finalVideoUri.split('/').pop() || `video_${Date.now()}.mp4`;
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'mp4';
        const type = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

        // @ts-ignore
        formData.append('media', {
          uri: finalVideoUri,
          name: filename,
          type,
        });

        if (posterUri) {
          // @ts-ignore
          formData.append('poster', {
            uri: posterUri,
            name: `poster_${Date.now()}.jpg`,
            type: 'image/jpeg',
          });
        }
      } else if (mediaType === 'image' && imageUri) {
        const filename = imageUri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const type = ext === 'png' ? 'image/png' : 'image/jpeg';
        // @ts-ignore
        formData.append('media', { uri: imageUri, name: filename, type });
      }

      // 🚀 Call parent onSubmit
      onSubmit(formData);
    } catch (err: any) {
      console.error('❌ Submit failed:', err?.message);
      Alert.alert('Upload Failed', err?.message || 'Please try again');
      setIsCompressing(false);
    } finally {
      // Cleanup compressed temp file after submit has been triggered
      if (compressedUri && compressedUri !== videoUri) {
        setTimeout(() => cleanupCompressed(compressedUri!), 3000);
      }
    }
  };

  const canSubmit =
    !loading &&
    !extracting &&
    !isCompressing &&
    (mediaType === 'image' ? !!imageUri : !!videoUri);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={createPostStyles.overlay}
      >
        <View style={createPostStyles.modalContent}>
          <View style={createPostStyles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Royal.pureBlack} />
            </TouchableOpacity>
            <Text style={createPostStyles.headerTitle}>
              {postKind === 'reel' ? 'New Reel' : postKind === 'story' ? 'New Story' : 'New Post'}
            </Text>
            <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit}>
              {loading || extracting || isCompressing ? (
                <ActivityIndicator size="small" color={Royal.pureBlack} />
              ) : (
                <Text
                  style={[
                    createPostStyles.shareButton,
                    !canSubmit && { opacity: 0.5 },
                  ]}
                >
                  Share
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={createPostStyles.content}>
            <View style={createPostStyles.kindRow}>
              {(['post', 'reel', 'story', 'igtv'] as const).map((kind) => (
                <TouchableOpacity
                  key={kind}
                  style={[
                    createPostStyles.kindBtn,
                    postKind === kind && createPostStyles.kindBtnActive,
                  ]}
                  onPress={() => setPostKind(kind)}
                >
                  <Ionicons
                    name={
                      kind === 'post'
                        ? 'grid-outline'
                        : kind === 'reel'
                        ? 'film-outline'
                        : kind === 'story'
                        ? 'radio-outline'
                        : 'tv-outline'
                    }
                    size={16}
                    color={postKind === kind ? Royal.pureWhite : Royal.textSecondary}
                  />
                  <Text
                    style={[
                      createPostStyles.kindText,
                      postKind === kind && createPostStyles.kindTextActive,
                    ]}
                  >
                    {kind.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={createPostStyles.mediaSection}>
              {imageUri ? (
                <View style={createPostStyles.mediaPreviewContainer}>
                  <ExpoImage
                    source={{ uri: imageUri }}
                    style={createPostStyles.mediaPreview}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={createPostStyles.removeMediaBtn}
                    onPress={() => setImageUri(null)}
                  >
                    <Ionicons name="close-circle" size={28} color={Royal.redAlert} />
                  </TouchableOpacity>
                </View>
              ) : videoUri ? (
                <View style={createPostStyles.mediaPreviewContainer}>
                  {posterUri ? (
                    <ExpoImage
                      source={{ uri: posterUri }}
                      style={createPostStyles.mediaPreview}
                      contentFit="cover"
                    />
                  ) : (
                    <InlineVideoPreview
                      uri={videoUri}
                      style={createPostStyles.mediaPreview}
                    />
                  )}
                  {extracting ? (
                    <View style={createPostStyles.posterOverlay}>
                      <ActivityIndicator size="small" color={Royal.pureWhite} />
                      <Text style={createPostStyles.posterOverlayText}>
                        Generating preview…
                      </Text>
                    </View>
                  ) : null}
                  {isCompressing ? (
                    <View style={createPostStyles.posterOverlay}>
                      <ActivityIndicator size="small" color={Royal.pureWhite} />
                      <Text style={createPostStyles.posterOverlayText}>
                        Compressing video… {Math.round(compressionProgress * 100)}%
                      </Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={createPostStyles.removeMediaBtn}
                    onPress={() => {
                      setVideoUri(null);
                      setPosterUri(null);
                    }}
                    disabled={isCompressing}
                  >
                    <Ionicons name="close-circle" size={28} color={Royal.redAlert} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={createPostStyles.mediaPickerRow}>
                  <TouchableOpacity
                    style={createPostStyles.mediaPickerBtn}
                    onPress={handlePickImage}
                  >
                    <Ionicons
                      name="image-outline"
                      size={40}
                      color={Royal.textTertiary}
                    />
                    <Text style={createPostStyles.mediaPickerText}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={createPostStyles.mediaPickerBtn}
                    onPress={handlePickVideo}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={40}
                      color={Royal.textTertiary}
                    />
                    <Text style={createPostStyles.mediaPickerText}>Video</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TextInput
              style={createPostStyles.input}
              placeholder="Title"
              placeholderTextColor={Royal.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <TextInput
              style={[createPostStyles.input, createPostStyles.textArea]}
              placeholder="Description"
              placeholderTextColor={Royal.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={2200}
            />
            <TextInput
              style={createPostStyles.input}
              placeholder="Category"
              placeholderTextColor={Royal.textTertiary}
              value={category}
              onChangeText={setCategory}
              maxLength={50}
            />
            <TextInput
              style={createPostStyles.input}
              placeholder="Tags (comma separated)"
              placeholderTextColor={Royal.textTertiary}
              value={tags}
              onChangeText={setTags}
            />
            <TextInput
              style={createPostStyles.input}
              placeholder="Location"
              placeholderTextColor={Royal.textTertiary}
              value={location}
              onChangeText={setLocation}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createPostStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,10,12,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Royal.pureWhite,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '90%', minHeight: '60%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  headerTitle: { color: Royal.pureBlack, fontSize: 17, fontWeight: '700' },
  shareButton: { color: Royal.pureBlack, fontSize: 16, fontWeight: '700' },
  content: { padding: 16 },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kindBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, backgroundColor: Royal.offWhite, borderRadius: 8,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  kindBtnActive: { backgroundColor: Royal.pureBlack, borderColor: Royal.pureBlack },
  kindText: { color: Royal.textSecondary, fontSize: 11, fontWeight: '700' },
  kindTextActive: { color: Royal.pureWhite },
  mediaSection: { marginBottom: 16 },
  mediaPickerRow: { flexDirection: 'row', gap: 12 },
  mediaPickerBtn: {
    flex: 1, aspectRatio: 1, backgroundColor: Royal.offWhite, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Royal.borderLight, borderStyle: 'dashed',
  },
  mediaPickerText: { color: Royal.textSecondary, marginTop: 8, fontSize: 14, fontWeight: '600' },
  mediaPreviewContainer: { position: 'relative', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  mediaPreview: { width: '100%', height: '100%' },
  removeMediaBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 14,
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  posterOverlayText: { color: Royal.pureWhite, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: Royal.offWhite, borderRadius: 10, padding: 14,
    color: Royal.pureBlack, fontSize: 15, marginBottom: 12,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
});

// ═════════════════════════════════════════════════════════
// USER / VENDOR PROFILE MODAL
// ═════════════════════════════════════════════════════════
export const UserProfileModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  onOpenComments: (ad: any) => void;
  onOpenFollowers?: (userId: string) => void;
  onOpenFollowing?: (userId: string) => void;
  onOpenStory?: (stories: any[], startIndex: number) => void;
  onToggleFollow?: (userId: string, following: boolean) => Promise<void> | void;
  onOpenMessage?: (participant: {
    userId: string;
    name: string;
    avatar: string;
    userType?: 'User' | 'Vendor';
  }) => void;
}> = ({
  visible,
  onClose,
  userId,
  onOpenComments,
  onOpenFollowers,
  onOpenFollowing,
  onToggleFollow,
  onOpenMessage,
}) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'tagged'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (visible && userId) {
      setLoading(true);
      (async () => {
        try {
          const [profileRes, postsRes] = await Promise.all([
            api.get(`/ads/profile/${userId}`),
            api.get(`/ads/user/${userId}`),
          ]);

          if (cancelled) return;
          const profileData = profileRes.data?.data || null;
          const allPosts = Array.isArray(postsRes.data?.data) ? postsRes.data.data : [];

          setProfile(profileData);
          setIsFollowing(!!profileData?.isFollowing);
          setPosts(allPosts.filter((p: any) => p.postKind !== 'reel'));
          setReels(allPosts.filter((p: any) => p.postKind === 'reel'));
        } catch (err) {
          if (!cancelled) { setPosts([]); setReels([]); }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    } else if (!visible) {
      setPosts([]); setReels([]); setProfile(null); setActiveTab('posts');
    }
    return () => { cancelled = true; };
  }, [visible, userId]);

  const handleFollow = async () => {
    if (!userId || followLoading) return;
    setFollowLoading(true);

    const next = !isFollowing;
    setIsFollowing(next);

    try {
      if (onToggleFollow) {
        await onToggleFollow(userId, next);
      } else {
        const res = await api.post(`/ads/follow/${userId}`, {});
        const server = !!(
          res.data?.data?.following ??
          res.data?.data?.isFollowing ??
          res.data?.data?.followed
        );
        setIsFollowing(server);
      }

      setProfile((p: any) =>
        p
          ? {
              ...p,
              followersCount: Math.max(
                0,
                (p.followersCount || 0) + (next ? 1 : -1)
              ),
            }
          : p
      );
    } catch (e: any) {
      setIsFollowing(!next);
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Failed to follow');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!userId || messageLoading) return;
    setMessageLoading(true);
    try {
      const targetName =
        profile?.name ||
        profile?.shopName ||
        profile?.username ||
        'Chat';
      const targetAvatar = getProfileAvatar(profile);
      const targetUserType =
        profile?.userType ||
        (profile?.shopName ? 'Vendor' : 'User');

      if (onOpenMessage) {
        onOpenMessage({
          userId,
          name: targetName,
          avatar: targetAvatar,
          userType: targetUserType,
        });
        onClose();
        return;
      }

      await api.post('/ads/messages/conversation', {
        targetUserId: userId,
        targetUserType,
      });
      onClose();
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message || e?.message || 'Failed to open chat'
      );
    } finally {
      setMessageLoading(false);
    }
  };

  const identityType =
    profile?.userType || (profile?.shopName ? 'Vendor' : 'User');
  const isVendorProfile =
    identityType === 'Vendor' || !!profile?.shopName || !!profile?.businessType;

  const displayName =
    profile?.name ||
    profile?.shopName ||
    profile?.username ||
    (isVendorProfile ? 'Shop' : 'User');

  const displayAvatar = getProfileAvatar(profile);

  const displayUsername = profile?.username || '';
  const displayBio = profile?.bio || profile?.description || '';
  const displayWebsite = profile?.website || '';
  const displayCategory = profile?.businessType || profile?.category || '';
  const displayPosts = activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : [];
  const isMe = !!profile?.isMe;

  const avatarRecyclingKey = `profile-avatar:${userId || 'unknown'}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={userProfileStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />

        <View style={userProfileStyles.header}>
          <TouchableOpacity onPress={onClose} style={userProfileStyles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Royal.pureBlack} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={userProfileStyles.headerTitle} numberOfLines={1}>
              {displayName}
            </Text>
            {isVendorProfile ? (
              <View style={userProfileStyles.vendorBadgeSmall}>
                <Ionicons name="storefront" size={10} color={Royal.pureWhite} />
                <Text style={userProfileStyles.vendorBadgeSmallText}>SHOP</Text>
              </View>
            ) : null}
          </View>
          <View style={userProfileStyles.backBtn} />
        </View>

        <ScrollView style={userProfileStyles.content}>
          <View style={userProfileStyles.profileSection}>
            <View style={userProfileStyles.profileTop}>
              <View style={userProfileStyles.avatarWrap}>
                {displayAvatar ? (
                  <ExpoImage
                    source={{ uri: displayAvatar }}
                    style={userProfileStyles.avatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={avatarRecyclingKey}
                    transition={120}
                  />
                ) : (
                  <View style={[userProfileStyles.avatar, userProfileStyles.avatarFallback]}>
                    <Text style={userProfileStyles.avatarLetter}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {isVendorProfile ? (
                  <View style={userProfileStyles.avatarTypeBadge}>
                    <Ionicons name="storefront" size={12} color={Royal.pureWhite} />
                  </View>
                ) : null}
              </View>

              <View style={userProfileStyles.statsRow}>
                <View style={userProfileStyles.statItem}>
                  <Text style={userProfileStyles.statNumber}>
                    {profile?.postsCount || posts.length}
                  </Text>
                  <Text style={userProfileStyles.statLabel}>Posts</Text>
                </View>
                <TouchableOpacity
                  style={userProfileStyles.statItem}
                  onPress={() => onOpenFollowers && userId && onOpenFollowers(userId)}
                  activeOpacity={0.7}
                >
                  <Text style={userProfileStyles.statNumber}>
                    {profile?.followersCount || 0}
                  </Text>
                  <Text style={userProfileStyles.statLabel}>Followers</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={userProfileStyles.statItem}
                  onPress={() => onOpenFollowing && userId && onOpenFollowing(userId)}
                  activeOpacity={0.7}
                >
                  <Text style={userProfileStyles.statNumber}>
                    {profile?.followingCount || 0}
                  </Text>
                  <Text style={userProfileStyles.statLabel}>Following</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={userProfileStyles.userName}>{displayName}</Text>
            {displayUsername ? (
              <Text style={userProfileStyles.userHandle}>@{displayUsername}</Text>
            ) : null}
            {displayCategory ? (
              <Text style={userProfileStyles.userCategory}>{displayCategory}</Text>
            ) : null}

            {displayBio ? (
              <LinkifiedText
                text={displayBio}
                style={userProfileStyles.bio}
                linkStyle={userProfileStyles.bioLink}
              />
            ) : null}

            {displayWebsite ? (
              <TouchableOpacity
                onPress={() => openExternalUrl(displayWebsite)}
                activeOpacity={0.7}
                style={userProfileStyles.websiteRow}
              >
                <Ionicons name="link-outline" size={14} color={Royal.blueAccent} />
                <Text style={userProfileStyles.website} numberOfLines={1}>
                  {displayWebsite.replace(/^https?:\/\//i, '')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {!isMe ? (
              <View style={userProfileStyles.actionRow}>
                <TouchableOpacity
                  style={[
                    userProfileStyles.followBtn,
                    isFollowing && userProfileStyles.followingBtn,
                  ]}
                  onPress={handleFollow}
                  disabled={followLoading}
                  activeOpacity={0.8}
                >
                  {followLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={isFollowing ? Royal.pureBlack : Royal.pureWhite}
                    />
                  ) : (
                    <>
                      <Ionicons
                        name={isFollowing ? 'checkmark' : 'person-add'}
                        size={14}
                        color={isFollowing ? Royal.pureBlack : Royal.pureWhite}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          userProfileStyles.followBtnText,
                          isFollowing && userProfileStyles.followingBtnText,
                        ]}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={userProfileStyles.messageBtn}
                  onPress={handleMessage}
                  disabled={messageLoading}
                  activeOpacity={0.8}
                >
                  {messageLoading ? (
                    <ActivityIndicator size="small" color={Royal.pureBlack} />
                  ) : (
                    <>
                      <Ionicons
                        name="paper-plane-outline"
                        size={14}
                        color={Royal.pureBlack}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={userProfileStyles.messageBtnText}>Message</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={userProfileStyles.actionRow}>
                <TouchableOpacity
                  style={userProfileStyles.editBtn}
                  activeOpacity={0.8}
                >
                  <Text style={userProfileStyles.editBtnText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>
            )}

            {isMe ? (
              <View style={userProfileStyles.dashboardCard}>
                <Text style={userProfileStyles.dashboardTitle}>Dashboard</Text>
                <Text style={userProfileStyles.dashboardStat}>
                  📈 {profile?.viewsLast30Days || 0} views (30d)
                </Text>
                <Text style={userProfileStyles.dashboardStat}>
                  👥 {profile?.reachLast30Days || 0} accounts reached
                </Text>
                <Text style={userProfileStyles.dashboardStat}>
                  ❤️ {profile?.totalLikesCount || 0} total likes
                </Text>
              </View>
            ) : null}
          </View>

          <View style={userProfileStyles.tabsRow}>
            <TouchableOpacity
              style={[userProfileStyles.tab, activeTab === 'posts' && userProfileStyles.tabActive]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons
                name="grid-outline" size={20}
                color={activeTab === 'posts' ? Royal.pureBlack : Royal.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[userProfileStyles.tab, activeTab === 'reels' && userProfileStyles.tabActive]}
              onPress={() => setActiveTab('reels')}
            >
              <Ionicons
                name="film-outline" size={20}
                color={activeTab === 'reels' ? Royal.pureBlack : Royal.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[userProfileStyles.tab, activeTab === 'tagged' && userProfileStyles.tabActive]}
              onPress={() => setActiveTab('tagged')}
            >
              <Ionicons
                name="person-outline" size={20}
                color={activeTab === 'tagged' ? Royal.pureBlack : Royal.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={userProfileStyles.loadingContainer}>
              <ActivityIndicator size="large" color={Royal.pureBlack} />
            </View>
          ) : displayPosts.length === 0 ? (
            <View style={userProfileStyles.emptyContainer}>
              <Ionicons name="images-outline" size={60} color={Royal.textTertiary} />
              <Text style={userProfileStyles.emptyText}>
                {activeTab === 'reels' ? 'No reels yet' :
                 activeTab === 'tagged' ? 'No tagged posts' :
                 'No posts yet'}
              </Text>
            </View>
          ) : (
            <View style={userProfileStyles.postsGrid}>
              {displayPosts.map((post) => {
                const isVideo = post.mediaType === 'video' && post.video;
                const preview = post.image || post.thumbnail || '';
                return (
                  <TouchableOpacity
                    key={post._id}
                    style={userProfileStyles.gridItem}
                    onPress={() => onOpenComments(post)}
                    activeOpacity={0.85}
                  >
                    {preview ? (
                      <ExpoImage
                        source={{ uri: preview }}
                        style={userProfileStyles.gridImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={String(post._id)}
                        transition={120}
                      />
                    ) : (
                      <View style={[userProfileStyles.gridImage, { backgroundColor: Royal.offWhite }]} />
                    )}
                    {isVideo ? (
                      <View style={userProfileStyles.videoBadge}>
                        <Ionicons name="play" size={12} color={Royal.pureWhite} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const userProfileStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.pureWhite },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Royal.pureBlack, fontSize: 17, fontWeight: '700' },
  vendorBadgeSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Royal.vendorPurple,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, marginTop: 2,
  },
  vendorBadgeSmallText: { color: Royal.pureWhite, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  content: { flex: 1 },
  profileSection: { paddingHorizontal: 16, paddingTop: 16 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: Royal.offWhite },
  avatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: Royal.pureBlack },
  avatarLetter: { color: Royal.pureWhite, fontSize: 32, fontWeight: '800' },
  avatarTypeBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Royal.vendorPurple,
    borderWidth: 2, borderColor: Royal.pureWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNumber: { color: Royal.pureBlack, fontSize: 17, fontWeight: '800' },
  statLabel: { color: Royal.textSecondary, fontSize: 12, marginTop: 2 },
  userName: { color: Royal.pureBlack, fontSize: 15, fontWeight: '700', marginTop: 12 },
  userHandle: { color: Royal.textSecondary, fontSize: 13, marginTop: 2 },
  userCategory: { color: Royal.vendorPurple, fontSize: 12, marginTop: 4, fontWeight: '600' },
  bio: { color: Royal.textPrimary, fontSize: 13, marginTop: 6, lineHeight: 19 },
  bioLink: { color: Royal.blueAccent, textDecorationLine: 'underline' },
  websiteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 6,
  },
  website: { color: Royal.blueAccent, fontSize: 13, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: Royal.pureBlack,
    borderRadius: 10,
    minHeight: 42,
  },
  followBtnText: {
    color: Royal.pureWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  followingBtn: {
    backgroundColor: Royal.offWhite,
    borderWidth: 1,
    borderColor: Royal.borderLight,
  },
  followingBtnText: { color: Royal.pureBlack },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: Royal.offWhite,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Royal.borderLight,
    minHeight: 42,
  },
  messageBtnText: {
    color: Royal.pureBlack,
    fontSize: 14,
    fontWeight: '700',
  },
  editBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: Royal.offWhite,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Royal.borderLight,
    minHeight: 42,
  },
  editBtnText: { color: Royal.pureBlack, fontSize: 14, fontWeight: '700' },
  dashboardCard: {
    backgroundColor: Royal.offWhite, borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  dashboardTitle: { color: Royal.pureBlack, fontSize: 14, fontWeight: '700' },
  dashboardStat: { color: Royal.greenAccent, fontSize: 12, marginTop: 4, fontWeight: '600' },
  tabsRow: {
    flexDirection: 'row', marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Royal.borderLight,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Royal.pureBlack },
  loadingContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: Royal.textSecondary, fontSize: 16, marginTop: 12 },
  postsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: SCREEN_WIDTH / 3, height: SCREEN_WIDTH / 3, padding: 1 },
  gridImage: { width: '100%', height: '100%', backgroundColor: Royal.offWhite },
  videoBadge: {
    position: 'absolute', top: 8, right: 8, width: 20, height: 20,
    borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
});

// ═════════════════════════════════════════════════════════
// STORY CREATOR MODAL
// ✅ Video compression before upload
// ═════════════════════════════════════════════════════════
export const StoryCreatorModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  loading: boolean;
}> = ({ visible, onClose, onSubmit, loading }) => {
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');

  // 🎬 Story compression state
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setMediaUri(null);
      setMediaType('image');
      setCaption('');
      setIsCompressing(false);
      setCompressionProgress(0);
    }
  }, [visible]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri); setMediaType('image');
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'], allowsEditing: true, quality: 1, videoMaxDuration: 30,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri); setMediaType('video');
    }
  };

  const handleSubmit = async () => {
    if (!mediaUri) return;
    if (isCompressing) return;

    let compressedUri: string | null = null;

    try {
      const formData = new FormData();
      formData.append('mediaType', mediaType);
      if (caption.trim()) formData.append('caption', caption.trim());

      if (mediaType === 'video') {
        setIsCompressing(true);
        setCompressionProgress(0);

        console.log('🎬 Starting video compression for story...');

        const result = await compressVideo(
          mediaUri,
          (progress) => setCompressionProgress(progress),
          {
            maxSize: 1280,
            bitrate: 1800000,
            compressionMethod: 'auto',
          }
        );

        compressedUri = result.compressed ? result.uri : null;

        console.log('════════════════════════════════════');
        console.log('  STORY COMPRESSION RESULT');
        console.log('  original  :', formatBytes(result.originalSize));
        console.log('  compressed:', formatBytes(result.compressedSize));
        console.log('  saved     :', `${result.savedPercent}%`);
        console.log('  duration  :', `${result.durationMs}ms`);
        console.log('════════════════════════════════════');

        setIsCompressing(false);

        const finalUri = result.uri;
        const filename = finalUri.split('/').pop() || `story_${Date.now()}.mp4`;
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'mp4';
        const type = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
        // @ts-ignore
        formData.append('media', { uri: finalUri, name: filename, type });
      } else {
        const filename = mediaUri.split('/').pop() || 'story.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const type = ext === 'png' ? 'image/png' : 'image/jpeg';
        // @ts-ignore
        formData.append('media', { uri: mediaUri, name: filename, type });
      }

      onSubmit(formData);
    } catch (e: any) {
      console.error('❌ Story submit failed:', e?.message);
      Alert.alert('Upload Failed', e?.message || 'Please try again');
      setIsCompressing(false);
    } finally {
      if (compressedUri && compressedUri !== mediaUri) {
        setTimeout(() => cleanupCompressed(compressedUri!), 3000);
      }
    }
  };

  const canSubmit = !!mediaUri && !loading && !isCompressing;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={createPostStyles.overlay}
      >
        <View style={createPostStyles.modalContent}>
          <View style={createPostStyles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Royal.pureBlack} />
            </TouchableOpacity>
            <Text style={createPostStyles.headerTitle}>Add to Story</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {loading || isCompressing ? (
                <ActivityIndicator size="small" color={Royal.pureBlack} />
              ) : (
                <Text
                  style={[
                    createPostStyles.shareButton,
                    !canSubmit && { opacity: 0.5 },
                  ]}
                >
                  Share
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={createPostStyles.content}>
            <View style={createPostStyles.mediaSection}>
              {mediaUri ? (
                <View style={createPostStyles.mediaPreviewContainer}>
                  {mediaType === 'video' ? (
                    <InlineVideoPreview
                      uri={mediaUri}
                      style={createPostStyles.mediaPreview}
                    />
                  ) : (
                    <ExpoImage
                      source={{ uri: mediaUri }}
                      style={createPostStyles.mediaPreview}
                      contentFit="cover"
                    />
                  )}
                  {isCompressing ? (
                    <View style={createPostStyles.posterOverlay}>
                      <ActivityIndicator size="small" color={Royal.pureWhite} />
                      <Text style={createPostStyles.posterOverlayText}>
                        Compressing… {Math.round(compressionProgress * 100)}%
                      </Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={createPostStyles.removeMediaBtn}
                    onPress={() => setMediaUri(null)}
                    disabled={isCompressing}
                  >
                    <Ionicons name="close-circle" size={28} color={Royal.redAlert} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={createPostStyles.mediaPickerRow}>
                  <TouchableOpacity
                    style={createPostStyles.mediaPickerBtn}
                    onPress={pickImage}
                  >
                    <Ionicons
                      name="image-outline"
                      size={40}
                      color={Royal.textTertiary}
                    />
                    <Text style={createPostStyles.mediaPickerText}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={createPostStyles.mediaPickerBtn}
                    onPress={pickVideo}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={40}
                      color={Royal.textTertiary}
                    />
                    <Text style={createPostStyles.mediaPickerText}>Video</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <TextInput
              style={createPostStyles.input}
              placeholder="Caption"
              placeholderTextColor={Royal.textTertiary}
              value={caption}
              onChangeText={setCaption}
              maxLength={500}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ═════════════════════════════════════════════════════════
// FOLLOW LIST MODAL
// ═════════════════════════════════════════════════════════
export const FollowListModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  users: any[];
  loading?: boolean;
  currentUserId?: string;
  onToggleFollow?: (userId: string) => void;
  onOpenProfile?: (userId: string) => void;
}> = ({
  visible, onClose, title, users, loading = false,
  currentUserId, onToggleFollow, onOpenProfile,
}) => {
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({});

  useEffect(() => { if (!visible) setFollowMap({}); }, [visible]);

  const handleFollowClick = (item: any) => {
    const current = followMap[item._id] ?? item.isFollowing ?? false;
    setFollowMap((prev) => ({ ...prev, [item._id]: !current }));
    if (onToggleFollow) onToggleFollow(item._id);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={followStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />
        <View style={followStyles.header}>
          <TouchableOpacity onPress={onClose} style={followStyles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Royal.pureBlack} />
          </TouchableOpacity>
          <Text style={followStyles.headerTitle}>{title}</Text>
          <View style={followStyles.backBtn} />
        </View>

        {loading ? (
          <View style={followStyles.loadingContainer}>
            <ActivityIndicator size="large" color={Royal.pureBlack} />
          </View>
        ) : users.length === 0 ? (
          <View style={followStyles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color={Royal.textTertiary} />
            <Text style={followStyles.emptyText}>No {title.toLowerCase()} yet</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item, i) => `${item._id || i}`}
            renderItem={({ item }) => {
              const isFollowing = followMap[item._id] ?? item.isFollowing ?? false;
              const isMe = currentUserId && item._id === currentUserId;
              const isVendor = item.type === 'Vendor';
              const avatar = getProfileAvatar(item);
              const avatarKey = `follow-row-avatar:${item.type || 'User'}:${item._id}`;
              return (
                <View style={followStyles.userRow}>
                  <TouchableOpacity
                    style={followStyles.userRowLeft}
                    onPress={() => onOpenProfile && item._id && onOpenProfile(item._id)}
                    activeOpacity={0.8}
                  >
                    <View style={followStyles.avatarWrap}>
                      {avatar ? (
                        <ExpoImage
                          source={{ uri: avatar }}
                          style={followStyles.avatar}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={avatarKey}
                          transition={120}
                        />
                      ) : (
                        <View style={[followStyles.avatar, followStyles.avatarFallback]}>
                          <Text style={followStyles.avatarLetter}>
                            {(item.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {isVendor ? (
                        <View style={followStyles.vendorBadge}>
                          <Ionicons name="storefront" size={10} color={Royal.pureWhite} />
                        </View>
                      ) : null}
                    </View>
                    <View style={followStyles.userInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={followStyles.userName} numberOfLines={1}>
                          {item.name || 'User'}
                        </Text>
                        {isVendor ? (
                          <View style={followStyles.vendorChip}>
                            <Text style={followStyles.vendorChipText}>SHOP</Text>
                          </View>
                        ) : null}
                      </View>
                      {item.username ? (
                        <Text style={followStyles.userUsername} numberOfLines={1}>
                          @{item.username}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  {!isMe && onToggleFollow ? (
                    <TouchableOpacity
                      style={[followStyles.followBtn, isFollowing && followStyles.followingBtn]}
                      onPress={() => handleFollowClick(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={[followStyles.followBtnText, isFollowing && followStyles.followingBtnText]}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const followStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.pureWhite },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Royal.pureBlack, fontSize: 17, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Royal.textSecondary, fontSize: 16, marginTop: 12 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  userRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarWrap: { marginRight: 12, position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Royal.offWhite },
  avatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: Royal.pureBlack },
  avatarLetter: { color: Royal.pureWhite, fontSize: 20, fontWeight: '800' },
  vendorBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Royal.vendorPurple,
    borderWidth: 2, borderColor: Royal.pureWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { color: Royal.pureBlack, fontSize: 14, fontWeight: '700' },
  vendorChip: {
    backgroundColor: Royal.vendorPurple,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 4,
  },
  vendorChipText: { color: Royal.pureWhite, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  userUsername: { color: Royal.textSecondary, fontSize: 12, marginTop: 2 },
  followBtn: {
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: Royal.pureBlack, borderRadius: 6,
  },
  followingBtn: { backgroundColor: Royal.offWhite, borderWidth: 1, borderColor: Royal.borderLight },
  followBtnText: { color: Royal.pureWhite, fontSize: 13, fontWeight: '700' },
  followingBtnText: { color: Royal.pureBlack },
});

// ═════════════════════════════════════════════════════════
// COLLECTION PICKER MODAL
// ═════════════════════════════════════════════════════════
export const CollectionPickerModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  adId: string | null;
  collections: any[];
  onPick: (collectionId: string | null) => void;
  onCreateNew: (name: string) => Promise<any>;
  loading?: boolean;
}> = ({ visible, onClose, collections, onPick, onCreateNew, loading }) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) { setCreating(false); setNewName(''); setSaving(false); }
  }, [visible]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await onCreateNew(newName.trim());
      if (created?._id) onPick(created._id);
      setCreating(false);
      setNewName('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create collection');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={collectionStyles.backdrop}>
        <View style={collectionStyles.sheet}>
          <View style={collectionStyles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Royal.pureBlack} />
            </TouchableOpacity>
            <Text style={collectionStyles.headerTitle}>Save to collection</Text>
            <View style={{ width: 24 }} />
          </View>

          {creating ? (
            <View style={{ padding: 16 }}>
              <TextInput
                style={collectionStyles.input}
                placeholder="Collection name"
                placeholderTextColor={Royal.textTertiary}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                maxLength={50}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[collectionStyles.btn, { backgroundColor: Royal.offWhite }]}
                  onPress={() => setCreating(false)}
                >
                  <Text style={{ color: Royal.pureBlack, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[collectionStyles.btn, { backgroundColor: Royal.pureBlack }]}
                  onPress={handleCreate}
                  disabled={saving || !newName.trim()}
                >
                  {saving ? <ActivityIndicator size="small" color={Royal.pureWhite} /> :
                    <Text style={{ color: Royal.pureWhite, fontWeight: '700' }}>Create</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity style={collectionStyles.row}
                onPress={() => onPick(null)} disabled={loading}>
                <Ionicons name="bookmark-outline" size={24} color={Royal.pureBlack} />
                <Text style={collectionStyles.rowLabel}>Default collection</Text>
              </TouchableOpacity>
              {collections.map((c) => (
                <TouchableOpacity
                  key={c._id}
                  style={collectionStyles.row}
                  onPress={() => onPick(c._id)}
                  disabled={loading}
                >
                  <Ionicons name="folder-outline" size={24} color={Royal.pureBlack} />
                  <View style={{ flex: 1 }}>
                    <Text style={collectionStyles.rowLabel}>{c.name}</Text>
                    <Text style={collectionStyles.rowSub}>{c.postsCount || 0} posts</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={collectionStyles.row} onPress={() => setCreating(true)}>
                <Ionicons name="add-circle-outline" size={24} color={Royal.blueAccent} />
                <Text style={[collectionStyles.rowLabel, { color: Royal.blueAccent }]}>
                  Create new collection
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const collectionStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Royal.pureWhite,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  headerTitle: { color: Royal.pureBlack, fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  rowLabel: { color: Royal.pureBlack, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Royal.textSecondary, fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: Royal.offWhite, borderRadius: 10, padding: 14,
    color: Royal.pureBlack, fontSize: 15,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ═════════════════════════════════════════════════════════
// ANALYTICS MODAL
// ═════════════════════════════════════════════════════════
export const AnalyticsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  analytics: any;
  loading?: boolean;
  period?: string;
  onChangePeriod?: (period: string) => void;
}> = ({ visible, onClose, analytics, loading, period = '30d', onChangePeriod }) => {
  const t = analytics?.totals || {};
  const traffic = analytics?.trafficSources || {};
  const demo = analytics?.demographics || { ageGroups: {}, gender: {}, topLocations: [] };

  const MetricRow = ({ label, value }: { label: string; value: any }) => (
    <View style={analyticsStyles.metricRow}>
      <Text style={analyticsStyles.metricLabel}>{label}</Text>
      <Text style={analyticsStyles.metricValue}>{value ?? 0}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={analyticsStyles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />
        <View style={analyticsStyles.header}>
          <TouchableOpacity onPress={onClose} style={analyticsStyles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Royal.pureBlack} />
          </TouchableOpacity>
          <Text style={analyticsStyles.headerTitle}>Analytics</Text>
          <View style={analyticsStyles.backBtn} />
        </View>

        {onChangePeriod ? (
          <View style={analyticsStyles.periodRow}>
            {['7d', '30d', '90d'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[analyticsStyles.periodBtn, period === p && analyticsStyles.periodBtnActive]}
                onPress={() => onChangePeriod(p)}
              >
                <Text style={[analyticsStyles.periodText, period === p && analyticsStyles.periodTextActive]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {loading ? (
          <View style={analyticsStyles.center}>
            <ActivityIndicator size="large" color={Royal.pureBlack} />
          </View>
        ) : !analytics ? (
          <View style={analyticsStyles.center}>
            <Text style={{ color: Royal.textSecondary }}>No analytics available</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={analyticsStyles.sectionTitle}>Overview</Text>
            <View style={analyticsStyles.card}>
              <MetricRow label="Views" value={t.views} />
              <MetricRow label="Reach" value={t.reach} />
              <MetricRow label="Impressions" value={t.impressions} />
              <MetricRow label="Likes" value={t.likes} />
              <MetricRow label="Comments" value={t.comments} />
              <MetricRow label="Shares" value={t.shares} />
              <MetricRow label="Saves" value={t.saves} />
              <MetricRow label="Profile Visits" value={t.profileVisits} />
              <MetricRow label="Follower Growth" value={t.followerGrowth} />
            </View>

            <Text style={analyticsStyles.sectionTitle}>Traffic Sources</Text>
            <View style={analyticsStyles.card}>
              <MetricRow label="Home" value={traffic.home} />
              <MetricRow label="Explore" value={traffic.explore} />
              <MetricRow label="Profile" value={traffic.profile} />
              <MetricRow label="Hashtags" value={traffic.hashtags} />
              <MetricRow label="Search" value={traffic.search} />
            </View>

            <Text style={analyticsStyles.sectionTitle}>Demographics</Text>
            <View style={analyticsStyles.card}>
              {Object.entries(demo.ageGroups || {}).map(([k, v]) => (
                <MetricRow key={k} label={k} value={v as number} />
              ))}
              <MetricRow label="Male" value={demo.gender?.male} />
              <MetricRow label="Female" value={demo.gender?.female} />
              <MetricRow label="Other" value={demo.gender?.other} />
            </View>

            {Array.isArray(demo.topLocations) && demo.topLocations.length > 0 ? (
              <>
                <Text style={analyticsStyles.sectionTitle}>Top Locations</Text>
                <View style={analyticsStyles.card}>
                  {demo.topLocations.map((loc: any, i: number) => (
                    <MetricRow key={`${loc.name}-${i}`} label={loc.name || 'Unknown'} value={loc.count} />
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const analyticsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.pureWhite },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: Royal.pureBlack, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  periodRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  periodBtn: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Royal.offWhite, borderWidth: 1, borderColor: Royal.borderLight,
  },
  periodBtnActive: { backgroundColor: Royal.pureBlack, borderColor: Royal.pureBlack },
  periodText: { color: Royal.textSecondary, fontSize: 12, fontWeight: '700' },
  periodTextActive: { color: Royal.pureWhite },
  sectionTitle: {
    color: Royal.pureBlack, fontSize: 15, fontWeight: '800',
    marginTop: 16, marginBottom: 8,
  },
  card: {
    backgroundColor: Royal.offWhite, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  metricRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  metricLabel: { color: Royal.textSecondary, fontSize: 13, fontWeight: '600' },
  metricValue: { color: Royal.pureBlack, fontSize: 14, fontWeight: '800' },
});

// ═════════════════════════════════════════════════════════
// HIGHLIGHT CREATOR MODAL
// ═════════════════════════════════════════════════════════
export const HighlightCreatorModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  stories: any[];
  onSubmit: (data: { name: string; storyIds: string[]; coverImage?: string }) => Promise<void>;
  loading?: boolean;
}> = ({ visible, onClose, stories, onSubmit }) => {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) { setName(''); setSelectedIds([]); setSaving(false); }
  }, [visible]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || selectedIds.length === 0) return;
    setSaving(true);
    try {
      const cover = stories.find((s) => s._id === selectedIds[0])?.media;
      await onSubmit({ name: name.trim(), storyIds: selectedIds, coverImage: cover });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={collectionStyles.backdrop}>
        <View style={[collectionStyles.sheet, { maxHeight: '85%' }]}>
          <View style={collectionStyles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Royal.pureBlack} />
            </TouchableOpacity>
            <Text style={collectionStyles.headerTitle}>New Highlight</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!name.trim() || selectedIds.length === 0 || saving}
            >
              {saving ? <ActivityIndicator size="small" color={Royal.pureBlack} /> :
                <Text style={{
                  color: (!name.trim() || selectedIds.length === 0) ? Royal.textTertiary : Royal.pureBlack,
                  fontWeight: '700', fontSize: 15,
                }}>Create</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <TextInput
              style={collectionStyles.input}
              placeholder="Highlight name"
              placeholderTextColor={Royal.textTertiary}
              value={name}
              onChangeText={setName}
              maxLength={50}
            />
          </View>
          <Text style={{ color: Royal.pureBlack, fontWeight: '700', paddingHorizontal: 16 }}>
            Select stories ({selectedIds.length})
          </Text>
          <ScrollView contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap' }}>
            {stories.map((story) => {
              const selected = selectedIds.includes(story._id);
              return (
                <TouchableOpacity
                  key={story._id}
                  style={{
                    width: 80, height: 110, margin: 4, borderRadius: 8, overflow: 'hidden',
                    borderWidth: 2, borderColor: selected ? Royal.blueAccent : 'transparent',
                  }}
                  onPress={() => toggle(story._id)}
                >
                  <ExpoImage
                    source={{ uri: story.media }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    recyclingKey={String(story._id)}
                  />
                  {selected ? (
                    <View style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: Royal.blueAccent,
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Ionicons name="checkmark" size={14} color={Royal.pureWhite} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            {stories.length === 0 ? (
              <Text style={{ color: Royal.textSecondary, padding: 16 }}>
                No stories to choose from.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};