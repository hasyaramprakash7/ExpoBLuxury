// src/components/ShopCard.tsx
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Vendor } from "../types";
import { Colors, getFullAddress, scale, verticalScale, moderateScale } from "../constants/colors";

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
    
    // Get current day index
    const now = new Date();
    const currentDayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentDayName = daysOrder[currentDayIndex === 0 ? 6 : currentDayIndex - 1]; // Convert to our format
    
    const result = daysOrder.map((day) => {
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
    
    return result;
  } catch {
    return [];
  }
};

export const ShopCard: React.FC<ShopCardProps> = ({ shop, onPress }) => {
  const [showFullHours, setShowFullHours] = useState(false);
  
  const fullAddress = getFullAddress(shop.address);
  
  // 🔥 Use time-based open/close
  const isOpen = isShopCurrentlyOpen(shop.operatingHours);
  const allDays = formatAllDays(shop.operatingHours);
  
  // Get today's hours
  const todayHours = allDays.find(d => d.isToday);
  
  // Get days to show (first 2 or all if expanded)
  const displayDays = showFullHours ? allDays : allDays.slice(0, 2);
  const hasMoreDays = allDays.length > 2;

  return (
    <TouchableOpacity
      style={shopCardStyles.cardContainer}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Shop Image Header */}
      <View style={shopCardStyles.imageHeader}>
        {shop.shopImage ? (
          <Image
            source={{ uri: shop.shopImage }}
            style={shopCardStyles.shopImage}
            resizeMode="cover"
          />
        ) : (
          <View style={shopCardStyles.shopImagePlaceholder}>
            <Ionicons name="storefront" size={moderateScale(40)} color={Colors.textLightGray} />
            <Text style={shopCardStyles.placeholderText}>No Image</Text>
          </View>
        )}
        
        {/* Overlay Badges */}
        <View style={shopCardStyles.imageOverlayBadges}>
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
        </View>

        {/* 🔥 Online Status Overlay - Based on operating hours */}
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

        {/* Out of Range Badge */}
        {shop.isInRange === false && shop.distance && (
          <View style={shopCardStyles.outOfRangeBadge}>
            <Ionicons name="location-outline" size={scale(10)} color={Colors.white} />
            <Text style={shopCardStyles.outOfRangeText}>
              {shop.distance.toFixed(1)} km
            </Text>
          </View>
        )}
      </View>

      {/* Shop Info Section */}
      <View style={shopCardStyles.infoSection}>
        <View style={shopCardStyles.nameRow}>
          <Text style={shopCardStyles.shopName} numberOfLines={1}>
            {shop.shopName}
          </Text>
          <Text style={shopCardStyles.businessType} numberOfLines={1}>
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
            <Text style={shopCardStyles.reviewCount}>({shop.reviewCount} reviews)</Text>
          ) : null}
          {shop.distance !== undefined && shop.distance !== null && (
            <View style={shopCardStyles.distancePill}>
              <Ionicons name="location-outline" size={scale(12)} color={shop.isInRange ? Colors.onlineGreen : Colors.offlineRed} />
              <Text style={[
                shopCardStyles.distanceText,
                { color: shop.isInRange ? Colors.onlineGreen : Colors.offlineRed }
              ]}>
                {shop.distance.toFixed(1)} km {!shop.isInRange && '• Out of Range'}
              </Text>
            </View>
          )}
        </View>

        <View style={shopCardStyles.addressRow}>
          <Ionicons name="location-outline" size={scale(14)} color={Colors.textGray} />
          <Text style={shopCardStyles.addressText}>
            {fullAddress}
          </Text>
        </View>

        {shop.categories && shop.categories.length > 0 && (
          <View style={shopCardStyles.tagsContainer}>
            {shop.categories.slice(0, 3).map((cat, idx) => (
              <View key={idx} style={shopCardStyles.tagPill}>
                <Text style={shopCardStyles.tagText}>{cat}</Text>
              </View>
            ))}
            {shop.categories.length > 3 && (
              <Text style={shopCardStyles.moreTag}>+{shop.categories.length - 3}</Text>
            )}
          </View>
        )}

        {(shop.services && shop.services.length > 0) || (shop.tags && shop.tags.length > 0) ? (
          <View style={shopCardStyles.smallTagsContainer}>
            {shop.services?.slice(0, 2).map((s, idx) => (
              <Text key={idx} style={shopCardStyles.smallTag}>{s}</Text>
            ))}
            {shop.tags?.slice(0, 2).map((t, idx) => (
              <Text key={idx} style={shopCardStyles.smallTag}>{t}</Text>
            ))}
            {(shop.services?.length > 2 || shop.tags?.length > 2) && (
              <Text style={shopCardStyles.smallTag}>+more</Text>
            )}
          </View>
        ) : null}

    

        {/* Delivery Range */}
        {shop.deliveryRange !== undefined && shop.deliveryRange > 0 && (
          <View style={shopCardStyles.deliveryRow}>
            <Ionicons name="bicycle-outline" size={scale(14)} color={Colors.textGray} />
            <Text style={shopCardStyles.deliveryText}>Delivers: {shop.deliveryRange} km</Text>
          </View>
        )}

        {(shop.phone || shop.email) && (
          <View style={shopCardStyles.contactRow}>
            {shop.phone && <Text style={shopCardStyles.contactText}>📞 {shop.phone}</Text>}
            {shop.phone && shop.email && <Text style={shopCardStyles.dotSeparator}> • </Text>}
            {shop.email && <Text style={shopCardStyles.contactText}>✉️ {shop.email}</Text>}
          </View>
        )}
      </View>

      <View style={shopCardStyles.divider} />

      <View style={shopCardStyles.bottomRow}>
        <View style={shopCardStyles.bottomLeft}>
          <View style={shopCardStyles.offerIconBadge}>
            <Ionicons name="flash" size={moderateScale(18)} color={Colors.white} />
          </View>
          <View>
            <Text style={shopCardStyles.offerTitle}>
              {shop.productsCount > 0 ? `${shop.productsCount} Products` : "Explore Shop"}
            </Text>
            <Text style={shopCardStyles.offerSubtitle}>AVAILABLE NOW | VIEW ALL</Text>
          </View>
        </View>
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
      </View>
    </TouchableOpacity>
  );
};

