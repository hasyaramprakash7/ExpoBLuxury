// src/components/FeedCards.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  Share as RNShare,
  Modal,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Share from 'react-native-share';

const TAG = '🟩[FeedCards]';
const warn = (...a: any[]) => console.warn(TAG, ...a);
const log = (...a: any[]) => {
  if (__DEV__) console.log(TAG, ...a);
};

const Royal = {
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
  offWhite: '#F4F4F6',
  softWhite: '#F2F2F7',
  textPrimary: '#0B0B0F',
  textSecondary: 'rgba(11,11,15,0.55)',
  textTertiary: 'rgba(11,11,15,0.40)',
  borderLight: 'rgba(0,0,0,0.08)',
  shadow: 'rgba(0,0,0,0.10)',
  redAlert: '#FF3040',
  redLike: '#FF3040',
  bookmarkActive: '#0B0B0F',
  blueAccent: '#0095F6',
  greenAccent: '#00C853',
  onlineGreen: '#4CD964',
  warning: '#FF9500',
  vendorPurple: '#6C63FF',
};

export const PLAY_STORE_LINK =
  'https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury';
export const APP_STORE_LINK = 'https://apps.apple.com/app/bluxury/id123456789';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get('window');

export const REEL_HEIGHT = SCREEN_HEIGHT * 0.9;
export const REEL_GAP = 1;
export const SNAP_INTERVAL = REEL_HEIGHT + REEL_GAP;

export const GRID_GAP = 2;
export const GRID_COLUMNS = 3;
export const GRID_ITEM_SIZE =
  (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
export const GRID_ITEM_HEIGHT = GRID_ITEM_SIZE * 1.4;
export const GRID_ROW_HEIGHT = GRID_ITEM_HEIGHT + GRID_GAP;

export const POST_MEDIA_HEIGHT = SCREEN_WIDTH * 1.25;

// ═════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═════════════════════════════════════════════════════════

export const normalizePhone = (phone: string) =>
  phone ? phone.replace(/^\+91/, '').replace(/\D/g, '') : '';

const isCancellationError = (e: any) =>
  /cancelled|canceled|did not share|dismissed/i.test(e?.message || '');

const buildReferralLink = (ad: any, userId?: string) => {
  const base = ad?.link || '';
  if (!/^https?:\/\//.test(base)) return '';
  if (!userId) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}ref=${encodeURIComponent(userId)}`;
};

const buildFullAddress = (addr: any): string =>
  addr
    ? [addr.street, addr.locality, addr.city, addr.district, addr.state, addr.pincode, addr.country]
        .filter(Boolean)
        .join(', ')
    : '';

const formatCount = (n?: number) => {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

const timeAgo = (date?: string) => {
  if (!date) return '';
  const t = new Date(date).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return 'Just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const getFS = () => require('expo-file-system/legacy');

export const downloadMediaLocally = async (
  ad: any
): Promise<{ uri: string; mediaType: 'image' | 'video' } | null> => {
  const isVideo = ad.mediaType === 'video' && !!ad.video;
  const remoteUrl: string = (isVideo ? ad.video : ad.image) || '';
  if (!remoteUrl) return null;
  if (remoteUrl.startsWith('file://')) {
    return { uri: remoteUrl, mediaType: isVideo ? 'video' : 'image' };
  }
  try {
    const FileSystem = getFS();
    const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    const ext = isVideo ? 'mp4' : 'jpg';
    const safeId = String(ad._id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = `${dir}saved_${safeId}_${Date.now()}.${ext}`;
    const dl = await FileSystem.downloadAsync(remoteUrl, filePath);
    if (dl?.status === 200 && dl.uri) {
      const uri = String(dl.uri).startsWith('file://') ? dl.uri : `file://${dl.uri}`;
      return { uri, mediaType: isVideo ? 'video' : 'image' };
    }
    return null;
  } catch (e) {
    warn('downloadMediaLocally failed:', e);
    return null;
  }
};

export const deleteLocalFile = async (uri?: string) => {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    const FileSystem = getFS();
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    warn('deleteLocalFile failed:', e);
  }
};

