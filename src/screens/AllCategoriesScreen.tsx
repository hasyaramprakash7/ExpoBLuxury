// src/screens/AllCategoriesScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import { fetchCategories } from '../features/categorySlice';
import { fetchActiveAds } from '../features/adSlice';
import AdCarousel from '../components/AdCarousel';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Colors, scale, verticalScale, moderateScale } from '../constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3; // Change to 2 if you want a 2‑column grid
const ITEM_SIZE = (width - 32 - (NUM_COLUMNS - 1) * 6) / NUM_COLUMNS;

const CategoryGridItem = ({ category, onPress }: any) => (
  <TouchableOpacity
    style={[styles.categoryItem, { width: ITEM_SIZE, height: ITEM_SIZE }]}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Image
      source={{ uri: category.image || 'https://via.placeholder.com/200' }}
      style={styles.categoryImage}
    />
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
      style={styles.gradient}
    />
    <View style={styles.categoryTextContainer}>
      <Text style={styles.categoryName} numberOfLines={1}>
        {category.name}
      </Text>
      <Text style={styles.categoryCount}>{category.count} shops</Text>
    </View>
  </TouchableOpacity>
);

const AllCategoriesScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const { categories, loading } = useSelector((state: RootState) => state.categories);
  const { directoryVendors } = useSelector((state: RootState) => state.vendorAuth);
  const [searchQuery, setSearchQuery] = useState('');

  // Build categories with shop counts
  const allCategories = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    const shopCountMap = new Map<string, number>();
    const categoryNameMap = new Map<string, string>();
    (directoryVendors || []).forEach((vendor) => {
      if (vendor.categories && Array.isArray(vendor.categories)) {
        vendor.categories.forEach((cat: string) => {
          const normalized = cat.toLowerCase();
          shopCountMap.set(normalized, (shopCountMap.get(normalized) || 0) + 1);
          if (!categoryNameMap.has(normalized)) {
            categoryNameMap.set(normalized, cat);
          }
        });
      }
    });
    return categories.map((cat) => ({
      name: categoryNameMap.get(cat.name.toLowerCase()) || cat.name,
      count: shopCountMap.get(cat.name.toLowerCase()) || 0,
      image: cat.image || cat.icon,
      _id: cat._id,
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [categories, directoryVendors]);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return allCategories;
    const lower = searchQuery.toLowerCase();
    return allCategories.filter((cat) =>
      cat.name.toLowerCase().includes(lower)
    );
  }, [allCategories, searchQuery]);

  useEffect(() => {
    if (categories.length === 0 && !loading) {
      dispatch(fetchCategories());
    }
    dispatch(fetchActiveAds());
  }, []);

  const handleCategoryPress = (category: any) => {
    navigation.navigate('CategoryShopsScreen', {
      categoryName: category.name,
      categoryImage: category.image,
    });
  };

  if (loading && categories.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.accentGreen} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Ad Carousel */}
      <AdCarousel limit={5} title="Sponsored" />

      {/* Search Bar – Instagram style */}
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

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item._id || item.name}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.gridContainer}
        renderItem={({ item }) => (
          <CategoryGridItem category={item} onPress={() => handleCategoryPress(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching categories' : 'No categories found'}
            </Text>
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
  // Instagram‑style Grid
  gridContainer: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  categoryItem: {
    margin: 4,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    position: 'relative',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  categoryTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  categoryName: {
    color: '#FFFFFF',
    fontSize: moderateScale(13),
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },
  categoryCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: moderateScale(10),
    marginTop: 2,
    fontWeight: '500',
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
  },
});

export default AllCategoriesScreen;