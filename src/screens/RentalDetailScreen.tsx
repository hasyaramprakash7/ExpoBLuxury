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
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import Share from 'react-native-share';
import { Share as RNShare } from 'react-native';
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
  whatsapp: '#25D366',
  success: '#10B981',
};

// Play Store link - replace with your actual app link
const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury';
const APP_STORE_LINK = 'https://apps.apple.com/app/bluxury/id123456789';

const RentalDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { rentalId } = route.params as { rentalId: string };

  const dispatch = useDispatch();
  const rental = useSelector(selectCurrentRental);
  const loading = useSelector(selectRentalLoading);
  const { user } = useSelector((state: RootState) => state.auth);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
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

  // Download image to local cache for sharing
  const downloadImageToLocal = async (imageUrl: string): Promise<string | null> => {
    try {
      const timestamp = Date.now();
      const filePath = `${FileSystem.cacheDirectory}rental_${timestamp}.jpg`;
      
      const downloadResult = await FileSystem.downloadAsync(
        imageUrl,
        filePath
      );
      
      if (downloadResult.status === 200) {
        if (Platform.OS === 'android') {
          return `file://${downloadResult.uri}`;
        }
        return downloadResult.uri;
      }
      return null;
    } catch (error) {
      console.log('Image download error:', error);
      return null;
    }
  };

  // Get Google Maps link for the location
  const getGoogleMapsLink = (): string => {
    if (!rental) return '';
    
    const coords = rental.location.coordinates?.coordinates;
    const fullAddress = `${rental.location.locality}, ${rental.location.city}, ${rental.location.state} - ${rental.location.pincode}`;
    
    if (coords && coords.length === 2) {
      const [lng, lat] = coords;
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  };

  // Build share message with ALL rental details + Google Maps link + App link
  const buildShareMessage = () => {
    if (!rental) return '';
    
    const fullAddress = `${rental.location.locality}, ${rental.location.city}, ${rental.location.state} - ${rental.location.pincode}`;
    const availableFrom = new Date(rental.availableFrom).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const mapsLink = getGoogleMapsLink();
    const appLink = Platform.OS === 'ios' ? APP_STORE_LINK : PLAY_STORE_LINK;
    
    let message = `🏠 *${rental.title || 'Rental Property'}*\n\n`;
    message += `📍 *Location:* ${fullAddress}\n`;
    message += `🗺️ *View on Google Maps:* ${mapsLink}\n`;
    message += `💰 *Monthly Rent:* ₹${rental.monthlyRent}/month\n`;
    message += `🏷️ *Type:* ${rental.rentalType || 'N/A'}\n`;
    message += `🛏️ *Bedrooms:* ${rental.bedrooms || 'N/A'}\n`;
    message += `🛁 *Bathrooms:* ${rental.bathrooms || 'N/A'}\n`;
    message += `👥 *Max Guests:* ${rental.maxGuests || 'N/A'}\n`;
    message += `📅 *Available From:* ${availableFrom}\n`;
    message += `💰 *Deposit:* ₹${rental.deposit || 'N/A'}\n`;
    message += `🔧 *Maintenance:* ₹${rental.maintenanceCharges || 'N/A'}\n`;
    message += `📋 *Status:* ${rental.isAvailable ? '✅ Available' : '❌ Booked'}\n`;
    
    if (rental.amenities && rental.amenities.length > 0) {
      message += `\n✨ *Amenities:* ${rental.amenities.join(', ')}\n`;
    }
    
    if (rental.description) {
      message += `\n📝 *Description:* ${rental.description.substring(0, 150)}${rental.description.length > 150 ? '...' : ''}\n`;
    }
    
    message += `\n📱 *Download App:* ${appLink}`;
    return message;
  };

  // Share to WhatsApp with image and full details
  const handleShareWhatsApp = async () => {
    if (!rental) return;
    
    setIsSharing(true);
    try {
      const imageUrl = rental.images?.[0];
      const message = buildShareMessage();
      
      // Try to share with image
      if (imageUrl) {
        try {
          const localFilePath = await downloadImageToLocal(imageUrl);
          
          if (localFilePath) {
            const shareOptions = {
              title: 'BLuxury Rental',
              message: message,
              url: localFilePath,
              type: 'image/jpeg',
              social: Share.Social.WHATSAPP,
            };
            
            await Share.shareSingle(shareOptions);
            setIsSharing(false);
            return;
          }
        } catch (imageError) {
          console.log('WhatsApp image share failed:', imageError);
          // Fall through to text-only sharing
        }
      }
      
      // Fallback: Share text only via WhatsApp URL
      const phone = rental.vendor?.contact || '';
      const waUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
      } else {
        // If WhatsApp is not installed, try to share via react-native-share without image
        await Share.open({
          title: 'BLuxury Rental',
          message: message,
        });
      }
      
    } catch (error) {
      console.error('WhatsApp share error:', error);
      if (error instanceof Error && error.message !== 'User cancelled') {
        Alert.alert('Share Error', 'Could not share to WhatsApp. Please try again.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // General share function
  const handleShare = async () => {
    if (!rental) return;
    
    setIsSharing(true);
    try {
      const imageUrl = rental.images?.[0];
      const message = buildShareMessage();
      
      // Try to share with image
      if (imageUrl) {
        try {
          const localFilePath = await downloadImageToLocal(imageUrl);
          
          if (localFilePath) {
            const shareOptions = {
              title: 'BLuxury Rental',
              message: message,
              url: localFilePath,
              type: 'image/jpeg',
            };
            
            await Share.open(shareOptions);
            setIsSharing(false);
            return;
          }
        } catch (imageError) {
          console.log('Image sharing failed:', imageError);
          // Fall through to text-only sharing
        }
      }
      
      // Fallback: share text only
      await RNShare.share({
        message: message,
        title: 'BLuxury Rental',
      });
      
    } catch (error) {
      console.error('Share error:', error);
      if (error instanceof Error && error.message !== 'User cancelled') {
        Alert.alert('Share Error', 'Could not share rental. Please try again.');
      }
    } finally {
      setIsSharing(false);
    }
  };

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

  const handleWhatsAppContact = () => {
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
          
          {/* Share Button - Same as Property Detail */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="share-outline" size={22} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{rental.title}</Text>
          <View style={styles.row}>
            <Text style={styles.price}>₹{rental.monthlyRent}/month</Text>
            <View style={[styles.statusBadge, rental.isAvailable ? styles.statusAvailable : styles.statusBooked]}>
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
              <TouchableOpacity style={[styles.actionBtn, styles.waBtn]} onPress={handleWhatsAppContact}>
                <Ionicons name="logo-whatsapp" size={18} color={Colors.white} />
                <Text style={styles.actionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Share Buttons Row - Same as Property Detail */}
          <View style={styles.shareRow}>
            <TouchableOpacity 
              style={[styles.shareActionBtn, styles.shareBtnStyle]} 
              onPress={handleShare}
              disabled={isSharing}
            >
              <Ionicons name="share-social-outline" size={20} color={Colors.white} />
              <Text style={styles.shareActionText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.shareActionBtn, styles.whatsappShareBtn]} 
              onPress={handleShareWhatsApp}
              disabled={isSharing}
            >
              <Ionicons name="logo-whatsapp" size={20} color={Colors.white} />
              <Text style={styles.shareActionText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>

          {/* Download App Link Section */}
          {/* <View style={styles.appDownloadSection}>
            <Text style={styles.appDownloadText}>
              📱 Download the BLuxury App
            </Text>
            <View style={styles.appLinksContainer}>
              <TouchableOpacity 
                style={[styles.appLinkBtn, styles.playStoreBtn]}
                onPress={() => Linking.openURL(PLAY_STORE_LINK)}
              >
                <Ionicons name="logo-google-playstore" size={20} color={Colors.white} />
                <Text style={styles.appLinkText}>Play Store</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.appLinkBtn, styles.appStoreBtn]}
                onPress={() => Linking.openURL(APP_STORE_LINK)}
              >
                <Ionicons name="logo-apple" size={20} color={Colors.white} />
                <Text style={styles.appLinkText}>App Store</Text>
              </TouchableOpacity>
            </View>
          </View> */}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Text style={styles.bottomPrice}>₹{rental.monthlyRent}/month</Text>
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
  shareBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusAvailable: {
    backgroundColor: Colors.success,
  },
  statusBooked: {
    backgroundColor: Colors.slate,
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
  waBtn: { backgroundColor: Colors.whatsapp },
  actionText: { color: Colors.white, fontWeight: 'bold', marginLeft: 8 },
  shareRow: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  shareActionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  shareBtnStyle: {
    backgroundColor: Colors.primary,
  },
  whatsappShareBtn: {
    backgroundColor: Colors.whatsapp,
  },
  shareActionText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  appDownloadSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.lightBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appDownloadText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
    textAlign: 'center',
    marginBottom: 12,
  },
  appLinksContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  appLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  playStoreBtn: {
    backgroundColor: '#3DDC84',
  },
  appStoreBtn: {
    backgroundColor: '#000000',
  },
  appLinkText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 46,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  bottomPrice: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
});

export default RentalDetailScreen;