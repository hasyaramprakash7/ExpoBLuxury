// src/screens/AllCategoriesScreen.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import { fetchCategories } from '../features/categorySlice';
import { fetchActiveAds } from '../features/adSlice';
import { searchDirectoryVendors } from '../features/vendor/vendorAuthSlice';
import { fetchAllVendorProducts } from '../features/vendor/vendorProductSlices';
import AdCarousel from '../components/AdCarousel';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors, scale, verticalScale, moderateScale } from '../constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createSelector } from '@reduxjs/toolkit';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const ITEM_SIZE = (width - 32 - (NUM_COLUMNS - 1) * 6) / NUM_COLUMNS;

// ✅ Create memoized selector for generic ads
const selectGenericAds = createSelector(
  (state: RootState) => state.ads?.activeAds || [],
  (activeAds) => activeAds.filter(ad => ad.isProductAd === false)
);

// ✅ Category Section Header - EXACT same as ShopListings
const CategorySectionHeader = ({ title, count }: { title: string; count: number }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      <View style={styles.sectionHeaderLine} />
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
    <Text style={styles.sectionHeaderCount}>{count} categories</Text>
  </View>
);

// ✅ Category Grid Item - EXACT same as ShopListings
const CategoryGridItem = ({ category, onPress }: any) => {
  const hasShops = category.count > 0;
  const displayName = typeof category.name === 'string' ? category.name : String(category.name || 'Category');
  
  return (
    <TouchableOpacity
      style={[
        styles.categoryGridItem,
        { width: ITEM_SIZE, height: ITEM_SIZE },
        !hasShops && styles.categoryItemDisabled
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!hasShops}
    >
      <Image
        source={{ uri: category.image || 'https://via.placeholder.com/200x200?text=Category' }}
        style={[styles.categoryGridImage, !hasShops && styles.categoryImageDisabled]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
        style={styles.categoryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.categoryTextContainer}>
        <Text style={styles.categoryGridName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.categoryGridCount, !hasShops && styles.categoryCountZero]}>
          {hasShops ? `${category.count} shops` : 'No shops yet'}
        </Text>
        {!hasShops && (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ✅ Parse categories from vendor - handles all formats
const parseVendorCategories = (categories: any): string[] => {
  if (!categories) return [];
  
  // If it's already an array
  if (Array.isArray(categories)) {
    // Check if it's a stringified array inside an array
    if (categories.length === 1 && typeof categories[0] === 'string') {
      try {
        const parsed = JSON.parse(categories[0]);
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item).trim());
        }
      } catch (_) {}
    }
    return categories.map(item => String(item).trim()).filter(Boolean);
  }
  
  // If it's a string
  if (typeof categories === 'string') {
    try {
      const parsed = JSON.parse(categories);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
      return [String(parsed).trim()].filter(Boolean);
    } catch (_) {
      // If it's a comma-separated string
      if (categories.includes(',')) {
        return categories.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [categories.trim()].filter(Boolean);
    }
  }
  
  return [];
};

const AllCategoriesScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { categories, loading } = useSelector((state: RootState) => state.categories);
  const { directoryVendors, loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth,
  );
  const { location: userLocation, selectedAddress } = useSelector(
    (state: RootState) => state.location,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // ✅ Get generic ads using memoized selector
  const allGenericAds = useSelector(selectGenericAds);
  
  // ✅ Memoize the sliced ads
  const genericAds = useMemo(() => {
    return allGenericAds.slice(0, 5);
  }, [allGenericAds]);

  // ✅ Handle ad press
  const handleAdPress = useCallback((ad: any) => {
    console.log('🔗 [AllCategories] Ad pressed:', ad.title, ad._id);
    if (!ad) return;
    navigation.navigate('AdListScreen', { 
      selectedAdTitle: ad.title || ad.name || 'Sponsored',
      selectedAdId: ad._id
    });
  }, [navigation]);

  // ✅ Build categories with shop counts - using proper parsing
  const allCategories = useMemo(() => {
    console.log('🔷 [AllCategories] Computing categories with counts', { 
      categoriesLength: categories?.length,
      directoryVendorsLength: directoryVendors?.length 
    });
    
    if (!categories || categories.length === 0) return [];
    
    const shopCountMap = new Map<string, number>();
    const categoryNameMap = new Map<string, string>();
    
    // Count shops per category from directoryVendors
    (directoryVendors || []).forEach((vendor) => {
      if (vendor) {
        // ✅ Use the proper parser
        const vendorCategories = parseVendorCategories(vendor.categories);
        console.log('🔍 [AllCategories] Vendor:', vendor.shopName || vendor.name, 'categories:', vendorCategories);
        
        vendorCategories.forEach((cat: string) => {
          if (cat) {
            const normalized = cat.toLowerCase().trim();
            shopCountMap.set(normalized, (shopCountMap.get(normalized) || 0) + 1);
            if (!categoryNameMap.has(normalized)) {
              categoryNameMap.set(normalized, cat);
            }
          }
        });
      }
    });

    // ✅ Keep ALL categories, show count (0 if no shops)
    const result = categories
      .map((cat) => {
        const categoryName = typeof cat.name === 'string' ? cat.name : String(cat.name || '');
        const normalizedName = categoryName.toLowerCase().trim();
        const count = shopCountMap.get(normalizedName) || 0;
        const displayName = categoryNameMap.get(normalizedName) || categoryName;
        return {
          name: displayName,
          count: count,
          image: cat.image || cat.icon,
          _id: cat._id,
        };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    
    const withShops = result.filter(c => c.count > 0);
    console.log('✅ [AllCategories] Categories with counts:', withShops.length, 'with shops');
    if (withShops.length > 0) {
      console.log('📊 [AllCategories] Categories with shops:', withShops.map(c => `${c.name}: ${c.count}`).join(', '));
    }
    return result;
  }, [categories, directoryVendors]);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return allCategories;
    const lower = searchQuery.toLowerCase();
    return allCategories.filter((cat) =>
      cat.name.toLowerCase().includes(lower)
    );
  }, [allCategories, searchQuery]);

  // ✅ Fetch all vendors when screen loads
  const fetchAllVendors = useCallback(async () => {
    console.log('🔄 [AllCategories] Fetching all vendors...');
    try {
      let lat = userLocation?.latitude;
      let lng = userLocation?.longitude;
      if (selectedAddress?.latitude && selectedAddress?.longitude) {
        lat = selectedAddress.latitude;
        lng = selectedAddress.longitude;
      }

      if (lat && lng) {
        await dispatch(searchDirectoryVendors({ lat, lng }));
      } else {
        await dispatch(searchDirectoryVendors({}));
      }
      console.log('✅ [AllCategories] Vendors fetched successfully');
    } catch (error) {
      console.error('❌ [AllCategories] Error fetching vendors:', error);
    }
  }, [dispatch, userLocation, selectedAddress]);

  // ✅ Load initial data
  useEffect(() => {
    const loadData = async () => {
      console.log('🚀 [AllCategories] Initial load started');
      setIsInitialLoading(true);
      try {
        await Promise.all([
          dispatch(fetchCategories()),
          dispatch(fetchActiveAds()),
          fetchAllVendors(),
        ]);
      } catch (error) {
        console.error('❌ [AllCategories] Initial load error:', error);
      } finally {
        setIsInitialLoading(false);
        console.log('✅ [AllCategories] Initial load completed');
      }
    };
    loadData();
  }, []);

  // ✅ Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 [AllCategories] Screen focused - refreshing vendors');
      fetchAllVendors();
      if (categories.length === 0) {
        dispatch(fetchCategories());
      }
      dispatch(fetchActiveAds());
    }, [fetchAllVendors, categories.length, dispatch])
  );

  // ✅ Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    console.log('🔄 [AllCategories] Pull-to-refresh triggered');
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchCategories()),
        dispatch(fetchActiveAds()),
        fetchAllVendors(),
        dispatch(fetchAllVendorProducts()),
      ]);
      console.log('✅ [AllCategories] Refresh completed');
    } catch (error) {
      console.error('❌ [AllCategories] Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, fetchAllVendors]);

  const handleCategoryPress = (category: any) => {
    // ✅ Only navigate if category has shops
    if (category.count === 0) {
      console.log('⏭️ [AllCategories] Category has no shops, not navigating');
      return;
    }
    console.log('🔷 [AllCategories] Navigating to category:', category.name);
    navigation.navigate('CategoryShopsScreen', {
      categoryName: category.name,
      categoryImage: category.image,
    });
  };

  // Calculate loading state
  const isLoading = isInitialLoading || vendorsLoading || loading;

  if (isLoading && categories.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.accentGreen} />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  // Count total categories with shops for header
  const totalWithShops = useMemo(() => {
    return allCategories.filter(c => c.count > 0).length;
  }, [allCategories]);

  return (
    <View style={styles.container}>
      {/* ✅ Ad Carousel */}
      {genericAds && genericAds.length > 0 ? (
        <AdCarousel 
          ads={genericAds} 
          title="Sponsored" 
          onAdPress={handleAdPress}
        />
      ) : (
        <View style={styles.noAdsContainer}>
          <Text style={styles.noAdsText}>No sponsored content available</Text>
        </View>
      )}

      {/* Search Bar - Instagram style */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.textGray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search categories"
          placeholderTextColor={Colors.textLightGray}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.textGray} />
          </TouchableOpacity>
        )}
      </View>

      {/* ✅ Category Section Header - Same as ShopListings */}
      <CategorySectionHeader 
        title="Browse Categories" 
        count={totalWithShops} 
      />

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item._id || item.name}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.gridContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accentGreen}
            colors={[Colors.accentGreen]}
            progressBackgroundColor="#FFFFFF"
          />
        }
        renderItem={({ item }) => (
          <CategoryGridItem category={item} onPress={() => handleCategoryPress(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={50} color={Colors.textLightGray} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching categories found' : 'No categories available'}
            </Text>
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <Text style={styles.clearSearchText}>Clear Search</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: Colors.textGray,
  },
  noAdsContainer: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  noAdsText: {
    color: Colors.textLightGray,
    fontSize: 14,
  },
  // ✅ Section Header - Same as ShopListings
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    marginTop: verticalScale(4),
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderLine: {
    width: scale(4),
    height: scale(20),
    backgroundColor: Colors.accentGreen,
    borderRadius: moderateScale(2),
    marginRight: scale(8),
  },
  sectionHeaderTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: Colors.textDark,
  },
  sectionHeaderCount: {
    fontSize: moderateScale(12),
    color: Colors.textLightGray,
  },
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: Colors.textDark,
    paddingVertical: 6,
  },
  // ✅ Grid - Same as ShopListings
  gridContainer: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  categoryGridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: scale(4),
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1A1A1A',
  },
  categoryItemDisabled: {
    opacity: 0.6,
  },
  categoryGridImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  categoryImageDisabled: {
    opacity: 0.7,
  },
  categoryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  categoryTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: scale(10),
    alignItems: 'center',
  },
  categoryGridName: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: verticalScale(2),
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  categoryGridCount: {
    fontSize: moderateScale(10),
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  categoryCountZero: {
    color: 'rgba(255,255,255,0.5)',
  },
  comingSoonBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  comingSoonText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  clearSearchButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: Colors.accentGreen,
    borderRadius: 8,
  },
  clearSearchText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default AllCategoriesScreen;