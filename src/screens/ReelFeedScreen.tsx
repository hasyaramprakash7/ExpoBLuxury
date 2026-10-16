// src/screens/ReelFeedScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppDispatch } from '../app/store';
import { trackAdView } from '../features/adSlice';
import {
  ReelCard,
  REEL_HEIGHT,
  REEL_GAP,
  pickVideoSource,
} from '../components/FeedCards';
import { useVideoPreload } from '../hooks/useVideoPreload';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOG_TAG = '🟪[ReelFeedScreen]';

const log = (...args: any[]) => {
  if (__DEV__) console.log(LOG_TAG, ...args);
};
const logWarn = (...args: any[]) => {
  if (__DEV__) console.warn(LOG_TAG, '⚠️', ...args);
};

const Royal = {
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
  offWhite: '#F4F4F6',
  textSecondary: 'rgba(11,11,15,0.55)',
  mediaBackdrop: '#0B0B0F',
  overlayBg: 'rgba(0,0,0,0.45)',
  overlayText: '#FFFFFF',
  overlayTextSoft: 'rgba(255,255,255,0.75)',
};

interface ReelFeedScreenProps {
  data: any[];
  initialIndex: number;
  onExit: () => void;
  onPress: (ad: any) => void;
  onOpenShop: (vendor: any) => void;
  onOpenProfile: (uid: string) => void;
  onLike: (adId: string) => void;
  onOpenComments: (ad: any) => void;
  onShareTracked: (adId: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  showOwner: boolean;
  userId: string;
  isFollowing?: (uid: string) => boolean;
  isOnline?: (uid: string) => boolean;
  onToggleFollow?: (uid: string, following: boolean) => void;
}

const ReelFeedScreen: React.FC<ReelFeedScreenProps> = ({
  data,
  initialIndex,
  onExit,
  onPress,
  onOpenShop,
  onOpenProfile,
  onLike,
  onOpenComments,
  onShareTracked,
  refreshing,
  onRefresh,
  onEndReached,
  hasMore,
  loadingMore,
  showOwner,
  userId,
  isFollowing,
  isOnline,
  onToggleFollow,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const feedListRef = useRef<FlatList<any>>(null);
  const viewedAdIds = useRef<Set<string>>(new Set());

  const [containerHeight, setContainerHeight] = useState<number>(REEL_HEIGHT);
  const cardHeight = containerHeight > 0 ? containerHeight : REEL_HEIGHT;
  const snapInterval = cardHeight + REEL_GAP;

  const [activeReelIndex, setActiveReelIndex] = useState<number>(initialIndex);

  // ⚡ PRELOAD next videos when active index changes
  useVideoPreload(data, activeReelIndex, 2);

  useEffect(() => {
    log(
      '🎬 ReelFeedScreen mounted | data =',
      data.length,
      '| initialIndex =',
      initialIndex,
      '| cardHeight =',
      cardHeight.toFixed(0)
    );
    return () => log('👋 ReelFeedScreen unmounted');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    log('📊 data length changed →', data.length);
    data.slice(0, 3).forEach((ad, i) => {
      const src = pickVideoSource(ad);
      log(
        `   [${i}] id=${ad?._id} type=${ad?.mediaType} postType=${ad?.postType}` +
          ` image=${ad?.image ? '✔' : '✖'} video=${src ? '✔' : '✖'}`
      );
    });
  }, [data]);

  useEffect(() => {
    setActiveReelIndex(initialIndex);
    const t = setTimeout(() => {
      try {
        feedListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
          viewPosition: 0,
        });
      } catch (e) {
        logWarn('scrollToIndex failed, using offset fallback:', e);
        feedListRef.current?.scrollToOffset({
          offset: initialIndex * snapInterval,
          animated: false,
        });
      }
    }, 60);
    return () => clearTimeout(t);
  }, [initialIndex, snapInterval]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (!viewableItems || viewableItems.length === 0) {
        setActiveReelIndex(-1);
        return;
      }

      for (let i = 0; i < viewableItems.length; i++) {
        const item = viewableItems[i].item;
        if (!item?._id) continue;
        if (viewedAdIds.current.has(item._id)) continue;
        viewedAdIds.current.add(item._id);
        dispatch(trackAdView(item._id));
      }

      const videoItems = viewableItems.filter(
        (v: any) => v.item?.mediaType === 'video' && v.isViewable
      );
      const candidate = videoItems.length > 0 ? videoItems : viewableItems;
      let best = candidate[0];
      for (let i = 1; i < candidate.length; i++) {
        if ((candidate[i].index ?? 0) < (best.index ?? 0)) {
          best = candidate[i];
        }
      }
      if (best && typeof best.index === 'number') {
        setActiveReelIndex((prev) => (prev === best.index ? prev : best.index));
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 300,
  }).current;

