// components/AdMasonryGrid.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchActiveAds, Ad } from '../features/adSlice';
import MasonryList from 'react-native-masonry-list';

const { width } = Dimensions.get('window');
const COLUMNS = 2;
const GAP = 8;

interface AdMasonryGridProps {
  placement?: 'home' | 'category' | 'search';
  title?: string;
  limit?: number;
  onAdPress?: (ad: Ad) => void;
}

const AdMasonryGrid: React.FC<AdMasonryGridProps> = ({
  placement = 'home',
  title = 'Sponsored',
  limit = 10,
  onAdPress,
}) => {
  const dispatch = useDispatch();
  const { adsByPlacement, loading, error } = useSelector((state: RootState) => state.ads);
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    loadAds();
  }, [placement]);

  const loadAds = async () => {
    await dispatch(fetchActiveAds(placement) as any);
  };

  useEffect(() => {
    // Get ads for the specific placement
    const placementAds = adsByPlacement[placement] || [];
    setAds(placementAds.slice(0, limit));
  }, [adsByPlacement, placement, limit]);

  const handleAdPress = async (ad: Ad) => {
    if (onAdPress) {
      onAdPress(ad);
      return;
    }

    if (ad.link) {
      try {
        const url = ad.link.startsWith('http') ? ad.link : `https://${ad.link}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot open this link');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to open link');
      }
    } else {
      Alert.alert('No Link', 'This ad has no destination link');
    }
  };

  // Prepare masonry data with random heights for Pinterest look
  const masonryData = ads.map((ad) => ({
    id: ad._id,
    image: ad.image,
    title: ad.title,
    link: ad.link,
    height: 180 + Math.floor(Math.random() * 120), // between 180-300
    adData: ad,
  }));

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.adItem, { height: item.height }]}
      onPress={() => handleAdPress(item.adData)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.image }} style={styles.adImage} resizeMode="cover" />
      <View style={styles.overlay}>
        <View style={styles.adBadge}>
          <Text style={styles.badgeText}>Sponsored</Text>
        </View>
        {item.title && (
          <Text style={styles.adTitle} numberOfLines={2}>
            {item.title}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading && ads.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return null; // Don't show on error
  }

  if (ads.length === 0) {
    return null; // Don't show if no ads
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <MasonryList
        data={masonryData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        columns={COLUMNS}
        spacing={GAP}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: GAP,
    paddingBottom: 16,
  },
  adItem: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: GAP,
    width: (width - (COLUMNS + 1) * GAP) / COLUMNS,
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 10,
    paddingTop: 20,
    flexDirection: 'column',
  },
  adBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  adTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loaderContainer: {
    padding: 20,
    alignItems: 'center',
  },
});

export default AdMasonryGrid;