// ═════════════════════════════════════════════════════════
// CLOUDINARY PUBLIC ID EXTRACTOR
// ═════════════════════════════════════════════════════════
const extractCloudinaryPublicId = (url: string): string => {
  try {
    const marker = '/video/upload/';
    const idx = url.indexOf(marker);
    if (idx === -1) return '';
    let tail = url.slice(idx + marker.length);
    tail = tail.replace(/^(?:[^/]+\/)*?(v\d+\/)/, '$1');
    tail = tail.replace(/^v\d+\//, '');
    tail = tail.replace(/\.[a-z0-9]+$/i, '');
    return tail;
  } catch {
    return '';
  }
};

// ═════════════════════════════════════════════════════════
// ✅ pickVideoSource with Cloudinary HLS fallback
// ═════════════════════════════════════════════════════════
export const pickVideoSource = (ad: any): string => {
  if (!ad) return '';
  const hls = typeof ad.hlsUrl === 'string' ? ad.hlsUrl.trim() : '';
  const mp4 =
    typeof ad.video === 'string'
      ? ad.video.trim()
      : typeof ad.media === 'string'
      ? ad.media.trim()
      : '';

  const hlsLooksValid =
    hls.length > 0 &&
    hls.endsWith('.m3u8') &&
    hls.startsWith('https://res.cloudinary.com');
  if (hlsLooksValid) return hls;

  if (mp4.includes('res.cloudinary.com') && mp4.includes('/video/upload/')) {
    const publicId = extractCloudinaryPublicId(mp4);
    if (publicId) {
      const match = mp4.match(/res\.cloudinary\.com\/([^/]+)\//);
      const cloudName = match ? match[1] : '';
      if (cloudName) {
        return `https://res.cloudinary.com/${cloudName}/video/upload/sp_hd/${publicId}.m3u8`;
      }
    }
  }

  return mp4;
};

export const pickVideoSources = (ad: any): string[] => {
  if (!ad) return [];
  const list: string[] = [];
  const primary = pickVideoSource(ad);
  const mp4 =
    typeof ad.video === 'string'
      ? ad.video.trim()
      : typeof ad.media === 'string'
      ? ad.media.trim()
      : '';
  if (primary) list.push(primary);
  if (mp4 && mp4 !== primary) list.push(mp4);
  return list;
};

// ═════════════════════════════════════════════════════════
// ✅ releaseVideoPlayer — safe cleanup
// ═════════════════════════════════════════════════════════
export const releaseVideoPlayer = (player: any) => {
  if (!player) return;
  try {
    player.pause?.();
    try {
      player.currentTime = 0;
    } catch {}
    if (typeof player.replace === 'function') {
      try {
        player.replace(null);
      } catch {
        try {
          player.replace('');
        } catch {}
      }
    }
    if (typeof player.release === 'function') {
      try {
        player.release();
      } catch {}
    }
  } catch (e) {
    // silent — cleanup must never throw
  }
};

// ═════════════════════════════════════════════════════════
// ✅ useActiveVideoPlayer — with AUTO-RETRY (exponential backoff)
//
// Telegram-grade error recovery:
//   1st error → retry after 1s
//   2nd error → retry after 2s
//   3rd error → retry after 4s
//   4th error → give up
// ═════════════════════════════════════════════════════════
const MAX_RETRIES = 3;

const useActiveVideoPlayer = (
  source: string,
  isActive: boolean,
  options: { loop?: boolean; muted?: boolean } = {}
) => {
  const { loop = true, muted = true } = options;
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<any>(null);

  const player = useVideoPlayer(isActive && source ? source : '', (p) => {
    p.loop = loop;
    p.muted = muted;
  });

  // Play / release on active change
  useEffect(() => {
    if (!player) return;
    if (!isActive) {
      releaseVideoPlayer(player);
      return;
    }
    try {
      player.play();
    } catch {}
    return () => {
      releaseVideoPlayer(player);
    };
  }, [player, isActive, source]);

  // 🎬 AUTO-RETRY on error
  useEffect(() => {
    if (!player || !isActive || !source) return;

    // Reset retry counter when source changes
    retryCountRef.current = 0;

    const sub = player.addListener?.('statusChange', (s: any) => {
      if (s?.status === 'error') {
        if (retryCountRef.current >= MAX_RETRIES) {
          console.warn(
            `🎬[FeedCards] Video gave up after ${MAX_RETRIES} retries: ${source.slice(0, 60)}`
          );
          return;
        }

        retryCountRef.current += 1;
        const delay = Math.pow(2, retryCountRef.current - 1) * 1000; // 1s, 2s, 4s

        console.log(
          `🎬[FeedCards] Video error — retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms`
        );

        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }

        retryTimerRef.current = setTimeout(() => {
          try {
            player.replace(source);
            player.play();
          } catch (e) {
            console.warn('🎬[FeedCards] Retry replace failed:', e);
          }
        }, delay);
      } else if (s?.status === 'readyToPlay') {
        // Reset on success
        if (retryCountRef.current > 0) {
          console.log(
            `🎬[FeedCards] Video recovered after ${retryCountRef.current} retries`
          );
        }
        retryCountRef.current = 0;
      }
    });

    return () => {
      try {
        sub?.remove?.();
      } catch {}
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [player, isActive, source]);

  return player;
};

const openBuyLink = async (ad: any, userId?: string, onFallback?: () => void) => {
  const url = buildReferralLink(ad, userId);
  if (!url) {
    if (onFallback) {
      onFallback();
      return;
    }
    Alert.alert('No Link', 'This post does not have a shopping link yet.');
    return;
  }
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else if (onFallback) onFallback();
    else Alert.alert('Error', 'Unable to open this link.');
  } catch (e) {
    warn('openBuyLink failed:', e);
    if (onFallback) onFallback();
    else Alert.alert('Error', 'Could not open the link in browser.');
  }
};

const shareAd = async (
  ad: any,
  setIsSharing: (v: boolean) => void,
  userId: string | undefined,
  onShareSuccess?: () => void
) => {
  if (!ad) return;
  setIsSharing(true);
  try {
    const imageUrl = ad.image || '';
    const title = ad.title || 'Post';
    const description = ad.description || '';
    const category = ad.category || '';
    const referralLink = buildReferralLink(ad, userId);
    const appLink = Platform.OS === 'ios' ? APP_STORE_LINK : PLAY_STORE_LINK;
    const shareLink = referralLink || appLink;

    let message = `📢 *${title}*\n\n`;
    if (description) message += `${description}\n\n`;
    if (category) message += `🏷️ Category: ${category}\n`;
    message += `🔗 ${shareLink}\n\n`;
    if (referralLink) message += `📱 Download BLuxury: ${appLink}`;

    let shared = false;
    if (imageUrl) {
      try {
        let localUri = imageUrl;
        if (!localUri.startsWith('file://')) {
          const FileSystem = getFS();
          const filePath = `${FileSystem.cacheDirectory}ad_${Date.now()}.jpg`;
          const dl = await FileSystem.downloadAsync(imageUrl, filePath);
          if (dl?.status === 200 && dl.uri) localUri = dl.uri;
        }
        if (Platform.OS === 'android' && !localUri.startsWith('file://')) {
          localUri = `file://${localUri}`;
        }
        await Share.open({
          title: 'BLuxury Post',
          message,
          url: localUri,
          type: 'image/jpeg',
        });
        shared = true;
      } catch (e) {
        if (isCancellationError(e)) {
          setIsSharing(false);
          return;
        }
      }
    }
    if (!shared) {
      const result = await RNShare.share({ message, title: 'BLuxury Post' });
      if (result?.action === RNShare.sharedAction) shared = true;
    }
    if (shared && onShareSuccess) onShareSuccess();
  } catch (e) {
    if (!isCancellationError(e)) Alert.alert('Share Error', 'Could not share this post.');
  } finally {
    setIsSharing(false);
  }
};

// ═════════════════════════════════════════════════════════
// POST OPTIONS SHEET
// ═════════════════════════════════════════════════════════
export const PostOptionsSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  ad: any;
  isOwner: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  onTogglePin?: (adId: string) => void;
  onArchive?: (adId: string) => void;
  onUnarchive?: (adId: string) => void;
  onDelete?: (adId: string) => void;
  onEdit?: (ad: any) => void;
  onViewAnalytics?: (adId: string) => void;
  onCopyLink?: (ad: any) => void;
  onReport?: (ad: any) => void;
  onHide?: (ad: any) => void;
}> = ({
  visible, onClose, ad, isOwner, isPinned, isArchived,
  onTogglePin, onArchive, onUnarchive, onDelete, onEdit,
  onViewAnalytics, onCopyLink, onReport, onHide,
}) => {
  if (!ad) return null;

  const Row = ({
    icon, label, onPress, danger, color,
  }: {
    icon: string; label: string; onPress?: () => void;
    danger?: boolean; color?: string;
  }) => (
    <TouchableOpacity
      style={optionsStyles.row}
      onPress={() => { onClose(); setTimeout(() => onPress?.(), 180); }}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon as any}
        size={22}
        color={color || (danger ? Royal.redAlert : Royal.pureBlack)}
      />
      <Text
        style={[
          optionsStyles.rowLabel,
          danger && { color: Royal.redAlert },
          color && { color },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={optionsStyles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={optionsStyles.sheet}>
          <View style={optionsStyles.handle} />
          {isOwner ? (
            <>
              {onViewAnalytics ? (
                <Row icon="analytics-outline" label="View Analytics"
                  onPress={() => onViewAnalytics(ad._id)} />
              ) : null}
              {onEdit ? (
                <Row icon="create-outline" label="Edit Post"
                  onPress={() => onEdit(ad)} />
              ) : null}
              {onTogglePin ? (
                <Row
                  icon={isPinned ? 'pin-outline' : 'pin'}
                  label={isPinned ? 'Unpin from Profile' : 'Pin to Profile'}
                  onPress={() => onTogglePin(ad._id)}
                />
              ) : null}
              {isArchived && onUnarchive ? (
                <Row icon="refresh-outline" label="Unarchive"
                  onPress={() => onUnarchive(ad._id)} />
              ) : onArchive ? (
                <Row icon="archive-outline" label="Archive"
                  onPress={() => onArchive(ad._id)} />
              ) : null}
              {onDelete ? (
                <Row icon="trash-outline" label="Delete Post" danger
                  onPress={() => onDelete(ad._id)} />
              ) : null}
            </>
          ) : (
            <>
              {onHide ? (
                <Row icon="eye-off-outline" label="Hide"
                  onPress={() => onHide(ad)} />
              ) : null}
              {onReport ? (
                <Row icon="flag-outline" label="Report" danger
                  onPress={() => onReport(ad)} />
              ) : null}
            </>
          )}
          {onCopyLink ? (
            <Row icon="link-outline" label="Copy Link"
              onPress={() => onCopyLink(ad)} />
          ) : null}
          <Row icon="close-outline" label="Cancel" onPress={onClose} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const optionsStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Royal.pureWhite,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8, paddingBottom: 24,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Royal.borderLight, alignSelf: 'center', marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, gap: 14,
  },
  rowLabel: {
    color: Royal.pureBlack, fontSize: 15, fontWeight: '600',
  },
});

// ═════════════════════════════════════════════════════════
// VIDEO THUMBNAIL GENERATOR (LRU-CAPPED)
// ═════════════════════════════════════════════════════════
const thumbCache = new Map<string, string>();
const MAX_THUMB_CACHE = 50;

const setThumbCache = (key: string, val: string) => {
  if (thumbCache.size >= MAX_THUMB_CACHE) {
    const firstKey = thumbCache.keys().next().value;
    if (firstKey) thumbCache.delete(firstKey);
  }
  thumbCache.set(key, val);
};

const GeneratedVideoThumbnailInner: React.FC<{
  videoUri: string; style: any;
}> = ({ videoUri, style }) => {
  const [thumb, setThumb] = useState<string | null>(
    () => thumbCache.get(videoUri) || null
  );

  const player = useVideoPlayer(videoUri, (p) => {
    p.muted = true;
    p.loop = false;
  });

  useEffect(() => {
    if (thumb) return;
    const existing = thumbCache.get(videoUri);
    if (existing) {
      setThumb(existing);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const thumbnails = await player.generateThumbnailsAsync([0, 1], {
          maxWidth: GRID_ITEM_SIZE,
          maxHeight: GRID_ITEM_HEIGHT,
        });
        if (cancelled || !thumbnails || thumbnails.length === 0) return;
        const uri = thumbnails[thumbnails.length - 1]?.uri;
        if (uri) {
          setThumbCache(videoUri, uri);
          setThumb(uri);
        }
      } catch (e) {
        warn('generateThumbnailsAsync failed:', e);
      } finally {
        releaseVideoPlayer(player);
      }
    })();
    return () => {
      cancelled = true;
      releaseVideoPlayer(player);
    };
  }, [thumb, videoUri, player]);

  return (
    <ExpoImage
      source={thumb ? { uri: thumb } : undefined}
      style={style}
      contentFit="cover"
      transition={120}
      cachePolicy="memory-disk"
    />
  );
};

