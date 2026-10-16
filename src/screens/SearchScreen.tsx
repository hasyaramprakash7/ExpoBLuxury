// src/screens/SearchScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';

import { AppDispatch, RootState } from '../store';
import {
  globalSearch,
  fetchTrendingHashtags,
  selectTrendingHashtags,
  selectSearchResults,
  toggleFollow,
} from '../features/adSlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 🎨 UNIFIED PALETTE
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
};

const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const GRID_ITEM_HEIGHT = GRID_ITEM_SIZE * 1.4;

const formatCount = (n?: number) => {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
};

type SearchTab = 'top' | 'users' | 'hashtags' | 'posts';

const SearchScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();

  const trendingHashtags = useSelector(selectTrendingHashtags);
  const searchResults = useSelector(selectSearchResults);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('top');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<any>(null);

  // ─── LOAD TRENDING ON MOUNT ───
  useEffect(() => {
    dispatch(fetchTrendingHashtags());
  }, [dispatch]);

  // ─── DEBOUNCE QUERY ───
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!query.trim()) {
      setDebouncedQuery('');
      setShowSuggestions(true);
      return;
    }
    setShowSuggestions(false);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  // ─── FETCH SEARCH ───
  useEffect(() => {
    if (!debouncedQuery) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await dispatch(globalSearch({ query: debouncedQuery, type: 'all' })).unwrap();
        // Save to recent searches
        setRecentSearches((prev) => {
          const filtered = prev.filter((q) => q !== debouncedQuery);
          return [debouncedQuery, ...filtered].slice(0, 10);
        });
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, dispatch]);

  // ─── HANDLERS ───
  const handleSelectHashtag = useCallback(
    (tag: string) => {
      Keyboard.dismiss();
      navigation.navigate('HashtagPosts', { tag: tag.replace(/^#/, '') });
    },
    [navigation]
  );

  const handleSelectUser = useCallback(
    (userId: string) => {
      Keyboard.dismiss();
      navigation.navigate('UserProfile', { userId });
    },
    [navigation]
  );

  const handleSelectPost = useCallback(
    (adId: string) => {
      Keyboard.dismiss();
      navigation.navigate('AdListScreen', { openPostId: adId });
    },
    [navigation]
  );

  const handleClearQuery = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setShowSuggestions(true);
    inputRef.current?.focus();
  }, []);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const handleToggleFollow = useCallback(
    (userId: string) => {
      dispatch(toggleFollow(userId));
    },
    [dispatch]
  );

  // ─── FILTERED RESULTS ───
  const topResults = useMemo(() => {
    const users = (searchResults?.users || []).slice(0, 3);
    const posts = (searchResults?.posts || []).slice(0, 6);
    const tags = (searchResults?.hashtags || []).slice(0, 3);
    return { users, posts, hashtags: tags };
  }, [searchResults]);

  // ─── RENDER SECTIONS ───
  const renderUserRow = (item: any, showFollow: boolean = true) => (
    <TouchableOpacity
      key={item._id}
      style={styles.userRow}
      onPress={() => handleSelectUser(item._id)}
      activeOpacity={0.7}
    >
      {item.avatar ? (
        <ExpoImage
          source={{ uri: item.avatar }}
          style={styles.userAvatar}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.userAvatar, styles.userAvatarFallback]}>
          <Text style={styles.userAvatarLetter}>
            {(item.name || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name || 'User'}
        </Text>
        {item.username ? (
          <Text style={styles.userUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        ) : null}
        {item.followersCount !== undefined ? (
          <Text style={styles.userMeta} numberOfLines={1}>
            {formatCount(item.followersCount)} followers
          </Text>
        ) : null}
      </View>
      {showFollow && !item.isFollowing ? (
        <TouchableOpacity
          style={styles.followBtn}
          onPress={() => handleToggleFollow(item._id)}
          activeOpacity={0.7}
        >
          <Text style={styles.followBtnText}>Follow</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );

  const renderHashtagRow = (item: any) => (
    <TouchableOpacity
      key={item._id || item.tag}
      style={styles.hashtagRow}
      onPress={() => handleSelectHashtag(item.tag)}
      activeOpacity={0.7}
    >
      <View style={styles.hashtagIconWrap}>
        <Ionicons name="pricetag-outline" size={20} color={Royal.pureBlack} />
      </View>
      <View style={styles.hashtagInfo}>
        <Text style={styles.hashtagText} numberOfLines={1}>
          #{item.tag}
        </Text>
        <Text style={styles.hashtagMeta} numberOfLines={1}>
          {formatCount(item.postsCount || 0)} posts
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Royal.textTertiary} />
    </TouchableOpacity>
  );

  const renderPostGrid = (posts: any[]) => (
    <View style={styles.gridWrap}>
      {posts.map((post) => {
        const isVideo = post.mediaType === 'video' && !!post.video;
        const preview = post.image || post.thumbnail || '';
        return (
          <TouchableOpacity
            key={post._id}
            style={styles.gridItem}
            onPress={() => handleSelectPost(post._id)}
            activeOpacity={0.85}
          >
            {preview ? (
              <ExpoImage
                source={{ uri: preview }}
                style={styles.gridImage}
                contentFit="cover"
                recyclingKey={String(post._id)}
                transition={150}
              />
            ) : (
              <View style={[styles.gridImage, { backgroundColor: Royal.offWhite }]} />
            )}
            {isVideo ? (
              <View style={styles.videoBadge} pointerEvents="none">
                <Ionicons name="play" size={10} color={Royal.pureWhite} />
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─── RENDER SUGGESTIONS (when no query) ───
  const renderSuggestions = () => (
    <ScrollView
      style={styles.suggestionsScroll}
      contentContainerStyle={styles.suggestionsContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {recentSearches.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={() => setRecentSearches([])}>
              <Text style={styles.sectionClearText}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((q) => (
            <TouchableOpacity
              key={q}
              style={styles.recentRow}
              onPress={() => setQuery(q)}
              activeOpacity={0.7}
            >
              <View style={styles.recentIconWrap}>
                <Ionicons name="time-outline" size={18} color={Royal.textSecondary} />
              </View>
              <Text style={styles.recentText} numberOfLines={1}>
                {q}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setRecentSearches((prev) => prev.filter((x) => x !== q))
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={Royal.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending on BLuxury</Text>
        {trendingHashtags.slice(0, 12).map((item: any) => renderHashtagRow(item))}
        {trendingHashtags.length === 0 ? (
          <Text style={styles.noTrending}>
            No trending hashtags yet. Start posting with hashtags!
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );

  // ─── RENDER RESULTS ───
  const renderResults = () => {
    const hasUsers = (searchResults?.users || []).length > 0;
    const hasPosts = (searchResults?.posts || []).length > 0;
    const hasHashtags = (searchResults?.hashtags || []).length > 0;
    const hasAny = hasUsers || hasPosts || hasHashtags;

    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Royal.pureBlack} />
        </View>
      );
    }

    if (!hasAny) {
      return (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="search" size={48} color={Royal.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No results for "{debouncedQuery}"</Text>
          <Text style={styles.emptySub}>
            Try a different keyword or check your spelling.
          </Text>
        </View>
      );
    }

    // TOP tab
    if (activeTab === 'top') {
      return (
        <ScrollView
          style={styles.resultsScroll}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {hasUsers ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>People</Text>
              {topResults.users.map((u) => renderUserRow(u))}
            </View>
          ) : null}

          {hasHashtags ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hashtags</Text>
              {topResults.hashtags.map((h) => renderHashtagRow(h))}
            </View>
          ) : null}

          {hasPosts ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Posts</Text>
              {renderPostGrid(topResults.posts)}
            </View>
          ) : null}
        </ScrollView>
      );
    }

    // USERS tab
    if (activeTab === 'users') {
      return (
        <FlatList
          data={searchResults?.users || []}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={styles.resultsContent}
          renderItem={({ item }) => renderUserRow(item)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No users found</Text>
            </View>
          }
        />
      );
    }

    // HASHTAGS tab
    if (activeTab === 'hashtags') {
      return (
        <FlatList
          data={searchResults?.hashtags || []}
          keyExtractor={(item: any) => item._id || item.tag}
          contentContainerStyle={styles.resultsContent}
          renderItem={({ item }) => renderHashtagRow(item)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No hashtags found</Text>
            </View>
          }
        />
      );
    }

    // POSTS tab
    if (activeTab === 'posts') {
      return (
        <ScrollView
          style={styles.resultsScroll}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderPostGrid(searchResults?.posts || [])}
          {!hasPosts ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No posts found</Text>
            </View>
          ) : null}
        </ScrollView>
      );
    }

    return null;
  };

  const showTabs = !showSuggestions && !!debouncedQuery;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Royal.textTertiary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search people, hashtags, posts"
            placeholderTextColor={Royal.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              if (query.trim()) {
                setDebouncedQuery(query.trim());
                setShowSuggestions(false);
              }
            }}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={handleClearQuery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Royal.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      {showTabs ? (
        <View style={styles.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {(
              [
                { key: 'top', label: 'Top' },
                { key: 'users', label: 'People' },
                { key: 'hashtags', label: 'Tags' },
                { key: 'posts', label: 'Posts' },
              ] as { key: SearchTab; label: string }[]
            ).map((t) => {
              const isActive = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tabChip, isActive && styles.tabChipActive]}
                  onPress={() => setActiveTab(t.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabChipText,
                      isActive && styles.tabChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Body */}
      <View style={{ flex: 1 }}>
        {showSuggestions ? renderSuggestions() : renderResults()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.pureWhite },

  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Royal.borderLight,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Royal.offWhite,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: Royal.borderLight,
  },
  searchInput: {
    flex: 1,
    color: Royal.pureBlack,
    fontSize: 15,
    padding: 0,
  },
  cancelText: {
    color: Royal.pureBlack,
    fontSize: 15,
    fontWeight: '600',
  },

  tabsWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Royal.borderLight,
  },
  tabsRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Royal.offWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Royal.borderLight,
    marginRight: 8,
  },
  tabChipActive: {
    backgroundColor: Royal.pureBlack,
    borderColor: Royal.pureBlack,
  },
  tabChipText: {
    color: Royal.pureBlack,
    fontSize: 13,
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: Royal.pureWhite,
  },

  suggestionsScroll: { flex: 1 },
  suggestionsContent: { paddingVertical: 12 },

  resultsScroll: { flex: 1 },
  resultsContent: { paddingVertical: 12, paddingBottom: 40 },

  section: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: Royal.pureBlack,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionClearText: {
    color: Royal.blueAccent,
    fontSize: 13,
    fontWeight: '600',
  },

  // User rows
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Royal.offWhite,
  },
  userAvatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Royal.pureBlack,
  },
  userAvatarLetter: {
    color: Royal.pureWhite,
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: { flex: 1 },
  userName: {
    color: Royal.pureBlack,
    fontSize: 14,
    fontWeight: '700',
  },
  userUsername: {
    color: Royal.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  userMeta: {
    color: Royal.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Royal.blueAccent,
    borderRadius: 6,
  },
  followBtnText: {
    color: Royal.pureWhite,
    fontSize: 13,
    fontWeight: '700',
  },

  // Hashtag rows
  hashtagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  hashtagIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Royal.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Royal.borderLight,
  },
  hashtagInfo: { flex: 1 },
  hashtagText: {
    color: Royal.pureBlack,
    fontSize: 14,
    fontWeight: '700',
  },
  hashtagMeta: {
    color: Royal.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // Post grid
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GRID_GAP / 2,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_HEIGHT,
    marginHorizontal: GRID_GAP / 2,
    marginBottom: GRID_GAP,
    backgroundColor: Royal.offWhite,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Recent
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  recentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Royal.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentText: {
    flex: 1,
    color: Royal.pureBlack,
    fontSize: 14,
    fontWeight: '500',
  },

  noTrending: {
    color: Royal.textSecondary,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },

  // Center
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Royal.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: Royal.pureBlack,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    color: Royal.textSecondary,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SearchScreen;