// screens/RentalDetailScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Linking,
  Platform,
  FlatList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchRentalById, selectCurrentRental, selectRentalLoading } from '../features/rentalSlice';
import { recordProductView } from '../features/productViewSlice';
import { RootState } from '../app/store';

const { width } = Dimensions.get('window');

const Colors = {
  primary: '#4A148C',
  gold: '#D4AF37',
  white: '#FFFFFF',
  black: '#000000',
  slate: '#64748B',
  lightBg: '#F8FAFC',
  border: '#E2E8F0',
};

const RentalDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { rentalId } = route.params as { rentalId: string };

  const dispatch = useDispatch();
  const rental = useSelector(selectCurrentRental);
  const loading = useSelector(selectRentalLoading);
  const { user } = useSelector((state: RootState) => state.auth);

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Track recorded product to prevent duplicates
  const lastRecordedProductId = useRef<string | null>(null);

  // Reset when rentalId changes (new product navigation)
  useEffect(() => {
    lastRecordedProductId.current = null;
  }, [rentalId]);

  // Fetch rental details
  useEffect(() => {
    if (rentalId) {
      dispatch(fetchRentalById(rentalId));
    }
  }, [rentalId]);

  // Record view only once per product per navigation
  useEffect(() => {
    if (!rental || !user?._id || !rental.vendor?.vendorId) return;

    // Skip if this product was already recorded
    if (lastRecordedProductId.current === rental._id) {
      return;
    }

    const userName =
      user.name || user.username || user.email?.split('@')[0] || 'User';
    const userPhone = user.phone || user.mobile || 'N/A';

    const payload = {
      productId: rental._id,
      productType: 'Rental' as const,
      viewerUserId: user._id,
      viewerName: userName,
      viewerPhone: userPhone,
      vendorId: rental.vendor.vendorId,
    };

    console.log('📤 Recording rental view:', payload);
    dispatch(recordProductView(payload));
    lastRecordedProductId.current = rental._id;
  }, [rental, user, dispatch]);

  if (loading || !rental) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const images =
    rental.images && rental.images.length > 0
      ? rental.images
      : ['https://via.placeholder.com/600x400?text=No+Image'];

  const fullAddress = `${rental.location.locality}, ${rental.location.city}, ${rental.location.state} - ${rental.location.pincode}`;

  const handleCall = () => {
    if (rental.vendor?.contact) Linking.openURL(`tel:${rental.vendor.contact}`);
  };

  const handleWhatsApp = () => {
    if (rental.vendor?.contact) {
      const msg = `Hi, I'm interested in your rental "${rental.title}" on BLuxury.`;
      Linking.openURL(
        `whatsapp://send?phone=${rental.vendor.contact}&text=${encodeURIComponent(msg)}`
      );
    }
  };

  const openMap = () => {
    const coords = rental.location.coordinates?.coordinates;
    if (coords && coords.length === 2) {
      const [lng, lat] = coords;
      const url = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(rental.title)}@${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(rental.title)})`,
      });
      Linking.canOpenURL(url as string).then((supported) => {
        if (supported) Linking.openURL(url as string);
        else Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
      });
    } else {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
      );
    }
  };

  const renderImageItem = ({ item }: { item: string }) => (
    <Image source={{ uri: item }} style={styles.mainImage} />
  );

  const onScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setActiveIndex(index);
  };

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {images.map((_, i) => (
        <View
          key={i}
          style={[styles.dot, activeIndex === i ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <View style={styles.imageWrapper}>
          <FlatList
            ref={flatListRef}
            data={images}
            renderItem={renderImageItem}
            keyExtractor={(_, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={styles.carousel}
          />
          {renderDots()}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={26} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{rental.title}</Text>
          <View style={styles.row}>
            <Text style={styles.price}>₹{rental.monthlyRent}/month</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {rental.isAvailable ? 'Available' : 'Booked'}
              </Text>
            </View>
          </View>
          <Text style={styles.address}>
            <Ionicons name="location-sharp" size={16} color={Colors.gold} /> {fullAddress}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailGrid}>
            <DetailItem icon="bed-outline" label="Type" value={rental.rentalType} />
            <DetailItem
              icon="people-outline"
              label="Max Guests"
              value={rental.maxGuests?.toString() || 'N/A'}
            />
            <DetailItem
              icon="bed-outline"
              label="Bedrooms"
              value={rental.bedrooms?.toString() || 'N/A'}
            />
            <DetailItem
              icon="water-outline"
              label="Bathrooms"
              value={rental.bathrooms?.toString() || 'N/A'}
            />
            <DetailItem
              icon="calendar-outline"
              label="Available From"
              value={new Date(rental.availableFrom).toDateString()}
            />
            <DetailItem icon="cash-outline" label="Deposit" value={`₹${rental.deposit}`} />
            <DetailItem
              icon="settings-outline"
              label="Maintenance"
              value={`₹${rental.maintenanceCharges}`}
            />
          </View>

          {rental.description && (
            <View>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{rental.description}</Text>
            </View>
          )}

          {rental.amenities && rental.amenities.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesContainer}>
                {rental.amenities.map((a, i) => (
                  <View key={i} style={styles.amenityPill}>
                    <Text style={styles.amenityText}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <TouchableOpacity style={styles.mapButton} onPress={openMap}>
            <Ionicons name="map-outline" size={20} color={Colors.white} />
            <Text style={styles.mapButtonText}>View on Map</Text>
          </TouchableOpacity>

          <View style={styles.vendorCard}>
            <Text style={styles.sectionTitle}>Vendor</Text>
            <View style={styles.vendorRow}>
              <Ionicons name="person-circle" size={40} color={Colors.primary} />
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{rental.vendor.name}</Text>
                <Text style={styles.vendorContact}>{rental.vendor.contact}</Text>
              </View>
            </View>
            <View style={styles.vendorActions}>
              <TouchableOpacity style={[styles.actionBtn, styles.callBtn]} onPress={handleCall}>
                <Ionicons name="call" size={18} color={Colors.white} />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.waBtn]} onPress={handleWhatsApp}>
                <Ionicons name="logo-whatsapp" size={18} color={Colors.white} />
                <Text style={styles.actionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Text style={styles.bottomPrice}>₹{rental.monthlyRent}/month</Text>
        {/* <TouchableOpacity
          style={styles.bookBtn}
          onPress={() =>
            navigation.navigate('ChatScreen', { vendorId: rental.vendor.vendorId })
          }
        >
          <Text style={styles.bookBtnText}>Chat with Vendor</Text>
        </TouchableOpacity> */}
      </View>
    </View>
  );
};

// Helper component for detail items
const DetailItem = ({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) => (
  <View style={detailStyles.item}>
    <Ionicons name={icon} size={20} color={Colors.primary} />
    <View style={detailStyles.textContainer}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  </View>
);

const detailStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 16,
  },
  textContainer: { marginLeft: 12 },
  label: { fontSize: 12, color: Colors.slate },
  value: { fontSize: 14, fontWeight: '600', color: Colors.black },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageWrapper: {
    height: 300,
    backgroundColor: Colors.slate,
    position: 'relative',
  },
  carousel: { flex: 1 },
  mainImage: { width, height: 300, resizeMode: 'cover' },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: Colors.white,
    width: 12,
    height: 8,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.black },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  price: { fontSize: 22, fontWeight: 'bold', color: Colors.primary },
  statusBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: { color: Colors.white, fontWeight: 'bold' },
  address: { marginTop: 8, fontSize: 14, color: Colors.slate },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 12,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  description: { fontSize: 15, color: Colors.slate, lineHeight: 22 },
  amenitiesContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  amenityPill: {
    backgroundColor: Colors.lightBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  amenityText: { color: Colors.primary, fontWeight: '600' },
  mapButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  mapButtonText: { color: Colors.white, fontWeight: 'bold', marginLeft: 8 },
  vendorCard: {
    backgroundColor: Colors.lightBg,
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  vendorRow: { flexDirection: 'row', alignItems: 'center' },
  vendorInfo: { marginLeft: 12 },
  vendorName: { fontSize: 16, fontWeight: 'bold', color: Colors.black },
  vendorContact: { fontSize: 14, color: Colors.slate },
  vendorActions: { flexDirection: 'row', marginTop: 12, gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  callBtn: { backgroundColor: Colors.primary },
  waBtn: { backgroundColor: '#25D366' },
  actionText: { color: Colors.white, fontWeight: 'bold', marginLeft: 8 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: 16,
    paddingBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bottomPrice: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  bookBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
  },
  bookBtnText: { color: Colors.white, fontWeight: 'bold' },
});

export default RentalDetailScreen;