  const lastEndReachedAt = useRef(0);
  const onEndReachedStable = useCallback(() => {
    const t = Date.now();
    if (t - lastEndReachedAt.current < 400) return;
    lastEndReachedAt.current = t;
    onEndReached();
  }, [onEndReached]);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: snapInterval,
      offset: snapInterval * index,
      index,
    }),
    [snapInterval]
  );

  const onLayout = useCallback(
    (e: any) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && Math.abs(h - containerHeight) > 1) {
        setContainerHeight(h);
      }
    },
    [containerHeight]
  );

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      <View style={styles.topOverlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backButton}
          onPress={onExit}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={Royal.overlayText} />
        </TouchableOpacity>
      </View>

      {data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="cube-outline"
            size={60}
            color={Royal.overlayTextSoft}
          />
          <Text style={styles.emptyText}>No posts available</Text>
          <Text style={styles.emptySubText}>Check back later</Text>
        </View>
      ) : (
        <FlatList
          key="reel-list"
          ref={feedListRef}
          data={data}
          keyExtractor={(item, i) => `reel-${item._id || i}`}
          numColumns={1}
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          pagingEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={2}
          updateCellsBatchingPeriod={60}
          removeClippedSubviews={true}
          onEndReachedThreshold={2}
          onEndReached={onEndReachedStable}
          scrollEventThrottle={32}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={(info) => {
            logWarn('onScrollToIndexFailed → index', info.index);
            setTimeout(() => {
              feedListRef.current?.scrollToOffset({
                offset: info.index * snapInterval,
                animated: false,
              });
            }, 100);
          }}
          renderItem={({ item, index }) => {
            const isActive = index === activeReelIndex;
            const isUserPost = item?.postType === 'user';
            const ownerId =
              String(
                isUserPost
                  ? typeof item?.userId === 'object'
                    ? item?.userId?._id
                    : item?.userId
                  : typeof item?.vendorId === 'object'
                  ? item?.vendorId?._id
                  : item?.vendorId
              ) || '';
            return (
              <View style={{ height: cardHeight, paddingBottom: REEL_GAP }}>
                <ReelCard
                  ad={item}
                  onPress={onPress}
                  onOpenShop={onOpenShop}
                  onOpenProfile={onOpenProfile}
                  onLike={onLike}
                  onOpenComments={onOpenComments}
                  onShareTracked={onShareTracked}
                  isActive={isActive}
                  showOwner={showOwner}
                  cardHeight={cardHeight}
                  userId={userId}
                  isOnline={isOnline ? isOnline(ownerId) : false}
                  isFollowing={isFollowing ? isFollowing(ownerId) : false}
                  onToggleFollow={onToggleFollow}
                />
              </View>
            );
          }}
          ListFooterComponent={
            hasMore && loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Royal.overlayText} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: Royal.mediaBackdrop },
  topOverlay: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Royal.overlayBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  listContainer: { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 },
  footerLoader: { paddingVertical: 24, alignItems: 'center' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Royal.mediaBackdrop,
  },
  emptyText: {
    color: Royal.overlayText,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubText: {
    color: Royal.overlayTextSoft,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ReelFeedScreen;