// src/vendorScreens/VendorProductViewsScreen.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  SectionList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { RootState } from '../app/store';
import { fetchVendorViews, clearViews, addView } from '../features/productViewSlice';
import socket from '../userScreens/utils/socket';

const { width } = Dimensions.get('window');

const Colors = {
  primary: '#4A148C',
  gold: '#D4AF37',
  white: '#FFFFFF',
  slate: '#64748B',
  lightBg: '#F8FAFC',
  border: '#E2E8F0',
  black: '#000000',
  error: '#EF4444',
  royalGreen: '#1B8C40',
  royalGreenLight: '#2A9D4A',
  textMuted: '#6B7280',
};

// --- Types ---
interface ProductView {
  _id: string;
  productId: string;
  productType: 'Property' | 'Rental';
  vendorId: string;
  viewerUserId: string;
  viewerName: string;
  viewerPhone: string;
  viewedAt: string;
  product?: {
    _id: string;
    title: string;
    images?: string[];
    minPriceCr?: number;
    maxPriceCr?: number;
    monthlyRent?: number;
    propertyType?: string;
    rentalType?: string;
  };
}

interface GroupedView {
  userId: string;
  userName: string;
  userPhone: string;
  productId: string;
  productType: string;
  productTitle: string;
  productImage: string;
  productPrice: string;
  viewCount: number;
  lastViewedAt: string;
  views: ProductView[];
}

const VendorProductViewsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { vendor } = useSelector((state: RootState) => state.vendorAuth);
  const { views, loading, error, page, totalPages, hasMore } = useSelector(
    (state: RootState) => state.productViews
  );
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const fetchViews = useCallback(
    async (pageNum = 1, refresh = false) => {
      if (!vendor?._id) {
        console.warn('⚠️ Vendor ID missing, cannot fetch views.');
        return;
      }
      if (refresh) setRefreshing(true);
      console.log(`📡 Fetching views for vendor ${vendor._id}, page ${pageNum}`);
      const result = await dispatch(fetchVendorViews({ vendorId: vendor._id, page: pageNum, limit: 20 }));
      console.log('📦 Fetch result:', result);
      setRefreshing(false);
    },
    [vendor, dispatch]
  );

  useEffect(() => {
    fetchViews(1, true);
    return () => {
      dispatch(clearViews());
    };
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  // Listen for real‑time new views via Socket.IO
  useEffect(() => {
    const handleNewView = (newView: any) => {
      console.log('🔔 New view via socket:', newView);
      dispatch(addView(newView));

      Toast.show({
        type: 'info',
        text1: '👀 New View!',
        text2: `${newView.viewerName} viewed your "${newView.product?.title || 'listing'}"`,
        visibilityTime: 4000,
        position: 'top',
        topOffset: 60,
      });
    };

    socket.on('newProductView', handleNewView);

    return () => {
      socket.off('newProductView', handleNewView);
    };
  }, [dispatch]);

  const onRefresh = () => fetchViews(1, true);
  const loadMore = () => {
    if (hasMore && !loading && page < totalPages) {
      fetchViews(page + 1);
    }
  };

  // --- Group views by user + product ---
  const groupedViews = useMemo(() => {
    const groupMap = new Map<string, GroupedView>();

    views.forEach((view: ProductView) => {
      const key = `${view.viewerUserId}-${view.productId}`;
      
      if (groupMap.has(key)) {
        const existing = groupMap.get(key)!;
        existing.viewCount += 1;
        existing.views.push(view);
        // Update last viewed time
        if (new Date(view.viewedAt) > new Date(existing.lastViewedAt)) {
          existing.lastViewedAt = view.viewedAt;
        }
      } else {
        const productTitle = view.product?.title || 'Unknown Listing';
        const productImage = view.product?.images?.[0] || 'https://via.placeholder.com/100';
        let productPrice = '';
        if (view.productType === 'Property') {
          productPrice = `₹${view.product?.minPriceCr || 0} Cr`;
        } else {
          productPrice = `₹${view.product?.monthlyRent || 0}/month`;
        }

        groupMap.set(key, {
          userId: view.viewerUserId,
          userName: view.viewerName || 'Unknown User',
          userPhone: view.viewerPhone || 'N/A',
          productId: view.productId,
          productType: view.productType,
          productTitle: productTitle,
          productImage: productImage,
          productPrice: productPrice,
          viewCount: 1,
          lastViewedAt: view.viewedAt,
          views: [view],
        });
      }
    });

    // Sort by view count (most views first) and then by last viewed
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.viewCount !== b.viewCount) {
        return b.viewCount - a.viewCount;
      }
      return new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime();
    });
  }, [views]);

  // --- Section Data for SectionList ---
  const sectionData = useMemo(() => {
    // Group by user
    const userMap = new Map<string, { user: string; userId: string; phone: string; data: GroupedView[] }>();
    
    groupedViews.forEach((item) => {
      if (userMap.has(item.userId)) {
        userMap.get(item.userId)!.data.push(item);
      } else {
        userMap.set(item.userId, {
          user: item.userName,
          userId: item.userId,
          phone: item.userPhone,
          data: [item],
        });
      }
    });

    return Array.from(userMap.values()).map((userGroup) => ({
      userId: userGroup.userId,
      title: userGroup.user,
      phone: userGroup.phone,
      data: userGroup.data,
      totalViews: userGroup.data.reduce((sum, item) => sum + item.viewCount, 0),
    }));
  }, [groupedViews]);

  const toggleSection = (userId: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setExpandedSections(newSet);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // --- Render Section Header ---
  const renderSectionHeader = ({ section }: { section: any }) => {
    const isExpanded = expandedSections.has(section.userId);
    
    return (
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(section.userId)}
        activeOpacity={0.8}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {section.title?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionSubtitle}>
              <Ionicons name="call-outline" size={12} color={Colors.slate} />
              <Text style={styles.sectionPhone}>{section.phone}</Text>
            </View>
          </View>
        </View>
        <View style={styles.sectionHeaderRight}>
          <View style={styles.viewCountBadge}>
            <Text style={styles.viewCountText}>{section.totalViews}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.slate}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // --- Render Item ---
  const renderItem = ({ item }: { item: GroupedView }) => (
    <TouchableOpacity
      style={styles.viewCard}
      onPress={() => {
        if (item.productType === 'Property') {
          navigation.navigate('PropertyDetailScreen', { propertyId: item.productId });
        } else {
          navigation.navigate('RentalDetail', { rentalId: item.productId });
        }
      }}
      activeOpacity={0.8}
    >
      <View style={styles.productPreview}>
        <Image
          source={{ uri: item.productImage }}
          style={styles.productImage}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={1}>
            {item.productTitle}
          </Text>
          <View style={styles.productMeta}>
            <Text style={styles.productType}>{item.productType}</Text>
            <Text style={styles.productPrice}>{item.productPrice}</Text>
          </View>
        </View>
        <View style={styles.itemRight}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{item.viewCount}</Text>
          </View>
          <Text style={styles.viewTime}>{formatDate(item.lastViewedAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // --- Debug Info ---
  const DebugInfo = () => (
    <View style={styles.debugContainer}>
      <Text style={styles.debugText}>📊 {views.length} total views</Text>
      <Text style={styles.debugText}>👥 {sectionData.length} unique users</Text>
      <Text style={styles.debugText}>📦 {groupedViews.length} unique product views</Text>
      {error && <Text style={styles.errorText}>❌ {error}</Text>}
      {vendor && <Text style={styles.debugText}>Vendor: {vendor.shopName || vendor.name}</Text>}
    </View>
  );

  if (loading && views.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.royalGreen} />
        <Text style={styles.loadingText}>Loading views...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Views</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <DebugInfo />

      {groupedViews.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Ionicons name="eye-off-outline" size={60} color={Colors.slate} />
          <Text style={styles.emptyText}>No product views yet</Text>
          <Text style={styles.emptySub}>
            When users view your properties or rentals, they'll appear here
          </Text>
          <TouchableOpacity style={styles.emptyRefreshBtn} onPress={onRefresh}>
            <Text style={styles.emptyRefreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sectionData}
          keyExtractor={(item, index) => `${item.userId}-${item.productId}-${index}`}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.royalGreen}
              colors={[Colors.royalGreen]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loading && views.length > 0 ? (
              <ActivityIndicator size="small" color={Colors.royalGreen} style={styles.footerLoader} />
            ) : null
          }
          ListEmptyComponent={
            !loading && sectionData.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="eye-off-outline" size={60} color={Colors.slate} />
                <Text style={styles.emptyText}>No views yet</Text>
                <Text style={styles.emptySub}>
                  When users view your listings, they'll appear here
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: Colors.royalGreen,
  },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  listContent: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.slate, marginTop: 12, fontSize: 14 },
  footerLoader: { paddingVertical: 20 },
  
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.royalGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  sectionPhone: {
    fontSize: 12,
    color: Colors.slate,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewCountBadge: {
    backgroundColor: Colors.royalGreen + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.royalGreen + '30',
  },
  viewCountText: {
    color: Colors.royalGreen,
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // View Card
  viewCard: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    marginBottom: 6,
    marginLeft: 16,
    marginRight: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.lightBg,
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.black,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  productType: {
    fontSize: 11,
    color: Colors.slate,
    backgroundColor: Colors.lightBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.royalGreen,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  countBadge: {
    backgroundColor: Colors.royalGreen,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewTime: {
    fontSize: 10,
    color: Colors.slate,
  },
  
  // Empty State
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.black,
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.slate,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyRefreshBtn: {
    marginTop: 20,
    backgroundColor: Colors.royalGreen,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyRefreshText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  
  // Debug
  debugContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  debugText: { fontSize: 12, color: Colors.slate },
  errorText: { fontSize: 12, color: Colors.error },
});

export default VendorProductViewsScreen;