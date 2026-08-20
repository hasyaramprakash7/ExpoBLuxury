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
  ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchActiveAds } from '../features/adSlice';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

interface AdListScreenProps {
  products?: any[];
  title?: string;
}

const { width } = Dimensions.get('window');
const CARD_MARGIN = 10;
const CATEGORY_WIDTH = 80;

// ----- Full Width Product Ad Card (for isProductAd === true) -----
const FullWidthProductAdCard: React.FC<{
  ad: any;
  onPress: (ad: any) => void;
  style?: any;
}> = ({ ad, onPress, style }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(3 / 4);

  const handleImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    if (width && height) {
      setImageAspectRatio(width / height);
    }
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageLoaded(true);
  };

  const handleCartPress = useCallback(() => {
    if (ad.link && (ad.link.startsWith('http://') || ad.link.startsWith('https://'))) {
      onPress(ad);
    } else {
      onPress(ad);
    }
  }, [ad, onPress]);

  return (
    <TouchableOpacity
      style={[styles.fullWidthProductAdItem, style]}
      onPress={() => onPress(ad)}
      activeOpacity={0.9}
    >
      <View style={styles.fullWidthProductImageContainer}>
        {!imageLoaded && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="small" color="#0A3D2B" />
          </View>
        )}
        <Image
          source={{ uri: ad.image || 'https://via.placeholder.com/400x500' }}
          style={[
            styles.fullWidthProductAdImage,
            !imageLoaded && styles.imageHidden,
            { aspectRatio: imageAspectRatio }
          ]}
          resizeMode="contain"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.8)']}
          style={styles.fullWidthOverlay}
        >
          <View style={styles.fullWidthOverlayContent}>
            <View style={styles.fullWidthTextContainer}>
              {ad.price && (
                <Text style={styles.fullWidthAdPrice}>₹{ad.price}</Text>
              )}
              {ad.description && (
                <Text style={styles.fullWidthAdDescription} numberOfLines={2}>
                  {ad.description}
                </Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.glassCartContainer}
              onPress={handleCartPress}
            >
              <Ionicons name="cart-outline" size={24} color="#FFFFFF" style={styles.glassCartIcon} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

// ----- Generic Ad (full‑width banner) -----
const GenericAdCard: React.FC<{
  ad: any;
  onPress: (ad: any) => void;
  style?: any;
}> = ({ ad, onPress, style }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.genericAdItem, style]}
      onPress={() => onPress(ad)}
      activeOpacity={0.9}
    >
      <View style={styles.genericImageContainer}>
        {!imageLoaded && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator size="small" color="#0A3D2B" />
          </View>
        )}
        <Image
          source={{ uri: ad.image || 'https://via.placeholder.com/400x300' }}
          style={[styles.genericAdImage, !imageLoaded && styles.imageHidden]}
          resizeMode="cover"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.7)']}
          style={styles.overlay}
        >
          <View style={styles.overlayContent}>
            <Text style={styles.adTitle} numberOfLines={2}>
              {ad.title || 'Sponsored'}
            </Text>
            <TouchableOpacity 
              style={styles.shopNowContainer}
              onPress={() => onPress(ad)}
            >
              <Text style={styles.shopNowText}>Click Me</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

// ----- Product Card (for regular products) -----
const ProductCard: React.FC<{
  product: any;
  onPress: (item: any) => void;
}> = ({ product, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => onPress(product)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: product.images?.[0] || 'https://via.placeholder.com/300x300' }}
        style={styles.productImage}
        resizeMode="cover"
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.productPrice}>₹{product.price}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ----- Sidebar Ad Item Component (Rectangular with full background image) -----
const SidebarAdItem: React.FC<{
  ad: any;
  isSelected: boolean;
  onPress: (ad: any) => void;
}> = ({ ad, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.sidebarAdItem, isSelected && styles.sidebarAdItemSelected]}
      onPress={() => onPress(ad)}
      activeOpacity={0.7}
    >
      <View style={[styles.sidebarAdImageContainer, isSelected && styles.sidebarAdImageContainerSelected]}>
        {ad.image ? (
          <Image
            source={{ uri: ad.image }}
            style={styles.sidebarAdImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.sidebarAdPlaceholder}>
            <Ionicons name="megaphone-outline" size={32} color="#0A3D2B" />
          </View>
        )}
      </View>
      <Text 
        style={[styles.sidebarAdName, isSelected && styles.sidebarAdNameSelected]} 
        numberOfLines={2}
      >
        {ad.title || 'Sponsored'}
      </Text>
    </TouchableOpacity>
  );
};

