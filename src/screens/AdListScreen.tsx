// screens/AdListScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchActiveAds } from '../features/adSlice';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface AdListScreenProps {
  title?: string;
}

const { width } = Dimensions.get('window');

// Full Width Featured Ad (First item)
const FeaturedAdItem: React.FC<{
  item: any;
  onPress: (ad: any) => void;
}> = ({ item, onPress }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  if (!item) return null;

  return (
    <TouchableOpacity
      style={styles.featuredAdItem}
      onPress={() => onPress(item)}
      activeOpacity={0.9}
    >
      <View style={styles.featuredImageContainer}>
        {!imageLoaded && (
          <View style={styles.featuredPlaceholder}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/400x200' }}
          style={[styles.featuredAdImage, !imageLoaded && styles.imageHidden]}
          resizeMode="cover"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />
        <View style={styles.featuredSponsoredBadge}>
          <Text style={styles.featuredSponsoredText}>Sponsored</Text>
        </View>
        {item.title && (
          <View style={styles.featuredOverlay}>
            <Text style={styles.featuredAdTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Regular Full-Width Ad Item
const FullWidthAdItem: React.FC<{
  item: any;
  onPress: (ad: any) => void;
}> = ({ item, onPress }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  if (!item) return null;

  return (
    <TouchableOpacity
      style={styles.adItem}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {!imageLoaded && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        )}
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/400x200' }}
          style={[styles.adImage, !imageLoaded && styles.imageHidden]}
          resizeMode="cover"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />
        {item.title && (
          <View style={styles.overlay}>
            <Text style={styles.adTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const AdListScreen: React.FC<AdListScreenProps> = ({ title = 'Sponsored Content' }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isMounted = useRef(true);
  const initialLoadDone = useRef(false);

  const { activeAds, loading, error } = useSelector((state: RootState) => state.ads);
  const [refreshing, setRefreshing] = useState(false);
  const [displayAds, setDisplayAds] = useState<any[]>([]);

  const loadAds = useCallback(async () => {
    try {
      await dispatch(fetchActiveAds());
    } catch (error) {
      console.error('Error loading ads:', error);
    }
  }, [dispatch]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadAds();
    }
    return () => {
      isMounted.current = false;
    };
  }, [loadAds]);

  useEffect(() => {
    setDisplayAds(activeAds || []);
  }, [activeAds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAds();
    setRefreshing(false);
  }, [loadAds]);

  const handleAdPress = useCallback((ad: any) => {
    if (ad.link && (ad.link.startsWith('http://') || ad.link.startsWith('https://'))) {
      navigation.navigate('WebViewScreen', { url: ad.link });
    }
  }, [navigation]);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    if (!item) return null;
    if (index === 0) {
      return <FeaturedAdItem item={item} onPress={handleAdPress} />;
    }
    return <FullWidthAdItem item={item} onPress={handleAdPress} />;
  }, [handleAdPress]);

  if (loading && !refreshing && displayAds.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading ads...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load ads</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadAds}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!displayAds || displayAds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No ads available</Text>
        <Text style={styles.emptySubText}>Check back later for sponsored content</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <FlatList
        data={displayAds}
        renderItem={renderItem}
        keyExtractor={(item, index) => item?._id || `ad-${index}`}
        numColumns={1}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={10}
        ListFooterComponent={
          displayAds.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{displayAds.length} ads available</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  listContainer: { paddingBottom: 16 },

  // Featured Ad (Full Width)
  featuredAdItem: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuredImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
    backgroundColor: '#F0F0F0',
  },
  featuredAdImage: { width: '100%', height: '100%' },
  featuredPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  imageHidden: { opacity: 0 },
  featuredSponsoredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredSponsoredText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
  },
  featuredAdTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Regular Full-Width Ad
  adItem: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#F0F0F0',
  },
  adImage: { width: '100%', height: '100%' },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
  },
  adTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  loaderContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  loadingText: { marginTop: 8, color: '#666666', fontSize: 14 },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  errorText: { color: '#FF3B30', fontSize: 14, marginBottom: 8 },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  retryText: { color: '#FFFFFF', fontWeight: '600' },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  emptyText: { color: '#999999', fontSize: 14, fontWeight: '500' },
  emptySubText: { color: '#CCCCCC', fontSize: 12, marginTop: 4 },
  footer: { paddingVertical: 16, alignItems: 'center' },
  footerText: { color: '#8E8E93', fontSize: 12 },
});

export default AdListScreen;