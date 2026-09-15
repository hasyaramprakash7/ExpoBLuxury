// src/components/ShopCard.tsx
import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  Modal,
  StatusBar,
  TouchableWithoutFeedback,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Vendor } from "../types";
import { Colors, getFullAddress, scale, verticalScale, moderateScale } from "../constants/colors";
import VendorHorizontalScroll from "./VendorHorizontalScroll";
import Share from 'react-native-share';
import { Share as RNShare } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Play Store link - replace with your actual app link
const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury';
const APP_STORE_LINK = 'https://apps.apple.com/app/bluxury/id123456789';

// 🔥 Helper to parse array fields (categories, services, tags)
const parseArrayField = (field: any): string[] => {
  if (!field) return [];

  if (Array.isArray(field)) {
    if (field.length === 1 && typeof field[0] === 'string' && field[0].startsWith('[')) {
      try {
        const parsed = JSON.parse(field[0]);
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item).trim()).filter(Boolean);
        }
      } catch (_) {}
    }
    return field.map(item => String(item).trim()).filter(Boolean);
  }

  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
      return [String(parsed).trim()].filter(Boolean);
    } catch (_) {
      if (field.includes(',')) {
        return field.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [field.trim()].filter(Boolean);
    }
  }

  return [];
};

interface ShopCardProps {
  shop: Vendor & {
    distance?: number;
    productsCount: number;
    productImages: string[];
    shopImage?: string;
    isInRange?: boolean;
  };
  onPress: () => void;
}

// 🔥 Check if shop is currently open based on operating hours
const isShopCurrentlyOpen = (operatingHours: any): boolean => {
  if (!operatingHours) return false;

  try {
    const parsed = typeof operatingHours === 'string' ? JSON.parse(operatingHours) : operatingHours;
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const daySchedule = parsed[currentDay];
    if (!daySchedule || !daySchedule.open || !daySchedule.close) return false;

    const [openHour, openMinute] = daySchedule.open.split(':').map(Number);
    const [closeHour, closeMinute] = daySchedule.close.split(':').map(Number);
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;

    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime < closeTime;
    }
    return currentTime >= openTime && currentTime < closeTime;
  } catch {
    return false;
  }
};

// 🔥 Format all days with their hours
const formatAllDays = (hours: any): Array<{ day: string; hours: string; isToday: boolean }> => {
  if (!hours) return [];

  try {
    const parsed = typeof hours === 'string' ? JSON.parse(hours) : hours;
    const dayNames = {
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
    };
    const daysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const now = new Date();
    const currentDayIndex = now.getDay();
    const currentDayName = daysOrder[currentDayIndex === 0 ? 6 : currentDayIndex - 1];

    return daysOrder.map((day) => {
      const dayData = parsed[day];
      const hoursStr = dayData && dayData.open && dayData.close
        ? `${dayData.open} - ${dayData.close}`
        : 'Closed';
      return {
        day: dayNames[day as keyof typeof dayNames] || day,
        hours: hoursStr,
        isToday: day === currentDayName,
      };
    });
  } catch {
    return [];
  }
};

