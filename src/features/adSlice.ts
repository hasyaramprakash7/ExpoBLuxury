// src/features/adSlice.ts
import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../userScreens/utils/api';

// ═════════════════════════════════════════════════════════
// 🔍 GLOBAL LOGGER
// ═════════════════════════════════════════════════════════
const SLICE_TAG = '🟨[adSlice]';

const log = (...args: any[]) => {
  if (__DEV__) console.log(SLICE_TAG, ...args);
};
const logWarn = (...args: any[]) => {
  if (__DEV__) console.warn(SLICE_TAG, '⚠️', ...args);
};
const logError = (...args: any[]) => {
  if (__DEV__) console.error(SLICE_TAG, '❌', ...args);
};

// 🔍 HLS URL LOGGER — dedicated tracker
const logHls = (adId: string, hlsUrl: string, video: string, source: string) => {
  if (!__DEV__) return;
  const hasHls = !!hlsUrl && hlsUrl.endsWith('.m3u8');
  const hasVideo = !!video;
  console.log(
    `${SLICE_TAG} 🎬 HLS[${source}] id=${adId?.slice(-8) || '?'} ` +
      `hls=${hasHls ? '✔' : '✖'} mp4=${hasVideo ? '✔' : '✖'} ` +
      `url=${hlsUrl?.slice(0, 60) || 'none'}...`
  );
};

// 🔍 STORY HLS LOGGER
const logStoryHls = (storyId: string, hlsUrl: string, media: string, source: string) => {
  if (!__DEV__) return;
  const hasHls = !!hlsUrl && hlsUrl.endsWith('.m3u8');
  console.log(
    `${SLICE_TAG} 📖 STORY-HLS[${source}] id=${storyId?.slice(-8) || '?'} ` +
      `hls=${hasHls ? '✔' : '✖'} media=${media ? '✔' : '✖'}`
  );
};

// ─────────────────────────────────────────────────────────────
// AUTH TOKEN HANDLING
// ─────────────────────────────────────────────────────────────
type ActiveRole = 'user' | 'vendor';

let cachedActiveRole: ActiveRole | null = null;
let cachedUserToken: string | null = null;
let cachedVendorToken: string | null = null;
let cacheStamp = 0;
const CACHE_TTL_MS = 30 * 1000;

const pick = (raw: string | null | undefined) =>
  raw && raw !== 'null' && raw !== 'undefined' ? raw : null;

const readTokens = async (): Promise<{
  userToken: string | null;
  vendorToken: string | null;
}> => {
  const now = Date.now();
  if (
    cachedUserToken !== undefined &&
    cachedVendorToken !== undefined &&
    now - cacheStamp < CACHE_TTL_MS
  ) {
    return { userToken: cachedUserToken, vendorToken: cachedVendorToken };
  }

  const [u, v] = await Promise.all([
    AsyncStorage.getItem('token').catch(() => null),
    AsyncStorage.getItem('vendorToken').catch(() => null),
  ]);

  cachedUserToken = pick(u);
  cachedVendorToken = pick(v);
  cacheStamp = now;
  return { userToken: cachedUserToken, vendorToken: cachedVendorToken };
};

const resolveAuthHeaders = async (
  activeRole?: ActiveRole | null
): Promise<Record<string, string>> => {
  const { userToken, vendorToken } = await readTokens();
  const role = activeRole || cachedActiveRole;

  let token: string | null = null;
  if (role === 'vendor' && vendorToken) token = vendorToken;
  else if (role === 'user' && userToken) token = userToken;
  else token = vendorToken || userToken || null;

  if (!token) {
    log('🔑 Auth[resolve] no token found');
    return {};
  }
  log(`🔑 Auth[resolve] role=${role || 'auto'} token=${token.slice(0, 12)}...`);
  return { Authorization: `Bearer ${token}` };
};

export const setActiveRoleForAds = (role: ActiveRole | null | undefined) => {
  if (role === cachedActiveRole) return;
  log(`🔄 setActiveRoleForAds: ${cachedActiveRole} → ${role}`);
  cachedActiveRole = role || null;
  cacheStamp = 0;
};

export const invalidateAuthCache = () => {
  log('🔄 invalidateAuthCache');
  cachedUserToken = null as any;
  cachedVendorToken = null as any;
  cacheStamp = 0;
};

const anyAuthHeaders = async (): Promise<Record<string, string>> =>
  resolveAuthHeaders(cachedActiveRole);

const EMPTY_ARRAY: any[] = [];
const EMPTY_PROFILE: any = null;

// ═════════════════════════════════════════════════════════════
// TYPES (unchanged)
// ═════════════════════════════════════════════════════════════
export type IdentityType = 'User' | 'Vendor';

export interface AdComment {
  _id: string;
  userId: any;
  userType?: IdentityType;
  userName: string;
  userAvatar?: string;
  text: string;
  likesCount: number;
  likedByMe?: boolean;
  parentId?: string | null;
  replies?: AdComment[];
  repliesCount?: number;
  createdAt: string;
}

export interface Ad {
  _id: string;
  title: string;
  description: string;
  category: string;
  tags?: string[];
  image: string;
  video?: string;
  hlsUrl?: string;
  thumbnail?: string;
  mediaType?: 'image' | 'video' | 'carousel';
  link: string;
  isActive: boolean;
  isProductAd: boolean;
  postKind?: 'post' | 'reel' | 'story' | 'igtv';
  postType?: 'vendor' | 'user';
  ownerId?: any;
  ownerType?: IdentityType;
  vendorId: any;
  vendorName: string;
  userId?: any;
  userName?: string;
  userAvatar?: string;
  location?: any;
  audio?: any;
  collaborators?: any[];
  taggedUsers?: any[];
  createdAt: string;
  likesCount?: number;
  viewsCount?: number;
  sharesCount?: number;
  savesCount?: number;
  reachCount?: number;
  impressionsCount?: number;
  commentsCount?: number;
  comments?: AdComment[];
  likedByMe?: boolean;
  savedByMe?: boolean;
  isSaved?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  engagementScore?: number;
  trendingScore?: number;
}

export interface Story {
  _id: string;
  userId: any;
  userType?: IdentityType;
  userName: string;
  userAvatar: string;
  media: string;
  mediaType: 'image' | 'video';
  hlsUrl?: string;  // ✅ NEW: HLS URL for video stories
  caption: string;
  viewersCount: number;
  hasSeen?: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface UserProfileStats {
  _id?: string;
  userId?: string;
  identityId?: string;
  identityType?: IdentityType;
  userType?: IdentityType;
  name: string;
  shopName?: string;
  username?: string;
  bio: string;
  website?: string;
  avatar: string;
  logo?: string;
  shopImage?: string;
  isVerified: boolean;
  isPrivate: boolean;
  isBusiness: boolean;
  category?: string;
  businessType?: string;
  phone?: string;
  email?: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  reelsCount: number;
  storiesCount: number;
  highlightsCount: number;
  totalLikesCount: number;
  totalViewsCount: number;
  totalCommentsCount: number;
  totalSharesCount: number;
  viewsLast30Days: number;
  reachLast30Days: number;
  isFollowing?: boolean;
  isMe?: boolean;
  user?: any;
}

export interface Notification {
  _id: string;
  userId: string;
  userType?: IdentityType;
  type: string;
  actorId?: string;
  actorType?: IdentityType;
  actorName?: string;
  actorAvatar?: string;
  adId?: string;
  text?: string;
  thumbnail?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationParticipant {
  userId: string;
  userType?: IdentityType;
  name: string;
  avatar: string;
  phone?: string;
}

export interface Conversation {
  _id: string;
  participant: ConversationParticipant;
  lastMessage: any;
  lastMessageAt: string;
  unreadCount: number;
  isGroup: boolean;
  isPinned: boolean;
  isMuted: boolean;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderType?: IdentityType;
  senderName: string;
  senderAvatar: string;
  receiverId: string;
  receiverType?: IdentityType;
  text: string;
  media?: string;
  mediaType: string;
  sharedAdId?: string;
  isRead: boolean;
  isDeleted?: boolean;
  createdAt: string;
}

export interface ReachAnalytics {
  adId: string;
  period: string;
  totals: {
    views: number;
    reach: number;
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    profileVisits: number;
    followerGrowth: number;
  };
  demographics: {
    ageGroups: Record<string, number>;
    gender: { male: number; female: number; other: number };
    topLocations: { name: string; count: number }[];
  };
  trafficSources: {
    home: number;
    explore: number;
    profile: number;
    hashtags: number;
    search: number;
    other: number;
  };
  dailyData: any[];
}

export interface SocialUser {
  _id: string;
  name: string;
  avatar?: string;
  username?: string;
  phone?: string;
  type?: IdentityType;
  isFollowing?: boolean;
  isOnline?: boolean;
  followersCount?: number;
  followedAt?: string;
}

interface AdState {
  ads: Ad[];
  activeAds: Ad[];
  feed: Ad[];
  explore: Ad[];
  myPosts: Ad[];
  userPosts: Record<string, Ad[]>;
  archivedPosts: Ad[];

  stories: any[];
  myStories: Story[];
  userStories: Record<string, Story[]>;
  highlights: Record<string, any[]>;

  userProfile: UserProfileStats | null;
  userProfiles: Record<string, UserProfileStats>;
  followers: Record<string, SocialUser[]>;
  following: Record<string, SocialUser[]>;
  suggestedUsers: SocialUser[];

  notifications: Notification[];
  unreadNotificationsCount: number;
  conversations: Conversation[];
  messages: Record<string, Message[]>;

  identitySearchResults: SocialUser[];
  identitySearchQuery: string;
  identitySearchLoading: boolean;
  resolvedIdentities: Record<string, SocialUser>;

  reachAnalytics: Record<string, ReachAnalytics>;
  userAnalytics: ReachAnalytics | null;

  trendingHashtags: any[];
  hashtagSearchResults: any[];
  hashtagPosts: Record<string, Ad[]>;

  searchResults: {
    users: any[];
    vendors?: any[];
    posts: Ad[];
    hashtags: any[];
  };

