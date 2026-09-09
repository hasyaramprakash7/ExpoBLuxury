// src/screens/ShopReviewsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import { fetchVendorReviews, clearReviews } from '../features/reviewSlice';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

const Colors = {
  background: "#FFFFFF",
  backgroundSecondary: "#F8F9FA",
  card: "#FFFFFF",
  white: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textTertiary: "#8A8A8A",
  accentGreen: "#1B8C40",
  accentBlue: "#2563EB",
  gold: "#F59E0B",
  starYellow: "#F59E0B",
  starGray: "#D1D5DB",
  border: "#E8E8E8",
  borderLight: "#F0F0F0",
  shadow: "rgba(0,0,0,0.08)",
};

// --- ReviewItem component (fully defensive) ---
const ReviewItem: React.FC<{ review: any }> = ({ review }) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  const rating = typeof review.rating === 'number' ? review.rating : 0;
  const userName = review.user?.name ? String(review.user.name) : 'User';
  const userInitial = userName.charAt(0).toUpperCase() || 'U';
  const comment = review.comment ? String(review.comment) : '';
  const createdAt = review.createdAt ? String(review.createdAt) : '';

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
              <Text style={reviewStyles.userAvatarText}>{userInitial}</Text>
            </View>
          )}
          <View>
            <Text style={reviewStyles.userName}>{userName}</Text>
            <View style={reviewStyles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= rating ? "star" : "star-outline"}
                  size={moderateScale(14)}
                  color={star <= rating ? Colors.starYellow : Colors.starGray}
                />
              ))}
            </View>
          </View>
        </View>
        <Text style={reviewStyles.reviewDate}>{formatDate(createdAt)}</Text>
      </View>

      {comment ? (
        <Text style={reviewStyles.reviewComment}>{comment}</Text>
      ) : null}

      {Array.isArray(review.images) && review.images.length > 0 && (
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

const ShopReviewsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { vendorId, vendorName, averageRating, reviewCount } = route.params || {};

  const dispatch = useDispatch<AppDispatch>();
  const { reviews, loading } = useSelector((state: RootState) => state.reviews);

  const [refreshing, setRefreshing] = useState(false);

  // Load reviews when screen mounts – do NOT clear on unmount
  useEffect(() => {
    if (vendorId) {
      dispatch(clearReviews());
      dispatch(fetchVendorReviews({ vendorId, page: 1, limit: 100 }));
    }
  }, [vendorId, dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (vendorId) {
      await dispatch(fetchVendorReviews({ vendorId, page: 1, limit: 100 }));
    }
    setRefreshing(false);
  }, [dispatch, vendorId]);

  if (!vendorId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No vendor information available.</Text>
      </View>
    );
  }

  const safeAvgRating = typeof averageRating === 'number' ? averageRating : 0;
  const safeReviewCount = typeof reviewCount === 'number' ? reviewCount : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Header with extra top padding for status bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={scale(28)} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{vendorName || 'Reviews'}</Text>
          {safeAvgRating > 0 && safeReviewCount > 0 && (
            <View style={styles.ratingChip}>
              <Ionicons name="star" size={moderateScale(14)} color={Colors.gold} />
              <Text style={styles.ratingText}>
                {safeAvgRating.toFixed(1)} ({safeReviewCount})
              </Text>
            </View>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentGreen} />
        }
      >
        {loading && reviews.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accentGreen} />
            <Text style={styles.loadingText}>Loading reviews...</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={moderateScale(60)} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to review this shop!</Text>
          </View>
        ) : (
          reviews.map((review) => <ReviewItem key={review._id} review={review} />)
        )}
        {/* Extra bottom spacer for safe area / home indicator */}
        <View style={{ height: verticalScale(60) }} />
      </ScrollView>
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
  scrollContent: {
    padding: moderateScale(16),
    // Add extra padding at the bottom for consistency
    paddingBottom: verticalScale(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    // Extra top padding to avoid status bar overlap (especially on Android)
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || verticalScale(20) : verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: scale(4),
    width: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
    marginTop: verticalScale(4),
  },
  ratingText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: scale(4),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  errorText: {
    color: '#E53E3E',
    fontSize: moderateScale(16),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(40),
  },
  loadingText: {
    marginTop: verticalScale(12),
    color: Colors.textSecondary,
    fontSize: moderateScale(14),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(60),
  },
  emptyTitle: {
    fontSize: moderateScale(20),
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: verticalScale(12),
  },
  emptySubtitle: {
    fontSize: moderateScale(15),
    color: Colors.textSecondary,
    marginTop: verticalScale(4),
  },
});

export default ShopReviewsScreen;