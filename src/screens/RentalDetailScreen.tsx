// screens/RentalDetailScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Modal,
  StatusBar,
  Pressable,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import Share from 'react-native-share';
import { Share as RNShare } from 'react-native';
import {
  fetchRentalById,
  selectCurrentRental,
  selectRentalLoading,
} from '../features/rentalSlice';
import { recordProductView } from '../features/productViewSlice';
import { RootState } from '../app/store';

const { width, height } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// 🎨 UNIFIED PALETTE — ShopListings feel (white bg + black accents)
// ─────────────────────────────────────────────────────────────
const Royal = {
  gold: '#D4AF37',
  goldSoft: '#E8CC7A',
  goldBright: '#F4DC90',
  goldDim: 'rgba(212,175,55,0.35)',
  goldFaint: 'rgba(212,175,55,0.10)',
  royalGreen: '#0A3D2B',
  royalGreenDeep: '#062318',
  obsidian: '#0B0B0F',
  ivory: '#FFFFFF',
  cream: '#FBF7EE',
  maroon: '#5C1A2B',
  // White surfaces (ShopListings feel)
  whiteBg: '#FFFFFF',
  offWhite: '#F4F4F6',
  softWhite: '#F2F2F7',
  borderLight: 'rgba(0,0,0,0.08)',
  borderMedium: 'rgba(0,0,0,0.15)',
  shadow: 'rgba(0,0,0,0.10)',
  // Text (dark on white)
  textPrimary: '#0B0B0F',
  textSecondary: 'rgba(11,11,15,0.65)',
  textTertiary: 'rgba(11,11,15,0.45)',
  // Accents
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
};

const Colors = {
  primary: Royal.royalGreen,
  gold: Royal.gold,
  white: '#FFFFFF',
  black: Royal.obsidian,
  slate: '#64748B',
  lightBg: Royal.offWhite,
  border: Royal.borderLight,
  whatsapp: '#25D366',
  success: '#10B981',
};

const PLAY_STORE_LINK =
  'https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury';
const APP_STORE_LINK = 'https://apps.apple.com/app/bluxury/id123456789';

const RentalDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { rentalId } = route.params as { rentalId: string };

  const dispatch = useDispatch();
  const rental = useSelector(selectCurrentRental);
  const loading = useSelector(selectRentalLoading);
  const { user } = useSelector((state: RootState) => state.auth);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const viewerListRef = useRef<FlatList>(null);
  const lastRecordedProductId = useRef<string | null>(null);

  useEffect(() => {
    lastRecordedProductId.current = null;
  }, [rentalId]);

  useEffect(() => {
    if (rentalId) dispatch(fetchRentalById(rentalId));
  }, [rentalId, dispatch]);

  useEffect(() => {
    if (!rental || !user?._id || !rental.vendor?.vendorId) return;
    if (lastRecordedProductId.current === rental._id) return;

    const userName =
      user.name || user.username || user.email?.split('@')[0] || 'User';
    const userPhone = user.phone || user.mobile || 'N/A';

    dispatch(
      recordProductView({
        productId: rental._id,
        productType: 'Rental' as const,
        viewerUserId: user._id,
        viewerName: userName,
        viewerPhone: userPhone,
        vendorId: rental.vendor.vendorId,
      })
    );
    lastRecordedProductId.current = rental._id;
  }, [rental, user, dispatch]);

  const downloadImageToLocal = async (
    imageUrl: string
  ): Promise<string | null> => {
    try {
      const filePath = `${FileSystem.cacheDirectory}rental_${Date.now()}.jpg`;
      const result = await FileSystem.downloadAsync(imageUrl, filePath);
      if (result.status === 200) {
        return Platform.OS === 'android' ? `file://${result.uri}` : result.uri;
      }
      return null;
    } catch {
      return null;
    }
  };

  const getGoogleMapsLink = (): string => {
    if (!rental) return '';
    const coords = rental.location?.coordinates?.coordinates;
    const fullAddress = `${rental.location.locality}, ${rental.location.city}, ${rental.location.state} - ${rental.location.pincode}`;
    if (coords && coords.length === 2) {
      const [lng, lat] = coords;
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  };

  const buildShareMessage = () => {
    if (!rental) return '';
    const fullAddress = `${rental.location.locality}, ${rental.location.city}, ${rental.location.state} - ${rental.location.pincode}`;
    const availableFrom = new Date(rental.availableFrom).toLocaleDateString(
      'en-IN',
      { year: 'numeric', month: 'long', day: 'numeric' }
    );
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
    if (rental.amenities?.length > 0)
      message += `\n✨ *Amenities:* ${rental.amenities.join(', ')}\n`;
    if (rental.description) {
      message += `\n📝 *Description:* ${rental.description.substring(0, 150)}${
        rental.description.length > 150 ? '...' : ''
      }\n`;
    }
    message += `\n📱 *Download App:* ${appLink}`;
    return message;
  };

  const handleShareWhatsApp = async () => {
    if (!rental) return;
    setIsSharing(true);
    try {
      const imageUrl = rental.images?.[0];
      const message = buildShareMessage();
      if (imageUrl) {
        try {
          const localFilePath = await downloadImageToLocal(imageUrl);
          if (localFilePath) {
            await Share.shareSingle({
              title: 'BLuxury Rental',
              message,
              url: localFilePath,
              type: 'image/jpeg',
              social: Share.Social.WHATSAPP,
            });
            setIsSharing(false);
            return;
          }
        } catch {}
      }
      const phone = rental.vendor?.contact || '';
      const waUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(
        message
      )}`;
      if (await Linking.canOpenURL(waUrl)) {
        await Linking.openURL(waUrl);
      } else {
        await Share.open({ title: 'BLuxury Rental', message });
      }
    } catch (e) {
      if (e instanceof Error && e.message !== 'User cancelled') {
        Alert.alert('Share Error', 'Could not share to WhatsApp.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleShare = async () => {
    if (!rental) return;
    setIsSharing(true);
    try {
      const imageUrl = rental.images?.[0];
      const message = buildShareMessage();
      if (imageUrl) {
        try {
          const localFilePath = await downloadImageToLocal(imageUrl);
          if (localFilePath) {
            await Share.open({
              title: 'BLuxury Rental',
              message,
              url: localFilePath,
              type: 'image/jpeg',
            });
            setIsSharing(false);
            return;
          }
        } catch {}
      }
      await RNShare.share({ message, title: 'BLuxury Rental' });
    } catch (e) {
      if (e instanceof Error && e.message !== 'User cancelled') {
        Alert.alert('Share Error', 'Could not share rental.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const openViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
    setActiveIndex(viewerIndex);
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({
        index: viewerIndex,
        animated: false,
      });
    });
  }, [viewerIndex]);

  if (loading || !rental) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Royal.pureBlack} />
        <Text style={styles.loadingText}>Loading rental details…</Text>
        <View style={styles.loadingDivider} />
      </View>
    );
  }

  const images = (rental.images || []).filter(Boolean);
  const fullAddress = `${rental.location.locality}, ${rental.location.city}, ${rental.location.state} - ${rental.location.pincode}`;

  const handleCall = () => {
    if (rental.vendor?.contact) Linking.openURL(`tel:${rental.vendor.contact}`);
  };

  const handleWhatsAppContact = () => {
    if (rental.vendor?.contact) {
      const msg = `Hi, I'm interested in your rental "${rental.title}" on BLuxury.`;
      Linking.openURL(
        `whatsapp://send?phone=${rental.vendor.contact}&text=${encodeURIComponent(
          msg
        )}`
      );
    }
  };

  const openMap = () => {
    const coords = rental.location?.coordinates?.coordinates;
    if (coords && coords.length === 2) {
      const [lng, lat] = coords;
      const url = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(rental.title)}@${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${encodeURIComponent(rental.title)})`,
      });
      Linking.canOpenURL(url as string).then((supported) => {
        if (supported) Linking.openURL(url as string);
        else
          Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          );
      });
    } else {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          fullAddress
        )}`
      );
    }
  };

  const renderImageItem = ({
    item,
    index,
  }: {
    item: string;
    index: number;
  }) => (
    <Pressable onPress={() => openViewer(index)}>
      <Image
        source={{ uri: item, cache: 'force-cache' }}
        style={styles.mainImage}
      />
    </Pressable>
  );

  const renderHeroFallback = () => (
    <LinearGradient
      colors={[Royal.royalGreenDeep, Royal.royalGreen, Royal.obsidian]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroFallback}
    >
      <Ionicons name="home" size={48} color={Royal.gold} />
      <Text style={styles.heroFallbackTitle} numberOfLines={2}>
        {(rental.title || 'Rental Property').toUpperCase()}
      </Text>
      <View style={styles.heroFallbackDivider} />
      <Text style={styles.heroFallbackSub}>
        {(rental.rentalType || 'PREMIUM RENTAL').toUpperCase()}
      </Text>
    </LinearGradient>
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
          style={[
            styles.dot,
            activeIndex === i ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.imageWrapper}>
          {images.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={images}
              renderItem={renderImageItem}
              keyExtractor={(item, index) => `${item}-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              style={styles.carousel}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
            />
          ) : (
            renderHeroFallback()
          )}

          {images.length > 0 && renderDots()}

          <TouchableOpacity
            style={[styles.backBtn, { top: Math.max(insets.top, 20) + 10 }]}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={Royal.pureWhite} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareBtn, { top: Math.max(insets.top, 20) + 10 }]}
            onPress={handleShare}
            disabled={isSharing}
            accessibilityLabel="Share rental"
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={Royal.pureWhite} />
            ) : (
              <Ionicons name="share-outline" size={20} color={Royal.pureWhite} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{(rental.title || '').toUpperCase()}</Text>

          <View style={styles.row}>
            <Text style={styles.price}>₹{rental.monthlyRent}/month</Text>
            <View
              style={[
                styles.statusBadge,
                rental.isAvailable ? styles.statusAvailable : styles.statusBooked,
              ]}
            >
              <Ionicons
                name={rental.isAvailable ? 'checkmark-circle' : 'close-circle'}
                size={12}
                color={Royal.pureWhite}
              />
              <Text style={styles.statusText}>
                {rental.isAvailable ? 'AVAILABLE' : 'BOOKED'}
              </Text>
            </View>
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location-sharp" size={14} color={Royal.pureBlack} />
            <Text style={styles.address}>{fullAddress}</Text>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Ionicons
              name="diamond-outline"
              size={10}
              color={Royal.pureBlack}
              style={{ marginHorizontal: 8, opacity: 0.5 }}
            />
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.sectionTitle}>DETAILS</Text>
          <View style={styles.detailGrid}>
            <DetailItem
              icon="bed-outline"
              label="Type"
              value={rental.rentalType}
            />
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
            <DetailItem
              icon="cash-outline"
              label="Deposit"
              value={`₹${rental.deposit}`}
            />
            <DetailItem
              icon="settings-outline"
              label="Maintenance"
              value={`₹${rental.maintenanceCharges}`}
            />
          </View>

          {rental.description && (
            <>
              <Text style={styles.sectionTitle}>DESCRIPTION</Text>
              <Text style={styles.description}>{rental.description}</Text>
            </>
          )}

          {rental.amenities?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>AMENITIES</Text>
              <View style={styles.amenitiesContainer}>
                {rental.amenities.map((a: string, i: number) => (
                  <View key={i} style={styles.amenityPill}>
                    <Ionicons name="diamond" size={9} color={Royal.pureBlack} />
                    <Text style={styles.amenityText}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Ionicons
              name="diamond-outline"
              size={10}
              color={Royal.pureBlack}
              style={{ marginHorizontal: 8, opacity: 0.5 }}
            />
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={openMap}
            activeOpacity={0.9}
          >
            <Ionicons name="map-outline" size={18} color={Royal.pureWhite} />
            <Text style={styles.mapButtonText}>VIEW ON MAP</Text>
          </TouchableOpacity>

          <View style={styles.vendorCard}>
            <Text style={styles.sectionTitle}>VENDOR</Text>
            <View style={styles.vendorRow}>
              <View style={styles.vendorIconRing}>
                <View style={styles.vendorIconInner}>
                  <Ionicons name="person" size={20} color={Royal.pureWhite} />
                </View>
              </View>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>
                  {(rental.vendor.name || 'VENDOR').toUpperCase()}
                </Text>
                <Text style={styles.vendorContact}>{rental.vendor.contact}</Text>
              </View>
            </View>
            <View style={styles.vendorActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.callBtn]}
                onPress={handleCall}
                activeOpacity={0.9}
              >
                <Ionicons name="call" size={16} color={Royal.pureWhite} />
                <Text style={[styles.actionText, { color: Royal.pureWhite }]}>
                  CALL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.waBtn]}
                onPress={handleWhatsAppContact}
                activeOpacity={0.9}
              >
                <Ionicons name="logo-whatsapp" size={16} color={Royal.pureWhite} />
                <Text style={[styles.actionText, { color: Royal.pureWhite }]}>
                  WHATSAPP
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.shareRow}>
            <TouchableOpacity
              style={[styles.shareActionBtn, styles.shareBtnStyle]}
              onPress={handleShare}
              disabled={isSharing}
              activeOpacity={0.9}
            >
              <Ionicons
                name="share-social-outline"
                size={18}
                color={Royal.pureWhite}
              />
              <Text style={[styles.shareActionText, { color: Royal.pureWhite }]}>
                SHARE
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareActionBtn, styles.whatsappShareBtn]}
              onPress={handleShareWhatsApp}
              disabled={isSharing}
              activeOpacity={0.9}
            >
              <Ionicons name="logo-whatsapp" size={18} color={Royal.pureWhite} />
              <Text style={[styles.shareActionText, { color: Royal.pureWhite }]}>
                WHATSAPP
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom bar — safe-area aware */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) + 14 },
        ]}
      >
        <View style={styles.bottomBarInner}>
          <View>
            <Text style={styles.bottomLabel}>MONTHLY RENT</Text>
            <Text style={styles.bottomPrice}>₹{rental.monthlyRent}/month</Text>
          </View>
          <TouchableOpacity
            style={styles.bottomCta}
            onPress={handleCall}
            activeOpacity={0.9}
          >
            <Ionicons name="call" size={16} color={Royal.pureWhite} />
            <Text style={styles.bottomCtaText}>CONTACT</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Full-screen image viewer */}
      <Modal
        visible={viewerVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={closeViewer}
        statusBarTranslucent
      >
        <View style={styles.viewerContainer}>
          <StatusBar barStyle="light-content" backgroundColor={Royal.obsidian} />

          <FlatList
            ref={viewerListRef}
            data={images}
            keyExtractor={(item, index) => `viewer-${item}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setViewerIndex(idx);
            }}
            renderItem={({ item }) => <ZoomableImage uri={item} />}
          />

          <View
            style={[
              styles.viewerCounter,
              { top: Math.max(insets.top, 20) + 12 },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.viewerCounterText}>
              {viewerIndex + 1} / {images.length}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.viewerClose, { top: Math.max(insets.top, 20) + 8 }]}
            onPress={closeViewer}
            accessibilityLabel="Close image viewer"
          >
            <Ionicons name="close" size={26} color={Royal.pureWhite} />
          </TouchableOpacity>

          {images.length > 1 && (
            <View
              style={[
                styles.viewerThumbs,
                { bottom: Math.max(insets.bottom, 16) + 12 },
              ]}
            >
              <FlatList
                data={images}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `thumb-${item}-${index}`}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setViewerIndex(index);
                      viewerListRef.current?.scrollToIndex({
                        index,
                        animated: true,
                      });
                    }}
                    style={[
                      styles.viewerThumb,
                      viewerIndex === index && styles.viewerThumbActive,
                    ]}
                  >
                    <Image
                      source={{ uri: item }}
                      style={styles.viewerThumbImage}
                    />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// ZoomableImage — pinch-to-zoom, double-tap-to-zoom