  savedCollections: any[];
  activities: any[];

  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  commentsByAd: Record<string, AdComment[]>;
  commentsLoading: boolean;
  activeAdsPage: number;
  activeAdsHasMore: boolean;
  activeAdsLoaded: boolean;
  activeAdsLoadingMore: boolean;
  feedPage: number;
  feedHasMore: boolean;
  feedLoaded: boolean;
  feedLoadingMore: boolean;
}

interface RootState {
  ads: AdState;
}

export const PAGE_SIZE = 20;

const initialState: AdState = {
  ads: [],
  activeAds: [],
  feed: [],
  explore: [],
  myPosts: [],
  userPosts: {},
  archivedPosts: [],
  stories: [],
  myStories: [],
  userStories: {},
  highlights: {},
  userProfile: null,
  userProfiles: {},
  followers: {},
  following: {},
  suggestedUsers: [],
  notifications: [],
  unreadNotificationsCount: 0,
  conversations: [],
  messages: {},
  identitySearchResults: [],
  identitySearchQuery: '',
  identitySearchLoading: false,
  resolvedIdentities: {},
  reachAnalytics: {},
  userAnalytics: null,
  trendingHashtags: [],
  hashtagSearchResults: [],
  hashtagPosts: {},
  searchResults: { users: [], vendors: [], posts: [], hashtags: [] },
  savedCollections: [],
  activities: [],
  loading: false,
  refreshing: false,
  loadingMore: false,
  error: null,
  commentsByAd: {},
  commentsLoading: false,
  activeAdsPage: 0,
  activeAdsHasMore: true,
  activeAdsLoaded: false,
  activeAdsLoadingMore: false,
  feedPage: 0,
  feedHasMore: true,
  feedLoaded: false,
  feedLoadingMore: false,
};

const ensureState = (s: AdState): AdState => {
  if (!Array.isArray(s.ads)) s.ads = [];
  if (!Array.isArray(s.activeAds)) s.activeAds = [];
  if (!Array.isArray(s.feed)) s.feed = [];
  if (!Array.isArray(s.explore)) s.explore = [];
  if (!Array.isArray(s.myPosts)) s.myPosts = [];
  if (!Array.isArray(s.archivedPosts)) s.archivedPosts = [];
  if (!s.userPosts || typeof s.userPosts !== 'object') s.userPosts = {};
  if (!Array.isArray(s.stories)) s.stories = [];
  if (!Array.isArray(s.myStories)) s.myStories = [];
  if (!s.userStories || typeof s.userStories !== 'object') s.userStories = {};
  if (!s.highlights || typeof s.highlights !== 'object') s.highlights = {};
  if (!s.userProfiles || typeof s.userProfiles !== 'object') s.userProfiles = {};
  if (!s.followers || typeof s.followers !== 'object') s.followers = {};
  if (!s.following || typeof s.following !== 'object') s.following = {};
  if (!Array.isArray(s.suggestedUsers)) s.suggestedUsers = [];
  if (!Array.isArray(s.notifications)) s.notifications = [];
  if (!Array.isArray(s.conversations)) s.conversations = [];
  if (!s.messages || typeof s.messages !== 'object') s.messages = {};
  if (!Array.isArray(s.identitySearchResults)) s.identitySearchResults = [];
  if (typeof s.identitySearchQuery !== 'string') s.identitySearchQuery = '';
  if (typeof s.identitySearchLoading !== 'boolean') s.identitySearchLoading = false;
  if (!s.resolvedIdentities || typeof s.resolvedIdentities !== 'object')
    s.resolvedIdentities = {};
  if (!s.reachAnalytics || typeof s.reachAnalytics !== 'object')
    s.reachAnalytics = {};
  if (!Array.isArray(s.trendingHashtags)) s.trendingHashtags = [];
  if (!Array.isArray(s.hashtagSearchResults)) s.hashtagSearchResults = [];
  if (!s.hashtagPosts || typeof s.hashtagPosts !== 'object') s.hashtagPosts = {};
  if (!s.searchResults || typeof s.searchResults !== 'object') {
    s.searchResults = { users: [], vendors: [], posts: [], hashtags: [] };
  }
  if (!Array.isArray(s.savedCollections)) s.savedCollections = [];
  if (!Array.isArray(s.activities)) s.activities = [];
  if (!s.commentsByAd || typeof s.commentsByAd !== 'object')
    s.commentsByAd = {};
  return s;
};

const patchAdInAllLists = (
  state: AdState,
  adId: string,
  patch: (ad: Ad) => void
) => {
  const apply = (arr?: Ad[]) => {
    if (!Array.isArray(arr)) return;
    const idx = arr.findIndex((a) => a?._id === adId);
    if (idx !== -1) patch(arr[idx]);
  };
  apply(state.ads);
  apply(state.activeAds);
  apply(state.feed);
  apply(state.explore);
  apply(state.myPosts);
  apply(state.archivedPosts);
  Object.keys(state.userPosts || {}).forEach((uid) => {
    if (Array.isArray(state.userPosts[uid])) apply(state.userPosts[uid]);
  });
  Object.keys(state.hashtagPosts || {}).forEach((tag) => {
    if (Array.isArray(state.hashtagPosts[tag])) apply(state.hashtagPosts[tag]);
  });
};

const replaceAdInAllLists = (state: AdState, updated: Ad) => {
  if (!updated?._id) return;
  const replace = (arr?: Ad[]) => {
    if (!Array.isArray(arr)) return;
    const idx = arr.findIndex((a) => a?._id === updated._id);
    if (idx !== -1) arr[idx] = { ...arr[idx], ...updated };
  };
  replace(state.ads);
  replace(state.activeAds);
  replace(state.feed);
  replace(state.explore);
  replace(state.myPosts);
  replace(state.archivedPosts);
  Object.keys(state.userPosts || {}).forEach((uid) => {
    if (Array.isArray(state.userPosts[uid])) replace(state.userPosts[uid]);
  });
};

const removeAdFromAllLists = (state: AdState, adId: string) => {
  if (!adId) return;
  const filter = (arr?: Ad[]) =>
    Array.isArray(arr) ? arr.filter((a) => a?._id !== adId) : arr;
  state.ads = filter(state.ads) || [];
  state.activeAds = filter(state.activeAds) || [];
  state.feed = filter(state.feed) || [];
  state.explore = filter(state.explore) || [];
  state.myPosts = filter(state.myPosts) || [];
  state.archivedPosts = filter(state.archivedPosts) || [];
  if (state.userPosts && typeof state.userPosts === 'object') {
    Object.keys(state.userPosts).forEach((uid) => {
      const arr = state.userPosts[uid];
      if (Array.isArray(arr)) {
        state.userPosts[uid] = arr.filter((a) => a?._id !== adId);
      }
    });
  }
};

// ═════════════════════════════════════════════════════════
// 🔍 THUNK LOGGER WRAPPER
// ═════════════════════════════════════════════════════════
const logThunk = (name: string, args?: any) => {
  if (!__DEV__) return;
  log(`🚀 ${name} → start`, args ? JSON.stringify(args).slice(0, 200) : '');
};
const logThunkOk = (name: string, result?: any) => {
  if (!__DEV__) return;
  const summary =
    typeof result === 'object' && result !== null
      ? `keys=${Object.keys(result).join(',')}`
      : String(result).slice(0, 100);
  log(`✅ ${name} → ok | ${summary}`);
};
const logThunkFail = (name: string, err: any) => {
  if (!__DEV__) return;
  logError(`❌ ${name} → failed | ${err?.message || err}`);
};

// ═════════════════════════════════════════════════════════
// FEED THUNKS
// ═════════════════════════════════════════════════════════

export const fetchPersonalizedFeed = createAsyncThunk(
  'ads/fetchPersonalizedFeed',
  async (
    params: { page?: number; limit?: number; type?: string } | undefined,
    { rejectWithValue }
  ) => {
    const NAME = 'fetchPersonalizedFeed';
    logThunk(NAME, params);
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? PAGE_SIZE;
      const qp = new URLSearchParams();
      qp.append('page', String(page));
      qp.append('limit', String(limit));
      if (params?.type) qp.append('type', params.type);
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/feed?${qp.toString()}`, { headers });
      const items = Array.isArray(res.data?.data) ? res.data.data : [];
      const hasMore =
        typeof res.data?.pagination?.hasMore === 'boolean'
          ? res.data.pagination.hasMore
          : items.length >= limit;

      // 🔍 Log first 3 ads HLS status
      items.slice(0, 3).forEach((ad: any) => {
        logHls(ad._id, ad.hlsUrl, ad.video, `${NAME}:page${page}`);
      });

      logThunkOk(NAME, { page, items: items.length, hasMore });
      return { page, limit, items, hasMore };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch feed'
      );
    }
  }
);

export const fetchExploreFeed = createAsyncThunk(
  'ads/fetchExploreFeed',
  async (
    params: { page?: number; limit?: number } | undefined,
    { rejectWithValue }
  ) => {
    const NAME = 'fetchExploreFeed';
    logThunk(NAME, params);
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? PAGE_SIZE;
      const qp = new URLSearchParams();
      qp.append('page', String(page));
      qp.append('limit', String(limit));
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/explore?${qp.toString()}`, { headers });
      const items = Array.isArray(res.data?.data) ? res.data.data : [];
      const hasMore =
        typeof res.data?.pagination?.hasMore === 'boolean'
          ? res.data.pagination.hasMore
          : items.length >= limit;

      items.slice(0, 3).forEach((ad: any) => {
        logHls(ad._id, ad.hlsUrl, ad.video, `${NAME}:page${page}`);
      });

      logThunkOk(NAME, { page, items: items.length, hasMore });
      return { page, limit, items, hasMore };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch explore'
      );
    }
  }
);

export const fetchAds = createAsyncThunk(
  'ads/fetchAll',
  async (params: any, { rejectWithValue }) => {
    const NAME = 'fetchAds';
    logThunk(NAME, params);
    try {
      let url = '/ads';
      const qp = new URLSearchParams();
      if (params?.isActive !== undefined)
        qp.append('isActive', String(params.isActive));
      if (params?.search) qp.append('search', params.search);
      if (params?.vendorId) qp.append('vendorId', params.vendorId);
      if (params?.userId) qp.append('userId', params.userId);
      if (params?.postType) qp.append('postType', params.postType);
      if (params?.postKind) qp.append('postKind', params.postKind);
      const q = qp.toString();
      if (q) url += `?${q}`;
      const headers = await anyAuthHeaders();
      const res = await api.get(url, { headers });
      const data = res.data?.data;
      const items = Array.isArray(data) ? data : [];
      logThunkOk(NAME, { count: items.length });
      return items;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch posts'
      );
    }
  }
);

