// src/screens/HashtagPostsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';

import { AppDispatch, RootState } from '../store';
import {
  fetchPostsByHashtag,
  selectHashtagPosts,
  toggleLikeAd,
  toggleSaveAd,
  trackAdView,
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

const HashtagPostsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const tag: string = (route.params?.tag || '').replace(/^#/, '').toLowerCase();

  // Stable selector per tag
  const hashtagPostsSelector = useMemo(
    () => selectHashtagPosts(tag),
    [tag]
  );
  const posts = useSelector(hashtagPostsSelector);
  const loading = useSelector((state: RootState) => state.ads.loading);

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ─── INITIAL LOAD ───
  useEffect(() => {
    if (!tag) return;
    setPage(1);
    setHasMore(true);
    dispatch(fetchPostsByHashtag({ tag, page: 1, limit: 30 }));
  }, [tag, dispatch]);

  // ─── PULL TO REFRESH ───
  const handleRefresh = useCallback(async () => {
    if (!tag) return;
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    try {
      await dispatch(fetchPostsByHashtag({ tag, page: 1, limit: 30 })).unwrap();
    } finally {
      setRefreshing(false);
    }
  }, [tag, dispatch]);

  // ─── LOAD MORE ───
  const handleLoadMore = useCallback(async () => {
    if (!tag || loadingMore || !hasMore || refreshing) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await dispatch(
        fetchPostsByHashtag({ tag, page: nextPage, limit: 30 })
      ).unwrap();
      setPage(nextPage);
      const pag = result?.pagination;
      if (pag && typeof pag.hasMore === 'boolean') {
        setHasMore(pag.hasMore);
      } else {
        setHasMore((result?.posts?.length || 0) >= 30);
      }
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [tag, page, hasMore, loadingMore, refreshing, dispatch]);

  // ─── OPEN POST (enters reel feed with the tapped post active) ───
  const handleOpenPost = useCallback(
    (ad: any) => {
      dispatch(trackAdView(ad._id));
      // Navigate back to AdListScreen and open feed there
      navigation.navigate('AdListScreen', { openPostId: ad._id });
    },
    [dispatch, navigation]
  );

  // ─── RENDER ITEM ───
  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const isVideo = item.mediaType === 'video' && !!item.video;
      const preview = item.image || item.thumbnail || '';

      return (
        <TouchableOpacity
          style={styles.gridItem}
          onPress={() => handleOpenPost(item)}
          activeOpacity={0.85}
        >
          {preview ? (
            <ExpoImage
              source={{ uri: preview }}
              style={styles.gridImage}
              contentFit="cover"
              recyclingKey={String(item._id)}
              transition={150}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.gridImage, { backgroundColor: Royal.offWhite }]} />
          )}

          {isVideo ? (
            <View style={styles.videoBadge} pointerEvents="none">
              <Ionicons name="play" size={12} color={Royal.pureWhite} />
            </View>
          ) : null}

          <View style={styles.gridOverlay} pointerEvents="none">
            <Ionicons name="heart" size={11} color={Royal.pureWhite} />
            <Text style={styles.gridOverlayText}>
              {formatCount(item.likesCount)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleOpenPost]
  );

  // ─── EMPTY STATE ───
  const renderEmpty = () => {
    if (loading && posts.length === 0) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Royal.pureBlack} />
          <Text style={styles.loadingText}>Loading posts…</Text>
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="pricetag-outline" size={48} color={Royal.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptySub}>
          Be the first to post with <Text style={styles.emptyTag}>#{tag}</Text>
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Royal.pureWhite} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Royal.pureBlack} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            #{tag}
          </Text>
          <Text style={styles.headerSubtitle}>
            {formatCount(posts.length)}{' '}
            {posts.length === 1 ? 'post' : 'posts'}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Grid */}
      <FlatList
        data={posts}
        keyExtractor={(item, i) => `hashtag-${item._id || i}`}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={1.2}
        onEndReached={handleLoadMore}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Royal.pureBlack}
          />
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={Royal.pureBlack} />
            </View>
          ) : null
        }
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Royal.borderLight,
    backgroundColor: Royal.pureWhite,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Royal.pureBlack,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: Royal.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },

  listContent: {
    paddingTop: 2,
    paddingBottom: 40,
  },
  gridRow: {
    justifyContent: 'flex-start',
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_HEIGHT,
    marginRight: GRID_GAP,
    marginBottom: GRID_GAP,
    backgroundColor: Royal.offWhite,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridOverlayText: {
    color: Royal.pureWhite,
    fontSize: 10,
    fontWeight: '700',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  loadingText: {
    color: Royal.textSecondary,
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
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
    fontSize: 17,
    fontWeight: '700',
  },
  emptySub: {
    color: Royal.textSecondary,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyTag: {
    color: Royal.blueAccent,
    fontWeight: '700',
  },

  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});

export default HashtagPostsScreen;