// src/screens/ShopDetails.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Linking,
  Alert,
  Platform,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../app/store";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import NewProductCard from "../components/NewProductCard10";
import { fetchVendorReviews, createReview, clearReviews } from "../features/reviewSlice";
import { createViewLead, createCallLead, createWhatsAppLead } from "../features/leadSlice";

const { width, height } = Dimensions.get("window");

// --- Responsive helpers ---
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

const Colors = {
  background: "#FFFFFF",
  backgroundSecondary: "#F8F9FA",
  card: "#FFFFFF",
  cardHover: "#F1F3F5",
  white: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textTertiary: "#8A8A8A",
  accentGreen: "#1B8C40",
  accentGreenDark: "#0F6B30",
  accentBlue: "#2563EB",
  gold: "#F59E0B",
  onlineGreen: "#22C55E",
  offlineRed: "#EF4444",
  border: "#E8E8E8",
  borderLight: "#F0F0F0",
  starYellow: "#F59E0B",
  starGray: "#D1D5DB",
  shadow: "rgba(0,0,0,0.08)",
  shadowDark: "rgba(0,0,0,0.12)",
};

// --- Helper to check if shop is currently open ---
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

// --- Helper to format full operating hours ---
const formatFullHours = (hours: any): string | null => {
  if (!hours) return null;
  try {
    const parsed = typeof hours === "string" ? JSON.parse(hours) : hours;
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const dayNames = {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",
    };
    
    let schedule = "";
    for (const day of days) {
      if (parsed[day] && parsed[day].open && parsed[day].close) {
        schedule += `${dayNames[day as keyof typeof dayNames]}: ${parsed[day].open} - ${parsed[day].close}\n`;
      }
    }
    return schedule || null;
  } catch {
    return null;
  }
};

// --- Review Component ---
const ReviewItem: React.FC<{ review: any }> = ({ review }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <View style={reviewStyles.reviewCard}>
      <View style={reviewStyles.reviewHeader}>
        <View style={reviewStyles.userInfo}>
          {review.user?.profilePic ? (
            <Image 
              source={{ uri: review.user.profilePic }} 
              style={reviewStyles.userAvatar} 
            />
          ) : (
            <View style={reviewStyles.userAvatarPlaceholder}>
              <Text style={reviewStyles.userAvatarText}>
                {review.user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <View>
            <Text style={reviewStyles.userName}>{review.user?.name || 'User'}</Text>
            <View style={reviewStyles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= review.rating ? "star" : "star-outline"}
                  size={moderateScale(14)}
                  color={star <= review.rating ? Colors.starYellow : Colors.starGray}
                />
              ))}
            </View>
          </View>
        </View>
        <Text style={reviewStyles.reviewDate}>{formatDate(review.createdAt)}</Text>
      </View>
      
      {review.comment && (
        <Text style={reviewStyles.reviewComment}>{review.comment}</Text>
      )}
      
      {review.images && review.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={reviewStyles.reviewImagesContainer}>
          {review.images.map((img: string, idx: number) => (
            <Image key={idx} source={{ uri: img }} style={reviewStyles.reviewImage} />
          ))}
        </ScrollView>
      )}
      
      {review.isVerified && (
        <View style={reviewStyles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={moderateScale(14)} color={Colors.accentBlue} />
          <Text style={reviewStyles.verifiedText}>Verified Purchase</Text>
        </View>
      )}
    </View>
  );
};