// ✅ THE MOST IMPORTANT ONE — fetchActiveAds
export const fetchActiveAds = createAsyncThunk(
  'ads/fetchActive',
  async (params: any, { rejectWithValue }) => {
    const NAME = 'fetchActiveAds';
    const t0 = Date.now();
    logThunk(NAME, params);
    try {
      const page = params?.page ?? 1;
      const limit = params?.limit ?? PAGE_SIZE;
      const qp = new URLSearchParams();
      qp.append('page', String(page));
      qp.append('limit', String(limit));
      if (params?.search) qp.append('search', params.search);
      if (params?.postType) qp.append('postType', params.postType);
      if (params?.postKind) qp.append('postKind', params.postKind);
      if (params?.sort) qp.append('sort', params.sort);
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/active?${qp.toString()}`, { headers });
      const items = Array.isArray(res.data?.data) ? res.data.data : [];
      const hasMore =
        typeof res.data?.pagination?.hasMore === 'boolean'
          ? res.data.pagination.hasMore
          : items.length >= limit;

      // 🔍 HLS LOG — Count how many ads have HLS
      let hlsCount = 0;
      let mp4OnlyCount = 0;
      let imageCount = 0;
      let videoCount = 0;

      items.forEach((ad: any) => {
        const isVideo = ad?.mediaType === 'video';
        const hasHls = typeof ad?.hlsUrl === 'string' && ad.hlsUrl.endsWith('.m3u8');
        if (isVideo) {
          videoCount++;
          if (hasHls) hlsCount++;
          else if (ad.video) mp4OnlyCount++;
        } else {
          imageCount++;
        }
      });

      log(
        `🎬 fetchActiveAds[page${page}] bandwidth summary: ` +
          `total=${items.length} video=${videoCount} image=${imageCount} ` +
          `hls=${hlsCount} mp4only=${mp4OnlyCount} ` +
          `(took ${Date.now() - t0}ms)`
      );

      // Log first 5 videos HLS status
      items
        .filter((ad: any) => ad?.mediaType === 'video')
        .slice(0, 5)
        .forEach((ad: any) => {
          logHls(ad._id, ad.hlsUrl, ad.video, `${NAME}:page${page}`);
        });

      if (videoCount > 0 && hlsCount === 0) {
        logWarn(
          `🚨 ${NAME}: FOUND ${videoCount} videos but ZERO have HLS URL! ` +
            `Check Cloudinary eager transform or backend buildHlsUrl!`
        );
      }

      logThunkOk(NAME, { page, items: items.length, hasMore, hlsCount });
      return { page, limit, items, hasMore };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch active posts'
      );
    }
  }
);

export const fetchMyPosts = createAsyncThunk(
  'ads/fetchMyPosts',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchMyPosts';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/my-posts', { headers });
      const data = res.data?.data;
      const items = Array.isArray(data) ? data : [];
      logThunkOk(NAME, { count: items.length });
      return items;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch your posts'
      );
    }
  }
);

export const fetchArchivedPosts = createAsyncThunk(
  'ads/fetchArchivedPosts',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchArchivedPosts';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/my-archive', { headers });
      const data = res.data?.data;
      const items = Array.isArray(data) ? data : [];
      logThunkOk(NAME, { count: items.length });
      return items;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch archived posts'
      );
    }
  }
);

export const fetchUserPosts = createAsyncThunk(
  'ads/fetchUserPosts',
  async (userId: string, { rejectWithValue }) => {
    const NAME = 'fetchUserPosts';
    logThunk(NAME, { userId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/user/${userId}`, { headers });
      const data = res.data?.data;
      const posts = Array.isArray(data) ? data : [];
      logThunkOk(NAME, { userId, count: posts.length });
      return { userId, posts };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch user posts'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// CRUD THUNKS
// ═════════════════════════════════════════════════════════

export const createAd = createAsyncThunk(
  'ads/create',
  async (data: FormData, { rejectWithValue }) => {
    const NAME = 'createAd';
    const t0 = Date.now();
    logThunk(NAME);

    // 🔍 Log FormData contents (dev only)
    if (__DEV__) {
      try {
        const entries = (data as any)._parts || [];
        log(`📦 ${NAME} FormData fields (${entries.length}):`);
        entries.forEach(([key, value]: any) => {
          if (value && typeof value === 'object' && value.uri) {
            log(
              `   ${key}: [FILE] uri=${String(value.uri).slice(0, 60)} type=${value.type} name=${value.name}`
            );
          } else {
            log(`   ${key}: ${String(value).slice(0, 100)}`);
          }
        });
      } catch (e) {
        logWarn(`${NAME} FormData log failed:`, e);
      }
    }

    try {
      const headers = await anyAuthHeaders();
      log(`📡 ${NAME} → POST /ads`);
      log(`📡 ${NAME} → headers: ${JSON.stringify(Object.keys(headers))}`);

      const res = await api.post('/ads', data, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 min for video uploads
      });

      const created = res.data?.data || null;
      const elapsed = Date.now() - t0;

      if (created) {
        log(
          `✅ ${NAME} created in ${elapsed}ms: id=${created._id} ` +
            `type=${created.mediaType} hls=${created.hlsUrl ? '✔' : '✖'} ` +
            `mp4=${created.video ? '✔' : '✖'}`
        );
        logHls(created._id, created.hlsUrl, created.video, NAME);
      } else {
        logWarn(`${NAME} returned null data in ${elapsed}ms`);
      }

      return created;
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      logError(`❌ ${NAME} failed in ${elapsed}ms`);
      logError(`   status:`, err?.response?.status);
      logError(`   statusText:`, err?.response?.statusText);
      logError(`   message:`, err?.message);
      logError(`   code:`, err?.code);

      const respData = err?.response?.data;

      if (respData) {
        if (typeof respData === 'string') {
          logError(`   body (string, first 500):`);
          logError(respData.slice(0, 500));
        } else if (typeof respData === 'object') {
          logError(`   body (json):`);
          logError(JSON.stringify(respData, null, 2).slice(0, 800));
        } else {
          logError(`   body (unknown type):`, String(respData).slice(0, 500));
        }
      } else {
        logError(`   body: <empty>`);
      }

      if (typeof respData === 'string' && respData.includes('<html')) {
        logError(`   🚨 SERVER RETURNED HTML — Express crash!`);
      }

      // 🔍 Extract user-friendly message
      let message = 'Failed to create post';
      if (respData && typeof respData === 'object') {
        message = respData.message || respData.error || message;
      } else if (
        typeof respData === 'string' &&
        !respData.includes('<html') &&
        respData.length < 300
      ) {
        message = respData;
      } else if (err?.message) {
        message = err.message;
      }

      return rejectWithValue(message);
    }
  }
);

export const updateAd = createAsyncThunk(
  'ads/update',
  async ({ id, data }: { id: string; data: FormData }, { rejectWithValue }) => {
    const NAME = 'updateAd';
    logThunk(NAME, { id });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.put(`/ads/${id}`, data, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data?.data || null;
      if (updated) {
        logHls(updated._id, updated.hlsUrl, updated.video, 'updateAd');
      }
      logThunkOk(NAME, { id });
      return updated;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to update post'
      );
    }
  }
);

export const deleteAd = createAsyncThunk(
  'ads/delete',
  async (id: string, { rejectWithValue }) => {
    const NAME = 'deleteAd';
    logThunk(NAME, { id });
    try {
      const headers = await anyAuthHeaders();
      await api.delete(`/ads/${id}`, { headers });
      logThunkOk(NAME, { id });
      return id;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to delete post'
      );
    }
  }
);

export const toggleAdStatus = createAsyncThunk(
  'ads/toggleStatus',
  async (
    { id, isActive }: { id: string; isActive: boolean },
    { rejectWithValue }
  ) => {
    const NAME = 'toggleAdStatus';
    logThunk(NAME, { id, isActive });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.patch(
        `/ads/${id}/toggle`,
        { isActive },
        { headers }
      );
      logThunkOk(NAME);
      return res.data?.data || null;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to toggle post status'
      );
    }
  }
);

export const archivePost = createAsyncThunk(
  'ads/archivePost',
  async (id: string, { rejectWithValue }) => {
    const NAME = 'archivePost';
    logThunk(NAME, { id });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(`/ads/${id}/archive`, {}, { headers });
      logThunkOk(NAME);
      return { id, data: res.data?.data };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to archive post'
      );
    }
  }
);

export const unarchivePost = createAsyncThunk(
  'ads/unarchivePost',
  async (id: string, { rejectWithValue }) => {
    const NAME = 'unarchivePost';
    logThunk(NAME, { id });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(`/ads/${id}/unarchive`, {}, { headers });
      logThunkOk(NAME);
      return { id, data: res.data?.data };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to unarchive post'
      );
    }
  }
);