export const ShopCard: React.FC<ShopCardProps> = ({ shop, onPress }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isImageFullScreen, setIsImageFullScreen] = useState(false);

  // 🔥 Parse categories, services, and tags using the helper
  const categories = useMemo(() => parseArrayField(shop.categories), [shop.categories]);
  const services = useMemo(() => parseArrayField(shop.services), [shop.services]);
  const tags = useMemo(() => parseArrayField(shop.tags), [shop.tags]);

  const fullAddress = getFullAddress(shop.address);

  const isOpen = isShopCurrentlyOpen(shop.operatingHours);

  // 🔥 Category / service tags
  const categoryTags = useMemo(() => categories.slice(0, 3), [categories]);
  const serviceTags = useMemo(() => services.slice(0, 3), [services]);

  // ✅ Has a real image
  const hasShopImage = Boolean(shop.shopImage && shop.shopImage.trim().length > 0);

  const getShopImageUrl = (): string => (hasShopImage ? (shop.shopImage as string) : '');

  // Google Maps link
  const getGoogleMapsLink = (): string => {
    const lat = shop.address?.latitude;
    const lng = shop.address?.longitude;
    const fullAddressStr = getFullAddress(shop.address);

    if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    if (fullAddressStr) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressStr)}`;
    return '';
  };

  // Download image locally for share
  const downloadImageToLocal = async (imageUrl: string): Promise<string | null> => {
    try {
      const timestamp = Date.now();
      const filePath = `${FileSystem.cacheDirectory}shop_${timestamp}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, filePath);

      if (downloadResult.status === 200) {
        if (Platform.OS === 'android') return `file://${downloadResult.uri}`;
        return downloadResult.uri;
      }
      return null;
    } catch (error) {
      console.log('Image download error:', error);
      return null;
    }
  };

  // Build share message
  const buildShareMessage = (): string => {
    const shopName = shop.shopName || 'Shop';
    const fullAddressStr = getFullAddress(shop.address);
    const mapsLink = getGoogleMapsLink();
    const appLink = Platform.OS === 'ios' ? APP_STORE_LINK : PLAY_STORE_LINK;
    const categoryStr = categories.length > 0 ? categories.join(', ') : 'N/A';
    const serviceStr = services.length > 0 ? services.join(', ') : 'N/A';
    const productCount = shop.productsCount || 0;

    let message = `🏪 *${shopName}*\n\n`;
    message += `📋 *Business Type:* ${shop.businessType || 'Shop'}\n`;
    if (fullAddressStr) message += `📍 *Location:* ${fullAddressStr}\n`;
    if (mapsLink) message += `🗺️ *View on Google Maps:* ${mapsLink}\n`;
    if (shop.phone) message += `📞 *Phone:* ${shop.phone}\n`;
    if (shop.distance !== undefined && shop.distance !== null) message += `📏 *Distance:* ${shop.distance.toFixed(1)} km\n`;
    if (categoryStr && categoryStr !== 'N/A') message += `📂 *Categories:* ${categoryStr}\n`;
    if (serviceStr && serviceStr !== 'N/A') message += `🛠️ *Services:* ${serviceStr}\n`;
    message += `🛍️ *Products:* ${productCount} items\n`;
    if (shop.deliveryRange && shop.deliveryRange > 0) message += `🚚 *Delivery Range:* ${shop.deliveryRange} km\n`;
    message += `🕐 *Status:* ${isOpen ? '✅ Open Now' : '❌ Closed'}\n`;
    if (shop.averageRating) message += `⭐ *Rating:* ${shop.averageRating.toFixed(1)} (${shop.reviewCount || 0} reviews)\n`;
    message += `\n📱 *Download App:* ${appLink}`;
    return message;
  };

  // WhatsApp share
  const handleShareWhatsApp = async () => {
    setIsSharing(true);
    try {
      const imageUrl = getShopImageUrl();
      const message = buildShareMessage();

      if (imageUrl) {
        try {
          const localFilePath = await downloadImageToLocal(imageUrl);
          if (localFilePath) {
            await Share.shareSingle({
              title: 'BLuxury Shop',
              message,
              url: localFilePath,
              type: 'image/jpeg',
              social: Share.Social.WHATSAPP,
            });
            setIsSharing(false);
            return;
          }
        } catch (imageError) {
          console.log('WhatsApp image share failed:', imageError);
        }
      }

      const phone = shop.phone || '';
      const waUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) await Linking.openURL(waUrl);
      else await Share.open({ title: 'BLuxury Shop', message });
    } catch (error) {
      console.error('WhatsApp share error:', error);
      if (error instanceof Error && error.message !== 'User cancelled') {
        Alert.alert('Share Error', 'Could not share to WhatsApp. Please try again.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // General share
  const handleShare = async () => {
    setIsSharing(true);
    try {
      const imageUrl = getShopImageUrl();
      const message = buildShareMessage();

      if (imageUrl) {
        try {
          const localFilePath = await downloadImageToLocal(imageUrl);
          if (localFilePath) {
            await Share.open({
              title: 'BLuxury Shop',
              message,
              url: localFilePath,
              type: 'image/jpeg',
            });
            setIsSharing(false);
            return;
          }
        } catch (imageError) {
          console.log('Image sharing failed:', imageError);
        }
      }

      await RNShare.share({ message, title: 'BLuxury Shop' });
    } catch (error) {
      console.error('Share error:', error);
      if (error instanceof Error && error.message !== 'User cancelled') {
        Alert.alert('Share Error', 'Could not share shop. Please try again.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={shopCardStyles.cardContainer}
        onPress={onPress}
        activeOpacity={0.95}
      >
        {/* 🔥 FULL-HEIGHT BACKGROUND IMAGE */}
        {hasShopImage && (
          <Image
            source={{ uri: shop.shopImage as string }}
            style={shopCardStyles.backgroundImage}
            resizeMode="cover"
          />
        )}

        {/* 🔥 Gradient overlay for readability */}
        <LinearGradient
          colors={
            hasShopImage
              ? ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.88)', 'rgba(0,0,0,0.96)']
              : ['#1F1F1F', '#0F0F0F']
          }
          locations={hasShopImage ? [0, 0.35, 0.72, 1] : [0, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* CONTENT OVERLAY */}
        <View style={shopCardStyles.contentOverlay}>
          {/* TOP ROW: status + badges + expand */}
          <View style={shopCardStyles.topRow}>
            <View style={shopCardStyles.onlineStatusOverlay}>
              <View
                style={[
                  shopCardStyles.statusDot,
                  { backgroundColor: isOpen ? Colors.onlineGreen : Colors.offlineRed },
                ]}
              />
              <Text
                style={[
                  shopCardStyles.statusTextOverlay,
                  { color: isOpen ? Colors.onlineGreen : Colors.offlineRed },
                ]}
              >
                {isOpen ? "Open Now" : "Closed"}
              </Text>
            </View>

            <View style={shopCardStyles.topRowRight}>
              {shop.isInRange === false && shop.distance ? (
                <View style={shopCardStyles.outOfRangeBadge}>
                  <Ionicons name="location-outline" size={scale(10)} color={Colors.white} />
                  <Text style={shopCardStyles.outOfRangeText}>{shop.distance.toFixed(1)} km</Text>
                </View>
              ) : null}

              {shop.isVerified && (
                <View style={shopCardStyles.overlayBadge}>
                  <Ionicons name="checkmark-circle" size={scale(16)} color={Colors.accentBlue} />
                </View>
              )}

              {shop.isPremium && (
                <View style={[shopCardStyles.overlayBadge, { backgroundColor: Colors.gold }]}>
                  <Text style={shopCardStyles.premiumBadgeText}>PREMIUM</Text>
                </View>
              )}

              {hasShopImage && (
                <TouchableOpacity
                  style={shopCardStyles.expandBtn}
                  onPress={() => setIsImageFullScreen(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="expand-outline" size={scale(14)} color={Colors.white} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SPACER pushes content to bottom, letting image shine through */}
          <View style={shopCardStyles.spacer} />

          {/* INFO SECTION */}
          <View style={shopCardStyles.infoSection}>
            <View style={shopCardStyles.nameRow}>
              <Text style={[shopCardStyles.shopName, shopCardStyles.textShadow]} numberOfLines={1}>
                {shop.shopName}
              </Text>
              <Text style={[shopCardStyles.businessType, shopCardStyles.textShadow]} numberOfLines={1}>
                {shop.businessType || "Shop"}
              </Text>
            </View>

            <View style={shopCardStyles.ratingRow}>
              {shop.averageRating ? (
                <View style={shopCardStyles.ratingPill}>
                  <Text style={shopCardStyles.ratingNumber}>
                    {shop.averageRating.toFixed(1)}
                  </Text>
                  <Ionicons name="star" size={scale(12)} color={Colors.white} />
                </View>
              ) : null}
              {shop.reviewCount ? (
                <Text style={[shopCardStyles.reviewCount, shopCardStyles.textShadow]}>
                  ({shop.reviewCount} reviews)
                </Text>
              ) : null}
              {shop.distance !== undefined && shop.distance !== null && (
                <View style={shopCardStyles.distancePill}>
                  <Ionicons
                    name="location-outline"
                    size={scale(12)}
                    color={shop.isInRange ? Colors.onlineGreen : Colors.offlineRed}
                  />
                  <Text
                    style={[
                      shopCardStyles.distanceText,
                      { color: shop.isInRange ? Colors.onlineGreen : Colors.offlineRed },
                    ]}
                  >
                    {shop.distance.toFixed(1)} km {!shop.isInRange && '• Out of Range'}
                  </Text>
                </View>
              )}
            </View>

            <View style={shopCardStyles.addressRow}>
              <Ionicons name="location-outline" size={scale(14)} color="rgba(255,255,255,0.85)" />
              <Text style={[shopCardStyles.addressText, shopCardStyles.textShadow]}>
                {fullAddress}
              </Text>
            </View>

            {/* Categories */}
            {categoryTags.length > 0 && (
              <View style={shopCardStyles.tagsContainer}>
                {categoryTags.map((cat, idx) => (
                  <View key={`cat-${idx}`} style={[shopCardStyles.tagPill, shopCardStyles.categoryTag]}>
                    <Text style={shopCardStyles.tagText}>{cat}</Text>
                  </View>
                ))}
                {categories.length > 3 && (
                  <Text style={shopCardStyles.moreTag}>+{categories.length - 3}</Text>
                )}
              </View>
            )}

            {/* Services */}
            {serviceTags.length > 0 && (
              <View style={shopCardStyles.tagsContainer}>
                {serviceTags.map((service, idx) => (
                  <View key={`service-${idx}`} style={[shopCardStyles.tagPill, shopCardStyles.serviceTag]}>
                    <Text style={shopCardStyles.tagText}>{service}</Text>
                  </View>
                ))}
                {services.length > 3 && (
                  <Text style={shopCardStyles.moreTag}>+{services.length - 3}</Text>
                )}
              </View>
            )}

            {/* Tags fallback */}
            {categories.length === 0 && services.length === 0 && tags.length > 0 && (
              <View style={shopCardStyles.tagsContainer}>
                {tags.slice(0, 4).map((tag, idx) => (
                  <View key={`tag-${idx}`} style={[shopCardStyles.tagPill, shopCardStyles.tagTag]}>
                    <Text style={shopCardStyles.tagText}>{tag}</Text>
                  </View>
                ))}
                {tags.length > 4 && (
                  <Text style={shopCardStyles.moreTag}>+{tags.length - 4}</Text>
                )}
              </View>
            )}

            {/* Delivery */}
            {shop.deliveryRange !== undefined && shop.deliveryRange > 0 && (
              <View style={shopCardStyles.deliveryRow}>
                <Ionicons name="bicycle-outline" size={scale(14)} color="rgba(255,255,255,0.85)" />
                <Text style={[shopCardStyles.deliveryText, shopCardStyles.textShadow]}>
                  Delivers: {shop.deliveryRange} km
                </Text>
              </View>
            )}

            {/* Contacts */}
            {(shop.phone || shop.email) && (
              <View style={shopCardStyles.contactRow}>
                {shop.phone && (
                  <Text style={[shopCardStyles.contactText, shopCardStyles.textShadow]}>📞 {shop.phone}</Text>
                )}
                {shop.phone && shop.email && <Text style={shopCardStyles.dotSeparator}> • </Text>}
                {shop.email && (
                  <Text style={[shopCardStyles.contactText, shopCardStyles.textShadow]}>✉️ {shop.email}</Text>
                )}
              </View>
            )}
          </View>

          {/* Horizontal scroll */}
          {shop._id && (
            <View style={shopCardStyles.horizontalScrollContainer}>
              <VendorHorizontalScroll
                vendorId={shop._id}
                vendorName={shop.shopName}
                isVendorOffline={!shop.isOnline}
                onSeeAll={onPress}
              />
            </View>
          )}

          <View style={shopCardStyles.divider} />

          {/* BOTTOM ROW */}
          <View style={shopCardStyles.bottomRow}>
            <View style={shopCardStyles.bottomLeft}>
              <View style={shopCardStyles.offerIconBadge}>
                <Ionicons name="flash" size={moderateScale(18)} color={Colors.white} />
              </View>
              <View>
                <Text style={[shopCardStyles.offerTitle, shopCardStyles.textShadow]}>
                  {shop.productsCount > 0 ? `${shop.productsCount} Products` : "Explore Shop"}
                </Text>
                <Text style={shopCardStyles.offerSubtitle}>AVAILABLE NOW | VIEW ALL</Text>
              </View>
            </View>

            <View style={shopCardStyles.rightSection}>
              <View style={shopCardStyles.productImagesContainer}>
                {shop.productImages && shop.productImages.length > 0 ? (
                  shop.productImages.slice(0, 3).map((img, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: img }}
                      style={[
                        shopCardStyles.miniProductImg,
                        { marginLeft: idx > 0 ? -scale(12) : 0, zIndex: 3 - idx },
                      ]}
                    />
                  ))
                ) : (
                  <Ionicons name="arrow-forward-circle" size={moderateScale(28)} color={Colors.accentGreen} />
                )}
              </View>

              <View style={shopCardStyles.shareButtonsContainer}>
                <TouchableOpacity
                  style={[shopCardStyles.shareBtnSmall, shopCardStyles.shareBtnStyle]}
                  onPress={handleShare}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="share-social-outline" size={12} color={Colors.white} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[shopCardStyles.shareBtnSmall, shopCardStyles.whatsappShareBtn]}
                  onPress={handleShareWhatsApp}
                  disabled={isSharing}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="logo-whatsapp" size={12} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* 🔥 FULL SCREEN IMAGE VIEWER */}
      <Modal
        visible={isImageFullScreen && hasShopImage}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsImageFullScreen(false)}
      >
        <View style={shopCardStyles.fullScreenContainer}>
          <StatusBar hidden={isImageFullScreen} />
          <TouchableWithoutFeedback onPress={() => setIsImageFullScreen(false)}>
            <View style={shopCardStyles.fullScreenTouchable}>
              <Image
                source={{ uri: shop.shopImage as string }}
                style={shopCardStyles.fullScreenImage}
                resizeMode="contain"
              />
            </View>
          </TouchableWithoutFeedback>
          <TouchableOpacity
            style={shopCardStyles.closeButton}
            onPress={() => setIsImageFullScreen(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={moderateScale(26)} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const shopCardStyles = StyleSheet.create({
  cardContainer: {
    borderRadius: moderateScale(24),
    marginVertical: verticalScale(10),
    marginHorizontal: scale(16),
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: verticalScale(10) },
    shadowOpacity: 0.25,
    shadowRadius: moderateScale(15),
    elevation: 10,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    minHeight: verticalScale(540),
  },

  // 🔥 Full-bleed background image
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  contentOverlay: {
    flex: 1,
    paddingTop: verticalScale(14),
    justifyContent: 'space-between',
  },

  spacer: {
    flex: 1,
    minHeight: verticalScale(50),
  },

  // TOP ROW
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
  },
  topRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },

  onlineStatusOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statusDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    marginRight: scale(6),
  },
  statusTextOverlay: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },

  overlayBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  premiumBadgeText: {
    color: Colors.white,
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outOfRangeBadge: {
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
    gap: scale(4),
  },
  outOfRangeText: {
    color: Colors.cardWhite,
    fontSize: moderateScale(10),
    fontWeight: '700',
  },
  expandBtn: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  // INFO
  infoSection: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(6),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(4),
  },
  shopName: {
    fontSize: moderateScale(22),
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    flex: 1,
  },
  businessType: {
    fontSize: moderateScale(13),
    color: 'rgba(255,255,255,0.85)',
    marginLeft: scale(8),
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(2),
    flexWrap: 'wrap',
  },
  ratingPill: {
    backgroundColor: Colors.accentGreen,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    marginRight: scale(6),
  },
  ratingNumber: {
    color: Colors.cardWhite,
    fontWeight: '800',
    fontSize: moderateScale(13),
    marginRight: scale(2),
  },
  reviewCount: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: moderateScale(13),
    marginRight: scale(6),
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  distanceText: {
    fontSize: moderateScale(12),
    marginLeft: scale(2),
    fontWeight: '700',
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: verticalScale(6),
  },
  addressText: {
    fontSize: moderateScale(14),
    color: 'rgba(255,255,255,0.9)',
    marginLeft: scale(4),
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: moderateScale(20),
  },

  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: verticalScale(6),
  },
  tagPill: {
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    marginRight: scale(6),
    marginBottom: verticalScale(4),
    borderWidth: 1,
  },
  categoryTag: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
    borderColor: 'rgba(76, 175, 80, 0.65)',
  },
  serviceTag: {
    backgroundColor: 'rgba(33, 150, 243, 0.25)',
    borderColor: 'rgba(33, 150, 243, 0.65)',
  },
  tagTag: {
    backgroundColor: 'rgba(233, 30, 99, 0.25)',
    borderColor: 'rgba(233, 30, 99, 0.65)',
  },
  tagText: {
    fontSize: moderateScale(12),
    color: '#FFFFFF',
    fontWeight: '600',
  },
  moreTag: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.7)',
    marginLeft: scale(4),
    alignSelf: 'center',
  },

  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  deliveryText: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.85)',
    marginLeft: scale(4),
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(4),
    flexWrap: 'wrap',
  },
  contactText: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  dotSeparator: {
    color: 'rgba(255,255,255,0.5)',
  },

  horizontalScrollContainer: {
    marginTop: verticalScale(6),
    marginBottom: verticalScale(4),
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    width: '100%',
    marginVertical: verticalScale(4),
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(16),
  },
  bottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  offerIconBadge: {
    width: scale(38),
    height: scale(38),
    backgroundColor: Colors.accentPurple,
    borderRadius: moderateScale(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  offerTitle: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: verticalScale(1),
  },
  offerSubtitle: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  productImagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniProductImg: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: Colors.dividerGray,
  },
  shareButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginLeft: scale(4),
  },
  shareBtnSmall: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  shareBtnStyle: {
    backgroundColor: Colors.accentGreen,
  },
  whatsappShareBtn: {
    backgroundColor: '#25D366',
  },

  // Text shadow helper
  textShadow: {
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Full screen viewer
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: verticalScale(44),
    right: scale(20),
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});

export default ShopCard;