// ─────────────────────────────────────────────────────────────
const ZoomableImage: React.FC<{ uri: string }> = ({ uri }) => {
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  const lastTapRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const [container, setContainer] = useState({ w: width, h: height });

  const reset = () => {
    scaleRef.current = 1;
    setScale(1);
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  };

  const toggleZoom = () => {
    if (scaleRef.current > 1) {
      reset();
    } else {
      const next = 2;
      scaleRef.current = next;
      setScale(next);
    }
  };

  const onPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      toggleZoom();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <View
      style={{ width, height, backgroundColor: Royal.obsidian }}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setContainer({ w, h });
      }}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          width: width * scale,
          height: height * scale,
        }}
        maximumZoomScale={4}
        minimumZoomScale={1}
        bouncesZoom
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scale > 1}
      >
        <Pressable onPress={onPress} style={{ flex: 1 }}>
          <Image
            source={{ uri }}
            style={{
              width: container.w * scale,
              height: container.h * scale,
              resizeMode: 'contain',
            }}
          />
        </Pressable>
      </ScrollView>
    </View>
  );
};

// Detail item
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
    <View style={detailStyles.iconRing}>
      <Ionicons name={icon} size={16} color={Royal.pureBlack} />
    </View>
    <View style={detailStyles.textContainer}>
      <Text style={detailStyles.label}>{label.toUpperCase()}</Text>
      <Text style={detailStyles.value}>{value || 'N/A'}</Text>
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
  iconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Royal.borderLight,
    backgroundColor: Royal.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: { marginLeft: 10, flex: 1 },
  label: {
    fontSize: 9,
    color: Royal.pureBlack,
    letterSpacing: 1.4,
    fontWeight: '800',
    marginBottom: 2,
    opacity: 0.5,
  },
  value: { fontSize: 13, fontWeight: '700', color: Royal.pureBlack },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.whiteBg },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Royal.offWhite,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 13,
    color: Royal.pureBlack,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loadingDivider: {
    width: 48,
    height: 1.5,
    backgroundColor: Royal.pureBlack,
    marginTop: 12,
    opacity: 0.4,
  },

  // Hero
  imageWrapper: {
    height: 320,
    backgroundColor: Royal.obsidian,
    position: 'relative',
  },
  carousel: { flex: 1 },
  mainImage: { width, height: 320, resizeMode: 'cover' },
  heroFallback: {
    width,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  heroFallbackTitle: {
    color: Royal.pureWhite,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 14,
  },
  heroFallbackDivider: {
    width: 48,
    height: 1.5,
    backgroundColor: Royal.gold,
    marginVertical: 10,
    opacity: 0.85,
  },
  heroFallbackSub: {
    color: Royal.goldSoft,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
  },

  backBtn: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(11,11,15,0.75)',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  shareBtn: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(11,11,15,0.75)',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  dotsContainer: {
    position: 'absolute',
    bottom: 18,
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
    backgroundColor: Royal.pureWhite,
    width: 22,
    height: 8,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  // Content
  content: { padding: 20, backgroundColor: Royal.whiteBg },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: Royal.pureBlack,
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  price: {
    fontSize: 22,
    fontWeight: '900',
    color: Royal.pureBlack,
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusAvailable: { backgroundColor: Royal.pureBlack },
  statusBooked: { backgroundColor: '#B91C1C' },
  statusText: {
    color: Royal.pureWhite,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.2,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    gap: 6,
  },
  address: {
    fontSize: 13,
    color: Royal.pureBlack,
    opacity: 0.7,
    flex: 1,
    lineHeight: 19,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Royal.borderLight,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Royal.pureBlack,
    letterSpacing: 2.5,
    marginBottom: 12,
    opacity: 0.8,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  description: {
    fontSize: 14,
    color: Royal.pureBlack,
    lineHeight: 22,
    opacity: 0.8,
  },

  amenitiesContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  amenityPill: {
    backgroundColor: Royal.offWhite,
    borderWidth: 1,
    borderColor: Royal.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amenityText: {
    color: Royal.pureBlack,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.4,
  },

  mapButton: {
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    backgroundColor: Royal.pureBlack,
    gap: 8,
  },
  mapButtonText: {
    color: Royal.pureWhite,
    fontWeight: '900',
    letterSpacing: 1.8,
    fontSize: 11,
  },

  vendorCard: {
    backgroundColor: Royal.offWhite,
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Royal.borderLight,
  },
  vendorRow: { flexDirection: 'row', alignItems: 'center' },
  vendorIconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: Royal.borderLight,
    padding: 2,
    backgroundColor: Royal.whiteBg,
  },
  vendorIconInner: {
    flex: 1,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Royal.pureBlack,
  },
  vendorInfo: { marginLeft: 12, flex: 1 },
  vendorName: {
    fontSize: 14,
    fontWeight: '900',
    color: Royal.pureBlack,
    letterSpacing: 1,
  },
  vendorContact: {
    fontSize: 12,
    color: Royal.pureBlack,
    opacity: 0.65,
    marginTop: 3,
    fontWeight: '600',
  },
  vendorActions: { flexDirection: 'row', marginTop: 14, gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  callBtn: {
    backgroundColor: Royal.pureBlack,
  },
  waBtn: {
    backgroundColor: Royal.pureBlack,
  },
  actionText: {
    fontWeight: '900',
    letterSpacing: 1.4,
    fontSize: 11,
  },

  shareRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  shareActionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  shareBtnStyle: {
    backgroundColor: Royal.pureBlack,
  },
  whatsappShareBtn: {
    backgroundColor: Royal.pureBlack,
  },
  shareActionText: {
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.8,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Royal.whiteBg,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Royal.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  bottomBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  bottomLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: Royal.pureBlack,
    letterSpacing: 2,
    marginBottom: 2,
    opacity: 0.5,
  },
  bottomPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: Royal.pureBlack,
  },
  bottomCta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    backgroundColor: Royal.pureBlack,
  },
  bottomCtaText: {
    color: Royal.pureWhite,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.8,
  },

  // Full-screen viewer
  viewerContainer: {
    flex: 1,
    backgroundColor: Royal.obsidian,
  },
  viewerClose: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(11,11,15,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  viewerCounter: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(11,11,15,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 20,
  },
  viewerCounterText: {
    color: Royal.pureWhite,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  viewerThumbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 64,
    zIndex: 20,
  },
  viewerThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.55,
  },
  viewerThumbActive: {
    borderColor: Royal.pureWhite,
    opacity: 1,
  },
  viewerThumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});

export default RentalDetailScreen;