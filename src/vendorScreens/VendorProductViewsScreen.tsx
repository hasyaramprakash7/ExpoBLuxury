import React, { useEffect, useState, useCallback } from 'react';
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
};

const VendorProductViewsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { vendor } = useSelector((state: RootState) => state.vendorAuth);
  const { views, loading, error, page, totalPages, hasMore } = useSelector(
    (state: RootState) => state.productViews
  );
  const [refreshing, setRefreshing] = useState(false);

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

  // 🔥 Listen for real‑time new views via Socket.IO
  useEffect(() => {
    const handleNewView = (newView: any) => {
      console.log('🔔 New view via socket:', newView);
      dispatch(addView(newView));

      // Show a toast / pop‑up notification to the vendor
      Toast.show({
        type: 'info',
        text1: '👀 New Lead!',
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

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.viewCard}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <Ionicons name="person-circle" size={40} color={Colors.primary} />
          <View style={styles.userText}>
            <Text style={styles.userName}>{item.viewerName}</Text>
            <Text style={styles.userPhone}>{item.viewerPhone}</Text>
          </View>
        </View>
        <Text style={styles.viewDate}>
          {new Date(item.viewedAt).toLocaleDateString()} {new Date(item.viewedAt).toLocaleTimeString()}
        </Text>
      </View>

      {item.product && (
        <TouchableOpacity
          style={styles.productPreview}
          onPress={() => {
            if (item.productType === 'Property') {
              navigation.navigate('PropertyDetailScreen', { propertyId: item.productId });
            } else {
              navigation.navigate('RentalDetail', { rentalId: item.productId });
            }
          }}
        >
          <Image
            source={{ uri: item.product.images?.[0] || 'https://via.placeholder.com/100' }}
            style={styles.productImage}
          />
          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={1}>
              {item.product.title}
            </Text>
            <Text style={styles.productType}>{item.productType}</Text>
            <Text style={styles.productPrice}>
              {item.productType === 'Property'
                ? `₹${item.product.minPriceCr} Cr`
                : `₹${item.product.monthlyRent}/month`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.slate} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Debug: show number of views
  const DebugInfo = () => (
    <View style={styles.debugContainer}>
      <Text style={styles.debugText}>📊 {views.length} views loaded</Text>
      {error && <Text style={styles.errorText}>❌ {error}</Text>}
      {vendor && <Text style={styles.debugText}>Vendor ID: {vendor._id}</Text>}
    </View>
  );

  if (loading && views.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
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

      <FlatList
        data={views}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loading && views.length > 0 ? <ActivityIndicator size="small" color={Colors.primary} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="eye-off-outline" size={60} color={Colors.slate} />
              <Text style={styles.emptyText}>No product views yet.</Text>
              <Text style={styles.emptySub}>
                When users view your listings, they'll appear here.
              </Text>
              <TouchableOpacity style={styles.emptyRefreshBtn} onPress={onRefresh}>
                <Text style={styles.emptyRefreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
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
    backgroundColor: Colors.primary,
  },
  headerTitle: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  listContent: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  viewCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userText: { marginLeft: 10 },
  userName: { fontSize: 16, fontWeight: 'bold', color: Colors.black },
  userPhone: { fontSize: 14, color: Colors.slate },
  viewDate: { fontSize: 12, color: Colors.slate },
  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightBg,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  productImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12 },
  productInfo: { flex: 1 },
  productTitle: { fontSize: 14, fontWeight: '600', color: Colors.black },
  productType: { fontSize: 12, color: Colors.slate },
  productPrice: { fontSize: 13, fontWeight: 'bold', color: Colors.primary },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: Colors.black, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.slate, textAlign: 'center', marginTop: 8 },
  emptyRefreshBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyRefreshText: { color: Colors.white, fontWeight: 'bold' },
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