// src/screens/NotificationsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';

import { AppDispatch } from '../store';
import {
  fetchNotifications,
  markNotificationsRead,
  selectNotifications,
} from '../features/adSlice';
import { UserProfileModal } from '../components/AdModals';

const Royal = {
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
  offWhite: '#F4F4F6',
  textSecondary: 'rgba(11,11,15,0.55)',
  textTertiary: 'rgba(11,11,15,0.40)',
  borderLight: 'rgba(0,0,0,0.08)',
  redAlert: '#FF3040',
  blueAccent: '#0095F6',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const timeAgo = (date?: string) => {
  if (!date) return '';
  const t = new Date(date).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return 'now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
};

const isToday = (date?: string) => {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};
const isThisWeek = (date?: string) => {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (isNaN(t)) return false;
  const diff = Date.now() - t;
  return diff < 7 * 24 * 60 * 60 * 1000 && !isToday(date);
};
const isThisMonth = (date?: string) => {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (isNaN(t)) return false;
  const diff = Date.now() - t;
  return diff < 30 * 24 * 60 * 60 * 1000 && !isThisWeek(date) && !isToday(date);
};

const buildActorLine = (group: any[]) => {
  const names = group.map((g) => g.actorName || 'Someone');
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
};

const groupNotifications = (items: any[]) => {
  const groups: any[] = [];
  const used = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    if (used.has(a._id)) continue;

    const sameKind = items.filter((b) => {
      if (used.has(b._id)) return false;
      if (b.type !== a.type) return false;
      if ((b.adId || '') !== (a.adId || '')) return false;
      const dt = Math.abs(
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      return dt < 60 * 60 * 1000;
    });

    sameKind.forEach((x) => used.add(x._id));
    groups.push({
      id: a._id,
      type: a.type,
      adId: a.adId,
      actors: sameKind,
      actorName: a.actorName,
      actorAvatar: a.actorAvatar,
      thumbnail: a.thumbnail,
      text: a.text,
      createdAt: a.createdAt,
      count: sameKind.length,
    });
  }

  return groups;
};

const iconFor = (type: string) => {
  switch (type) {
    case 'like':           return { name: 'heart', color: Royal.redAlert };
    case 'comment':        return { name: 'chatbubble', color: Royal.pureBlack };
    case 'follow':         return { name: 'person', color: Royal.blueAccent };
    case 'message':        return { name: 'paper-plane', color: Royal.blueAccent };
    case 'story_reaction': return { name: 'happy', color: '#FFD700' };
    case 'story_like':     return { name: 'heart', color: Royal.redAlert };
    case 'share':          return { name: 'paper-plane', color: Royal.pureBlack };
    case 'mention':        return { name: 'at', color: Royal.blueAccent };
    default:               return { name: 'notifications', color: '#888' };
  }
};

const labelFor = (type: string) => {
  switch (type) {
    case 'like':           return 'liked your post';
    case 'comment':        return 'commented';
    case 'follow':         return 'started following you';
    case 'message':        return 'sent you a message';
    case 'story_reaction': return 'reacted to your story';
    case 'story_like':     return 'liked your story';
    case 'share':          return 'shared your post';
    case 'mention':        return 'mentioned you';
    default:               return 'interacted with you';
  }
};

// ─────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────
const NotificationsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const notifications = useSelector(selectNotifications);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'mentions'>('all');

  // Profile modal target
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await dispatch(fetchNotifications());
      await dispatch(markNotificationsRead());
      setLoading(false);
    })();
  }, [dispatch]);

  const sections = useMemo(() => {
    const groups = groupNotifications(notifications);
    const today: any[] = [];
    const week: any[] = [];
    const month: any[] = [];
    const earlier: any[] = [];

    groups.forEach((g) => {
      if (isToday(g.createdAt)) today.push(g);
      else if (isThisWeek(g.createdAt)) week.push(g);
      else if (isThisMonth(g.createdAt)) month.push(g);
      else earlier.push(g);
    });

    const result: { title: string; data: any[] }[] = [];
    if (today.length) result.push({ title: 'Today', data: today });
    if (week.length) result.push({ title: 'This Week', data: week });
    if (month.length) result.push({ title: 'This Month', data: month });
    if (earlier.length) result.push({ title: 'Earlier', data: earlier });
    return result;
  }, [notifications]);

  // Tap on actor avatar/name → open user profile
  const openActorProfile = (actor: any) => {
    const uid = actor?.actorId || actor?._id;
    if (!uid) return;
    setProfileUserId(String(uid));
    setShowProfileModal(true);
  };

  // Tap on thumbnail → open the post
  const openPost = (adId?: string) => {
    if (!adId) return;
    navigation.navigate('PostDetails', { adId });
  };

  const renderRow = ({ item }: { item: any }) => {
    const icon = iconFor(item.type);
    const firstActor = item.actors[0] || {};
    const actorCount = item.actors.length;
    const thumbUri = item.thumbnail || item.actors[0]?.thumbnail || '';

    return (
      <View style={styles.row}>
        {/* LEFT: tappable avatar(s) + type badge */}
        <TouchableOpacity
          style={styles.avatarColumn}
          onPress={() => openActorProfile(firstActor)}
          activeOpacity={0.8}
        >
          <View style={styles.avatarStack}>
            {actorCount > 1 ? (
              <>
                <View style={[styles.stackedAvatar, styles.stackedBack]}>
                  {item.actors[1]?.actorAvatar ? (
                    <ExpoImage
                      source={{ uri: item.actors[1].actorAvatar }}
                      style={styles.stackedAvatarImg}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.stackedAvatarImg, styles.avatarFallback]}>
                      <Text style={styles.avatarLetter}>
                        {(item.actors[1]?.actorName || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[styles.stackedAvatar, styles.stackedFront]}>
                  {firstActor.actorAvatar ? (
                    <ExpoImage
                      source={{ uri: firstActor.actorAvatar }}
                      style={styles.stackedAvatarImg}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.stackedAvatarImg, styles.avatarFallback]}>
                      <Text style={styles.avatarLetter}>
                        {(firstActor.actorName || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : firstActor.actorAvatar ? (
              <ExpoImage
                source={{ uri: firstActor.actorAvatar }}
                style={styles.singleAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.singleAvatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>
                  {(firstActor.actorName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.typeBadge, { backgroundColor: icon.color }]}>
            <Ionicons name={icon.name as any} size={10} color={Royal.pureWhite} />
          </View>
        </TouchableOpacity>

        {/* MIDDLE: tappable text (name → profile) */}
        <TouchableOpacity
          style={styles.textColumn}
          onPress={() => openActorProfile(firstActor)}
          activeOpacity={0.8}
        >
          <Text style={styles.rowText} numberOfLines={2}>
            <Text style={styles.bold}>{buildActorLine(item.actors)}</Text>{' '}
            {labelFor(item.type)}
            {item.text && (item.type === 'comment' || item.type === 'message') ? (
              <Text style={styles.secondaryText}>: {item.text}</Text>
            ) : null}
            {item.text && item.type === 'story_reaction' ? (
              <Text style={styles.secondaryText}> {item.text}</Text>
            ) : null}
            <Text style={styles.timeText}> {timeAgo(item.createdAt)}</Text>
          </Text>
        </TouchableOpacity>

        {/* RIGHT: thumbnail (opens post) or Follow button */}
        {item.type === 'follow' ? (
          <TouchableOpacity
            style={styles.followBackBtn}
            onPress={() => openActorProfile(firstActor)}
            activeOpacity={0.8}
          >
            <Text style={styles.followBackBtnText}>Follow</Text>
          </TouchableOpacity>
        ) : thumbUri ? (
          <TouchableOpacity onPress={() => openPost(item.adId)} activeOpacity={0.8}>
            <ExpoImage
              source={{ uri: thumbUri }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: Royal.offWhite }]} />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Royal.pureBlack} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => {}}
        >
          <Ionicons name="settings-outline" size={22} color={Royal.pureBlack} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setTab('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
            All
          </Text>
          {tab === 'all' ? <View style={styles.tabUnderline} /> : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setTab('mentions')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, tab === 'mentions' && styles.tabTextActive]}>
            Mentions
          </Text>
          {tab === 'mentions' ? <View style={styles.tabUnderline} /> : null}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Royal.pureBlack} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="notifications-outline" size={44} color={Royal.pureBlack} />
          </View>
          <Text style={styles.emptyTitle}>Activity</Text>
          <Text style={styles.emptyText}>
            When someone interacts with your posts, you'll see it here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item: any) => item.id}
          renderItem={renderRow}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        />
      )}

      <UserProfileModal
        visible={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setProfileUserId(null);
        }}
        userId={profileUserId}
        onOpenComments={(ad: any) => {
          setShowProfileModal(false);
          if (ad?._id) navigation.navigate('PostDetails', { adId: ad._id });
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.pureWhite },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Royal.borderLight,
  },
  backBtn: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    color: Royal.pureBlack, fontSize: 20, fontWeight: '800',
  },

  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Royal.borderLight,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    justifyContent: 'center', position: 'relative',
  },
  tabText: {
    color: Royal.textSecondary, fontSize: 14, fontWeight: '600',
  },
  tabTextActive: {
    color: Royal.pureBlack, fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: '25%', right: '25%',
    height: 2, backgroundColor: Royal.pureBlack, borderRadius: 1,
  },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: Royal.pureWhite,
  },
  sectionTitle: {
    color: Royal.pureBlack, fontSize: 15, fontWeight: '800',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  avatarColumn: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarStack: {
    width: 52, height: 52,
    justifyContent: 'center', alignItems: 'center',
  },
  singleAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Royal.offWhite,
  },
  stackedAvatar: {
    width: 38, height: 38, borderRadius: 19,
    position: 'absolute',
    borderWidth: 2, borderColor: Royal.pureWhite,
    overflow: 'hidden',
  },
  stackedBack: { top: 0, right: 0 },
  stackedFront: { bottom: 0, left: 0 },
  stackedAvatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Royal.pureBlack,
  },
  avatarLetter: {
    color: Royal.pureWhite, fontSize: 14, fontWeight: '800',
  },
  typeBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Royal.redAlert,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Royal.pureWhite,
  },

  textColumn: {
    flex: 1,
    paddingHorizontal: 12,
  },
  rowText: {
    color: Royal.pureBlack, fontSize: 14, lineHeight: 19,
  },
  bold: { fontWeight: '700' },
  secondaryText: { color: Royal.textSecondary },
  timeText: {
    color: Royal.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },

  thumbnail: {
    width: 48, height: 48, borderRadius: 4,
    backgroundColor: Royal.offWhite,
  },
  followBackBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: Royal.offWhite,
    borderRadius: 8,
    borderWidth: 1, borderColor: Royal.borderLight,
  },
  followBackBtnText: {
    color: Royal.pureBlack, fontSize: 13, fontWeight: '700',
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconWrap: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2, borderColor: Royal.pureBlack,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: Royal.pureBlack, fontSize: 20, fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: Royal.textSecondary, fontSize: 14,
    textAlign: 'center', lineHeight: 20, maxWidth: 280,
  },
});

export default NotificationsScreen;