const shopCardStyles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.cardWhite,
    borderRadius: moderateScale(24),
    marginVertical: verticalScale(10),
    marginHorizontal: scale(16),
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: verticalScale(10) },
    shadowOpacity: 0.15,
    shadowRadius: moderateScale(15),
    elevation: 8,
    overflow: 'hidden',
  },
  imageHeader: {
    width: '100%',
    height: verticalScale(180),
    position: 'relative',
    backgroundColor: Colors.dividerGray,
  },
  shopImage: {
    width: '100%',
    height: '100%',
  },
  shopImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  placeholderText: {
    color: Colors.textLightGray,
    fontSize: moderateScale(14),
    marginTop: verticalScale(8),
  },
  imageOverlayBadges: {
    position: 'absolute',
    top: verticalScale(12),
    right: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  overlayBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
  },
  premiumBadgeText: {
    color: Colors.white,
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  onlineStatusOverlay: {
    position: 'absolute',
    bottom: verticalScale(12),
    left: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
  },
  statusDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    marginRight: scale(6),
  },
  statusTextOverlay: {
    color: Colors.cardWhite,
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  outOfRangeBadge: {
    position: 'absolute',
    bottom: verticalScale(12),
    right: scale(12),
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
    fontWeight: '600',
  },
  infoSection: {
    padding: moderateScale(16),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(4),
  },
  shopName: {
    fontSize: moderateScale(20),
    fontWeight: '900',
    color: Colors.textDark,
    letterSpacing: -0.5,
    flex: 1,
  },
  businessType: {
    fontSize: moderateScale(13),
    color: Colors.textGray,
    marginLeft: scale(8),
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
    color: Colors.textLightGray,
    fontSize: moderateScale(13),
    marginRight: scale(6),
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
  },
  distanceText: {
    fontSize: moderateScale(12),
    marginLeft: scale(2),
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: verticalScale(4),
  },
  addressText: {
    fontSize: moderateScale(14),
    color: Colors.textGray,
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
    backgroundColor: '#F0F0F0',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    marginRight: scale(6),
    marginBottom: verticalScale(4),
  },
  tagText: {
    fontSize: moderateScale(12),
    color: Colors.textGray,
    fontWeight: '500',
  },
  moreTag: {
    fontSize: moderateScale(12),
    color: Colors.textLightGray,
    marginLeft: scale(4),
  },
  smallTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: verticalScale(4),
  },
  smallTag: {
    fontSize: moderateScale(11),
    color: Colors.textGray,
    backgroundColor: '#F0F0F0',
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    marginRight: scale(4),
    marginBottom: verticalScale(4),
  },
  // 🔥 New Hours Styles
  hoursContainer: {
    marginTop: verticalScale(6),
    marginBottom: verticalScale(4),
    backgroundColor: '#F8F8F8',
    borderRadius: moderateScale(8),
    padding: moderateScale(10),
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
    paddingBottom: verticalScale(4),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  hoursHeaderText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    marginLeft: scale(4),
  },
  todayHoursText: {
    fontSize: moderateScale(12),
    color: Colors.textGray,
    marginLeft: 'auto',
    fontWeight: '500',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(2),
  },
  todayRow: {
    backgroundColor: 'rgba(27, 140, 64, 0.08)',
    borderRadius: moderateScale(4),
    paddingHorizontal: scale(4),
    marginHorizontal: -scale(4),
  },
  dayName: {
    fontSize: moderateScale(12),
    color: Colors.textGray,
    fontWeight: '500',
  },
  todayText: {
    color: Colors.accentGreen,
    fontWeight: '700',
  },
  dayHours: {
    fontSize: moderateScale(12),
    color: Colors.textDark,
  },
  closedText: {
    color: Colors.offlineRed,
  },
  showMoreBtn: {
    marginTop: verticalScale(2),
    paddingVertical: verticalScale(2),
  },
  showMoreText: {
    fontSize: moderateScale(11),
    color: Colors.accentBlue,
    fontWeight: '600',
    textAlign: 'center',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  deliveryText: {
    fontSize: moderateScale(12),
    color: Colors.textGray,
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
    color: Colors.textGray,
    fontWeight: '500',
  },
  dotSeparator: {
    color: Colors.textLightGray,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dividerGray,
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
    color: Colors.textDark,
    marginBottom: verticalScale(1),
  },
  offerSubtitle: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    color: Colors.textLightGray,
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
    borderColor: Colors.cardWhite,
    backgroundColor: Colors.dividerGray,
  },
});