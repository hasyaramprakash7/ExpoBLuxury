// src/components/VendorVerticalScroll.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  TextInput,
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

const CARD_HORIZONTAL_MARGIN = 16;
const FLIP_CARD_WIDTH = width - CARD_HORIZONTAL_MARGIN * 2;
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

interface VendorVerticalScrollProps {
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

// ---------- Chip ----------
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

// ---------- CTA ----------
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

// ================================================================
// Flip Card — horizontal flip with live finger tracking
// (vertical drag is left to the parent vertical ScrollView)
// ================================================================
interface FlipItemCardProps {
  item: DisplayItem;
  onPress: () => void;
}

const FlipItemCard: React.FC<FlipItemCardProps> = ({ item, onPress }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [, forceRender] = useState(0);

  const rotateY = useSharedValue(0);
  const isFlippedSV = useSharedValue(0);

  const isProperty = item.type === 'property';
  const isRental = item.type === 'rental';
  const raw = item.rawData || {};

  const image = typeof item.image === 'string' && item.image.trim() ? item.image : null;
  const showImage = !!image && !imgFailed;

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
    rotateY.value = withSpring(next * 180, SMOOTH_SPRING);
    forceRender((n) => n + 1);
  }, []);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .shouldCancelWhenOutside(false)
    .onUpdate((e) => {
      const base = isFlippedSV.value * 180;
      const delta = Math.max(-90, Math.min(90, e.translationX * 0.5));
      rotateY.value = base + delta;
    })
    .onEnd((e) => {
      const distance = Math.abs(e.translationX);
      const velocity = Math.abs(e.velocityX);
      const shouldFlip = distance > 55 || velocity > 450;

      if (shouldFlip) {
        const next = isFlippedSV.value === 0 ? 1 : 0;
        isFlippedSV.value = next;
        rotateY.value = withSpring(next * 180, SMOOTH_SPRING);
        runOnJS(forceRender)(Date.now());
      } else {
        rotateY.value = withSpring(isFlippedSV.value * 180, SMOOTH_SPRING);
      }
    });

  const frontStyle = useAnimatedStyle(() => {
    const r = rotateY.value;
    const showBack = r > 90 && r < 270;
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${r}deg` }],
      zIndex: showBack ? 0 : 1,
      opacity: showBack ? 0 : 1,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const r = rotateY.value;
    const showBack = r > 90 && r < 270;
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${r + 180}deg` }],
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
        {/* ================= FRONT ================= */}
        <ReAnimated.View style={[styles.cardBase, frontStyle]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={onPress}
            style={styles.cardTouchable}
          >
            {showImage ? (
              <Image
                source={{ uri: image! }}
                style={styles.cardBgImage}
                resizeMode="cover"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <View style={[styles.cardBgImage, { backgroundColor: Palette.royalNavy }]} />
            )}

            <LinearGradient
              colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
              style={styles.cardGradient}
            />

            <View style={styles.frontHeader}>
              <View style={styles.chipBrandGroup}>
                <RealisticChip />
                <Text style={styles.brandText}>BLACK EDITION</Text>
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

        {/* ================= BACK ================= */}
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

// ================================================================
// Main
// ================================================================
export const VendorVerticalScroll: React.FC<VendorVerticalScrollProps> = ({
  vendorId,
  vendorName,
  isVendorOffline = false,
  onSeeAll,
}) => {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const title = (item.title || '').toLowerCase();
      const subtitle = (item.subtitle || '').toLowerCase();
      const price = (item.price || '').toLowerCase();
      return title.includes(q) || subtitle.includes(q) || price.includes(q);
    });
  }, [items, searchQuery]);

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
      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={18} color={Palette.textLightGray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search listings..."
          placeholderTextColor={Palette.textLightGray}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={Palette.textLightGray} />
          </TouchableOpacity>
        )}
      </View>

      {filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? `No results for "${searchQuery}"`
              : `No listings available for ${vendorName}`}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}

          // ⚡ SMOOTH HUMAN-LIKE VERTICAL SCROLL TUNING
          decelerationRate="fast"
          // iOS: momentum glide after finger lift
          // (use 0.985 for even longer glide, like Instagram)

          directionalLockEnabled
          // iOS: lock to vertical axis once scroll begins → no jitter

          alwaysBounceVertical={false}
          // iOS: don't bounce on an empty list, but keep bounce when content exists

          bounces={true}
          // iOS: gentle bounce at top/bottom

          nestedScrollEnabled
          // Android: allows child horizontal scroll (flip gesture) to coexist

          scrollEventThrottle={16}
          // 16ms ≈ 60fps updates for smooth momentum tracking

          removeClippedSubviews={false}
          // Keep all cards mounted so images don't pop in mid-scroll

          overScrollMode="never"
          // Android: kill the blue glow at edges — feels premium

          keyboardShouldPersistTaps="handled"
          // Search bar: tapping a card while keyboard is up works

          keyboardDismissMode="on-drag"
          // iOS: dismiss keyboard when user starts scrolling → smoother feel
        >
          {filteredItems.map((item) => {
            if (item.type === 'product' && item.productData) {
              return (
                <View
                  key={`${item.type}-${item.id}`}
                  style={styles.productCardWrapper}
                >
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
      )}
    </View>
  );
};

// ================================================================
// Styles
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1, marginVertical: 12 },
  scrollContent: { paddingHorizontal: 12, paddingVertical: 8 },

  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.pureWhite,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Palette.lightBorder,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Palette.textDark,
    paddingVertical: 0,
  },

  flipWrapper: {
    width: FLIP_CARD_WIDTH,
    height: FLIP_CARD_HEIGHT,
    alignSelf: 'center',
    marginBottom: 16,
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
    backfaceVisibility: 'hidden',
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
  cardGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

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
    marginBottom: 16,
    alignSelf: 'center',
  },

  loadingContainer: { padding: 16, alignItems: 'center' },
  loadingText: { marginTop: 8, color: Palette.textGray, fontSize: 14 },
  emptyContainer: { padding: 16, alignItems: 'center' },
  emptyText: { color: Palette.textGray, fontSize: 14, textAlign: 'center' },
});

export default VendorVerticalScroll;