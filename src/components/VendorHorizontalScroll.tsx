// src/components/VendorHorizontalScroll.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import config from '../../src/config/config';
import NewProductCard from '../components/NewProductCard10';

const { width } = Dimensions.get('window');

const FLIP_CARD_WIDTH = width * 0.72;
const FLIP_CARD_HEIGHT = FLIP_CARD_WIDTH / 1.586;
const PRODUCT_CARD_WIDTH = width;

const Palette = {
  royalNavy: '#0B1021',
  luxuryGold: '#D4AF37',
  pureWhite: '#FFFFFF',
  lightBorder: '#EAEAEA',
  success: '#10B981',
  error: '#EF4444',
  accentGreen: '#1B8C40',
  textDark: '#1C1C1E',
  textGray: '#6B7280',
  textLightGray: '#9CA3AF',
};

const SMOOTH_SPRING = {
  damping: 18,
  stiffness: 130,
  mass: 0.85,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

interface VendorHorizontalScrollProps {
  vendorId: string;
  vendorName: string;
  isVendorOffline?: boolean;
  onSeeAll?: () => void;
}

interface DisplayItem {
  id: string;
  type: 'property' | 'rental' | 'product';
  title: string;
  image: string;
  price: string;
  subtitle?: string;
  productData?: any;
  rawData?: any;
}

const RealisticChip = () => (
  <LinearGradient
    colors={['#D4AF37', '#F9E2AF', '#C5A028', '#D4AF37']}
    style={styles.chipContainer}
  >
    <View style={[styles.chipLine, { top: '25%' }]} />
    <View style={[styles.chipLine, { top: '50%' }]} />
    <View style={[styles.chipLine, { top: '75%' }]} />
    <View style={[styles.chipLineV, { left: '33%' }]} />
    <View style={[styles.chipLineV, { left: '66%' }]} />
  </LinearGradient>
);

const ViewCTA = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const tx = useSharedValue(0);
  useEffect(() => {
    tx.value = withRepeat(
      withSequence(withTiming(8, { duration: 600 }), withTiming(0, { duration: 600 })),
      -1,
      true
    );
  }, []);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.ctaButton}>
      <Text style={styles.ctaText}>{label}</Text>
      <ReAnimated.View style={anim}>
        <Ionicons name="arrow-forward" size={16} color={Palette.pureWhite} />
      </ReAnimated.View>
    </TouchableOpacity>
  );
};

interface FlipItemCardProps {
  item: DisplayItem;
  onPress: () => void;
}