// ----- Main Component -----
const AdListScreen: React.FC<AdListScreenProps> = ({ products: externalProducts, title = '' }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isMounted = useRef(true);
  const initialLoadDone = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const paramsProcessed = useRef(false);

  const { activeAds, loading, error } = useSelector((state: RootState) => state.ads);
  const [refreshing, setRefreshing] = useState(false);
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [sidebarAds, setSidebarAds] = useState<any[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Get navigation params
  const selectedAdId = route.params?.selectedAdId || route.params?.adId;
  const selectedAdTitle = route.params?.selectedAdTitle;

  // Log the params for debugging
  useEffect(() => {
    console.log('📋 [AdListScreen] Received params:', { 
      selectedAdId, 
      selectedAdTitle,
      routeParams: route.params 
    });
  }, [selectedAdId, selectedAdTitle, route.params]);

  // Load ads if not provided externally
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      if (!externalProducts) {
        console.log('🔄 [AdListScreen] Fetching active ads');
        dispatch(fetchActiveAds());
      }
    }
    return () => {
      isMounted.current = false;
    };
  }, [dispatch, externalProducts]);

  // Process ads and filter by selected generic ad
  useEffect(() => {
    const products = externalProducts || [];
    const ads = activeAds || [];

    console.log('📊 [AdListScreen] Processing ads:', { 
      totalAds: ads.length,
      externalProducts: externalProducts?.length || 0 
    });

    // Separate generic and product ads
    const genericAds = ads.filter(ad => ad.isProductAd === false);
    const productAds = ads.filter(ad => ad.isProductAd === true);

    console.log('📊 [AdListScreen] Generic ads:', genericAds.length, 'Product ads:', productAds.length);

    // Set sidebar ads - only generic ads with title
    const validGenericAds = genericAds.filter(ad => ad.title && ad.title.trim().length > 0);
    setSidebarAds(validGenericAds);

    // ✅ ONLY use params if we haven't initialized yet OR if params changed
    // and we haven't manually selected an ad
    if (!hasInitialized) {
      // Check if we have a selected ad from navigation params
      let selectedAdFromParams = null;
      if (selectedAdId) {
        selectedAdFromParams = validGenericAds.find(ad => ad._id === selectedAdId);
        console.log('🔍 [AdListScreen] Looking for ad by ID:', selectedAdId, 'Found:', !!selectedAdFromParams);
      } else if (selectedAdTitle) {
        selectedAdFromParams = validGenericAds.find(
          ad => ad.title && ad.title.trim().toLowerCase() === selectedAdTitle.trim().toLowerCase()
        );
        console.log('🔍 [AdListScreen] Looking for ad by Title:', selectedAdTitle, 'Found:', !!selectedAdFromParams);
      }

      // If we have a selected ad from params, use it
      if (selectedAdFromParams) {
        console.log('✅ [AdListScreen] Selected ad from params:', selectedAdFromParams.title);
        setSelectedAd(selectedAdFromParams);
      } 
      // If no selected ad and we have generic ads, select the first one
      else if (validGenericAds.length > 0 && !selectedAd) {
        console.log('✅ [AdListScreen] Selecting first generic ad:', validGenericAds[0].title);
        setSelectedAd(validGenericAds[0]);
      }
      setHasInitialized(true);
    }

    // Build display data based on selected ad
    const merged: any[] = [];

    if (selectedAd) {
      const title = selectedAd.title.trim();
      console.log('📊 [AdListScreen] Building display for selected ad:', title);
      
      // First, add the selected generic ad (full width)
      merged.push({ type: 'ad', data: selectedAd });
      
      // Then add all product ads with the same title
      const matchingProductAds = productAds.filter(pa => pa.title && pa.title.trim() === title);
      console.log('📊 [AdListScreen] Matching product ads:', matchingProductAds.length);
      
      matchingProductAds.forEach(pa => {
        merged.push({ type: 'fullProductAd', data: pa });
      });

      // If there are no product ads matching, show a message
      if (matchingProductAds.length === 0) {
        console.log('⚠️ [AdListScreen] No matching product ads found for:', title);
      }
    } else {
      // No selected ad - show all generic ads and product ads separately
      console.log('📊 [AdListScreen] No selected ad, showing all');
      const allAds = [...genericAds, ...productAds];
      allAds.forEach(ad => {
        if (ad.isProductAd) {
          merged.push({ type: 'fullProductAd', data: ad });
        } else {
          merged.push({ type: 'ad', data: ad });
        }
      });
    }

    console.log('📊 [AdListScreen] Display data items:', merged.length);
    setDisplayData(merged);
  }, [externalProducts, activeAds, selectedAd, selectedAdId, selectedAdTitle, hasInitialized]);

  // ✅ Scroll to selected ad in sidebar
  useEffect(() => {
    if (selectedAd && sidebarAds.length > 0) {
      const index = sidebarAds.findIndex(ad => ad._id === selectedAd._id);
      if (index !== -1) {
        console.log('📜 [AdListScreen] Scrolling to sidebar item:', index, selectedAd.title);
        // Small delay to ensure layout is ready
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: index * 90, // Approximate height of each sidebar item
            animated: true,
          });
        }, 200);
      }
    }
  }, [selectedAd, sidebarAds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!externalProducts) {
      await dispatch(fetchActiveAds());
    }
    setRefreshing(false);
  }, [dispatch, externalProducts]);

  const handleAdPress = useCallback((ad: any) => {
    if (ad.link && (ad.link.startsWith('http://') || ad.link.startsWith('https://'))) {
      navigation.navigate('WebViewScreen', { url: ad.link });
    } else {
      navigation.navigate('AdDetail', { ad });
    }
  }, [navigation]);

  const handleProductPress = useCallback((product: any) => {
    navigation.navigate('ProductDetails', { productId: product._id });
  }, [navigation]);

  // ✅ Handle sidebar ad press - clear route params to prevent override
  const handleSidebarAdPress = useCallback((ad: any) => {
    console.log('🔄 [AdListScreen] Sidebar ad pressed:', ad.title);
    // Clear the route params so they don't override our selection
    navigation.setParams({ 
      selectedAdId: undefined,
      selectedAdTitle: undefined,
      adId: undefined
    });
    setSelectedAd(ad);
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (!item) return null;
    if (item.type === 'product') {
      return <ProductCard product={item.data} onPress={handleProductPress} />;
    } else if (item.type === 'fullProductAd') {
      return <FullWidthProductAdCard ad={item.data} onPress={handleAdPress} />;
    } else {
      return <GenericAdCard ad={item.data} onPress={handleAdPress} />;
    }
  }, [handleAdPress, handleProductPress]);

  // Loading / error / empty states
  if (loading && !refreshing && displayData.length === 0 && !externalProducts) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0A3D2B" />
        <Text style={styles.loadingText}>Loading ads...</Text>
      </View>
    );
  }

  if (error && !externalProducts) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load ads</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sidebarAds.length === 0 && displayData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No content available</Text>
        <Text style={styles.emptySubText}>Check back later</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sidebar with Generic Ads */}
      <View style={styles.sidebar}>
        <ScrollView 
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sidebarList}
        >
          {sidebarAds.map((ad) => (
            <SidebarAdItem
              key={ad._id}
              ad={ad}
              isSelected={selectedAd?._id === ad._id}
              onPress={handleSidebarAdPress}
            />
          ))}
        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <View style={styles.topSpacing} />
        
        {title && <Text style={styles.sectionTitle}>{title}</Text>}
        
        {/* Show selected ad name */}
        {selectedAd && (
          <View style={styles.selectedAdHeader}>
            <Text style={styles.selectedAdHeaderTitle}>
              {selectedAd.title}
            </Text>
            <Text style={styles.selectedAdHeaderCount}>
              {displayData.filter(d => d.type === 'fullProductAd').length} products
            </Text>
          </View>
        )}

        <FlatList
          data={displayData}
          renderItem={renderItem}
          keyExtractor={(item, index) => {
            if (item.type === 'product') {
              return `product-${item.data._id || index}`;
            } else if (item.type === 'fullProductAd') {
              return `fullProductAd-${item.data._id || index}`;
            } else {
              return `ad-${item.data._id || index}`;
            }
          }}
          numColumns={1}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListFooterComponent={
            displayData.length > 0 ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {displayData.filter(d => d.type === 'product').length} products · {displayData.filter(d => d.type === 'ad' || d.type === 'fullProductAd').length} ads
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F8F8',
    flexDirection: 'row',
    paddingTop: 18,
  },
  
  // Sidebar for Ads
  sidebar: {
    width: CATEGORY_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E5EA',
    paddingTop: 8,
  },
  sidebarList: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  sidebarAdItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    width: CATEGORY_WIDTH,
  },
  sidebarAdItemSelected: {
    backgroundColor: 'rgba(10, 61, 43, 0.08)',
  },
  sidebarAdImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  sidebarAdImageContainerSelected: {
    borderColor: '#0A3D2B',
  },
  sidebarAdImage: {
    width: '100%',
    height: '100%',
  },
  sidebarAdPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarAdName: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 2,
  },
  sidebarAdNameSelected: {
    color: '#0A3D2B',
    fontWeight: '700',
  },

  // Main Content
  mainContent: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  
  topSpacing: {
    height: 12,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  
  selectedAdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedAdHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  selectedAdHeaderCount: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },

  listContainer: { 
    paddingBottom: 16, 
    paddingHorizontal: 12,
    gap: 12,
  },

  headerContainer: {
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  groupContainer: {
    marginBottom: 16,
  },

  // Full Width Product Ad
  fullWidthProductAdItem: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 16,
    width: '100%',
  },
  fullWidthProductImageContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#F0F0F0',
  },
  fullWidthProductAdImage: { 
    width: '100%',
    height: undefined,
  },
  imageHidden: { opacity: 0 },
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
  fullWidthOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 24,
  },
  fullWidthOverlayContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  fullWidthTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  fullWidthAdTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 4,
  },
  fullWidthAdPrice: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 2,
  },
  fullWidthAdDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  glassCartContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: 'rgba(255, 255, 255, 0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 2,
  },
  glassCartIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  fullWidthShopNowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A3D2B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    minWidth: 130,
    justifyContent: 'center',
    shadowColor: '#0A3D2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    alignSelf: 'flex-start',
  },
  fullWidthShopNowText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 6,
    letterSpacing: 0.5,
  },
  fullWidthProductList: {
    width: '100%',
  },

  // Generic Ad
  genericAdItem: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 16,
  },
  genericImageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#F0F0F0',
  },
  genericAdImage: { 
    width: '100%', 
    height: '100%' 
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  overlayContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  adTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  shopNowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A3D2B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
    minWidth: 110,
    justifyContent: 'center',
    shadowColor: '#0A3D2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  shopNowText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },

  // Product Card
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  productImage: {
    width: 120,
    height: 120,
  },
  productInfo: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B8C40',
  },

  // Common
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
    backgroundColor: '#0A3D2B',
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