export const togglePinPost = createAsyncThunk(
  'ads/togglePinPost',
  async (id: string, { rejectWithValue }) => {
    const NAME = 'togglePinPost';
    logThunk(NAME, { id });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(`/ads/${id}/pin`, {}, { headers });
      logThunkOk(NAME);
      return { id, isPinned: !!res.data?.data?.isPinned };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to pin post'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// ENGAGEMENT THUNKS
// ═════════════════════════════════════════════════════════

export const toggleLikeAd = createAsyncThunk(
  'ads/toggleLike',
  async (adId: string, { rejectWithValue }) => {
    const NAME = 'toggleLikeAd';
    logThunk(NAME, { adId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(`/ads/${adId}/like`, {}, { headers });
      logThunkOk(NAME, res.data?.data);
      return res.data?.data as {
        adId: string;
        liked: boolean;
        likesCount: number;
      };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to toggle like'
      );
    }
  }
);

export const toggleSaveAd = createAsyncThunk(
  'ads/toggleSave',
  async (
    { adId, collectionId }: { adId: string; collectionId?: string },
    { rejectWithValue }
  ) => {
    const NAME = 'toggleSaveAd';
    logThunk(NAME, { adId, collectionId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(
        `/ads/${adId}/save`,
        { collectionId },
        { headers }
      );
      logThunkOk(NAME, res.data?.data);
      return res.data?.data as {
        adId: string;
        saved: boolean;
        savesCount: number;
      };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to toggle save'
      );
    }
  }
);

// ✅ THE MOST IMPORTANT ONE — trackAdView (with dedup logging)
export const trackAdView = createAsyncThunk(
  'ads/trackView',
  async (
    payload:
      | string
      | {
          adId: string;
          ageGroup?: string;
          gender?: string;
          location?: string;
          source?: string;
        },
    { rejectWithValue }
  ) => {
    const NAME = 'trackAdView';
    const adId = typeof payload === 'string' ? payload : payload.adId;
    const source = typeof payload === 'string' ? undefined : payload.source;
    log(`👁️ trackAdView → adId=${adId?.slice(-8)} source=${source || 'none'}`);
    try {
      const body =
        typeof payload === 'string'
          ? {}
          : {
              ageGroup: payload.ageGroup,
              gender: payload.gender,
              location: payload.location,
              source: payload.source,
            };
      const headers = await anyAuthHeaders();
      const res = await api.post(`/ads/${adId}/view`, body, { headers });
      const data = res.data?.data as {
        adId: string;
        viewsCount: number;
        reachCount: number;
        impressionsCount: number;
        deduplicated?: boolean;
      };

      // 🔍 Log dedup status
      if (data?.deduplicated) {
        log(
          `🔄 trackAdView DEDUP adId=${adId?.slice(-8)} ` +
            `views=${data.viewsCount} (server-side 30-min skip)`
        );
      } else {
        log(
          `✅ trackAdView COUNTED adId=${adId?.slice(-8)} ` +
            `views=${data.viewsCount} reach=${data.reachCount}`
        );
      }

      return data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to track view'
      );
    }
  }
);

export const trackAdShare = createAsyncThunk(
  'ads/trackShare',
  async (
    { adId, shareType }: { adId: string; shareType?: string },
    { rejectWithValue }
  ) => {
    const NAME = 'trackAdShare';
    logThunk(NAME, { adId, shareType });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(
        `/ads/${adId}/share`,
        { shareType },
        { headers }
      );
      logThunkOk(NAME, res.data?.data);
      return res.data?.data as { adId: string; sharesCount: number };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to track share'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// COMMENTS THUNKS
// ═════════════════════════════════════════════════════════

export const fetchComments = createAsyncThunk(
  'ads/fetchComments',
  async (adId: string, { rejectWithValue }) => {
    const NAME = 'fetchComments';
    logThunk(NAME, { adId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/${adId}/comments`, { headers });
      const data = res.data?.data;
      const comments = Array.isArray(data) ? data : [];
      logThunkOk(NAME, { count: comments.length });
      return { adId, comments: comments as AdComment[] };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to load comments'
      );
    }
  }
);

export const addComment = createAsyncThunk(
  'ads/addComment',
  async (
    { adId, text, parentId }: { adId: string; text: string; parentId?: string },
    { rejectWithValue }
  ) => {
    const NAME = 'addComment';
    logThunk(NAME, { adId, textLen: text?.length, parentId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(
        `/ads/${adId}/comments`,
        { text, parentId },
        { headers }
      );
      logThunkOk(NAME);
      return {
        adId,
        comment: res.data?.data as AdComment,
        commentsCount: (res.data?.commentsCount as number) || 0,
      };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to post comment'
      );
    }
  }
);

export const deleteComment = createAsyncThunk(
  'ads/deleteComment',
  async (
    { adId, commentId }: { adId: string; commentId: string },
    { rejectWithValue }
  ) => {
    const NAME = 'deleteComment';
    logThunk(NAME, { adId, commentId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.delete(`/ads/${adId}/comments/${commentId}`, {
        headers,
      });
      logThunkOk(NAME);
      return {
        adId,
        commentId,
        commentsCount: (res.data?.commentsCount as number) || 0,
      };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to delete comment'
      );
    }
  }
);

export const toggleCommentLike = createAsyncThunk(
  'ads/toggleCommentLike',
  async (
    { adId, commentId }: { adId: string; commentId: string },
    { rejectWithValue }
  ) => {
    const NAME = 'toggleCommentLike';
    logThunk(NAME, { adId, commentId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(
        `/ads/${adId}/comments/${commentId}/like`,
        {},
        { headers }
      );
      logThunkOk(NAME);
      return {
        adId,
        commentId,
        liked: !!res.data?.data?.liked,
        likesCount: (res.data?.data?.likesCount as number) || 0,
      };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to like comment'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// STORIES THUNKS
// ═════════════════════════════════════════════════════════

export const fetchActiveStories = createAsyncThunk(
  'ads/fetchActiveStories',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchActiveStories';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/stories/active', { headers });
      const stories = res.data?.data || [];

      // 🔍 Log story HLS status
      let storyVideoCount = 0;
      let storyHlsCount = 0;
      const allStories: any[] = [];
      stories.forEach((group: any) => {
        if (Array.isArray(group.stories)) {
          allStories.push(...group.stories);
        }
      });
      allStories.forEach((s: any) => {
        if (s.mediaType === 'video') {
          storyVideoCount++;
          if (s.hlsUrl?.endsWith('.m3u8')) storyHlsCount++;
        }
      });

      log(
        `📖 fetchActiveStories: groups=${stories.length} ` +
          `storyVideos=${storyVideoCount} withHLS=${storyHlsCount}`
      );

      allStories
        .filter((s: any) => s.mediaType === 'video')
        .slice(0, 3)
        .forEach((s: any) => {
          logStoryHls(s._id, s.hlsUrl, s.media, `${NAME}`);
        });

      logThunkOk(NAME, { count: stories.length });
      return stories;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch stories'
      );
    }
  }
);

export const fetchMyStories = createAsyncThunk(
  'ads/fetchMyStories',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchMyStories';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/stories/my', { headers });
      const stories = res.data?.data || [];

      // 🔍 Log story HLS status
      stories
        .filter((s: any) => s.mediaType === 'video')
        .slice(0, 3)
        .forEach((s: any) => {
          logStoryHls(s._id, s.hlsUrl, s.media, `${NAME}`);
        });

      logThunkOk(NAME, { count: stories.length });
      return stories;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch your stories'
      );
    }
  }
);

export const fetchStoriesByUserId = createAsyncThunk(
  'ads/fetchStoriesByUserId',
  async (userId: string, { rejectWithValue }) => {
    const NAME = 'fetchStoriesByUserId';
    logThunk(NAME, { userId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/stories/user/${userId}`, { headers });
      const stories = res.data?.data || [];

      // 🔍 Log story HLS status
      stories
        .filter((s: any) => s.mediaType === 'video')
        .slice(0, 3)
        .forEach((s: any) => {
          logStoryHls(s._id, s.hlsUrl, s.media, `${NAME}`);
        });

      logThunkOk(NAME, { count: stories.length });
      return { userId, stories };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch user stories'
      );
    }
  }
);

export const createStory = createAsyncThunk(
  'ads/createStory',
  async (data: FormData, { rejectWithValue }) => {
    const NAME = 'createStory';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post('/ads/stories', data, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      const story = res.data?.data;
      if (story) {
        log(
          `✅ createStory: id=${story._id} type=${story.mediaType} ` +
            `hls=${story.hlsUrl ? '✔' : '✖'}`
        );
        if (story.mediaType === 'video') {
          logStoryHls(story._id, story.hlsUrl, story.media, 'createStory');
        }
      }
      return story;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to create story'
      );
    }
  }
);

export const viewStory = createAsyncThunk(
  'ads/viewStory',
  async (storyId: string, { rejectWithValue }) => {
    const NAME = 'viewStory';
    logThunk(NAME, { storyId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(
        `/ads/stories/${storyId}/view`,
        {},
        { headers }
      );
      logThunkOk(NAME, res.data?.data);
      return { storyId, ...res.data?.data };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to view story'
      );
    }
  }
);

export const reactToStory = createAsyncThunk(
  'ads/reactToStory',
  async (
    { storyId, emoji }: { storyId: string; emoji: string },
    { rejectWithValue }
  ) => {
    const NAME = 'reactToStory';
    logThunk(NAME, { storyId, emoji });
    try {
      const headers = await anyAuthHeaders();
      await api.post(
        `/ads/stories/${storyId}/react`,
        { emoji },
        { headers }
      );
      logThunkOk(NAME);
      return { storyId, emoji };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to react to story'
      );
    }
  }
);

export const deleteStory = createAsyncThunk(
  'ads/deleteStory',
  async (storyId: string, { rejectWithValue }) => {
    const NAME = 'deleteStory';
    logThunk(NAME, { storyId });
    try {
      const headers = await anyAuthHeaders();
      await api.delete(`/ads/stories/${storyId}`, { headers });
      logThunkOk(NAME);
      return storyId;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to delete story'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// HIGHLIGHTS THUNKS
// ═════════════════════════════════════════════════════════

export const fetchHighlights = createAsyncThunk(
  'ads/fetchHighlights',
  async (userId: string, { rejectWithValue }) => {
    const NAME = 'fetchHighlights';
    logThunk(NAME, { userId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/highlights/${userId}`, { headers });
      const highlights = res.data?.data || [];
      logThunkOk(NAME, { count: highlights.length });
      return { userId, highlights };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch highlights'
      );
    }
  }
);

export const createHighlight = createAsyncThunk(
  'ads/createHighlight',
  async (
    data: { name: string; coverImage?: string; storyIds?: string[] },
    { rejectWithValue }
  ) => {
    const NAME = 'createHighlight';
    logThunk(NAME, { name: data?.name, storyCount: data?.storyIds?.length });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post('/ads/highlights', data, { headers });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to create highlight'
      );
    }
  }
);

export const deleteHighlight = createAsyncThunk(
  'ads/deleteHighlight',
  async (highlightId: string, { rejectWithValue }) => {
    const NAME = 'deleteHighlight';
    logThunk(NAME, { highlightId });
    try {
      const headers = await anyAuthHeaders();
      await api.delete(`/ads/highlights/${highlightId}`, { headers });
      logThunkOk(NAME);
      return highlightId;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to delete highlight'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// FOLLOW THUNKS
// ═════════════════════════════════════════════════════════

export const toggleFollow = createAsyncThunk(
  'ads/toggleFollow',
  async (targetUserId: string, { getState, rejectWithValue }) => {
    const NAME = 'toggleFollow';
    logThunk(NAME, { targetUserId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post(
        `/ads/follow/${targetUserId}`,
        {},
        { headers }
      );

      const body = res.data?.data || res.data || {};
      let following: boolean | undefined =
        typeof body.following === 'boolean'
          ? body.following
          : typeof body.isFollowing === 'boolean'
          ? body.isFollowing
          : typeof body.followed === 'boolean'
          ? body.followed
          : undefined;

      if (following === undefined) {
        const state: any = getState();
        const prev =
          state.ads.userProfiles?.[targetUserId]?.isFollowing ??
          state.ads.userProfile?.isFollowing ??
          false;
        following = !prev;
      }

      const followersCount =
        typeof body.followersCount === 'number'
          ? body.followersCount
          : undefined;

      log(`✅ toggleFollow: ${following ? 'FOLLOWED' : 'UNFOLLOWED'}`);
      return { targetUserId, following, followersCount };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to follow'
      );
    }
  }
);

export const fetchFollowers = createAsyncThunk(
  'ads/fetchFollowers',
  async (
    {
      userId,
      page = 1,
      limit = 50,
    }: { userId: string; page?: number; limit?: number },
    { rejectWithValue }
  ) => {
    const NAME = 'fetchFollowers';
    logThunk(NAME, { userId, page, limit });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(
        `/ads/followers/${userId}?page=${page}&limit=${limit}`,
        { headers }
      );
      const followers = (res.data?.data || []) as SocialUser[];
      logThunkOk(NAME, { count: followers.length });
      return { userId, followers, pagination: res.data?.pagination };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch followers'
      );
    }
  }
);

export const fetchFollowing = createAsyncThunk(
  'ads/fetchFollowing',
  async (
    {
      userId,
      page = 1,
      limit = 50,
    }: { userId: string; page?: number; limit?: number },
    { rejectWithValue }
  ) => {
    const NAME = 'fetchFollowing';
    logThunk(NAME, { userId, page, limit });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(
        `/ads/following/${userId}?page=${page}&limit=${limit}`,
        { headers }
      );
      const following = (res.data?.data || []) as SocialUser[];
      logThunkOk(NAME, { count: following.length });
      return { userId, following, pagination: res.data?.pagination };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch following'
      );
    }
  }
);

export const checkFollowing = createAsyncThunk(
  'ads/checkFollowing',
  async (targetUserId: string, { rejectWithValue }) => {
    const NAME = 'checkFollowing';
    logThunk(NAME, { targetUserId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/following/check/${targetUserId}`, {
        headers,
      });
      const following = res.data?.data?.following || false;
      log(`✅ checkFollowing: ${following}`);
      return { targetUserId, following };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to check following'
      );
    }
  }
);

export const fetchSuggestedUsers = createAsyncThunk(
  'ads/fetchSuggestedUsers',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchSuggestedUsers';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/suggested-users', { headers });
      const users = (res.data?.data || []) as SocialUser[];
      logThunkOk(NAME, { count: users.length });
      return users;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch suggestions'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// IDENTITY SEARCH + RESOLVE
// ═════════════════════════════════════════════════════════

export const searchIdentities = createAsyncThunk(
  'ads/searchIdentities',
  async (query: string, { rejectWithValue }) => {
    const NAME = 'searchIdentities';
    logThunk(NAME, { query });
    try {
      const q = String(query || '').trim();
      if (!q) return { query: q, results: [] as SocialUser[] };
      const headers = await anyAuthHeaders();
      const res = await api.get(
        `/ads/identities/search?q=${encodeURIComponent(q)}`,
        { headers }
      );
      const results = (res.data?.data || []) as SocialUser[];
      logThunkOk(NAME, { query: q, count: results.length });
      return { query: q, results };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Search failed'
      );
    }
  }
);

export const resolveIdentities = createAsyncThunk(
  'ads/resolveIdentities',
  async (ids: string[], { rejectWithValue }) => {
    const NAME = 'resolveIdentities';
    logThunk(NAME, { count: ids?.length });
    try {
      const clean = Array.from(
        new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean))
      );
      if (clean.length === 0) return {} as Record<string, SocialUser>;
      const headers = await anyAuthHeaders();
      const res = await api.post(
        '/ads/identities/resolve',
        { ids: clean },
        { headers }
      );
      const data = (res.data?.data || {}) as Record<string, SocialUser>;
      logThunkOk(NAME, { resolved: Object.keys(data).length });
      return data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Resolve failed'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// PROFILE THUNKS
// ═════════════════════════════════════════════════════════

export const fetchUserProfile = createAsyncThunk(
  'ads/fetchUserProfile',
  async (userId: string, { rejectWithValue }) => {
    const NAME = 'fetchUserProfile';
    logThunk(NAME, { userId });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/profile/${userId}`, { headers });
      logThunkOk(NAME, { userId });
      return { userId, profile: res.data?.data };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch profile'
      );
    }
  }
);

export const updateProfileStats = createAsyncThunk(
  'ads/updateProfileStats',
  async (data: any, { rejectWithValue }) => {
    const NAME = 'updateProfileStats';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.put('/ads/profile/stats', data, { headers });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to update profile'
      );
    }
  }
);

export const fetchUserDashboard = createAsyncThunk(
  'ads/fetchUserDashboard',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchUserDashboard';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/dashboard', { headers });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch dashboard'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// ANALYTICS THUNKS
// ═════════════════════════════════════════════════════════

export const fetchReachAnalytics = createAsyncThunk(
  'ads/fetchReachAnalytics',
  async (
    { adId, period = '30d' }: { adId: string; period?: string },
    { rejectWithValue }
  ) => {
    const NAME = 'fetchReachAnalytics';
    logThunk(NAME, { adId, period });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/analytics/${adId}?period=${period}`, {
        headers,
      });
      logThunkOk(NAME);
      return { adId, analytics: res.data?.data };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch analytics'
      );
    }
  }
);