const FlipItemCard: React.FC<FlipItemCardProps> = ({ item, onPress }) => {
  const [, forceRender] = useState(0);

  const rotateX = useSharedValue(0);
  const isFlippedSV = useSharedValue(0);

  const isProperty = item.type === 'property';
  const isRental = item.type === 'rental';
  const raw = item.rawData || {};

  const image = typeof item.image === 'string' && item.image.trim() ? item.image : null;

  const title = (item.title || '').toString();
  const typeBadge = (
    isProperty ? raw.propertyType || 'PROPERTY' : raw.rentalType || 'RENTAL'
  )
    .toString()
    .toUpperCase();

  const priceDisplay = item.price || '';

  const fullAddress = [
    raw.location?.address,
    raw.location?.locality,
    raw.location?.city,
    raw.location?.state,
    raw.location?.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  const specMain = isProperty
    ? raw.configuration?.bhk || ''
    : raw.bedrooms
    ? `${raw.bedrooms} BHK`
    : '';

  const specSub = isProperty
    ? raw.areaOptions?.[0]?.superBuiltUpSqFt || raw.area
      ? `${raw.areaOptions?.[0]?.superBuiltUpSqFt || raw.area} SQFT`
      : ''
    : raw.bathrooms
    ? `${raw.bathrooms} BATH`
    : 'MONTHLY';

  const locality = (raw.location?.locality || raw.location?.city || '')
    .toString()
    .toUpperCase();

  const vendorPhone = raw.contactPhone || raw.vendor?.phone || '';
  const isAvailable = raw.isAvailable !== false;

  const toggleFlip = useCallback(() => {
    const next = isFlippedSV.value === 0 ? 1 : 0;
    isFlippedSV.value = next;
    rotateX.value = withSpring(next * 180, SMOOTH_SPRING);
    forceRender((n) => n + 1);
  }, []);

  // 🎯 VERTICAL drag flips the card. Horizontal drag falls through to
  //    the parent horizontal ScrollView.
  //
  //    Key tuning for smooth horizontal scroll:
  //    - activeOffsetY: [-15, 15]  → don't hijack touch until 15px vertical
  //    - failOffsetX:   [-8, 8]    → bail out FAST if user moves horizontally
  //                                   (so the ScrollView takes over immediately)
  const pan = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .failOffsetX([-8, 8])
    .shouldCancelWhenOutside(false)
    .onUpdate((e) => {
      const base = isFlippedSV.value * 180;
      const delta = Math.max(-90, Math.min(90, e.translationY * 0.5));
      rotateX.value = base + delta;
    })
    .onEnd((e) => {
      const distance = Math.abs(e.translationY);
      const velocity = Math.abs(e.velocityY);
      const shouldFlip = distance > 55 || velocity > 450;

      if (shouldFlip) {
        const next = isFlippedSV.value === 0 ? 1 : 0;
        isFlippedSV.value = next;
        rotateX.value = withSpring(next * 180, SMOOTH_SPRING);
        runOnJS(forceRender)(Date.now());
      } else {
        rotateX.value = withSpring(isFlippedSV.value * 180, SMOOTH_SPRING);
      }
    });

  const frontStyle = useAnimatedStyle(() => {
    const r = rotateX.value;
    const showBack = r > 90 && r < 270;
    const isFlat = Math.abs(r) < 0.5;
    return {
      transform: isFlat ? [] : [{ perspective: 1200 }, { rotateX: `${r}deg` }],
      zIndex: showBack ? 0 : 1,
      opacity: showBack ? 0 : 1,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const r = rotateX.value;
    const showBack = r > 90 && r < 270;
    const isFlat = Math.abs(r - 180) < 0.5;
    return {
      transform: isFlat ? [] : [{ perspective: 1200 }, { rotateX: `${r + 180}deg` }],
      zIndex: showBack ? 1 : 0,
      opacity: showBack ? 1 : 0,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    };
  });

  const ctaLabel = isProperty ? 'VIEW PROPERTY' : 'VIEW RENTAL';

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.flipWrapper}>
        <ReAnimated.View style={[styles.cardBase, frontStyle]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={onPress}
            style={styles.cardTouchable}
          >
            {!!image && (
              <Image
                source={{ uri: image }}
                style={styles.cardBgImage}
                resizeMode="cover"
              />
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
              locations={[0, 0.5, 1]}
              style={styles.cardGradient}
            />

            <View style={styles.frontHeader}>
              <View style={styles.chipBrandGroup}>
                <RealisticChip />
              </View>
              <View style={styles.glassBadge}>
                <Text style={styles.badgeText}>{typeBadge}</Text>
              </View>
            </View>

            <View style={styles.frontBody}>
              <Text style={styles.miniLabel}>
                {isRental ? 'MONTHLY RENT' : 'VALUATION'}
              </Text>
              <Text style={styles.priceValue}>{priceDisplay}</Text>
              {isRental && !isAvailable && (
                <View
                  style={[styles.availablePill, { backgroundColor: 'rgba(239,68,68,0.9)' }]}
                >
                  <View style={styles.availableDot} />
                  <Text style={styles.availablePillText}>BOOKED</Text>
                </View>
              )}
            </View>

            <View style={styles.frontFooter}>
              <View style={styles.footerLeft}>
                <Text style={styles.miniLabel}>
                  {isProperty ? 'PROPERTY TITLE' : 'RENTAL TITLE'}
                </Text>
                <Text style={styles.boldTitle} numberOfLines={1}>
                  {title.toUpperCase()}
                </Text>
                {!!fullAddress && (
                  <View style={styles.addressRow}>
                    <Ionicons
                      name="location-sharp"
                      size={10}
                      color="rgba(255,255,255,0.6)"
                    />
                    <Text style={styles.locationText} numberOfLines={2}>
                      {fullAddress}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.specColumn}>
                {!!specMain && <Text style={styles.specText}>{specMain}</Text>}
                {!!specSub && <Text style={styles.specTextSub}>{specSub}</Text>}
              </View>
            </View>
          </TouchableOpacity>
        </ReAnimated.View>

        <ReAnimated.View style={[styles.cardBase, styles.cardBack, backStyle]}>
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={onPress}
            style={styles.vCardContainer}
          >
            <View style={styles.vCardHeader}>
              <View style={styles.vCardLogoArea}>
                <MaterialCommunityIcons
                  name="rhombus-split"
                  size={20}
                  color={Palette.accentGreen}
                />
                <Text style={styles.vCardBrandName}>BLUXURY</Text>
              </View>
              <TouchableOpacity
                onPress={toggleFlip}
                style={styles.flipIcon}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="refresh-circle" size={22} color={Palette.accentGreen} />
              </TouchableOpacity>
            </View>

            <View style={styles.vCardMainInfo}>
              <Text style={styles.vendorName} numberOfLines={1}>
                {title.toUpperCase()}
              </Text>
              <Text style={styles.vendorTitle} numberOfLines={1}>
                {typeBadge}
              </Text>
              <View style={styles.goldDivider} />
            </View>

            <View style={styles.contactGrid}>
              {!!priceDisplay && (
                <View style={styles.contactItem}>
                  <Ionicons name="pricetag" size={13} color={Palette.accentGreen} />
                  <Text style={styles.contactText} numberOfLines={1}>
                    {priceDisplay}
                  </Text>
                </View>
              )}

              {!!locality && (
                <View style={styles.contactItem}>
                  <Ionicons name="location-sharp" size={13} color={Palette.accentGreen} />
                  <Text style={styles.contactText} numberOfLines={1}>
                    {locality}
                  </Text>
                </View>
              )}

              {!!vendorPhone && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`tel:${vendorPhone}`)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="call" size={13} color={Palette.accentGreen} />
                  <Text style={styles.contactText}>+91 {vendorPhone}</Text>
                </TouchableOpacity>
              )}

              {!!vendorPhone && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() =>
                    Linking.openURL(
                      Platform.OS === 'android'
                        ? `whatsapp://send?phone=${vendorPhone}`
                        : `whatsapp://send?phone=${vendorPhone}`
                    )
                  }
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <FontAwesome name="whatsapp" size={13} color={Palette.accentGreen} />
                  <Text style={styles.contactText}>WHATSAPP</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.vCardFooter}>
              <ViewCTA label={ctaLabel} onPress={onPress} />
            </View>
          </TouchableOpacity>
        </ReAnimated.View>
      </View>
    </GestureDetector>
  );
};

export const VendorHorizontalScroll: React.FC<VendorHorizontalScrollProps> = ({
  vendorId,
  vendorName,
  isVendorOffline = false,
  onSeeAll,
}) => {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId) {
      setItems([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchVendorData = async () => {
      try {
        const baseUrl = config.apiUrl;
        const [propertiesRes, rentalsRes, productsRes] = await Promise.all([
          axios.get(`${baseUrl}/v1/properties`, {
            params: { 'vendor.vendorId': vendorId, limit: 10 },
          }),
          axios.get(`${baseUrl}/v1/rentals`, { params: { vendorId, limit: 10 } }),
          axios.get(`${baseUrl}/vendor-products/vendor/${vendorId}?limit=10`),
        ]);

        const combined: DisplayItem[] = [];

        (propertiesRes.data.data || []).forEach((p: any) => {
          const min = p.minPriceCr ?? null;
          const max = p.maxPriceCr ?? null;
          const price =
            min != null && max != null
              ? min === max
                ? `₹${min} Cr`
                : `₹${min} - ${max} Cr`
              : min != null
              ? `₹${min} Cr`
              : '';
          combined.push({
            id: p._id,
            type: 'property',
            title: p.title || '',
            image: p.images?.[0] || '',
            price,
            subtitle: `${p.propertyType || ''} • ${p.configuration?.bhk || ''}`,
            rawData: p,
          });
        });

        (rentalsRes.data.data || []).forEach((r: any) => {
          combined.push({
            id: r._id,
            type: 'rental',
            title: r.title || '',
            image: r.images?.[0] || '',
            price: r.monthlyRent ? `₹${Number(r.monthlyRent).toLocaleString()}` : '',
            subtitle: `${r.rentalType || ''} • ${r.bedrooms || 0} BHK`,
            rawData: r,
          });
        });

        (productsRes.data.products || []).forEach((prod: any) => {
          combined.push({
            id: prod._id,
            type: 'product',
            title: prod.name,
            image: prod.images?.[0] || '',
            price: `₹${prod.price}`,
            subtitle: prod.category || prod.brandName || '',
            productData: prod,
          });
        });

        if (isMounted) {
          setItems(combined);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching vendor data:', err);
        if (isMounted) {
          setError('Failed to load listings');
          setLoading(false);
        }
      }
    };

    fetchVendorData();
    return () => {
      isMounted = false;
    };
  }, [vendorId]);

  const handleItemPress = useCallback(
    (item: DisplayItem) => {
      if (item.type === 'product') return;
      if (item.type === 'property') {
        navigation.navigate('PropertyDetailScreen', { propertyId: item.id });
      } else if (item.type === 'rental') {
        navigation.navigate('RentalDetail', { rentalId: item.id });
      }
    },
    [navigation]
  );

  if (!vendorId || !vendorName) return null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Palette.accentGreen} />
        <Text style={styles.loadingText}>Loading {vendorName}'s listings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>⚠️ {error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No listings available for {vendorName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}

        // ⚡ SMOOTH HORIZONTAL SCROLL TUNING
        decelerationRate={0.985}
        // 0.985 → long, floaty momentum glide (Instagram/iOS Photos feel)
        // iOS only. Android uses its own fling curve.

        directionalLockEnabled
        // iOS: lock to horizontal axis once scrolling starts → no jitter

        alwaysBounceHorizontal={false}
        // iOS: don't bounce on short content

        bounces={true}
        // iOS: gentle rubber-band bounce at ends

        nestedScrollEnabled
        // Android: essential — allows this ScrollView to coexist with
        // the parent vertical ScrollView (ShopCard list)

        scrollEventThrottle={16}
        // 16ms ≈ 60fps scroll event dispatch → smooth momentum

        removeClippedSubviews={false}
        // Keep all cards mounted so images don't pop in mid-scroll

        overScrollMode="never"
        // Android: no blue edge glow → premium feel

        // 🎯 Android-only: make the parent gesture win over child
        // touch handlers so horizontal drag is captured instantly
        // even when the touch starts on a flip card.
        onStartShouldSetResponderCapture={() => false}
      >
        {items.map((item) => {
          if (item.type === 'product' && item.productData) {
            return (
              <View key={`${item.type}-${item.id}`} style={styles.productCardWrapper}>
                <NewProductCard
                  product={item.productData}
                  isVendorOffline={isVendorOffline}
                />
              </View>
            );
          }
          return (
            <FlipItemCard
              key={`${item.type}-${item.id}`}
              item={item}
              onPress={() => handleItemPress(item)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 12 },
  scrollContent: { paddingHorizontal: 12, paddingVertical: 4 },

  flipWrapper: {
    width: FLIP_CARD_WIDTH,
    height: FLIP_CARD_HEIGHT,
    marginHorizontal: 6,
  },
  cardTouchable: { flex: 1, position: 'relative' },

  cardBase: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: Palette.pureWhite,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Palette.lightBorder,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardBack: {
    backgroundColor: Palette.pureWhite,
    borderColor: Palette.accentGreen,
    borderWidth: 1,
  },

  cardBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },

  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },

  chipContainer: { width: 34, height: 24, borderRadius: 4, overflow: 'hidden' },
  chipLine: {
    position: 'absolute',
    height: 0.5,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  chipLineV: {
    position: 'absolute',
    width: 0.5,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  chipBrandGroup: { flexDirection: 'row', alignItems: 'center' },

  frontHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    alignItems: 'center',
    zIndex: 2,
  },
  brandText: {
    color: Palette.pureWhite,
    fontSize: 8,
    letterSpacing: 2,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  glassBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: { color: '#fff', fontSize: 7.5, fontWeight: 'bold' },

  frontBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    paddingHorizontal: 16,
    zIndex: 2,
  },
  miniLabel: {
    color: Palette.luxuryGold,
    fontSize: 7.5,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  priceValue: { color: '#fff', fontSize: 20, fontWeight: '300', letterSpacing: 1 },
  availablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.9)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  availableDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.pureWhite,
    marginRight: 4,
  },
  availablePillText: {
    color: Palette.pureWhite,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  frontFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    zIndex: 2,
  },
  footerLeft: { flex: 1 },
  boldTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  locationText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    marginLeft: 4,
    letterSpacing: 0.3,
    lineHeight: 11.5,
    flex: 1,
  },
  specColumn: { alignItems: 'flex-end', marginLeft: 6 },
  specText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  specTextSub: { color: Palette.luxuryGold, fontSize: 7, fontWeight: 'bold' },

  vCardContainer: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: Palette.pureWhite,
  },
  vCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vCardLogoArea: { flexDirection: 'row', alignItems: 'center' },
  vCardBrandName: {
    color: Palette.textDark,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginLeft: 5,
  },
  flipIcon: { padding: 2 },
  vCardMainInfo: { marginTop: 2 },
  vendorName: { color: Palette.textDark, fontSize: 13, fontWeight: 'bold' },
  vendorTitle: {
    color: Palette.textLightGray,
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 1,
  },
  goldDivider: {
    width: 24,
    height: 2,
    backgroundColor: Palette.accentGreen,
    marginTop: 5,
  },
  contactGrid: { marginVertical: 2 },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  contactText: {
    color: Palette.textGray,
    fontSize: 9,
    marginLeft: 8,
    fontWeight: '500',
    flex: 1,
  },
  vCardFooter: { width: '100%' },
  ctaButton: {
    backgroundColor: Palette.accentGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  ctaText: {
    color: Palette.pureWhite,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginRight: 8,
  },

  productCardWrapper: {
    width: PRODUCT_CARD_WIDTH,
    paddingHorizontal: 20,
    marginHorizontal: 0,
  },

  loadingContainer: { padding: 16, alignItems: 'center' },
  loadingText: { marginTop: 8, color: Palette.textGray, fontSize: 14 },
  emptyContainer: { padding: 16, alignItems: 'center' },
  emptyText: { color: Palette.textGray, fontSize: 14 },
});

export default VendorHorizontalScroll;