const GeneratedVideoThumbnail: React.FC<{
  videoUri: string; style: any; enabled: boolean;
}> = ({ videoUri, style, enabled }) => {
  if (!enabled) return null;
  const cached = thumbCache.get(videoUri);
  if (cached) {
    return (
      <ExpoImage
        source={{ uri: cached }}
        style={style}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
      />
    );
  }
  return <GeneratedVideoThumbnailInner videoUri={videoUri} style={style} />;
};

const VideoThumbnail: React.FC<{
  videoUri: string; fallbackImage?: string; style: any;
  recyclingKey?: string; enabled: boolean;
}> = ({ videoUri, fallbackImage, style, recyclingKey, enabled }) => {
  if (fallbackImage) {
    return (
      <ExpoImage
        source={{ uri: fallbackImage }}
        style={style}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
      />
    );
  }
  return <GeneratedVideoThumbnail videoUri={videoUri} style={style} enabled={enabled} />;
};

// ═════════════════════════════════════════════════════════
// GRID CARD
// ═════════════════════════════════════════════════════════
const ActiveGridVideo: React.FC<{ ad: any }> = ({ ad }) => {
  const sources = pickVideoSources(ad);
  const primary = sources[0] || '';

  const player = useActiveVideoPlayer(primary, true, {
    loop: true,
    muted: true,
  });

  useEffect(() => {
    if (!player || sources.length < 2) return;
    const sub = player.addListener?.('statusChange', (s: any) => {
      if (s?.status === 'error' && sources[1]) {
        try {
          player.replace(sources[1]);
          player.play();
        } catch {}
      }
    });
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [player, sources[0], sources[1], ad._id]);

  return (
    <VideoView
      player={player}
      style={styles.gridVideo}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
};

const GridVideoCell: React.FC<{
  ad: any; fallbackImage?: string; isActive: boolean;
}> = ({ ad, fallbackImage, isActive }) => {
  if (isActive) return <ActiveGridVideo ad={ad} />;
  return (
    <VideoThumbnail
      videoUri={ad.video || pickVideoSource(ad)}
      fallbackImage={fallbackImage}
      style={styles.gridImage}
      enabled={true}
    />
  );
};

export const GridCard: React.FC<{
  ad: any;
  onPress: (ad: any) => void;
  isActiveVideo: boolean;
  isOnline?: boolean;
}> = React.memo(({ ad, onPress, isActiveVideo, isOnline = false }) => {
  const isVideo = ad.mediaType === 'video' && !!pickVideoSource(ad);
  if (!isVideo && !ad.image) return null;
  const isUserPost = ad.postType === 'user';
  const isVendorPost = ad.postType === 'vendor';
  const showOnlineDot = (isUserPost || isVendorPost) && isOnline;

  return (
    <TouchableOpacity style={styles.gridCard} onPress={() => onPress(ad)} activeOpacity={0.85}>
      {isVideo ? (
        <GridVideoCell ad={ad} fallbackImage={ad.thumbnail || ad.image} isActive={isActiveVideo} />
      ) : (
        <ExpoImage
          source={{ uri: ad.image }}
          style={styles.gridImage}
          contentFit="cover"
          recyclingKey={String(ad._id)}
          transition={150}
          cachePolicy="memory-disk"
        />
      )}
      {isVideo ? (
        <View style={styles.gridVideoBadge} pointerEvents="none">
          <Ionicons name="play" size={12} color={Royal.pureWhite} />
        </View>
      ) : null}
      {ad.isPinned ? (
        <View style={styles.gridPinnedBadge} pointerEvents="none">
          <Ionicons name="pin" size={10} color={Royal.pureWhite} />
        </View>
      ) : null}
      {showOnlineDot ? (
        <View style={styles.gridOnlineBadge} pointerEvents="none" />
      ) : null}
      <View style={styles.gridOverlay} pointerEvents="none">
        <Ionicons name="eye-outline" size={11} color={Royal.pureWhite} />
        <Text style={styles.gridOverlayText}>{formatCount(ad.viewsCount)}</Text>
      </View>
    </TouchableOpacity>
  );
});

// ═════════════════════════════════════════════════════════
// REEL CARD
// ═════════════════════════════════════════════════════════
const ReelVideo: React.FC<{ ad: any }> = ({ ad }) => {
  const [muted, setMuted] = useState(false);
  const sources = pickVideoSources(ad);
  const primary = sources[0] || '';

  const player = useActiveVideoPlayer(primary, true, {
    loop: true,
    muted: false,
  });

  useEffect(() => {
    if (player) player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!player || sources.length < 2) return;
    const sub = player.addListener?.('statusChange', (s: any) => {
      if (s?.status === 'error' && sources[1]) {
        try {
          player.replace(sources[1]);
          player.play();
        } catch {}
      }
    });
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [player, sources[0], sources[1], ad._id]);

  return (
    <View style={styles.reelImageWrap}>
      <VideoView
        player={player}
        style={styles.reelImage}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      <TouchableOpacity
        style={styles.reelSoundToggle}
        onPress={() => setMuted((m) => !m)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={muted ? 'volume-mute' : 'volume-high'}
          size={20}
          color={Royal.pureWhite}
        />
      </TouchableOpacity>
    </View>
  );
};

export const ReelCard: React.FC<{
  ad: any;
  onPress: (ad: any) => void;
  onOpenShop: (vendor: any) => void;
  onOpenProfile: (userId: string) => void;
  onLike: (adId: string) => void;
  onOpenComments: (ad: any) => void;
  onShareTracked: (adId: string) => void;
  isActive: boolean;
  showOwner?: boolean;
  cardHeight: number;
  userId?: string;
  isOnline?: boolean;
  isFollowing?: boolean;
  onToggleFollow?: (userId: string, following: boolean) => void;
}> = React.memo(
  ({
    ad, onPress, onOpenShop, onOpenProfile, onLike, onOpenComments,
    onShareTracked, isActive, showOwner = false, cardHeight, userId,
    isOnline = false, isFollowing = false, onToggleFollow,
  }) => {
    const [isSharing, setIsSharing] = useState(false);
    const [isLiking, setIsLiking] = useState(false);

    const videoSrc = pickVideoSource(ad);
    const isVideo = ad.mediaType === 'video' && !!videoSrc;
    const isUserPost = ad.postType === 'user';
    const isVendorPost = ad.postType === 'vendor';

    const vendor = ad.vendorId && typeof ad.vendorId === 'object' ? ad.vendorId : null;
    const user = ad.userId && typeof ad.userId === 'object' ? ad.userId : null;

    const vendorPhone = vendor?.phone || '';
    const vendorAddress = vendor?.address || null;
    const vendorName = vendor?.shopName || vendor?.name || ad.vendorName || 'Vendor';
    const userName = user?.name || ad.userName || 'User';
    const liked = !!ad.likedByMe;
    const displayName = isUserPost ? userName : vendorName;
    const previewImage = ad.thumbnail || ad.image;

    const ownerIdentityId = isUserPost
      ? String(user?._id || ad.userId || '')
      : String(vendor?._id || ad.vendorId || '');

    const isMe = userId && ownerIdentityId === String(userId);

    const handleShare = () => shareAd(ad, setIsSharing, userId, () => onShareTracked(ad._id));
    const handleLike = () => {
      if (isLiking) return;
      setIsLiking(true);
      onLike(ad._id);
      setTimeout(() => setIsLiking(false), 250);
    };

    const handleCall = () => {
      if (!vendorPhone) return Alert.alert('No Phone', 'No phone on file.');
      Linking.openURL(`tel:${vendorPhone}`).catch(() =>
        Alert.alert('Error', 'Unable to make call')
      );
    };

    const handleWhatsApp = () => {
      if (!vendorPhone) return Alert.alert('No Phone', 'No phone on file.');
      const msg = `Hi, I'm interested in "${ad.title || 'your post'}" on BLuxury.`;
      Linking.openURL(
        `whatsapp://send?phone=${vendorPhone}&text=${encodeURIComponent(msg)}`
      ).catch(() => Alert.alert('Error', 'WhatsApp not installed.'));
    };

    const handleLocation = () => {
      const lat = vendorAddress?.latitude;
      const lng = vendorAddress?.longitude;
      const fullAddress = buildFullAddress(vendorAddress);
      if (lat && lng) {
        const scheme = Platform.select({
          ios: `maps:0,0?q=${encodeURIComponent(vendorName)}@${lat},${lng}`,
          android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(vendorName)})`,
        })!;
        const fb = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        Linking.canOpenURL(scheme).then((ok) => Linking.openURL(ok ? scheme : fb));
      } else if (fullAddress) {
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
        );
      } else {
        Alert.alert('No Location', 'No address on file.');
      }
    };

    const handleOpenProfileOrShop = () => {
      if (ownerIdentityId) {
        onOpenProfile(ownerIdentityId);
        return;
      }
      if (!isUserPost && vendor) {
        onOpenShop(vendor);
      }
    };

    const handleOpenShopExplicit = () => {
      if (isUserPost) {
        if (ownerIdentityId) onOpenProfile(ownerIdentityId);
        return;
      }
      if (!vendor) return Alert.alert('No Vendor', 'Vendor unavailable.');
      onOpenShop(vendor);
    };

    const handleBuy = () => openBuyLink(ad, userId, () => onPress(ad));

    const handleFollowPress = () => {
      if (!ownerIdentityId || isMe) return;
      onToggleFollow?.(ownerIdentityId, !isFollowing);
    };

    return (
      <View style={[styles.reelCard, { height: cardHeight }]}>
        {isVideo ? (
          isActive ? (
            <ReelVideo ad={ad} />
          ) : (
            <VideoThumbnail
              videoUri={ad.video || videoSrc}
              fallbackImage={previewImage}
              style={styles.reelImage}
              recyclingKey={String(ad._id)}
              enabled={true}
            />
          )
        ) : (
          <ExpoImage
            source={{ uri: ad.image }}
            style={styles.reelImage}
            contentFit="cover"
            recyclingKey={String(ad._id)}
            transition={200}
            cachePolicy="memory-disk"
          />
        )}

        {!isVideo ? (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => onPress(ad)}
          />
        ) : null}

        <View style={styles.reelOverlay} pointerEvents="box-none">
          <View style={styles.reelContent}>
            <View style={styles.reelTextContainer}>
              {showOwner && displayName ? (
                <TouchableOpacity
                  style={styles.ownerPill}
                  onPress={handleOpenProfileOrShop}
                  activeOpacity={0.7}
                >
                  {(isUserPost || isVendorPost) && isOnline ? (
                    <View style={styles.reelOnlineDot} />
                  ) : null}
                  <Text style={styles.ownerName} numberOfLines={1}>
                    {isUserPost ? `👤 ${displayName}` : `🏪 ${displayName}`}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {!isMe && onToggleFollow ? (
                <TouchableOpacity
                  style={[
                    styles.reelFollowBtn,
                    isFollowing && styles.reelFollowBtnActive,
                  ]}
                  onPress={handleFollowPress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isFollowing ? 'checkmark' : 'person-add'}
                    size={12}
                    color={isFollowing ? Royal.pureBlack : Royal.pureWhite}
                  />
                  <Text
                    style={[
                      styles.reelFollowBtnText,
                      isFollowing && styles.reelFollowBtnTextActive,
                    ]}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {ad.title ? (
                <View style={styles.textPill}>
                  <Text style={styles.reelTitle} numberOfLines={2}>
                    {ad.title}
                  </Text>
                </View>
              ) : null}
              {ad.description ? (
                <View style={styles.textPill}>
                  <Text style={styles.reelDescription} numberOfLines={3}>
                    {ad.description}
                  </Text>
                </View>
              ) : null}
              {ad.category ? (
                <View style={styles.reelCategoryBadge}>
                  <Text style={styles.reelCategoryText}>{ad.category}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.reelActions}>
              <TouchableOpacity
                style={styles.reelActionButton}
                onPress={handleLike}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={28}
                  color={liked ? Royal.redLike : Royal.pureWhite}
                />
                <Text style={styles.reelActionCount}>
                  {formatCount(ad.likesCount)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reelActionButton}
                onPress={() => onOpenComments(ad)}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble-outline" size={26} color={Royal.pureWhite} />
                <Text style={styles.reelActionCount}>
                  {formatCount(ad.commentsCount)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reelActionButton}
                onPress={handleShare}
                disabled={isSharing}
                activeOpacity={0.7}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={Royal.pureWhite} />
                ) : (
                  <Ionicons name="paper-plane-outline" size={26} color={Royal.pureWhite} />
                )}
                <Text style={styles.reelActionCount}>
                  {formatCount(ad.sharesCount)}
                </Text>
              </TouchableOpacity>
              <View style={styles.reelActionButton}>
                <Ionicons name="eye-outline" size={26} color={Royal.pureWhite} />
                <Text style={styles.reelActionCount}>
                  {formatCount(ad.viewsCount)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.reelActionButton}
                onPress={handleOpenShopExplicit}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isUserPost ? 'person-outline' : 'storefront-outline'}
                  size={26}
                  color={Royal.pureWhite}
                />
              </TouchableOpacity>
              {!isUserPost ? (
                <>
                  <TouchableOpacity
                    style={styles.reelActionButton}
                    onPress={handleCall}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call-outline" size={26} color={Royal.pureWhite} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reelActionButton}
                    onPress={handleWhatsApp}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="logo-whatsapp" size={26} color={Royal.pureWhite} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reelActionButton}
                    onPress={handleLocation}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={26} color={Royal.pureWhite} />
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity
                style={styles.reelActionButton}
                onPress={handleBuy}
                activeOpacity={0.7}
              >
                <Ionicons name="cart-outline" size={26} color={Royal.pureWhite} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

// ═════════════════════════════════════════════════════════
// POST VIDEO
// ═════════════════════════════════════════════════════════
const PostVideo: React.FC<{ ad: any }> = ({ ad }) => {
  const [muted, setMuted] = useState(true);
  const sources = pickVideoSources(ad);
  const primary = sources[0] || '';

  const player = useActiveVideoPlayer(primary, true, {
    loop: true,
    muted: true,
  });

  useEffect(() => {
    if (player) player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!player || sources.length < 2) return;
    const sub = player.addListener?.('statusChange', (s: any) => {
      if (s?.status === 'error' && sources[1]) {
        try {
          player.replace(sources[1]);
          player.play();
        } catch {}
      }
    });
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [player, sources[0], sources[1], ad._id]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => setMuted((m) => !m)}
      style={styles.postMedia}
    >
      <VideoView
        player={player}
        style={styles.postMedia}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      <View style={styles.postMuteIcon} pointerEvents="none">
        <Ionicons
          name={muted ? 'volume-mute' : 'volume-high'}
          size={16}
          color={Royal.pureWhite}
        />
      </View>
    </TouchableOpacity>
  );
};

const PostMedia: React.FC<{
  ad: any; isActive: boolean; onPress: (ad: any) => void;
}> = ({ ad, isActive, onPress }) => {
  const isVideo = ad.mediaType === 'video' && !!pickVideoSource(ad);

  if (!isVideo) {
    return (
      <TouchableOpacity activeOpacity={1} onPress={() => onPress(ad)} style={styles.postMedia}>
        <ExpoImage
          source={{ uri: ad.image }}
          style={styles.postMedia}
          contentFit="cover"
          recyclingKey={String(ad._id)}
          transition={150}
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    );
  }

  if (isActive) return <PostVideo ad={ad} />;

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => onPress(ad)} style={styles.postMedia}>
      <VideoThumbnail
        videoUri={ad.video || pickVideoSource(ad)}
        fallbackImage={ad.thumbnail || ad.image}
        style={styles.postMedia}
        recyclingKey={String(ad._id)}
        enabled={true}
      />
    </TouchableOpacity>
  );
};

// ═════════════════════════════════════════════════════════
// AD FEED POST
// ═════════════════════════════════════════════════════════
export const AdFeedPost: React.FC<{
  ad: any;
  isActive: boolean;
  onPress: (ad: any) => void;
  onOpenShop: (vendor: any) => void;
  onOpenProfile: (userId: string) => void;
  onLike: (adId: string) => void;
  onOpenComments: (ad: any) => void;
  onShareTracked: (adId: string) => void;
  isSaved: boolean;
  isSaving?: boolean;
  onToggleSave: (ad: any) => void;
  userId?: string;
  isOwner?: boolean;
  isArchived?: boolean;
  isOnline?: boolean;
  isFollowing?: boolean;
  onToggleFollow?: (userId: string, following: boolean) => void;
  onTogglePin?: (adId: string) => void;
  onArchive?: (adId: string) => void;
  onUnarchive?: (adId: string) => void;
  onDelete?: (adId: string) => void;
  onEdit?: (ad: any) => void;
  onViewAnalytics?: (adId: string) => void;
  onCopyLink?: (ad: any) => void;
  onReport?: (ad: any) => void;
  onHide?: (ad: any) => void;
}> = React.memo(
  ({
    ad, isActive, onPress, onOpenShop, onOpenProfile, onLike, onOpenComments,
    onShareTracked, isSaved, isSaving = false, onToggleSave, userId,
    isOwner = false, isArchived = false,
    isOnline = false, isFollowing = false, onToggleFollow,
    onTogglePin, onArchive, onUnarchive, onDelete, onEdit, onViewAnalytics,
    onCopyLink, onReport, onHide,
  }) => {
    const [isSharing, setIsSharing] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [isFollowingLocal, setIsFollowingLocal] = useState(isFollowing);
    const [followBusy, setFollowBusy] = useState(false);
    const [optionsVisible, setOptionsVisible] = useState(false);

    useEffect(() => {
      setIsFollowingLocal(isFollowing);
    }, [isFollowing]);

    const isUserPost = ad.postType === 'user';
    const isVendorPost = ad.postType === 'vendor';
    const vendor = ad.vendorId && typeof ad.vendorId === 'object' ? ad.vendorId : null;
    const user = ad.userId && typeof ad.userId === 'object' ? ad.userId : null;

    const vendorPhone = vendor?.phone || '';
    const vendorAddress = vendor?.address || null;
    const vendorName = vendor?.shopName || vendor?.name || ad.vendorName || 'Vendor';
    const userName = user?.name || ad.userName || 'User';

    const displayName = isUserPost ? userName : vendorName;
    const displayAvatar = isUserPost
      ? user?.avatar || user?.profilePic || ad.userAvatar || ''
      : vendor?.avatar || vendor?.logo || vendor?.profileImage || '';

    const ownerIdentityId = isUserPost
      ? String(user?._id || ad.userId || '')
      : String(vendor?._id || ad.vendorId || '');

    const isMe = userId && ownerIdentityId === String(userId);

    const liked = !!ad.likedByMe;
    const likedCount = ad.likesCount ?? 0;
    const createdAt = ad.createdAt || ad.updatedAt || ad.created_at;

    const handleLike = () => {
      if (isLiking) return;
      setIsLiking(true);
      onLike(ad._id);
      setTimeout(() => setIsLiking(false), 250);
    };

    const handleShare = () => shareAd(ad, setIsSharing, userId, () => onShareTracked(ad._id));

    const handleOpenProfile = () => {
      if (ownerIdentityId) {
        onOpenProfile(ownerIdentityId);
        return;
      }
      if (!isUserPost && vendor) {
        onOpenShop(vendor);
      }
    };

    const handleOpenShopExplicit = () => {
      if (isUserPost) {
        if (ownerIdentityId) onOpenProfile(ownerIdentityId);
        return;
      }
      if (!vendor) return Alert.alert('No Vendor', 'Vendor unavailable.');
      onOpenShop(vendor);
    };

    const handleCall = () => {
      if (!vendorPhone) return Alert.alert('No Phone', 'No phone on file.');
      Linking.openURL(`tel:${vendorPhone}`).catch(() =>
        Alert.alert('Error', 'Unable to make call')
      );
    };

    const handleWhatsApp = () => {
      if (!vendorPhone) return Alert.alert('No Phone', 'No phone on file.');
      const msg = `Hi, I'm interested in "${ad.title || 'your post'}" on BLuxury.`;
      Linking.openURL(
        `whatsapp://send?phone=${vendorPhone}&text=${encodeURIComponent(msg)}`
      ).catch(() => Alert.alert('Error', 'WhatsApp not installed.'));
    };

    const handleLocation = () => {
      const lat = vendorAddress?.latitude;
      const lng = vendorAddress?.longitude;
      const fullAddress = buildFullAddress(vendorAddress);
      if (lat && lng) {
        const scheme = Platform.select({
          ios: `maps:0,0?q=${encodeURIComponent(vendorName)}@${lat},${lng}`,
          android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(vendorName)})`,
        })!;
        const fb = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        Linking.canOpenURL(scheme).then((ok) => Linking.openURL(ok ? scheme : fb));
      } else if (fullAddress) {
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
        );
      } else {
        Alert.alert('No Location', 'No address on file.');
      }
    };

    const handleBuy = () => openBuyLink(ad, userId, () => onPress(ad));

    const handleToggleFollowPress = async () => {
      if (followBusy || isMe || !ownerIdentityId) return;
      const next = !isFollowingLocal;
      setIsFollowingLocal(next);
      setFollowBusy(true);
      try {
        onToggleFollow?.(ownerIdentityId, next);
      } finally {
        setTimeout(() => setFollowBusy(false), 300);
      }
    };

    const avatarRecyclingKey = `avatar:${ownerIdentityId || ad._id}`;

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.postHeaderLeft}
            onPress={handleOpenProfile}
            activeOpacity={0.8}
          >
            <View style={styles.postAvatarWrap}>
              {displayAvatar ? (
                <ExpoImage
                  source={{ uri: displayAvatar }}
                  style={styles.postAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={avatarRecyclingKey}
                  transition={120}
                />
              ) : (
                <View style={[styles.postAvatar, styles.postAvatarFallback]}>
                  <Text style={styles.postAvatarLetter}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {(isUserPost || isVendorPost) && isOnline ? (
                <View style={styles.postOnlineDot} />
              ) : null}
              {isVendorPost ? (
                <View style={styles.postVendorBadge}>
                  <Ionicons name="storefront" size={9} color={Royal.pureWhite} />
                </View>
              ) : null}
            </View>
            <View style={styles.postHeaderText}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.postUsername} numberOfLines={1}>
                  {displayName}
                </Text>
                {isVendorPost ? (
                  <View style={styles.postVendorChip}>
                    <Text style={styles.postVendorChipText}>SHOP</Text>
                  </View>
                ) : null}
                {ad.isPinned ? (
                  <Ionicons name="pin" size={12} color={Royal.textSecondary} />
                ) : null}
              </View>
              <Text style={styles.postSubtitle} numberOfLines={1}>
                {ad.category
                  ? `${ad.category} • ${isVendorPost ? 'Shop' : 'Post'}`
                  : isVendorPost
                  ? 'Shop'
                  : 'Post'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.postHeaderRight}>
            {!isMe && !isOwner && onToggleFollow ? (
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  isFollowingLocal && styles.followBtnActive,
                ]}
                onPress={handleToggleFollowPress}
                disabled={followBusy}
                activeOpacity={0.7}
              >
                {followBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowingLocal ? Royal.pureBlack : Royal.pureWhite}
                  />
                ) : (
                  <>
                    <Ionicons
                      name={isFollowingLocal ? 'checkmark' : 'person-add'}
                      size={12}
                      color={isFollowingLocal ? Royal.pureBlack : Royal.pureWhite}
                    />
                    <Text
                      style={[
                        styles.followBtnText,
                        isFollowingLocal && styles.followBtnTextActive,
                      ]}
                    >
                      {isFollowingLocal ? 'Following' : 'Follow'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.postMenuBtn}
              onPress={() => setOptionsVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={Royal.pureBlack} />
            </TouchableOpacity>
          </View>
        </View>

        <PostMedia ad={ad} isActive={isActive} onPress={onPress} />

        <View style={styles.postActionsRow}>
          <View style={styles.postActionsLeft}>
            <TouchableOpacity
              onPress={handleLike}
              activeOpacity={0.7}
              style={styles.postActionBtn}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={26}
                color={liked ? Royal.redLike : Royal.pureBlack}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onOpenComments(ad)}
              activeOpacity={0.7}
              style={styles.postActionBtn}
            >
              <Ionicons name="chatbubble-outline" size={24} color={Royal.pureBlack} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              disabled={isSharing}
              activeOpacity={0.7}
              style={styles.postActionBtn}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={Royal.pureBlack} />
              ) : (
                <Ionicons name="paper-plane-outline" size={24} color={Royal.pureBlack} />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => onToggleSave(ad)}
            activeOpacity={0.7}
            style={styles.postActionBtn}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Royal.pureBlack} />
            ) : (
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isSaved ? Royal.bookmarkActive : Royal.pureBlack}
              />
            )}
          </TouchableOpacity>
        </View>

        {likedCount > 0 ? (
          <Text style={styles.postLikes}>
            {formatCount(likedCount)} {likedCount === 1 ? 'like' : 'likes'}
          </Text>
        ) : null}

        <Text style={styles.postCaption}>
          <Text style={styles.postCaptionUser} onPress={handleOpenProfile}>
            {displayName}{' '}
          </Text>
          {ad.title ? (
            <Text style={styles.postCaptionUser}>{ad.title} </Text>
          ) : null}
          {ad.description || ''}
        </Text>

        {ad.commentsCount > 0 ? (
          <TouchableOpacity onPress={() => onOpenComments(ad)}>
            <Text style={styles.postViewComments}>
              View all {formatCount(ad.commentsCount)} comments
            </Text>
          </TouchableOpacity>
        ) : null}

        {createdAt ? (
          <Text style={styles.postTime}>{timeAgo(createdAt)}</Text>
        ) : null}

        {isVendorPost ? (
          <View style={styles.postAdActions}>
            <TouchableOpacity
              style={styles.postAdBtn}
              onPress={handleOpenShopExplicit}
              activeOpacity={0.7}
            >
              <Ionicons name="storefront-outline" size={20} color={Royal.pureBlack} />
              <Text style={styles.postAdBtnLabel}>Shop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.postAdBtn}
              onPress={handleCall}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={20} color={Royal.pureBlack} />
              <Text style={styles.postAdBtnLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.postAdBtn}
              onPress={handleWhatsApp}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={20} color={Royal.pureBlack} />
              <Text style={styles.postAdBtnLabel}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.postAdBtn}
              onPress={handleLocation}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={20} color={Royal.pureBlack} />
              <Text style={styles.postAdBtnLabel}>Map</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.postAdBtn}
              onPress={handleBuy}
              activeOpacity={0.7}
            >
              <Ionicons name="cart-outline" size={20} color={Royal.pureBlack} />
              <Text style={styles.postAdBtnLabel}>Buy</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <PostOptionsSheet
          visible={optionsVisible}
          onClose={() => setOptionsVisible(false)}
          ad={ad}
          isOwner={isOwner}
          isPinned={!!ad.isPinned}
          isArchived={isArchived}
          onTogglePin={onTogglePin}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
          onEdit={onEdit}
          onViewAnalytics={onViewAnalytics}
          onCopyLink={onCopyLink}
          onReport={onReport}
          onHide={onHide}
        />
      </View>
    );
  }
);

// ═════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  gridCard: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_HEIGHT,
    backgroundColor: Royal.offWhite,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: { width: '100%', height: '100%' },
  gridVideo: { width: '100%', height: '100%' },
  gridVideoBadge: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22,
    borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  gridPinnedBadge: {
    position: 'absolute', top: 6, left: 6, width: 18, height: 18,
    borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  gridOnlineBadge: {
    position: 'absolute', top: 6, left: 6, width: 12, height: 12,
    borderRadius: 6, backgroundColor: Royal.onlineGreen,
    borderWidth: 2, borderColor: Royal.pureWhite,
  },
  gridOverlay: {
    position: 'absolute', right: 6, bottom: 6,
    paddingHorizontal: 6, paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  gridOverlayText: { color: Royal.pureWhite, fontSize: 10, fontWeight: '700' },

  postCard: {
    backgroundColor: Royal.pureWhite, paddingBottom: 8, marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Royal.borderLight,
  },
  postHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  postHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postAvatarWrap: { position: 'relative' },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Royal.offWhite },
  postAvatarFallback: {
    justifyContent: 'center', alignItems: 'center', backgroundColor: Royal.pureBlack,
  },
  postAvatarLetter: { color: Royal.pureWhite, fontSize: 16, fontWeight: '800' },
  postOnlineDot: {
    position: 'absolute', bottom: -1, right: -1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Royal.onlineGreen,
    borderWidth: 2, borderColor: Royal.pureWhite,
  },
  postVendorBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Royal.vendorPurple,
    borderWidth: 2, borderColor: Royal.pureWhite,
    justifyContent: 'center', alignItems: 'center',
  },
  postHeaderText: { flex: 1, justifyContent: 'center' },
  postUsername: { color: Royal.pureBlack, fontSize: 14, fontWeight: '700' },
  postVendorChip: {
    backgroundColor: Royal.vendorPurple,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 4,
  },
  postVendorChipText: {
    color: Royal.pureWhite, fontSize: 8, fontWeight: '800', letterSpacing: 0.5,
  },
  postSubtitle: { color: Royal.textSecondary, fontSize: 12, marginTop: 1 },
  postMenuBtn: { padding: 4, marginLeft: 4 },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 8, backgroundColor: Royal.pureBlack,
    minWidth: 76, justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: Royal.offWhite,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  followBtnText: { color: Royal.pureWhite, fontSize: 12, fontWeight: '700' },
  followBtnTextActive: { color: Royal.pureBlack },

  postMedia: {
    width: SCREEN_WIDTH, height: POST_MEDIA_HEIGHT, backgroundColor: Royal.offWhite,
  },
  postMuteIcon: {
    position: 'absolute', top: 12, right: 12, width: 30, height: 30,
    borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  postActionsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 10,
  },
  postActionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  postActionBtn: { padding: 2 },
  postLikes: {
    color: Royal.pureBlack, fontSize: 14, fontWeight: '700',
    paddingHorizontal: 12, paddingTop: 8,
  },
  postCaption: {
    color: Royal.pureBlack, fontSize: 14, lineHeight: 19,
    paddingHorizontal: 12, paddingTop: 4,
  },
  postCaptionUser: { fontWeight: '700' },
  postViewComments: {
    color: Royal.textSecondary, fontSize: 13,
    paddingHorizontal: 12, paddingTop: 4,
  },
  postTime: {
    color: Royal.textTertiary, fontSize: 11, paddingHorizontal: 12,
    paddingTop: 4, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  postAdActions: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingTop: 12, paddingHorizontal: 8, marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Royal.borderLight,
  },
  postAdBtn: { alignItems: 'center', padding: 6, minWidth: 56 },
  postAdBtnLabel: {
    color: Royal.pureBlack, fontSize: 11, fontWeight: '600', marginTop: 4,
  },

  reelCard: {
    width: '100%', backgroundColor: '#0A3D2B', overflow: 'hidden', position: 'relative',
  },
  reelImage: { width: '100%', height: '100%' },
  reelImageWrap: { width: '100%', height: '100%' },
  reelSoundToggle: {
    position: 'absolute', top: 12, right: 12, width: 40, height: 40,
    borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', zIndex: 20,
  },
  reelOverlay: { position: 'absolute', left: 0, right: 0, bottom: 40, padding: 16 },
  reelContent: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  reelTextContainer: { flex: 1, marginRight: 12, alignItems: 'flex-start' },
  textPill: {
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, marginTop: 6,
    alignSelf: 'flex-start', maxWidth: '100%',
  },
  reelTitle: { color: Royal.pureWhite, fontSize: 18, fontWeight: '800' },
  reelDescription: { color: Royal.pureWhite, fontSize: 13, fontWeight: '500' },
  ownerPill: {
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', maxWidth: '100%',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  ownerName: { color: Royal.pureWhite, fontSize: 13, fontWeight: '600' },
  reelOnlineDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Royal.onlineGreen,
  },
  reelFollowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: Royal.pureWhite,
    marginTop: 6,
  },
  reelFollowBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  reelFollowBtnText: { color: Royal.pureBlack, fontSize: 11, fontWeight: '700' },
  reelFollowBtnTextActive: { color: Royal.pureBlack },
  reelCategoryBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6,
  },
  reelCategoryText: { color: Royal.pureBlack, fontSize: 12, fontWeight: '700' },
  reelActions: { alignItems: 'center', gap: 16, paddingBottom: 10 },
  reelActionButton: { alignItems: 'center', justifyContent: 'center', minWidth: 46 },
  reelActionCount: {
    color: Royal.pureWhite, fontSize: 11, fontWeight: '700', marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});