export const fetchUserReachAnalytics = createAsyncThunk(
  'ads/fetchUserReachAnalytics',
  async (
    { period = '30d' }: { period?: string } = {},
    { rejectWithValue }
  ) => {
    const NAME = 'fetchUserReachAnalytics';
    logThunk(NAME, { period });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(`/ads/analytics/user?period=${period}`, {
        headers,
      });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch user analytics'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// HASHTAG THUNKS
// ═════════════════════════════════════════════════════════

export const searchHashtags = createAsyncThunk(
  'ads/searchHashtags',
  async (query: string, { rejectWithValue }) => {
    const NAME = 'searchHashtags';
    logThunk(NAME, { query });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(
        `/ads/hashtags/search?q=${encodeURIComponent(query)}`,
        { headers }
      );
      logThunkOk(NAME);
      return res.data?.data || [];
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to search hashtags'
      );
    }
  }
);

export const fetchTrendingHashtags = createAsyncThunk(
  'ads/fetchTrendingHashtags',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchTrendingHashtags';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/hashtags/trending', { headers });
      logThunkOk(NAME);
      return res.data?.data || [];
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch trending hashtags'
      );
    }
  }
);

export const fetchPostsByHashtag = createAsyncThunk(
  'ads/fetchPostsByHashtag',
  async (
    {
      tag,
      page = 1,
      limit = 20,
    }: { tag: string; page?: number; limit?: number },
    { rejectWithValue }
  ) => {
    const NAME = 'fetchPostsByHashtag';
    logThunk(NAME, { tag, page, limit });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(
        `/ads/hashtags/${tag}/posts?page=${page}&limit=${limit}`,
        { headers }
      );
      logThunkOk(NAME);
      return {
        tag,
        posts: res.data?.data || [],
        pagination: res.data?.pagination,
      };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch hashtag posts'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// SEARCH THUNKS
// ═════════════════════════════════════════════════════════

export const globalSearch = createAsyncThunk(
  'ads/globalSearch',
  async (
    { query, type = 'all' }: { query: string; type?: string },
    { rejectWithValue }
  ) => {
    const NAME = 'globalSearch';
    logThunk(NAME, { query, type });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(
        `/ads/search?q=${encodeURIComponent(query)}&type=${type}`,
        { headers }
      );
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to search'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// NOTIFICATIONS THUNKS
// ═════════════════════════════════════════════════════════

export const fetchNotifications = createAsyncThunk(
  'ads/fetchNotifications',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchNotifications';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/notifications', { headers });
      const data = res.data?.data || [];
      const unreadCount = res.data?.unreadCount || 0;
      logThunkOk(NAME, { count: data.length, unreadCount });
      return { data, unreadCount };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch notifications'
      );
    }
  }
);

export const markNotificationsRead = createAsyncThunk(
  'ads/markNotificationsRead',
  async (notificationIds: string[] | undefined, { rejectWithValue }) => {
    const NAME = 'markNotificationsRead';
    logThunk(NAME, { count: notificationIds?.length });
    try {
      const headers = await anyAuthHeaders();
      await api.put(
        '/ads/notifications/read',
        { notificationIds },
        { headers }
      );
      logThunkOk(NAME);
      return true;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to mark read'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// MESSAGES THUNKS
// ═════════════════════════════════════════════════════════

export const fetchConversations = createAsyncThunk(
  'ads/fetchConversations',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchConversations';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/messages/conversations', { headers });
      const conversations = res.data?.data || [];
      logThunkOk(NAME, { count: conversations.length });
      return conversations;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch conversations'
      );
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'ads/fetchMessages',
  async (
    {
      conversationId,
      page = 1,
      limit = 50,
    }: { conversationId: string; page?: number; limit?: number },
    { rejectWithValue }
  ) => {
    const NAME = 'fetchMessages';
    logThunk(NAME, { conversationId, page, limit });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get(
        `/ads/messages/${conversationId}?page=${page}&limit=${limit}`,
        { headers }
      );
      const messages = res.data?.data || [];
      logThunkOk(NAME, { count: messages.length });
      return { conversationId, messages };
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch messages'
      );
    }
  }
);

export const sendMessage = createAsyncThunk(
  'ads/sendMessage',
  async (data: FormData, { rejectWithValue }) => {
    const NAME = 'sendMessage';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post('/ads/messages/send', data, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to send message'
      );
    }
  }
);

export const getOrCreateConversation = createAsyncThunk(
  'ads/getOrCreateConversation',
  async (
    payload: string | { targetUserId: string; targetUserType?: IdentityType },
    { rejectWithValue }
  ) => {
    const NAME = 'getOrCreateConversation';
    logThunk(NAME, payload);
    try {
      const body =
        typeof payload === 'string' ? { targetUserId: payload } : payload;
      const headers = await anyAuthHeaders();
      const res = await api.post('/ads/messages/conversation', body, {
        headers,
      });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to open conversation'
      );
    }
  }
);

export const deleteMessage = createAsyncThunk(
  'ads/deleteMessage',
  async (messageId: string, { rejectWithValue }) => {
    const NAME = 'deleteMessage';
    logThunk(NAME, { messageId });
    try {
      const headers = await anyAuthHeaders();
      await api.delete(`/ads/messages/${messageId}`, { headers });
      logThunkOk(NAME);
      return messageId;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to delete message'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// SAVED COLLECTIONS THUNKS
// ═════════════════════════════════════════════════════════

export const fetchSavedCollections = createAsyncThunk(
  'ads/fetchSavedCollections',
  async (_, { rejectWithValue }) => {
    const NAME = 'fetchSavedCollections';
    logThunk(NAME);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.get('/ads/saved/collections', { headers });
      logThunkOk(NAME);
      return res.data?.data || [];
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch collections'
      );
    }
  }
);

export const createSavedCollection = createAsyncThunk(
  'ads/createSavedCollection',
  async (data: { name: string; isPrivate?: boolean }, { rejectWithValue }) => {
    const NAME = 'createSavedCollection';
    logThunk(NAME, data);
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post('/ads/saved/collections', data, { headers });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to create collection'
      );
    }
  }
);

export const updateSavedCollection = createAsyncThunk(
  'ads/updateSavedCollection',
  async ({ id, data }: { id: string; data: any }, { rejectWithValue }) => {
    const NAME = 'updateSavedCollection';
    logThunk(NAME, { id });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.put(`/ads/saved/collections/${id}`, data, {
        headers,
      });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to update collection'
      );
    }
  }
);

