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
  TextInput,
  SafeAreaView,
  StatusBar,
  Animated,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Share as RNShare,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchActiveAds } from '../features/adSlice';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import Share from 'react-native-share';

// ---------- Dynamically load speech recognition (fallback for Expo Go) ----------
let SpeechRecognition: any = null;
try {
  SpeechRecognition = require('expo-speech-recognition');
} catch (e) {
  console.warn('🔇 Speech recognition not available', e);
}

// Play Store & App Store links – replace with your actual links
const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury';
const APP_STORE_LINK = 'https://apps.apple.com/app/bluxury/id123456789';

// Helper to detect user cancellation
const isCancellationError = (error: any): boolean => {
  const msg = error?.message?.toLowerCase() || '';
  return (
    msg.includes('user cancelled') ||
    msg.includes('canceled') ||
    msg.includes('user did not share') ||
    msg.includes('dismissed')
  );
};

// ---------- Share function (reusable) ----------
const shareAd = async (ad: any, setIsSharing: (val: boolean) => void) => {
  if (!ad) return;

  setIsSharing(true);
  try {
    const imageUrl = ad.image || '';
    const title = ad.title || 'Ad';
    const description = ad.description || '';
    const category = ad.category || '';
    const link = ad.link || '';

    let message = `📢 *${title}*\n\n`;
    if (description) message += `${description}\n\n`;
    if (category) message += `🏷️ Category: ${category}\n`;
    if (link) message += `🔗 Link: ${link}\n\n`;
    const appLink = Platform.OS === 'ios' ? APP_STORE_LINK : PLAY_STORE_LINK;
    message += `📱 Download the BLuxury App: ${appLink}`;

    if (imageUrl) {
      try {
        const timestamp = Date.now();
        const filePath = `${FileSystem.cacheDirectory}ad_${timestamp}.jpg`;
        const downloadResult = await FileSystem.downloadAsync(imageUrl, filePath);
        if (downloadResult.status === 200) {
          let localUri = downloadResult.uri;
          if (Platform.OS === 'android') {
            localUri = `file://${localUri}`;
          }
          const shareOptions = {
            title: 'BLuxury Ad',
            message: message,
            url: localUri,
            type: 'image/jpeg',
          };
          await Share.open(shareOptions);
          setIsSharing(false);
          return;
        }
      } catch (imageError) {
        if (isCancellationError(imageError)) {
          setIsSharing(false);
          return;
        }
        console.log('Image share failed, falling back to text', imageError);
      }
    }

    await RNShare.share({
      message: message,
      title: 'BLuxury Ad',
    });
  } catch (error) {
    console.error('Share error:', error);
    if (!isCancellationError(error)) {
      Alert.alert('Share Error', 'Could not share this ad. Please try again.');
    }
  } finally {
    setIsSharing(false);
  }
};

// ---------- Component Interfaces ----------
interface AdListScreenProps {
  products?: any[];
  title?: string;
}

const { width } = Dimensions.get('window');
const TAB_WIDTH = 80;
const TAB_HEIGHT = 80;
const CATEGORY_ITEM_WIDTH = 90;
const TOP_BAR_HEIGHT = 270;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// ----- helper to normalize phone -----
const normalizePhone = (phone: string) => {
  if (!phone) return '';
  return phone.replace(/^\+91/, '').replace(/\D/g, '');
};

// ----- Category Item Component -----
const CategoryItem: React.FC<{
  category: string;
  image: string;
  isSelected: boolean;
  onPress: (category: string) => void;
}> = ({ category, image, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        isSelected && styles.categoryItemActive,
      ]}
      onPress={() => onPress(category)}
      activeOpacity={0.7}
    >
      <View style={styles.categoryImageContainer}>
        <Image
          source={{ uri: image || 'https://via.placeholder.com/80' }}
          style={styles.categoryImage}
          resizeMode="cover"
        />
        {isSelected && (
          <View style={styles.categorySelectedOverlay}>
            <Ionicons name="checkmark-circle" size={18} color="#0A3D2B" />
          </View>
        )}
      </View>
      <Text
        style={[
          styles.categoryText,
          isSelected && styles.categoryTextActive,
        ]}
        numberOfLines={1}
      >
        {category}
      </Text>
    </TouchableOpacity>
  );
};

