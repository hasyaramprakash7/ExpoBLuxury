// components/AdCarousel.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import { fetchActiveAds, Ad } from '../features/adSlice';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface AdCarouselProps {
  limit?: number;
  title?: string;
}

const AdCarousel: React.FC<AdCarouselProps> = ({ limit = 5, title = 'Sponsored' }) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();

  // ✅ Select each field individually – avoids the "new object" warning
  const activeAds = useSelector((state: RootState) => state.ads?.activeAds || []);
  const loading = useSelector((state: RootState) => state.ads?.loading || false);

  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    if (activeAds.length === 0 && !loading) {
      dispatch(fetchActiveAds());
    }
  }, [activeAds.length, loading, dispatch]);

  useEffect(() => {
    setAds(activeAds.slice(0, limit));
  }, [activeAds, limit]);

  if (loading && ads.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  if (ads.length === 0) return null;

  const handleAdPress = (ad: Ad) => {
    if (ad.link && (ad.link.startsWith('http://') || ad.link.startsWith('https://'))) {
      navigation.navigate('WebViewScreen', { url: ad.link });
    }
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <FlatList
        data={ads}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.adItem}
            onPress={() => handleAdPress(item)}
            activeOpacity={0.9}
          >
            <Image source={{ uri: item.image }} style={styles.adImage} resizeMode="cover" />
            {item.title && (
              <View style={styles.overlay}>
                <Text style={styles.adTitle} numberOfLines={1}>{item.title}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 8, paddingHorizontal: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8, marginLeft: 4 },
  listContent: { paddingRight: 8 },
  adItem: {
    width: width * 0.7,
    height: 120,
    marginRight: 12,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  adImage: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
  },
  adTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  loaderContainer: { padding: 10, alignItems: 'center' },
});

export default AdCarousel;