const reviewStyles = StyleSheet.create({
  reviewCard: {
    backgroundColor: Colors.card,
    borderRadius: moderateScale(14),
    padding: moderateScale(16),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(6),
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    marginRight: scale(12),
  },
  userAvatarPlaceholder: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: Colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  userAvatarText: {
    color: Colors.white,
    fontSize: moderateScale(18),
    fontWeight: 'bold',
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  ratingStars: {
    flexDirection: 'row',
    marginTop: verticalScale(2),
  },
  reviewDate: {
    color: Colors.textTertiary,
    fontSize: moderateScale(11),
  },
  reviewComment: {
    color: Colors.textSecondary,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(22),
    marginTop: verticalScale(6),
  },
  reviewImagesContainer: {
    flexDirection: 'row',
    marginTop: verticalScale(10),
  },
  reviewImage: {
    width: moderateScale(70),
    height: moderateScale(70),
    borderRadius: moderateScale(10),
    marginRight: scale(8),
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(8),
  },
  verifiedText: {
    color: Colors.accentBlue,
    fontSize: moderateScale(12),
    marginLeft: scale(4),
  },
});

// --- Review Modal Component ---
const ReviewModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  vendorId: string;
  onSubmit: (rating: number, comment: string) => void;
  loading: boolean;
}> = ({ visible, onClose, vendorId, onSubmit, loading }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }
    onSubmit(rating, comment);
  };

  const resetForm = () => {
    setRating(0);
    setComment('');
    setHoverRating(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={reviewModalStyles.overlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={reviewModalStyles.modalContainer}
            >
              <View style={reviewModalStyles.modalContent}>
                <View style={reviewModalStyles.modalHeader}>
                  <Text style={reviewModalStyles.modalTitle}>Write a Review</Text>
                  <TouchableOpacity onPress={handleClose}>
                    <Ionicons name="close" size={scale(24)} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={reviewModalStyles.ratingLabel}>How would you rate this shop?</Text>
                
                <View style={reviewModalStyles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      onPressIn={() => setHoverRating(star)}
                      onPressOut={() => setHoverRating(0)}
                    >
                      <Ionicons
                        name={star <= (hoverRating || rating) ? "star" : "star-outline"}
                        size={moderateScale(44)}
                        color={star <= (hoverRating || rating) ? Colors.starYellow : Colors.starGray}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {rating > 0 && (
                  <Text style={reviewModalStyles.ratingText}>
                    {rating === 5 ? 'Excellent! ⭐' :
                     rating === 4 ? 'Very Good 👍' :
                     rating === 3 ? 'Good 👌' :
                     rating === 2 ? 'Fair 🤔' :
                     'Poor 😞'}
                  </Text>
                )}

                <TextInput
                  style={reviewModalStyles.commentInput}
                  placeholder="Share your experience..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  value={comment}
                  onChangeText={setComment}
                  maxLength={500}
                />
                
                <Text style={reviewModalStyles.charCount}>{comment.length}/500</Text>

                <View style={reviewModalStyles.buttonRow}>
                  <TouchableOpacity
                    style={[reviewModalStyles.button, reviewModalStyles.cancelButton]}
                    onPress={handleClose}
                  >
                    <Text style={reviewModalStyles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[reviewModalStyles.button, reviewModalStyles.submitButton]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={reviewModalStyles.submitButtonText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const reviewModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '92%',
    maxHeight: '80%',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: moderateScale(24),
    padding: moderateScale(24),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  modalTitle: {
    fontSize: moderateScale(22),
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  ratingLabel: {
    fontSize: moderateScale(16),
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: verticalScale(16),
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(10),
    marginBottom: verticalScale(8),
  },
  ratingText: {
    fontSize: moderateScale(20),
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: verticalScale(16),
  },
  commentInput: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    color: Colors.textPrimary,
    fontSize: moderateScale(15),
    minHeight: verticalScale(100),
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  charCount: {
    color: Colors.textTertiary,
    fontSize: moderateScale(12),
    textAlign: 'right',
    marginTop: verticalScale(6),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(20),
    gap: scale(12),
  },
  button: {
    flex: 1,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(14),
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: moderateScale(15),
  },
  submitButton: {
    backgroundColor: Colors.accentGreen,
  },
  submitButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: moderateScale(15),
  },
});

// --- Main Component ---
const ShopDetails = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vendor } = route.params;

  const dispatch = useDispatch<AppDispatch>();
  const { allProducts, loading: productsLoading } = useSelector(
    (state: RootState) => state.vendorProducts
  );
  const { user } = useSelector((state: RootState) => state.auth);
  const { reviews, loading: reviewsLoading } = useSelector(
    (state: RootState) => state.reviews
  );

  const [products, setProducts] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const vendorData = vendor;
  const isOpen = isShopCurrentlyOpen(vendorData?.operatingHours);
  const fullHours = formatFullHours(vendorData?.operatingHours);
  const hoursDisplay = fullHours ? fullHours.split('\n').filter(Boolean) : [];

  const viewTracked = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      viewTracked.current = false;
    };
  }, []);

  // Track view lead
  useEffect(() => {
    if (user?._id && vendor?._id && !viewTracked.current && isMounted.current) {
      viewTracked.current = true;
      
      const viewData = {
        vendorId: vendor._id,
        shopName: vendor.shopName || 'Shop',
        userId: user._id,
        userName: user.name || 'User'
      };
      
      dispatch(createViewLead(viewData))
        .then((result: any) => {
          console.log('✅ View lead tracked for vendor:', vendor.shopName);
        })
        .catch((error: any) => {
          console.error('❌ Failed to track view lead:', error);
        });
    }
  }, [vendor?._id, user?._id, dispatch]);

  // Fetch products
  useEffect(() => {
    if (!allProducts || allProducts.length === 0) {
      dispatch(fetchAllVendorProducts());
    }
  }, [dispatch]);

  // Fetch reviews
  useEffect(() => {
    if (vendorData?._id && isMounted.current) {
      dispatch(clearReviews());
      dispatch(fetchVendorReviews({ vendorId: vendorData._id, page: 1, limit: 20 }));
    }
    return () => {
      if (isMounted.current) {
        dispatch(clearReviews());
      }
    };
  }, [vendorData?._id, dispatch]);

  // Filter products for this vendor
  useEffect(() => {
    if (allProducts && vendorData?._id) {
      const filtered = allProducts.filter(
        (p) => (p.vendor?._id || p.vendorId) === vendorData._id
      );
      setProducts(filtered);
    }
  }, [allProducts, vendorData]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchAllVendorProducts()).unwrap(),
        dispatch(fetchVendorReviews({ vendorId: vendorData._id, page: 1, limit: 20 })).unwrap(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, vendorData]);

  // Handle Call
  const handleCall = useCallback(() => {
    if (vendorData?._id && user?._id) {
      dispatch(createCallLead({
        vendorId: vendorData._id,
        shopName: vendorData.shopName || 'Shop',
        phone: vendorData.phone || ''
      }));
    }
    if (vendorData?.phone) {
      Linking.openURL(`tel:${vendorData.phone}`).catch(() => 
        Alert.alert('Error', 'Unable to make call')
      );
    }
  }, [vendorData, user?._id, dispatch]);

  // Handle WhatsApp
  const handleWhatsApp = useCallback(() => {
    if (vendorData?._id && user?._id) {
      dispatch(createWhatsAppLead({
        vendorId: vendorData._id,
        shopName: vendorData.shopName || 'Shop',
        phone: vendorData.phone || ''
      }));
    }
    if (vendorData?.phone) {
      const msg = `Hi, I'm interested in your shop "${vendorData.shopName}" on BLuxury.`;
      Linking.openURL(
        `whatsapp://send?phone=${vendorData.phone}&text=${encodeURIComponent(msg)}`
      ).catch(() => Alert.alert('Error', 'WhatsApp not installed'));
    }
  }, [vendorData, user?._id, dispatch]);

  // Open map
  const openMap = useCallback(() => {
    const { latitude, longitude } = vendorData?.address || {};
    if (latitude && longitude) {
      const scheme = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(vendorData.shopName)}@${latitude},${longitude}`,
        android: `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(vendorData.shopName)})`,
      });
      const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      Linking.canOpenURL(scheme as string)
        .then((supported) => {
          if (supported) {
            Linking.openURL(scheme as string);
          } else {
            Linking.openURL(fallbackUrl);
          }
        })
        .catch(() => Linking.openURL(fallbackUrl));
    } else {
      const address = getFullAddress();
      if (address) {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        Linking.openURL(url);
      } else {
        Alert.alert("Error", "No address available for this shop.");
      }
    }
  }, [vendorData]);

  const getFullAddress = () => {
    const addr = vendorData?.address;
    if (!addr) return null;
    const parts = [
      addr.street,
      addr.locality,
      addr.city,
      addr.district,
      addr.state,
      addr.pincode,
      addr.country,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const fullAddress = getFullAddress();

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!user?._id) {
      Alert.alert('Login Required', 'Please login to submit a review.');
      return;
    }
    setIsSubmitting(true);
    try {
      await dispatch(createReview({
        vendorId: vendorData._id,
        rating,
        comment,
      })).unwrap();
      Alert.alert('Success', 'Your review has been submitted!');
      setShowReviewModal(false);
      dispatch(fetchVendorReviews({ vendorId: vendorData._id, page: 1, limit: 20 }));
    } catch (error: any) {
      Alert.alert('Error', error || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vendorData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accentGreen} />
        <Text style={styles.loadingText}>Loading shop details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accentGreen}
            colors={[Colors.accentGreen]}
            progressBackgroundColor={Colors.background}
          />
        }
      >
        {/* Header Image with White Gradient */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                vendorData?.shopImage ||
                "https://via.placeholder.com/600x400?text=Shop",
            }}
            style={styles.shopImage}
            resizeMode="cover"
          />
          
          {/* White Gradient Overlay at Bottom - 50% */}
          <View style={styles.imageGradientOverlay} />
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={scale(24)} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Shop Info - White Theme */}
        <View style={styles.infoContainer}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <Text style={styles.shopName}>{vendorData?.shopName}</Text>
              <View style={[styles.onlineBadge, { backgroundColor: isOpen ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)' }]}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isOpen ? Colors.onlineGreen : Colors.offlineRed },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: isOpen ? Colors.onlineGreen : Colors.offlineRed },
                  ]}
                >
                  {isOpen ? "Open Now" : "Closed"}
                </Text>
              </View>
            </View>
            
            <View style={styles.badgeRow}>
              {vendorData?.isVerified && (
                <View style={styles.badge}>
                  <Ionicons name="checkmark-circle" size={moderateScale(18)} color={Colors.accentBlue} />
                </View>
              )}
              {vendorData?.isPremium && (
                <View style={[styles.badge, styles.premiumBadge]}>
                  <Ionicons name="star" size={moderateScale(16)} color={Colors.gold} />
                </View>
              )}
            </View>
          </View>

          <Text style={styles.businessType}>{vendorData?.businessType || "Shop"}</Text>

          {/* Rating & Reviews */}
          <View style={styles.ratingContainer}>
            {vendorData?.averageRating ? (
              <View style={styles.ratingPill}>
                <Text style={styles.ratingNumber}>
                  {vendorData.averageRating.toFixed(1)}
                </Text>
                <Ionicons name="star" size={moderateScale(14)} color={Colors.white} />
              </View>
            ) : null}
            {vendorData?.reviewCount ? (
              <Text style={styles.reviewCount}>
                {vendorData.reviewCount} reviews
              </Text>
            ) : null}
          </View>

          {/* Address with Map Button */}
          {fullAddress && (
            <TouchableOpacity style={styles.addressContainer} onPress={openMap} activeOpacity={0.7}>
              <View style={styles.addressRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name="location-outline" size={moderateScale(20)} color={Colors.accentGreen} />
                </View>
                <View style={styles.addressContent}>
                  <Text style={styles.addressLabel}>Location</Text>
                  <Text style={styles.addressText}>{fullAddress}</Text>
                </View>
                <Ionicons name="chevron-forward" size={moderateScale(20)} color={Colors.textTertiary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Categories */}
          {vendorData?.categories && vendorData.categories.length > 0 && (
            <View style={styles.tagsContainer}>
              {vendorData.categories.slice(0, 5).map((cat: string, idx: number) => (
                <View key={idx} style={styles.tagPill}>
                  <Text style={styles.tagText}>{cat}</Text>
                </View>
              ))}
              {vendorData.categories.length > 5 && (
                <Text style={styles.moreTag}>
                  +{vendorData.categories.length - 5}
                </Text>
              )}
            </View>
          )}

          {/* Operating Hours */}
          {hoursDisplay.length > 0 && (
            <View style={styles.hoursContainer}>
              <View style={styles.hoursHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name="time-outline" size={moderateScale(20)} color={Colors.accentGreen} />
                </View>
                <Text style={styles.hoursTitle}>Operating Hours</Text>
              </View>
              <View style={styles.hoursList}>
                {hoursDisplay.slice(0, showAllHours ? hoursDisplay.length : 3).map((hour, idx) => (
                  <Text key={idx} style={styles.hourText}>
                    {hour}
                  </Text>
                ))}
                {hoursDisplay.length > 3 && (
                  <TouchableOpacity onPress={() => setShowAllHours(!showAllHours)}>
                    <Text style={styles.showMoreText}>
                      {showAllHours ? 'Show less' : `Show ${hoursDisplay.length - 3} more days`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Delivery Range */}
          {vendorData?.deliveryRange !== undefined && vendorData.deliveryRange > 0 && (
            <View style={styles.deliveryContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="bicycle-outline" size={moderateScale(20)} color={Colors.accentGreen} />
              </View>
              <Text style={styles.deliveryText}>
                Delivers up to {vendorData.deliveryRange} km
              </Text>
            </View>
          )}

          {/* Contact Buttons */}
          {(vendorData?.phone || vendorData?.email) && (
            <View style={styles.contactRow}>
              {vendorData?.phone && (
                <TouchableOpacity
                  style={[styles.contactButton, styles.callButton]}
                  onPress={handleCall}
                >
                  <Ionicons name="call-outline" size={moderateScale(20)} color={Colors.white} />
                  <Text style={styles.contactButtonText}>Call</Text>
                </TouchableOpacity>
              )}
              {vendorData?.phone && (
                <TouchableOpacity
                  style={[styles.contactButton, styles.whatsappButton]}
                  onPress={handleWhatsApp}
                >
                  <Ionicons name="logo-whatsapp" size={moderateScale(20)} color={Colors.white} />
                  <Text style={styles.contactButtonText}>WhatsApp</Text>
                </TouchableOpacity>
              )}
              {vendorData?.phone && (
                <TouchableOpacity
                  style={[styles.contactButton, styles.directionsButton]}
                  onPress={openMap}
                >
                  <Ionicons name="navigate-outline" size={moderateScale(20)} color={Colors.white} />
                  <Text style={styles.contactButtonText}>Directions</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.divider} />

          {/* Reviews Section */}
          <View style={styles.reviewsHeader}>
            <View style={styles.reviewsTitleContainer}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              {vendorData?.reviewCount > 0 && (
                <View style={styles.reviewCountBadge}>
                  <Text style={styles.reviewCountBadgeText}>{vendorData.reviewCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.writeReviewButton}
              onPress={() => setShowReviewModal(true)}
            >
              <Ionicons name="create-outline" size={moderateScale(16)} color={Colors.white} />
              <Text style={styles.writeReviewText}>Write Review</Text>
            </TouchableOpacity>
          </View>

          {reviewsLoading ? (
            <View style={styles.loadingReviews}>
              <ActivityIndicator size="small" color={Colors.accentGreen} />
              <Text style={styles.loadingReviewsText}>Loading reviews...</Text>
            </View>
          ) : reviews.length === 0 ? (
            <View style={styles.emptyReviews}>
              <Ionicons name="chatbubble-outline" size={moderateScale(40)} color={Colors.textTertiary} />
              <Text style={styles.emptyReviewsText}>No reviews yet</Text>
              <Text style={styles.emptyReviewsSubtext}>Be the first to review this shop!</Text>
            </View>
          ) : (
            reviews.slice(0, 5).map((review) => (
              <ReviewItem key={review._id} review={review} />
            ))
          )}
          
          {reviews.length > 5 && (
            <TouchableOpacity style={styles.viewAllReviews}>
              <Text style={styles.viewAllReviewsText}>View all {reviews.length} reviews</Text>
              <Ionicons name="chevron-forward" size={moderateScale(16)} color={Colors.accentBlue} />
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          {/* Products Section */}
          <View style={styles.productsHeader}>
            <Text style={styles.sectionTitle}>Products</Text>
            <Text style={styles.productCount}>{products.length} items</Text>
          </View>
          
          {productsLoading ? (
            <View style={styles.loadingProducts}>
              <ActivityIndicator size="large" color={Colors.accentGreen} />
              <Text style={styles.loadingProductsText}>Loading products...</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Ionicons name="cube-outline" size={moderateScale(40)} color={Colors.textTertiary} />
              <Text style={styles.emptyProductsText}>No products available</Text>
              <Text style={styles.emptyProductsSubtext}>Check back later for updates</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <View style={styles.productCardWrapper}>
                  <NewProductCard
                    product={item}
                    isVendorOffline={!vendorData?.isOnline}
                  />
                </View>
              )}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Review Modal */}
      <ReviewModal
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        vendorId={vendorData._id}
        onSubmit={handleSubmitReview}
        loading={isSubmitting}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: verticalScale(12),
    fontSize: moderateScale(16),
  },
  imageContainer: {
    width: "100%",
    height: verticalScale(300),
    position: "relative",
  },
  shopImage: {
    width: "100%",
    height: "100%",
  },
  imageGradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "transparent",
    backgroundImage: "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.98) 100%)",
  },
  backButton: {
    position: "absolute",
    top: verticalScale(12),
    left: scale(16),
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: scale(10),
    borderRadius: moderateScale(24),
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoContainer: {
    padding: moderateScale(20),
    marginTop: verticalScale(-20),
    backgroundColor: Colors.background,
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: verticalScale(6),
  },
  titleLeft: {
    flex: 1,
  },
  shopName: {
    fontSize: moderateScale(28),
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginBottom: verticalScale(6),
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(20),
    alignSelf: "flex-start",
  },
  statusDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    marginRight: scale(6),
  },
  statusText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  badge: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  premiumBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  businessType: {
    fontSize: moderateScale(16),
    color: Colors.textSecondary,
    marginBottom: verticalScale(12),
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(16),
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accentGreen,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(20),
  },
  ratingNumber: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: moderateScale(14),
    marginRight: scale(4),
  },
  reviewCount: {
    fontSize: moderateScale(14),
    color: Colors.textSecondary,
    marginLeft: scale(10),
  },
  addressContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  addressLabel: {
    fontSize: moderateScale(12),
    color: Colors.textTertiary,
    marginBottom: verticalScale(2),
  },
  addressText: {
    fontSize: moderateScale(14),
    color: Colors.textPrimary,
  },
  iconContainer: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: "rgba(27, 140, 64, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginVertical: verticalScale(8),
    gap: scale(6),
  },
  tagPill: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: moderateScale(13),
    color: Colors.textSecondary,
  },
  moreTag: {
    fontSize: moderateScale(13),
    color: Colors.textTertiary,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
  },
  hoursContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    marginVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(8),
  },
  hoursTitle: {
    fontSize: moderateScale(15),
    fontWeight: "600",
    color: Colors.textPrimary,
    marginLeft: scale(12),
  },
  hoursList: {
    marginLeft: scale(48),
  },
  hourText: {
    fontSize: moderateScale(14),
    color: Colors.textSecondary,
    marginBottom: verticalScale(4),
  },
  showMoreText: {
    fontSize: moderateScale(14),
    color: Colors.accentBlue,
    marginTop: verticalScale(4),
  },
  deliveryContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    marginVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deliveryText: {
    fontSize: moderateScale(14),
    color: Colors.textSecondary,
    marginLeft: scale(12),
  },
  contactRow: {
    flexDirection: "row",
    gap: scale(10),
    marginVertical: verticalScale(12),
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(12),
    gap: scale(6),
  },
  callButton: {
    backgroundColor: Colors.accentGreen,
  },
  whatsappButton: {
    backgroundColor: "#25D366",
  },
  directionsButton: {
    backgroundColor: Colors.accentBlue,
  },
  contactButtonText: {
    color: Colors.white,
    fontWeight: "600",
    fontSize: moderateScale(14),
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: verticalScale(20),
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  reviewsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(16),
  },
  reviewsTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  reviewCountBadge: {
    backgroundColor: Colors.accentGreen,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(12),
  },
  reviewCountBadgeText: {
    color: Colors.white,
    fontSize: moderateScale(12),
    fontWeight: "600",
  },
  writeReviewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.accentGreen,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(20),
    gap: scale(4),
  },
  writeReviewText: {
    color: Colors.white,
    fontSize: moderateScale(13),
    fontWeight: "600",
  },
  loadingReviews: {
    alignItems: "center",
    paddingVertical: verticalScale(20),
    gap: verticalScale(8),
  },
  loadingReviewsText: {
    color: Colors.textTertiary,
    fontSize: moderateScale(14),
  },
  emptyReviews: {
    alignItems: "center",
    paddingVertical: verticalScale(30),
    gap: verticalScale(6),
  },
  emptyReviewsText: {
    color: Colors.textSecondary,
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  emptyReviewsSubtext: {
    color: Colors.textTertiary,
    fontSize: moderateScale(14),
  },
  viewAllReviews: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(12),
    gap: scale(4),
  },
  viewAllReviewsText: {
    color: Colors.accentBlue,
    fontSize: moderateScale(15),
    fontWeight: "600",
  },
  productsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(16),
  },
  productCount: {
    fontSize: moderateScale(14),
    color: Colors.textTertiary,
  },
  loadingProducts: {
    alignItems: "center",
    paddingVertical: verticalScale(30),
    gap: verticalScale(12),
  },
  loadingProductsText: {
    color: Colors.textTertiary,
    fontSize: moderateScale(14),
  },
  emptyProducts: {
    alignItems: "center",
    paddingVertical: verticalScale(30),
    gap: verticalScale(6),
  },
  emptyProductsText: {
    color: Colors.textSecondary,
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  emptyProductsSubtext: {
    color: Colors.textTertiary,
    fontSize: moderateScale(14),
  },
  productCardWrapper: {
    marginBottom: verticalScale(12),
  },
  bottomSpacer: {
    height: verticalScale(40),
  },
});

export default ShopDetails;