// ----- Full Width Product Ad Card with Share & optional owner -----
const FullWidthProductAdCard: React.FC<{
  ad: any;
  onPress: (ad: any) => void;
  style?: any;
  showOwner?: boolean;
}> = ({ ad, onPress, style, showOwner = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(3 / 4);
  const [isSharing, setIsSharing] = useState(false);

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

  const handleShare = useCallback(() => {
    shareAd(ad, setIsSharing);
  }, [ad]);

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
              {showOwner && ad.userName && (
                <Text style={styles.ownerName}>👤 {ad.userName}</Text>
              )}
              {ad.description && (
                <Text style={styles.fullWidthAdDescription} numberOfLines={2}>
                  {ad.description}
                </Text>
              )}
              {ad.category && (
                <Text style={styles.fullWidthAdCategory}>{ad.category}</Text>
              )}
            </View>
            <View style={styles.fullWidthActionButtons}>
              <TouchableOpacity
                style={styles.glassCartContainer}
                onPress={() => onPress(ad)}
              >
                <Ionicons name="cart-outline" size={24} color="#FFFFFF" style={styles.glassCartIcon} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.glassCartContainer, { marginLeft: 8 }]}
                onPress={handleShare}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

// ----- Generic Ad Card with Share & optional owner -----
const GenericAdCard: React.FC<{
  ad: any;
  onPress: (ad: any) => void;
  style?: any;
  showOwner?: boolean;
}> = ({ ad, onPress, style, showOwner = false }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(() => {
    shareAd(ad, setIsSharing);
  }, [ad]);

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
            <View style={styles.adTextContainer}>
              {showOwner && ad.userName && (
                <Text style={styles.ownerName}>👤 {ad.userName}</Text>
              )}
              <Text style={styles.adTitle} numberOfLines={2}>
                {ad.title || 'Sponsored'}
              </Text>
              {ad.description && (
                <Text style={styles.adDescription} numberOfLines={1}>
                  {ad.description}
                </Text>
              )}
              {ad.category && (
                <Text style={styles.adCategory}>{ad.category}</Text>
              )}
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.shopNowContainer}
                onPress={() => onPress(ad)}
              >
                <Text style={styles.shopNowText}>Click Me</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shopNowContainer, { marginLeft: 8, backgroundColor: '#1A1A1A' }]}
                onPress={handleShare}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

// ----- Product Card (unchanged) -----
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