export const deleteSavedCollection = createAsyncThunk(
  'ads/deleteSavedCollection',
  async (id: string, { rejectWithValue }) => {
    const NAME = 'deleteSavedCollection';
    logThunk(NAME, { id });
    try {
      const headers = await anyAuthHeaders();
      await api.delete(`/ads/saved/collections/${id}`, { headers });
      logThunkOk(NAME);
      return id;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to delete collection'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// ACTIVITY THUNKS
// ═════════════════════════════════════════════════════════

export const fetchActivity = createAsyncThunk(
  'ads/fetchActivity',
  async (
    {
      page = 1,
      limit = 50,
      type,
    }: { page?: number; limit?: number; type?: string } = {},
    { rejectWithValue }
  ) => {
    const NAME = 'fetchActivity';
    logThunk(NAME, { page, limit, type });
    try {
      const headers = await anyAuthHeaders();
      let url = `/ads/activity?page=${page}&limit=${limit}`;
      if (type) url += `&type=${encodeURIComponent(type)}`;
      const res = await api.get(url, { headers });
      logThunkOk(NAME);
      return res.data?.data || [];
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to fetch activity'
      );
    }
  }
);

export const logActivity = createAsyncThunk(
  'ads/logActivity',
  async (
    data: {
      type: string;
      adId?: string;
      targetUserId?: string;
      metadata?: any;
    },
    { rejectWithValue }
  ) => {
    const NAME = 'logActivity';
    logThunk(NAME, { type: data?.type });
    try {
      const headers = await anyAuthHeaders();
      const res = await api.post('/ads/activity/log', data, { headers });
      logThunkOk(NAME);
      return res.data?.data;
    } catch (err: any) {
      logThunkFail(NAME, err);
      return rejectWithValue(
        err.response?.data?.message || 'Failed to log activity'
      );
    }
  }
);

// ═════════════════════════════════════════════════════════
// SLICE
// ═════════════════════════════════════════════════════════

const adSlice = createSlice({
  name: 'ads',
  initialState,
  reducers: {
    clearAds: (state) => {
      ensureState(state);
      state.ads = [];
      state.activeAds = [];
      state.feed = [];
      state.explore = [];
      state.myPosts = [];
      state.userPosts = {};
      state.loading = false;
      state.error = null;
      state.activeAdsPage = 0;
      state.activeAdsHasMore = true;
      state.activeAdsLoaded = false;
      state.activeAdsLoadingMore = false;
      state.feedPage = 0;
      state.feedHasMore = true;
      state.feedLoaded = false;
      state.feedLoadingMore = false;
    },
    resetAds: () => initialState,
    invalidateActiveAds: (state) => {
      ensureState(state);
      state.activeAdsLoaded = false;
      state.activeAdsPage = 0;
      state.activeAdsHasMore = true;
    },
    invalidateFeed: (state) => {
      ensureState(state);
      state.feedLoaded = false;
      state.feedPage = 0;
      state.feedHasMore = true;
    },
    setCommentsForAd: (
      state,
      action: { payload: { adId: string; comments: AdComment[] } }
    ) => {
      ensureState(state);
      state.commentsByAd[action.payload.adId] = Array.isArray(
        action.payload.comments
      )
        ? action.payload.comments
        : [];
    },
    updatePostInLists: (state, action) => {
      ensureState(state);
      const updated = action.payload as Ad;
      if (!updated?._id) return;
      replaceAdInAllLists(state, updated);
    },
    updateMessageInConversation: (
      state,
      action: { payload: { conversationId: string; message: Message } }
    ) => {
      ensureState(state);
      const { conversationId, message } = action.payload;
      const list = state.messages[conversationId] || [];
      const exists = list.some((m) => m._id === message._id);
      if (!exists) {
        state.messages[conversationId] = [...list, message];
      }
    },
    updateConversationLastMessage: (
      state,
      action: {
        payload: {
          conversationId: string;
          lastMessage: any;
          lastMessageAt: string;
        };
      }
    ) => {
      ensureState(state);
      const { conversationId, lastMessage, lastMessageAt } = action.payload;
      const idx = state.conversations.findIndex(
        (c) => c._id === conversationId
      );
      if (idx !== -1) {
        state.conversations[idx] = {
          ...state.conversations[idx],
          lastMessage,
          lastMessageAt,
        };
      }
    },
    incrementUnreadCount: (
      state,
      action: { payload: { conversationId: string; userId: string } }
    ) => {
      ensureState(state);
      const { conversationId, userId } = action.payload;
      const idx = state.conversations.findIndex(
        (c) => c._id === conversationId
      );
      if (
        idx !== -1 &&
        state.conversations[idx].participant?.userId === userId
      ) {
        state.conversations[idx].unreadCount =
          (state.conversations[idx].unreadCount || 0) + 1;
      }
    },
    updateOnlineStatus: () => {},
    incrementUnreadNotifications: (state) => {
      ensureState(state);
      state.unreadNotificationsCount =
        (state.unreadNotificationsCount || 0) + 1;
    },
    prependNotification: (state, action) => {
      ensureState(state);
      if (action.payload) {
        state.notifications = [action.payload, ...state.notifications];
        state.unreadNotificationsCount =
          (state.unreadNotificationsCount || 0) + 1;
      }
    },
    setUserAnalytics: (state, action) => {
      ensureState(state);
      state.userAnalytics = action.payload;
    },
    clearIdentitySearch: (state) => {
      ensureState(state);
      state.identitySearchResults = [];
      state.identitySearchQuery = '';
      state.identitySearchLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Personalized Feed ──
      .addCase(fetchPersonalizedFeed.pending, (state, action) => {
        ensureState(state);
        const page = action.meta.arg?.page ?? 1;
        state.error = null;
        if (page > 1) {
          state.feedLoadingMore = true;
          return;
        }
        if (state.feed.length === 0) state.loading = true;
        else state.refreshing = true;
      })
      .addCase(fetchPersonalizedFeed.fulfilled, (state, action) => {
        ensureState(state);
        const { page, items, hasMore } = action.payload;
        state.loading = false;
        state.refreshing = false;
        state.feedLoadingMore = false;
        if (page <= 1) {
          state.feed = items;
          state.feedPage = 1;
        } else {
          const seen = new Set(state.feed.map((a) => a?._id));
          const fresh = items.filter((a) => a?._id && !seen.has(a._id));
          state.feed = [...state.feed, ...fresh];
          state.feedPage = page;
        }
        state.feedHasMore = hasMore;
        state.feedLoaded = true;
      })
      .addCase(fetchPersonalizedFeed.rejected, (state, action) => {
        ensureState(state);
        state.loading = false;
        state.refreshing = false;
        state.feedLoadingMore = false;
        state.error = action.payload as string;
      })

      // ── Explore ──
      .addCase(fetchExploreFeed.pending, (state) => {
        ensureState(state);
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExploreFeed.fulfilled, (state, action) => {
        ensureState(state);
        state.loading = false;
        state.explore = action.payload.items;
      })
      .addCase(fetchExploreFeed.rejected, (state, action) => {
        ensureState(state);
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── All Ads ──
      .addCase(fetchAds.pending, (state) => {
        ensureState(state);
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAds.fulfilled, (state, action) => {
        ensureState(state);
        state.loading = false;
        state.ads = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchAds.rejected, (state, action) => {
        ensureState(state);
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── Active Ads ──
      .addCase(fetchActiveAds.pending, (state, action) => {
        ensureState(state);
        const page = action.meta.arg?.page ?? 1;
        state.error = null;
        if (page > 1) {
          state.activeAdsLoadingMore = true;
          return;
        }
        if (state.activeAds.length === 0) state.loading = true;
        else state.refreshing = true;
      })
      .addCase(fetchActiveAds.fulfilled, (state, action) => {
        ensureState(state);
        const { page, items, hasMore } = action.payload;
        state.loading = false;
        state.refreshing = false;
        state.activeAdsLoadingMore = false;
        if (page <= 1) {
          state.activeAds = items;
          state.activeAdsPage = 1;
        } else {
          const seen = new Set(state.activeAds.map((a) => a?._id));
          const fresh = items.filter((a) => a?._id && !seen.has(a._id));
          state.activeAds = [...state.activeAds, ...fresh];
          state.activeAdsPage = page;
        }
        state.activeAdsHasMore = hasMore;
        state.activeAdsLoaded = true;
      })
      .addCase(fetchActiveAds.rejected, (state, action) => {
        ensureState(state);
        state.loading = false;
        state.refreshing = false;
        state.activeAdsLoadingMore = false;
        state.error = action.payload as string;
      })

      // ── My Posts ──
      .addCase(fetchMyPosts.pending, (state) => {
        ensureState(state);
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyPosts.fulfilled, (state, action) => {
        ensureState(state);
        state.loading = false;
        state.myPosts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchMyPosts.rejected, (state, action) => {
        ensureState(state);
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── Archived ──
      .addCase(fetchArchivedPosts.fulfilled, (state, action) => {
        ensureState(state);
        state.archivedPosts = Array.isArray(action.payload)
          ? action.payload
          : [];
      })

      // ── User Posts ──
      .addCase(fetchUserPosts.fulfilled, (state, action) => {
        ensureState(state);
        const { userId, posts } = action.payload;
        if (userId) state.userPosts[userId] = Array.isArray(posts) ? posts : [];
      })

      // ── Create ──
      .addCase(createAd.fulfilled, (state, action) => {
        ensureState(state);
        const created = action.payload as Ad | null;
        if (!created?._id) return;
        state.ads = [created, ...state.ads];
        state.feed = [created, ...state.feed];
        if (created.isActive)
          state.activeAds = [created, ...state.activeAds];
        state.myPosts = [created, ...state.myPosts];
      })

      // ── Update ──
      .addCase(updateAd.fulfilled, (state, action) => {
        ensureState(state);
        const updated = action.payload as Ad | null;
        if (!updated?._id) return;
        replaceAdInAllLists(state, updated);
      })

      // ── Delete ──
      .addCase(deleteAd.fulfilled, (state, action) => {
        ensureState(state);
        const id = action.payload;
        if (!id) return;
        removeAdFromAllLists(state, id);
        if (state.commentsByAd) delete state.commentsByAd[id];
      })

      // ── Toggle Status ──
      .addCase(toggleAdStatus.fulfilled, (state, action) => {
        ensureState(state);
        const updated = action.payload as Ad | null;
        if (!updated?._id) return;
        replaceAdInAllLists(state, updated);
        const activeIdx = state.activeAds.findIndex(
          (a) => a?._id === updated._id
        );
        if (updated.isActive) {
          if (activeIdx === -1)
            state.activeAds = [updated, ...state.activeAds];
          else state.activeAds[activeIdx] = updated;
        } else if (activeIdx !== -1) {
          state.activeAds = state.activeAds.filter(
            (a) => a?._id !== updated._id
          );
        }
      })

      // ── Archive ──
      .addCase(archivePost.fulfilled, (state, action) => {
        ensureState(state);
        const { id, data } = action.payload;
        const ad = [...state.myPosts, ...state.activeAds].find(
          (a) => a?._id === id
        );
        if (ad) {
          const archivedAd = {
            ...ad,
            ...(data || {}),
            isArchived: true,
            isActive: false,
          };
          state.archivedPosts = [archivedAd, ...state.archivedPosts];
        }
        removeAdFromAllLists(state, id);
      })

      // ── Unarchive ──
      .addCase(unarchivePost.fulfilled, (state, action) => {
        ensureState(state);
        const { id, data } = action.payload;
        state.archivedPosts = state.archivedPosts.filter(
          (a) => a._id !== id
        );
        if (data?._id) {
          state.myPosts = [data, ...state.myPosts];
          if (data.isActive) state.activeAds = [data, ...state.activeAds];
        }
      })

      // ── Pin ──
      .addCase(togglePinPost.fulfilled, (state, action) => {
        ensureState(state);
        const { id, isPinned } = action.payload;
        patchAdInAllLists(state, id, (ad) => {
          ad.isPinned = isPinned;
        });
        state.myPosts = [...state.myPosts].sort(
          (a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
        );
      })

      // ── Like (optimistic) ──
      .addCase(toggleLikeAd.pending, (state, action) => {
        ensureState(state);
        const adId = action.meta.arg;
        patchAdInAllLists(state, adId, (ad) => {
          ad.likedByMe = !ad.likedByMe;
          ad.likesCount = Math.max(
            0,
            (ad.likesCount || 0) + (ad.likedByMe ? 1 : -1)
          );
        });
      })
      .addCase(toggleLikeAd.fulfilled, (state, action) => {
        ensureState(state);
        const { adId, liked, likesCount } = action.payload;
        patchAdInAllLists(state, adId, (ad) => {
          ad.likedByMe = liked;
          ad.likesCount = likesCount;
        });
      })
      .addCase(toggleLikeAd.rejected, (state, action) => {
        ensureState(state);
        const adId = action.meta.arg;
        patchAdInAllLists(state, adId, (ad) => {
          ad.likedByMe = !ad.likedByMe;
          ad.likesCount = Math.max(
            0,
            (ad.likesCount || 0) + (ad.likedByMe ? 1 : -1)
          );
        });
      })

      // ── Save ──
      .addCase(toggleSaveAd.fulfilled, (state, action) => {
        ensureState(state);
        const { adId, saved, savesCount } = action.payload;
        patchAdInAllLists(state, adId, (ad) => {
          ad.savedByMe = saved;
          ad.savesCount = savesCount;
        });
      })

      // ── Track View ──
      .addCase(trackAdView.fulfilled, (state, action) => {
        ensureState(state);
        const { adId, viewsCount, reachCount, impressionsCount } =
          action.payload;
        patchAdInAllLists(state, adId, (ad) => {
          ad.viewsCount = viewsCount;
          if (reachCount !== undefined) ad.reachCount = reachCount;
          if (impressionsCount !== undefined)
            ad.impressionsCount = impressionsCount;
        });
      })

      // ── Track Share ──
      .addCase(trackAdShare.fulfilled, (state, action) => {
        ensureState(state);
        const { adId, sharesCount } = action.payload;
        patchAdInAllLists(state, adId, (ad) => {
          ad.sharesCount = sharesCount;
        });
      })

      // ── Comments ──
      .addCase(fetchComments.pending, (state) => {
        ensureState(state);
        state.commentsLoading = true;
      })
      .addCase(fetchComments.fulfilled, (state, action) => {
        ensureState(state);
        state.commentsLoading = false;
        state.commentsByAd[action.payload.adId] = action.payload.comments;
      })
      .addCase(fetchComments.rejected, (state) => {
        ensureState(state);
        state.commentsLoading = false;
      })

      .addCase(addComment.fulfilled, (state, action) => {
        ensureState(state);
        const { adId, comment, commentsCount } = action.payload;
        if (!comment) return;
        const existing = state.commentsByAd[adId] || [];
        state.commentsByAd[adId] = [comment, ...existing];
        patchAdInAllLists(state, adId, (ad) => {
          ad.commentsCount = commentsCount;
        });
      })

      .addCase(deleteComment.fulfilled, (state, action) => {
        ensureState(state);
        const { adId, commentId, commentsCount } = action.payload;
        const list = state.commentsByAd[adId];
        if (Array.isArray(list)) {
          state.commentsByAd[adId] = list.filter(
            (c) => c._id !== commentId && c.parentId !== commentId
          );
        }
        patchAdInAllLists(state, adId, (ad) => {
          ad.commentsCount = commentsCount;
        });
      })

      .addCase(toggleCommentLike.fulfilled, (state, action) => {
        ensureState(state);
        const { adId, commentId, liked, likesCount } = action.payload;
        const list = state.commentsByAd[adId];
        if (!Array.isArray(list)) return;
        const idx = list.findIndex((c) => c._id === commentId);
        if (idx !== -1) {
          list[idx].likedByMe = liked;
          list[idx].likesCount = likesCount;
        }
      })

      // ── Stories ──
      .addCase(fetchActiveStories.fulfilled, (state, action) => {
        ensureState(state);
        state.stories = action.payload;
      })
      .addCase(fetchMyStories.fulfilled, (state, action) => {
        ensureState(state);
        state.myStories = action.payload;
      })
      .addCase(fetchStoriesByUserId.fulfilled, (state, action) => {
        ensureState(state);
        state.userStories[action.payload.userId] = action.payload.stories;
      })
      .addCase(createStory.fulfilled, (state, action) => {
        ensureState(state);
        if (action.payload)
          state.myStories = [action.payload, ...state.myStories];
      })
      .addCase(viewStory.fulfilled, (state, action) => {
        ensureState(state);
        const { storyId, viewersCount } = action.payload;
        state.stories = state.stories.map((s: any) => {
          if (s.stories) {
            return {
              ...s,
              stories: s.stories.map((st: any) =>
                st._id === storyId
                  ? { ...st, viewersCount, hasSeen: true }
                  : st
              ),
            };
          }
          return s;
        });
      })
      .addCase(deleteStory.fulfilled, (state, action) => {
        ensureState(state);
        state.myStories = state.myStories.filter(
          (s) => s._id !== action.payload
        );
      })

      // ── Follow (polymorphic + optimistic rollback on reject) ──
      .addCase(toggleFollow.pending, (state, action) => {
        ensureState(state);
        const targetUserId = String(action.meta.arg || '');
        if (!targetUserId) return;

        if (
          state.userProfile &&
          state.userProfile.userId === targetUserId
        ) {
          const next = !state.userProfile.isFollowing;
          state.userProfile.isFollowing = next;
          state.userProfile.followersCount = Math.max(
            0,
            (state.userProfile.followersCount || 0) + (next ? 1 : -1)
          );
        }
        Object.keys(state.userProfiles).forEach((uid) => {
          if (state.userProfiles[uid]?.userId === targetUserId) {
            const prev = !!state.userProfiles[uid].isFollowing;
            state.userProfiles[uid].isFollowing = !prev;
          }
        });
        Object.keys(state.followers).forEach((uid) => {
          state.followers[uid] = state.followers[uid].map(
            (u: SocialUser) =>
              u._id === targetUserId
                ? { ...u, isFollowing: !u.isFollowing }
                : u
          );
        });
        Object.keys(state.following).forEach((uid) => {
          state.following[uid] = state.following[uid].map(
            (u: SocialUser) =>
              u._id === targetUserId
                ? { ...u, isFollowing: !u.isFollowing }
                : u
          );
        });
        state.suggestedUsers = state.suggestedUsers.map((u: SocialUser) =>
          u._id === targetUserId
            ? { ...u, isFollowing: !u.isFollowing }
            : u
        );
      })
      .addCase(toggleFollow.fulfilled, (state, action) => {
        ensureState(state);
        const { targetUserId, following, followersCount } = action.payload;

        if (
          state.userProfile &&
          state.userProfile.userId === targetUserId
        ) {
          state.userProfile.isFollowing = following;
          if (typeof followersCount === 'number') {
            state.userProfile.followersCount = followersCount;
          }
        }

        Object.keys(state.userProfiles).forEach((uid) => {
          if (state.userProfiles[uid]?.userId === targetUserId) {
            state.userProfiles[uid].isFollowing = following;
            if (typeof followersCount === 'number') {
              state.userProfiles[uid].followersCount = followersCount;
            }
          }
        });

        Object.keys(state.followers).forEach((uid) => {
          state.followers[uid] = state.followers[uid].map(
            (u: SocialUser) =>
              u._id === targetUserId
                ? {
                    ...u,
                    isFollowing: following,
                    ...(typeof followersCount === 'number'
                      ? { followersCount }
                      : {}),
                  }
                : u
          );
        });
        Object.keys(state.following).forEach((uid) => {
          state.following[uid] = state.following[uid].map(
            (u: SocialUser) =>
              u._id === targetUserId ? { ...u, isFollowing: following } : u
          );
        });
        state.suggestedUsers = state.suggestedUsers.map((u: SocialUser) =>
          u._id === targetUserId ? { ...u, isFollowing: following } : u
        );
      })
      .addCase(toggleFollow.rejected, (state, action) => {
        ensureState(state);
        const targetUserId = String(action.meta.arg || '');
        if (!targetUserId) return;

        if (
          state.userProfile &&
          state.userProfile.userId === targetUserId
        ) {
          const next = !state.userProfile.isFollowing;
          state.userProfile.isFollowing = next;
          state.userProfile.followersCount = Math.max(
            0,
            (state.userProfile.followersCount || 0) + (next ? 1 : -1)
          );
        }
        Object.keys(state.userProfiles).forEach((uid) => {
          if (state.userProfiles[uid]?.userId === targetUserId) {
            const prev = !!state.userProfiles[uid].isFollowing;
            state.userProfiles[uid].isFollowing = !prev;
          }
        });
        Object.keys(state.followers).forEach((uid) => {
          state.followers[uid] = state.followers[uid].map(
            (u: SocialUser) =>
              u._id === targetUserId
                ? { ...u, isFollowing: !u.isFollowing }
                : u
          );
        });
        Object.keys(state.following).forEach((uid) => {
          state.following[uid] = state.following[uid].map(
            (u: SocialUser) =>
              u._id === targetUserId
                ? { ...u, isFollowing: !u.isFollowing }
                : u
          );
        });
        state.suggestedUsers = state.suggestedUsers.map((u: SocialUser) =>
          u._id === targetUserId
            ? { ...u, isFollowing: !u.isFollowing }
            : u
        );
      })

      .addCase(fetchFollowers.fulfilled, (state, action) => {
        ensureState(state);
        state.followers[action.payload.userId] = action.payload.followers;
      })
      .addCase(fetchFollowing.fulfilled, (state, action) => {
        ensureState(state);
        state.following[action.payload.userId] = action.payload.following;
      })
      .addCase(fetchSuggestedUsers.fulfilled, (state, action) => {
        ensureState(state);
        state.suggestedUsers = action.payload;
      })

      // ── Identity Search ──
      .addCase(searchIdentities.pending, (state, action) => {
        ensureState(state);
        state.identitySearchLoading = true;
        state.identitySearchQuery = String(action.meta.arg || '');
      })
      .addCase(searchIdentities.fulfilled, (state, action) => {
        ensureState(state);
        state.identitySearchLoading = false;
        if (state.identitySearchQuery === action.payload.query) {
          state.identitySearchResults = action.payload.results;
        }
      })
      .addCase(searchIdentities.rejected, (state) => {
        ensureState(state);
        state.identitySearchLoading = false;
        state.identitySearchResults = [];
      })

      // ── Resolve Identities ──
      .addCase(resolveIdentities.fulfilled, (state, action) => {
        ensureState(state);
        const payload = action.payload || {};
        Object.keys(payload).forEach((id) => {
          state.resolvedIdentities[id] = {
            ...(state.resolvedIdentities[id] || {}),
            ...payload[id],
          };
        });
      })

      // ── Profile ──
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        ensureState(state);
        const { userId, profile } = action.payload;
        state.userProfiles[userId] = profile;
        state.userProfile = profile;
      })
      .addCase(updateProfileStats.fulfilled, (state, action) => {
        ensureState(state);
        if (action.payload) {
          state.userProfile = action.payload;
          if (action.payload.userId)
            state.userProfiles[action.payload.userId] = action.payload;
        }
      })
      .addCase(fetchUserDashboard.fulfilled, (state, action) => {
        ensureState(state);
        if (action.payload?.stats) state.userProfile = action.payload.stats;
      })

      // ── Analytics ──
      .addCase(fetchReachAnalytics.fulfilled, (state, action) => {
        ensureState(state);
        state.reachAnalytics[action.payload.adId] =
          action.payload.analytics;
      })
      .addCase(fetchUserReachAnalytics.fulfilled, (state, action) => {
        ensureState(state);
        state.userAnalytics = action.payload;
      })

      // ── Hashtags ──
      .addCase(searchHashtags.fulfilled, (state, action) => {
        ensureState(state);
        state.hashtagSearchResults = action.payload;
      })
      .addCase(fetchTrendingHashtags.fulfilled, (state, action) => {
        ensureState(state);
        state.trendingHashtags = action.payload;
      })
      .addCase(fetchPostsByHashtag.fulfilled, (state, action) => {
        ensureState(state);
        state.hashtagPosts[action.payload.tag] = action.payload.posts;
      })

      // ── Search ──
      .addCase(globalSearch.fulfilled, (state, action) => {
        ensureState(state);
        state.searchResults = action.payload || {
          users: [],
          vendors: [],
          posts: [],
          hashtags: [],
        };
      })

      // ── Notifications ──
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        ensureState(state);
        state.notifications = action.payload.data;
        state.unreadNotificationsCount = action.payload.unreadCount;
      })
      .addCase(markNotificationsRead.fulfilled, (state) => {
        ensureState(state);
        state.notifications = state.notifications.map((n) => ({
          ...n,
          isRead: true,
        }));
        state.unreadNotificationsCount = 0;
      })

      // ── Messages ──
      .addCase(fetchConversations.fulfilled, (state, action) => {
        ensureState(state);
        state.conversations = action.payload;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        ensureState(state);
        state.messages[action.payload.conversationId] =
          action.payload.messages;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        ensureState(state);
        const msg = action.payload as Message;
        if (msg?.conversationId) {
          const list = state.messages[msg.conversationId] || [];
          const exists = list.some((m) => m._id === msg._id);
          if (!exists) state.messages[msg.conversationId] = [...list, msg];
        }
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        ensureState(state);
        const messageId = action.payload;
        Object.keys(state.messages).forEach((convId) => {
          state.messages[convId] = state.messages[convId].map((m) =>
            m._id === messageId
              ? {
                  ...m,
                  isDeleted: true,
                  text: 'This message was deleted',
                }
              : m
          );
        });
      })

      // ── Highlights ──
      .addCase(fetchHighlights.fulfilled, (state, action) => {
        ensureState(state);
        state.highlights[action.payload.userId] = action.payload.highlights;
      })
      .addCase(createHighlight.fulfilled, (state, action) => {
        ensureState(state);
        const highlight = action.payload;
        if (highlight?.userId) {
          const existing = state.highlights[highlight.userId] || [];
          state.highlights[highlight.userId] = [highlight, ...existing];
        }
      })
      .addCase(deleteHighlight.fulfilled, (state, action) => {
        ensureState(state);
        const highlightId = action.payload;
        Object.keys(state.highlights).forEach((userId) => {
          state.highlights[userId] = state.highlights[userId].filter(
            (h: any) => h._id !== highlightId
          );
        });
      })

      // ── Saved Collections ──
      .addCase(fetchSavedCollections.fulfilled, (state, action) => {
        ensureState(state);
        state.savedCollections = action.payload;
      })
      .addCase(createSavedCollection.fulfilled, (state, action) => {
        ensureState(state);
        if (action.payload)
          state.savedCollections = [
            action.payload,
            ...state.savedCollections,
          ];
      })
      .addCase(updateSavedCollection.fulfilled, (state, action) => {
        ensureState(state);
        const updated = action.payload;
        if (updated?._id) {
          const idx = state.savedCollections.findIndex(
            (c: any) => c._id === updated._id
          );
          if (idx !== -1) state.savedCollections[idx] = updated;
        }
      })
      .addCase(deleteSavedCollection.fulfilled, (state, action) => {
        ensureState(state);
        state.savedCollections = state.savedCollections.filter(
          (c: any) => c._id !== action.payload
        );
      })

      // ── Activity ──
      .addCase(fetchActivity.fulfilled, (state, action) => {
        ensureState(state);
        state.activities = action.payload;
      });
  },
});

// ─────────────────────────────────────────────────────────────
// NON-PARAMETRIZED SELECTORS
// ─────────────────────────────────────────────────────────────
export const selectAllAds = (state: RootState) =>
  state.ads.ads || EMPTY_ARRAY;
export const selectActiveAds = (state: RootState) =>
  state.ads.activeAds || EMPTY_ARRAY;
export const selectFeed = (state: RootState) =>
  state.ads.feed || EMPTY_ARRAY;
export const selectExplore = (state: RootState) =>
  state.ads.explore || EMPTY_ARRAY;
export const selectMyPosts = (state: RootState) =>
  state.ads.myPosts || EMPTY_ARRAY;
export const selectArchivedPosts = (state: RootState) =>
  state.ads.archivedPosts || EMPTY_ARRAY;
export const selectAdsLoading = (state: RootState) => state.ads.loading;
export const selectAdsRefreshing = (state: RootState) => state.ads.refreshing;
export const selectAdsError = (state: RootState) => state.ads.error;
export const selectStories = (state: RootState) =>
  state.ads.stories || EMPTY_ARRAY;
export const selectMyStories = (state: RootState) =>
  state.ads.myStories || EMPTY_ARRAY;
export const selectUserProfile = (state: RootState) => state.ads.userProfile;
export const selectSuggestedUsers = (state: RootState) =>
  state.ads.suggestedUsers || EMPTY_ARRAY;
export const selectNotifications = (state: RootState) =>
  state.ads.notifications || EMPTY_ARRAY;
export const selectUnreadNotifications = (state: RootState) =>
  state.ads.unreadNotificationsCount;
export const selectConversations = (state: RootState) =>
  state.ads.conversations || EMPTY_ARRAY;

// Identity search + resolve
export const selectIdentitySearchResults = (state: RootState) =>
  state.ads.identitySearchResults || EMPTY_ARRAY;
export const selectIdentitySearchQuery = (state: RootState) =>
  state.ads.identitySearchQuery || '';
export const selectIdentitySearchLoading = (state: RootState) =>
  state.ads.identitySearchLoading;
export const selectResolvedIdentities = (state: RootState) =>
  state.ads.resolvedIdentities || {};

export const selectActiveAdsLoaded = (state: RootState) =>
  state.ads.activeAdsLoaded;
export const selectActiveAdsHasMore = (state: RootState) =>
  state.ads.activeAdsHasMore;
export const selectActiveAdsLoadingMore = (state: RootState) =>
  state.ads.activeAdsLoadingMore;
export const selectActiveAdsPage = (state: RootState) =>
  state.ads.activeAdsPage;
export const selectFeedLoaded = (state: RootState) => state.ads.feedLoaded;
export const selectFeedHasMore = (state: RootState) => state.ads.feedHasMore;
export const selectFeedLoadingMore = (state: RootState) =>
  state.ads.feedLoadingMore;
export const selectFeedPage = (state: RootState) => state.ads.feedPage;
export const selectTrendingHashtags = (state: RootState) =>
  state.ads.trendingHashtags || EMPTY_ARRAY;
export const selectHashtagSearchResults = (state: RootState) =>
  state.ads.hashtagSearchResults || EMPTY_ARRAY;
export const selectSearchResults = (state: RootState) =>
  state.ads.searchResults || {
    users: [],
    vendors: [],
    posts: [],
    hashtags: [],
  };
export const selectSavedCollections = (state: RootState) =>
  state.ads.savedCollections || EMPTY_ARRAY;
export const selectUserAnalytics = (state: RootState) =>
  state.ads.userAnalytics;
export const selectActivity = (state: RootState) =>
  state.ads.activities || EMPTY_ARRAY;

// ─────────────────────────────────────────────────────────────
// MEMOIZED PARAMETRIZED SELECTORS
// ─────────────────────────────────────────────────────────────
export const selectUserProfileById = (userId: string) =>
  createSelector(
    [(state: RootState) => state.ads.userProfiles?.[userId]],
    (profile) => profile ?? EMPTY_PROFILE
  );

export const selectFollowers = (userId: string) =>
  createSelector(
    [(state: RootState) => state.ads.followers?.[userId]],
    (list) => (Array.isArray(list) && list.length ? list : EMPTY_ARRAY)
  );

export const selectFollowing = (userId: string) =>
  createSelector(
    [(state: RootState) => state.ads.following?.[userId]],
    (list) => (Array.isArray(list) && list.length ? list : EMPTY_ARRAY)
  );

export const selectMessages = (conversationId: string) =>
  createSelector(
    [
      (state: RootState) =>
        conversationId ? state.ads.messages?.[conversationId] : undefined,
    ],
    (list) => (Array.isArray(list) && list.length ? list : EMPTY_ARRAY)
  );

export const selectCommentsForAd = (adId: string) =>
  createSelector(
    [
      (state: RootState) =>
        adId ? state.ads.commentsByAd?.[adId] : undefined,
    ],
    (list) => (Array.isArray(list) && list.length ? list : EMPTY_ARRAY)
  );

export const selectUserPosts = (userId: string) =>
  createSelector(
    [
      (state: RootState) =>
        userId ? state.ads.userPosts?.[userId] : undefined,
    ],
    (list) => (Array.isArray(list) && list.length ? list : EMPTY_ARRAY)
  );

export const selectUserStories = (userId: string) =>
  createSelector(
    [
      (state: RootState) =>
        userId ? state.ads.userStories?.[userId] : undefined,
    ],
    (list) => (Array.isArray(list) && list.length ? list : EMPTY_ARRAY)
  );

export const selectHighlights = (userId: string) =>
  createSelector(
    [
      (state: RootState) =>
        userId ? state.ads.highlights?.[userId] : undefined,
    ],
    (list) => (Array.isArray(list) && list.length ? list : EMPTY_ARRAY)
  );

export const selectReachAnalytics = (adId: string) =>
  createSelector(
    [
      (state: RootState) =>
        adId ? state.ads.reachAnalytics?.[adId] : undefined,
    ],
    (analytics) => analytics ?? null
  );

export const selectHashtagPosts = (tag: string) =>
  createSelector(
    [
      (state: RootState) =>
        tag ? state.ads.hashtagPosts?.[tag] : undefined,
    ],
    (list) => (Array.isArray(list) && list.length ? list : EMPTY_ARRAY)
  );

export const selectResolvedIdentityById = (id: string) =>
  createSelector(
    [
      (state: RootState) =>
        id ? state.ads.resolvedIdentities?.[id] : undefined,
    ],
    (resolved) => resolved ?? null
  );

export const {
  clearAds,
  resetAds,
  setCommentsForAd,
  updatePostInLists,
  invalidateActiveAds,
  invalidateFeed,
  updateMessageInConversation,
  updateConversationLastMessage,
  incrementUnreadCount,
  updateOnlineStatus,
  incrementUnreadNotifications,
  prependNotification,
  setUserAnalytics,
  clearIdentitySearch,
} = adSlice.actions;

export default adSlice.reducer;