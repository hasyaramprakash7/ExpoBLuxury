// components/AdCarousel.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface AdCarouselProps {
  ads: any[];
  title?: string;
  onAdPress?: (ad: any) => void;
  limit?: number;
  autoPlayInterval?: number;
}

const AdCarousel: React.FC<AdCarouselProps> = ({ 
  ads = [],
  title = 'Sponsored', 
  onAdPress,
  limit = 5,
  autoPlayInterval = 4000,
}) => {
  const navigation = useNavigation<any>();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<{[key: string]: boolean}>({});
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Filter only generic ads (isProductAd === false)
  const filteredAds = React.useMemo(() => {
    if (!ads || !Array.isArray(ads)) return [];
    return ads.filter(ad => ad.isProductAd === false);
  }, [ads]);

  const displayAds = filteredAds.slice(0, limit);

  // Auto-play functionality
  const startAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    
    if (displayAds.length > 1 && isAutoPlaying) {
      autoPlayTimerRef.current = setInterval(() => {
        const nextIndex = (currentIndex + 1) % displayAds.length;
        setCurrentIndex(nextIndex);
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      }, autoPlayInterval);
    }
  }, [displayAds.length, currentIndex, isAutoPlaying, autoPlayInterval]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  // Start/stop auto-play based on dependencies
  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, [startAutoPlay, stopAutoPlay]);

  // Handle manual scroll
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (width - 32));
    if (index !== currentIndex && index < displayAds.length) {
      setCurrentIndex(index);
    }
  };

  const handleImageLoad = (adId: string) => {
    setImageLoaded(prev => ({ ...prev, [adId]: true }));
  };

  // ✅ Handle ad press - navigate to AdListScreen
  const handleAdPress = (ad: any) => {
    console.log('🎯 Ad pressed:', ad.title, ad._id);
    
    if (onAdPress) {
      // Use custom handler if provided
      onAdPress(ad);
    } else {
      // Default: navigate to AdListScreen
      navigation.navigate('AdList', { 
        selectedAdTitle: ad.title || ad.name || 'Sponsored',
        selectedAdId: ad._id
      });
    }
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    flatListRef.current?.scrollToIndex({
      index: index,
      animated: true,
    });
    // Reset auto-play timer when manually navigating
    stopAutoPlay();
    setTimeout(() => startAutoPlay(), 3000);
  };

  // ✅ If no ads to display, return null
  if (displayAds.length === 0) {
    return null;
  }

  const renderAdItem = ({ item }: { item: any }) => {
    const isLoaded = imageLoaded[item._id] || false;
    
    return (
      <TouchableOpacity
        style={styles.adCard}
        onPress={() => handleAdPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          {!isLoaded && (
            <View style={styles.placeholderContainer}>
              <ActivityIndicator size="small" color="#0A3D2B" />
            </View>
          )}
          <Image
            source={{ uri: item.image || 'https://via.placeholder.com/400x200' }}
            style={[styles.adImage, !isLoaded && styles.imageHidden]}
            resizeMode="cover"
            onLoad={() => handleImageLoad(item._id)}
            onError={() => handleImageLoad(item._id)}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
            style={styles.gradientOverlay}
          >
            <View style={styles.adContent}>
              <Text style={styles.adTitle} numberOfLines={1}>
                {item.title || 'Sponsored'}
              </Text>
              {item.description && (
                <Text style={styles.adDescription} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
              <View style={styles.shopNowButton}>
                <Text style={styles.shopNowText}>Shop Now</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      <FlatList
        ref={flatListRef}
        data={displayAds}
        renderItem={renderAdItem}
        keyExtractor={(item, index) => item._id || `ad-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        snapToInterval={width - 32}
        decelerationRate="fast"
        contentContainerStyle={styles.listContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onTouchStart={stopAutoPlay}
        onTouchEnd={() => {
          setTimeout(startAutoPlay, 3000);
        }}
      />
      
      {/* Pagination dots */}
      {displayAds.length > 1 && (
        <View style={styles.paginationContainer}>
          {displayAds.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.paginationDot,
                currentIndex === index && styles.paginationDotActive,
              ]}
              onPress={() => handleDotPress(index)}
              activeOpacity={0.7}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  adCard: {
    width: width - 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#F0F0F0',
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  imageHidden: {
    opacity: 0,
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  adContent: {
    flexDirection: 'column',
  },
  adTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  adDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  shopNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A3D2B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  shopNowText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D1D6',
    marginHorizontal: 5,
  },
  paginationDotActive: {
    backgroundColor: '#0A3D2B',
    width: 20,
  },
});

export default AdCarousel;