// ----- Main Component -----
const AdListScreen: React.FC<AdListScreenProps> = ({ products: externalProducts, title = '' }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isMounted = useRef(true);
  const initialLoadDone = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);
  const categoryScrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHeaderHidden = useRef(false);
  
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const isHorizontalScrolling = useRef(false);
  const horizontalScrollTimer = useRef<NodeJS.Timeout | null>(null);
  
  const { activeAds, loading, error } = useSelector((state: RootState) => state.ads);
  const user = useSelector((state: RootState) => state.auth.user);
  
  // ✅ Normalize phone and check if special user
  const normalizedPhone = normalizePhone(user?.phone || '');
  const isSpecialUser = normalizedPhone === '7893828468';
  
  const [refreshing, setRefreshing] = useState(false);
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [sidebarAds, setSidebarAds] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  // State for categories - specific to selected title
  const [categories, setCategories] = useState<{ name: string; image: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);

  // Get navigation params
  const selectedAdId = route.params?.selectedAdId || route.params?.adId;
  const selectedAdTitle = route.params?.selectedAdTitle;

  // --- State for Instagram-grade browser (prevents double taps) ---
  const [isOpeningBrowser, setIsOpeningBrowser] = useState(false);

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
        dispatch(fetchActiveAds(searchQuery || undefined));
      }
    }
  }, [dispatch, externalProducts, searchQuery]);

  // Helper function to find ad by ID or title (uses the provided list)
  const findAdByParams = useCallback((adsList: any[]) => {
    if (selectedAdId) {
      const found = adsList.find(ad => ad._id === selectedAdId);
      if (found) {
        console.log('🔍 [AdListScreen] Found ad by ID:', found.title);
        return found;
      }
    }
    if (selectedAdTitle) {
      const found = adsList.find(
        ad => ad.title && ad.title.trim().toLowerCase() === selectedAdTitle.trim().toLowerCase()
      );
      if (found) {
        console.log('🔍 [AdListScreen] Found ad by Title:', found.title);
        return found;
      }
    }
    return null;
  }, [selectedAdId, selectedAdTitle]);

  // ----- Voice Search Handler (only if module available) -----
  const handleVoiceSearch = useCallback(async () => {
    if (!SpeechRecognition) {
      Alert.alert('Not Available', 'Voice search is not supported in this environment.');
      return;
    }

    if (isRecording) {
      try {
        await SpeechRecognition.stopAsync();
      } catch (e) {
        console.warn('Stop error:', e);
      }
      setIsRecording(false);
      return;
    }

    const { status } = await SpeechRecognition.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow speech recognition to use voice search.');
      return;
    }

    setIsRecording(true);

    try {
      const subscription = SpeechRecognition.addListener('onResult', (event: any) => {
        const transcript = event.results?.[0]?.transcript;
        if (transcript) {
          setSearchQuery(transcript);
          setIsRecording(false);
          SpeechRecognition.stopAsync().catch(console.warn);
        }
      });

      const errorSub = SpeechRecognition.addListener('onError', (error: any) => {
        console.error('Speech error:', error);
        setIsRecording(false);
        SpeechRecognition.stopAsync().catch(console.warn);
      });

      const endSub = SpeechRecognition.addListener('onEnd', () => {
        setIsRecording(false);
        subscription.remove();
        errorSub.remove();
        endSub.remove();
      });

      await SpeechRecognition.startAsync({
        lang: 'en-US',
        interimResults: true,
        maxResults: 1,
      });
    } catch (error) {
      console.error('Voice search error:', error);
      setIsRecording(false);
      Alert.alert('Error', 'Failed to start voice recognition. Please try again.');
    }
  }, [isRecording]);

  // Back handler for search - clears search on back press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searchQuery.length > 0) {
        setSearchQuery('');
        return true;
      }
      if (searchInputRef.current?.isFocused()) {
        searchInputRef.current?.blur();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [searchQuery]);

  // Process ads and extract categories - ONLY for the selected title
  useEffect(() => {
    const products = externalProducts || [];
    let ads = activeAds || [];

    console.log('📊 [AdListScreen] Processing ads:', { 
      totalAds: ads.length,
      externalProducts: externalProducts?.length || 0 
    });

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      ads = ads.filter(ad => 
        (ad.title && ad.title.toLowerCase().includes(query)) ||
        (ad.description && ad.description.toLowerCase().includes(query)) ||
        (ad.category && ad.category.toLowerCase().includes(query))
      );
    }

    const genericAds = ads.filter(ad => ad.isProductAd === false);
    const productAds = ads.filter(ad => ad.isProductAd === true);

    console.log('📊 [AdListScreen] Generic ads:', genericAds.length, 'Product ads:', productAds.length);

    // ----- DEDUPLICATE SIDEBAR ADS BY TITLE -----
    let validGenericAds = genericAds.filter(ad => ad.title && ad.title.trim().length > 0);
    const uniqueMap = new Map<string, any>();
    validGenericAds.forEach(ad => {
      const key = ad.title.trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, ad);
      }
    });
    const uniqueSidebarAds = Array.from(uniqueMap.values());
    setSidebarAds(uniqueSidebarAds);

    // Find ad from params using the unique list
    let adToSelect = findAdByParams(uniqueSidebarAds);
    
    if (!adToSelect && uniqueSidebarAds.length > 0 && !selectedAd) {
      console.log('✅ [AdListScreen] Selecting first generic ad:', uniqueSidebarAds[0].title);
      adToSelect = uniqueSidebarAds[0];
    }

    if (selectedAd && searchQuery.trim()) {
      const stillExists = uniqueSidebarAds.some(ad => ad._id === selectedAd._id);
      if (!stillExists) {
        console.log('🔍 [AdListScreen] Selected ad not in search results, clearing selection');
        setSelectedAd(null);
        navigation.setParams({ selectedAdId: undefined, selectedAdTitle: undefined, adId: undefined });
        return;
      }
    }

    if (adToSelect) {
      if (!selectedAd || selectedAd._id !== adToSelect._id) {
        console.log('🔄 [AdListScreen] Setting selected ad to:', adToSelect.title);
        setSelectedAd(adToSelect);
        return;
      }
    }

    // --- EXTRACT CATEGORIES ONLY FOR THE SELECTED TITLE ---
    if (selectedAd) {
      const selectedTitle = selectedAd.title.trim();
      console.log('📊 [AdListScreen] Extracting categories for title:', selectedTitle);
      
      const productAdsForTitle = productAds.filter(pa => 
        pa.title && pa.title.trim() === selectedTitle
      );
      
      console.log('📊 [AdListScreen] Product ads for this title:', productAdsForTitle.length);
      
      const categoryMap = new Map<string, string>();
      productAdsForTitle.forEach(ad => {
        if (ad.category && ad.category.trim()) {
          const catName = ad.category.trim();
          if (!categoryMap.has(catName)) {
            categoryMap.set(catName, ad.image || 'https://via.placeholder.com/80');
          }
        }
      });
      
      const extractedCategories = Array.from(categoryMap.entries()).map(([name, image]) => ({
        name,
        image,
      }));
      setCategories(extractedCategories);
      console.log('📊 [AdListScreen] Extracted categories for this title:', extractedCategories.length);
      
      if (selectedCategory) {
        const categoryExists = extractedCategories.some(c => c.name === selectedCategory);
        if (!categoryExists) {
          setSelectedCategory(null);
        }
      }
    } else {
      setCategories([]);
      setSelectedCategory(null);
    }

    // =============================================================
    // ⭐ BUILD DISPLAY DATA: Include ALL ads (generic + product)
    // with the selected title, not just product ads.
    // =============================================================
    const merged: any[] = [];

    if (selectedAd) {
      const title = selectedAd.title.trim();
      console.log('📊 [AdListScreen] Building display for selected ad:', title);
      
      merged.push({ type: 'ad', data: selectedAd });

      const allMatchingAds = ads.filter(ad => 
        ad.title && ad.title.trim() === title && ad._id !== selectedAd._id
      );

      let filteredMatchingAds = allMatchingAds;
      if (selectedCategory) {
        filteredMatchingAds = allMatchingAds.filter(ad => 
          ad.category && ad.category.trim().toLowerCase() === selectedCategory.toLowerCase()
        );
      }

      filteredMatchingAds.forEach(ad => {
        if (ad.isProductAd) {
          merged.push({ type: 'fullProductAd', data: ad });
        } else {
          merged.push({ type: 'ad', data: ad });
        }
      });

      setFilteredProducts(filteredMatchingAds.filter(ad => ad.isProductAd));

    } else {
      let allAds = [...genericAds, ...productAds];
      
      if (selectedCategory) {
        allAds = allAds.filter(ad => 
          ad.category && ad.category.trim().toLowerCase() === selectedCategory.toLowerCase()
        );
      }
      
      allAds.forEach(ad => {
        if (ad.isProductAd) {
          merged.push({ type: 'fullProductAd', data: ad });
        } else {
          merged.push({ type: 'ad', data: ad });
        }
      });
      
      setFilteredProducts(productAds);
    }

    console.log('📊 [AdListScreen] Display data items:', merged.length);
    setDisplayData(merged);
    
  }, [externalProducts, activeAds, selectedAd, findAdByParams, searchQuery, navigation, selectedCategory]);

  // Scroll the main list to the top whenever selectedAd or searchQuery changes
  useEffect(() => {
    if (displayData.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedAd, searchQuery, displayData.length]);

  // Scroll to selected ad in horizontal scroll view with smooth indicator
  useEffect(() => {
    if (selectedAd && sidebarAds.length > 0) {
      const index = sidebarAds.findIndex(ad => ad._id === selectedAd._id);
      if (index !== -1) {
        console.log('📜 [AdListScreen] Scrolling to sidebar item:', index, selectedAd.title);
        const scrollToX = index * (TAB_WIDTH + 8) - (width / 2 - TAB_WIDTH / 2);
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: Math.max(0, scrollToX),
            animated: true,
          });
        }, 100);
        
        const targetPosition = index * (TAB_WIDTH + 8) + 8;
        indicatorPosition.stopAnimation();
        Animated.timing(indicatorPosition, {
          toValue: targetPosition,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }
    }
  }, [selectedAd, sidebarAds]);

  const handleHorizontalScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const tabIndex = Math.round(offsetX / (TAB_WIDTH + 8));
    const clampedIndex = Math.max(0, Math.min(tabIndex, sidebarAds.length - 1));
    const targetPosition = clampedIndex * (TAB_WIDTH + 8) + 8;
    if (!isHorizontalScrolling.current) {
      indicatorPosition.setValue(targetPosition);
    }
  };

  const handleHorizontalScrollBeginDrag = () => {
    isHorizontalScrolling.current = true;
    if (horizontalScrollTimer.current) {
      clearTimeout(horizontalScrollTimer.current);
    }
  };

  const handleHorizontalScrollEndDrag = () => {
    if (horizontalScrollTimer.current) {
      clearTimeout(horizontalScrollTimer.current);
    }
    horizontalScrollTimer.current = setTimeout(() => {
      isHorizontalScrolling.current = false;
    }, 300);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!externalProducts) {
      await dispatch(fetchActiveAds(searchQuery || undefined));
    }
    setRefreshing(false);
  }, [dispatch, externalProducts, searchQuery]);

  // ============================================================
  // 🚀 INSTAGRAM-GRADE NATIVE BROWSER (expo-web-browser)
  // ============================================================
  const openLinkInNativeBrowser = useCallback(async (url: string) => {
    if (isOpeningBrowser) return;
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Invalid Link', 'This link cannot be opened.');
      return;
    }

    try {
      setIsOpeningBrowser(true);
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: '#0A3D2B',
        controlsColor: '#FFFFFF',
        dismissButtonStyle: 'close',
        enableBarCollapsing: true,
        showTitle: true,
        enableDefaultShare: true,
      });
    } catch (error) {
      console.warn('WebBrowser error:', error);
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot open this link.');
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to open link.');
      }
    } finally {
      setIsOpeningBrowser(false);
    }
  }, [isOpeningBrowser]);

  // ---- REPLACED: Ad Press Handler with Native Browser ----
  const handleAdPress = useCallback((ad: any) => {
    if (ad.link && (ad.link.startsWith('http://') || ad.link.startsWith('https://'))) {
      openLinkInNativeBrowser(ad.link);
    } else {
      navigation.navigate('AdDetail', { ad });
    }
  }, [navigation, openLinkInNativeBrowser]);

  // ---- Reset browser opening flag if screen loses focus ----
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsOpeningBrowser(false);
      };
    }, [])
  );

  const handleProductPress = useCallback((product: any) => {
    navigation.navigate('ProductDetails', { productId: product._id });
  }, [navigation]);

  const handleSidebarAdPress = useCallback((ad: any) => {
    console.log('🔄 [AdListScreen] Sidebar ad pressed:', ad.title);
    navigation.setParams({ 
      selectedAdId: undefined,
      selectedAdTitle: undefined,
      adId: undefined
    });
    setSelectedAd(ad);
    setSelectedCategory(null);
    setCategories([]);
  }, [navigation]);

  const handleCategoryPress = useCallback((categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryName);
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    }
  }, [selectedCategory]);

  const handleSettingsPress = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (!item) return null;
    if (item.type === 'product') {
      return <ProductCard product={item.data} onPress={handleProductPress} />;
    } else if (item.type === 'fullProductAd') {
      return <FullWidthProductAdCard ad={item.data} onPress={handleAdPress} showOwner={isSpecialUser} />;
    } else {
      return <GenericAdCard ad={item.data} onPress={handleAdPress} showOwner={isSpecialUser} />;
    }
  }, [handleAdPress, handleProductPress, isSpecialUser]);

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;
    
    if (currentScrollY > 20) {
      if (diff > 3) {
        if (!isHeaderHidden.current) {
          isHeaderHidden.current = true;
          Animated.timing(headerTranslateY, {
            toValue: -TOP_BAR_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      } else if (diff < -3) {
        if (isHeaderHidden.current) {
          isHeaderHidden.current = false;
          Animated.timing(headerTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      }
    } else {
      if (isHeaderHidden.current) {
        isHeaderHidden.current = false;
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
    lastScrollY.current = currentScrollY;
  };

  // Loading / error states
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <Animated.View 
          style={[
            styles.topBar,
            {
              transform: [{ translateY: headerTranslateY }],
            }
          ]}
        >
          <View style={styles.searchBarContainer}>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={handleSettingsPress}
            />
            
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search ads by title, description or category..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
              onSubmitEditing={() => {
                searchInputRef.current?.blur();
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
            {SpeechRecognition && (
              <TouchableOpacity
                onPress={handleVoiceSearch}
                style={styles.voiceButton}
                disabled={isRecording}
              />
            )}
          </View>
          
          {/* Title List */}
          <View style={styles.tabsWrapper}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScrollView}
              contentContainerStyle={styles.tabsContent}
              onScroll={handleHorizontalScroll}
              onScrollBeginDrag={handleHorizontalScrollBeginDrag}
              onScrollEndDrag={handleHorizontalScrollEndDrag}
              scrollEventThrottle={16}
            >
              {sidebarAds.map((ad, index) => (
                <TouchableOpacity
                  key={ad._id}
                  style={[
                    styles.tabItem,
                    selectedAd?._id === ad._id && styles.tabItemActive,
                  ]}
                  onPress={() => handleSidebarAdPress(ad)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabImageContainer}>
                    <Image
                      source={{ uri: ad.image || 'https://via.placeholder.com/80' }}
                      style={styles.tabImage}
                      resizeMode="cover"
                    />
                  </View>
                  <Text
                    style={[
                      styles.tabText,
                      selectedAd?._id === ad._id && styles.tabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {ad.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Animated.View 
              style={[
                styles.indicator,
                {
                  transform: [{ translateX: indicatorPosition }],
                }
              ]}
            />
          </View>

          {/* Category List - Directly below title list with proper spacing */}
          {selectedAd && categories.length > 0 && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categorySectionTitle}>Categories</Text>
                {selectedCategory && (
                  <TouchableOpacity 
                    onPress={() => setSelectedCategory(null)}
                    style={styles.clearCategoryButton}
                  >
                    <Text style={styles.clearCategoryText}>Clear</Text>
                    <Ionicons name="close-circle" size={16} color="#0A3D2B" />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView
                ref={categoryScrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScrollView}
                contentContainerStyle={styles.categoryScrollContent}
              >
                {categories.map((category) => (
                  <CategoryItem
                    key={category.name}
                    category={category.name}
                    image={category.image}
                    isSelected={selectedCategory === category.name}
                    onPress={handleCategoryPress}
                  />
                ))}
              </ScrollView>
              {selectedCategory && filteredProducts.length > 0 && (
                <View style={styles.categoryResultHeader}>
                  <Text style={styles.categoryResultText}>
                    {filteredProducts.length} products in "{selectedCategory}"
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {selectedAd && categories.length === 0 && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categorySectionTitle}>Categories</Text>
              </View>
              <View style={styles.noCategoryContainer}>
                <Text style={styles.noCategoryText}>No categories available for this title</Text>
              </View>
            </View>
          )}
        </Animated.View>

        <View style={styles.mainContent}>
          <AnimatedFlatList
            ref={flatListRef}
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={
              <>
                <View style={{ height: TOP_BAR_HEIGHT + 16 }} />
                
                {title && <Text style={styles.sectionTitle}>{title}</Text>}
                {selectedAd && displayData.length > 0 && (
                  <View style={styles.selectedAdHeader}>
                    <Text style={styles.selectedAdHeaderTitle}>{selectedAd.title}</Text>
                    <Text style={styles.selectedAdHeaderCount}>
                      {displayData.filter(d => d.type === 'fullProductAd').length} products
                    </Text>
                  </View>
                )}
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons 
                  name={searchQuery.trim() ? "search-outline" : "megaphone-outline"} 
                  size={60} 
                  color="#CCCCCC" 
                />
                <Text style={styles.emptyText}>
                  {searchQuery.trim() 
                    ? `No results found for "${searchQuery.trim()}"` 
                    : "No content available"}
                </Text>
                <Text style={styles.emptySubText}>
                  {searchQuery.trim() ? "Try a different search term" : "Check back later"}
                </Text>
              </View>
            }
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
    </SafeAreaView>
  );
};

// ----- Styles (unchanged) -----
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
    paddingTop: StatusBar.currentHeight || 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    height: 40,
  },
  settingsButton: { paddingRight: 10, paddingVertical: 4 },
  searchInput: { flex: 1, fontSize: 16, color: '#1C1C1E', marginLeft: 8, paddingVertical: 0 },
  voiceButton: { paddingHorizontal: 8, paddingVertical: 4 },
  tabsWrapper: { position: 'relative', paddingBottom: 4 },
  tabsScrollView: { maxHeight: TAB_HEIGHT + 20 },
  tabsContent: { paddingVertical: 8, paddingHorizontal: 4, gap: 8, alignItems: 'center' },
  tabItem: {
    width: TAB_WIDTH,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tabItemActive: { borderColor: '#0A3D2B', backgroundColor: '#E8F5E9' },
  tabImageContainer: { width: TAB_WIDTH - 16, height: TAB_WIDTH - 16, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E0E0E0' },
  tabImage: { width: '100%', height: '100%' },
  tabText: { fontSize: 11, color: '#666', fontWeight: '500', marginTop: 4, textAlign: 'center', maxWidth: TAB_WIDTH - 8 },
  tabTextActive: { color: '#0A3D2B', fontWeight: '700' },
  indicator: { position: 'absolute', bottom: 0, left: 8, width: TAB_WIDTH, height: 3, backgroundColor: '#0A3D2B', borderRadius: 2 },
  mainContent: { flex: 1, backgroundColor: '#F8F8F8', paddingTop: 4 },
  categorySection: { backgroundColor: '#FFFFFF', paddingVertical: 6, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 2, paddingBottom: 10 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, marginBottom: 4 },
  categorySectionTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  clearCategoryButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearCategoryText: { fontSize: 12, color: '#0A3D2B', fontWeight: '500' },
  categoryScrollView: { maxHeight: 90 },
  categoryScrollContent: { paddingVertical: 4, paddingHorizontal: 8, gap: 10, alignItems: 'center' },
  categoryItem: { width: CATEGORY_ITEM_WIDTH, alignItems: 'center', borderRadius: 10, backgroundColor: '#F8F8F8', borderWidth: 2, borderColor: 'transparent', paddingVertical: 3, paddingHorizontal: 3 },
  categoryItemActive: { borderColor: '#0A3D2B', backgroundColor: '#E8F5E9' },
  categoryImageContainer: { width: CATEGORY_ITEM_WIDTH - 16, height: CATEGORY_ITEM_WIDTH - 16, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F0F0F0', position: 'relative' },
  categoryImage: { width: '100%', height: '100%' },
  categorySelectedOverlay: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10 },
  categoryText: { fontSize: 10, color: '#666', fontWeight: '500', marginTop: 2, textAlign: 'center', maxWidth: CATEGORY_ITEM_WIDTH - 8 },
  categoryTextActive: { color: '#0A3D2B', fontWeight: '700' },
  categoryResultHeader: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#F5F5F5', borderRadius: 6, marginHorizontal: 4 },
  categoryResultText: { fontSize: 11, color: '#1C1C1E', fontWeight: '500' },
  noCategoryContainer: { paddingVertical: 4, alignItems: 'center' },
  noCategoryText: { fontSize: 12, color: '#999', fontWeight: '400' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', marginHorizontal: 16, marginBottom: 12, marginTop: 8 },
  selectedAdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF', marginHorizontal: 12, marginBottom: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  selectedAdHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  selectedAdHeaderCount: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  listContainer: { paddingBottom: 16, paddingHorizontal: 12, gap: 12 },
  fullWidthProductAdItem: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, marginBottom: 16, width: '100%' },
  fullWidthProductImageContainer: { width: '100%', position: 'relative', backgroundColor: '#F0F0F0' },
  fullWidthProductAdImage: { width: '100%', height: undefined },
  imageHidden: { opacity: 0 },
  imagePlaceholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' },
  fullWidthOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 24 },
  fullWidthOverlayContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  fullWidthTextContainer: { flex: 1, marginRight: 12 },
  fullWidthAdDescription: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '400', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  fullWidthAdCategory: { color: '#FFD700', fontSize: 12, fontWeight: '600', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  fullWidthActionButtons: { flexDirection: 'row', alignItems: 'center' },
  glassCartContainer: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', shadowColor: 'rgba(255, 255, 255, 0.3)', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 2 },
  glassCartIcon: { textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  genericAdItem: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, marginBottom: 16 },
  genericImageContainer: { width: '100%', aspectRatio: 16 / 9, position: 'relative', backgroundColor: '#F0F0F0' },
  genericAdImage: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  overlayContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  adTextContainer: { flex: 1, marginRight: 12 },
  adTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  adDescription: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  adCategory: { color: '#FFD700', fontSize: 11, fontWeight: '600', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  ownerName: { color: '#FFD700', fontSize: 12, fontWeight: '600', marginBottom: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  shopNowContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A3D2B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25, minWidth: 110, justifyContent: 'center', shadowColor: '#0A3D2B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  shopNowText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginRight: 4 },
  actionButtons: { flexDirection: 'row', alignItems: 'center' },
  productCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  productImage: { width: 120, height: 120 },
  productInfo: { flex: 1, padding: 14, justifyContent: 'center' },
  productName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: '700', color: '#1B8C40' },
  loaderContainer: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: '#666666', fontSize: 14 },
  errorContainer: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#FF3B30', fontSize: 14, marginBottom: 8 },
  retryButton: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#0A3D2B', borderRadius: 6 },
  retryText: { color: '#FFFFFF', fontWeight: '600' },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#999999', fontSize: 16, fontWeight: '500', marginTop: 12, textAlign: 'center' },
  emptySubText: { color: '#CCCCCC', fontSize: 14, marginTop: 4, textAlign: 'center' },
  footer: { paddingVertical: 16, alignItems: 'center' },
  footerText: { color: '#8E8E93', fontSize: 12 },
});

export default AdListScreen;