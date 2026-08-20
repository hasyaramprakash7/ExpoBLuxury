// src/screens/admin/AdManagementScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
  RefreshControl,
  Dimensions,
  Image,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootState, AppDispatch } from "../../src/app/store";
import {
  fetchAds,
  createAd,
  updateAd,
  deleteAd,
  toggleAdStatus,
  Ad,
} from "../../src/features/adSlice";

const { width, height } = Dimensions.get("window");

const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

const Colors = {
  backgroundDark: "#0A0A0A",
  cardWhite: "#FFFFFF",
  textDark: "#1C1C1E",
  textGray: "#6B7280",
  textLightGray: "#9CA3AF",
  accentGreen: "#1B8C40",
  accentBlue: "#2563EB",
  accentRed: "#FF4444",
  borderGray: "#E5E5EA",
  gold: "#FFD700",
  onlineGreen: "#34C759",
  offlineRed: "#FF4444",
  accentYellow: "#F59E0B",
};

// --- Ad Form Modal ---
const AdFormModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  ad?: Ad | null;
  onSubmit: (data: FormData) => void;
  loading: boolean;
}> = ({ visible, onClose, ad, onSubmit, loading }) => {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [isActive, setIsActive] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isProductAd, setIsProductAd] = useState(false);

  useEffect(() => {
    if (ad) {
      setTitle(ad.title || "");
      setLink(ad.link || "");
      setStartDate(new Date(ad.startDate));
      setEndDate(new Date(ad.endDate));
      setIsActive(ad.isActive !== undefined ? ad.isActive : true);
      setIsProductAd(ad.isProductAd || false);
      setExistingImageUrl(ad.image || null);
      setImageUri(null);
    } else {
      setTitle("");
      setLink("");
      setStartDate(new Date());
      setEndDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      setIsActive(true);
      setIsProductAd(false);
      setExistingImageUrl(null);
      setImageUri(null);
    }
  }, [ad]);

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to upload ad images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setExistingImageUrl(null);
    }
  };

  const handleSubmit = () => {
    if (!imageUri && !existingImageUrl) {
      Alert.alert("Error", "Ad image is required");
      return;
    }
    if (startDate > endDate) {
      Alert.alert("Error", "Start date must be before end date");
      return;
    }

    try {
      const formData = new FormData();
      if (title && title.trim()) formData.append('title', title.trim());
      if (link && link.trim()) formData.append('link', link.trim());
      formData.append('startDate', startDate.toISOString());
      formData.append('endDate', endDate.toISOString());
      formData.append('isActive', isActive ? 'true' : 'false');
      formData.append('isProductAd', isProductAd ? 'true' : 'false');

      if (imageUri) {
        const filename = imageUri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        // @ts-ignore
        formData.append('image', {
          uri: imageUri,
          name: filename,
          type: type,
        });
      }
      onSubmit(formData);
    } catch (error) {
      Alert.alert("Error", "Failed to prepare form data. Please try again.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={formStyles.overlay}>
        <View style={formStyles.modalContent}>
          <View style={formStyles.modalHeader}>
            <Text style={formStyles.modalTitle}>{ad ? "Edit Ad" : "Create Ad"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textGray} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Title (Optional)</Text>
              <TextInput
                style={formStyles.input}
                placeholder="Enter ad title"
                placeholderTextColor={Colors.textLightGray}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>

            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Ad Image *</Text>
              <TouchableOpacity style={formStyles.imagePickerButton} onPress={handleImagePick}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={formStyles.imagePreview} />
                ) : existingImageUrl ? (
                  <Image source={{ uri: existingImageUrl }} style={formStyles.imagePreview} />
                ) : (
                  <View style={formStyles.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={32} color={Colors.textLightGray} />
                    <Text style={formStyles.imagePlaceholderText}>Tap to select image</Text>
                  </View>
                )}
              </TouchableOpacity>
              {(imageUri || existingImageUrl) && (
                <TouchableOpacity
                  style={formStyles.removeImageButton}
                  onPress={() => {
                    setImageUri(null);
                    setExistingImageUrl(null);
                  }}
                >
                  <Text style={formStyles.removeImageText}>Remove Image</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Link (Optional)</Text>
              <TextInput
                style={formStyles.input}
                placeholder="Enter destination URL"
                placeholderTextColor={Colors.textLightGray}
                value={link}
                onChangeText={setLink}
                autoCapitalize="none"
              />
            </View>

            <View style={formStyles.formGroup}>
              <View style={formStyles.switchRow}>
                <Text style={formStyles.label}>Product Ad</Text>
                <Switch
                  value={isProductAd}
                  onValueChange={setIsProductAd}
                  trackColor={{ false: "#333", true: Colors.accentBlue }}
                  thumbColor={isProductAd ? Colors.cardWhite : Colors.textLightGray}
                />
              </View>
              <Text style={formStyles.helperText}>
                {isProductAd
                  ? "This ad will be styled as a product promotion"
                  : "This ad will be displayed as a generic banner"}
              </Text>
            </View>

            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Start Date *</Text>
              <TouchableOpacity
                style={formStyles.datePickerButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.textGray} />
                <Text style={formStyles.dateText}>
                  {startDate.toLocaleDateString()} {startDate.toLocaleTimeString()}
                </Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="datetime"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    setShowStartPicker(false);
                    if (selectedDate) setStartDate(selectedDate);
                  }}
                />
              )}
            </View>

            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>End Date *</Text>
              <TouchableOpacity
                style={formStyles.datePickerButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.textGray} />
                <Text style={formStyles.dateText}>
                  {endDate.toLocaleDateString()} {endDate.toLocaleTimeString()}
                </Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="datetime"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    setShowEndPicker(false);
                    if (selectedDate) setEndDate(selectedDate);
                  }}
                />
              )}
            </View>

            <View style={formStyles.formGroup}>
              <View style={formStyles.switchRow}>
                <Text style={formStyles.label}>Active</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: "#333", true: Colors.accentGreen }}
                  thumbColor={isActive ? Colors.cardWhite : Colors.textLightGray}
                />
              </View>
              <Text style={formStyles.helperText}>
                {isActive
                  ? "Ad will be visible to users (if within date range)"
                  : "Ad will be hidden from users"}
              </Text>
            </View>

            <TouchableOpacity
              style={formStyles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.cardWhite} />
              ) : (
                <Text style={formStyles.submitButtonText}>
                  {ad ? "Update Ad" : "Create Ad"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const formStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.backgroundDark,
    borderRadius: moderateScale(20),
    padding: moderateScale(20),
    width: "92%",
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "#333",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(16),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: "bold",
    color: Colors.cardWhite,
  },
  formGroup: {
    marginBottom: verticalScale(16),
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: Colors.textGray,
    marginBottom: verticalScale(6),
  },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    color: Colors.cardWhite,
    fontSize: moderateScale(15),
    borderWidth: 1,
    borderColor: "#333",
  },
  imagePickerButton: {
    backgroundColor: "#1A1A1A",
    borderRadius: moderateScale(10),
    padding: moderateScale(8),
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    minHeight: scale(120),
  },
  imagePreview: {
    width: '100%',
    height: scale(150),
    borderRadius: moderateScale(8),
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(20),
  },
  imagePlaceholderText: {
    color: Colors.textLightGray,
    marginTop: verticalScale(8),
    fontSize: moderateScale(14),
  },
  removeImageButton: {
    marginTop: verticalScale(8),
    alignItems: "center",
  },
  removeImageText: {
    color: Colors.offlineRed,
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: "#333",
    gap: scale(8),
  },
  dateText: {
    color: Colors.cardWhite,
    fontSize: moderateScale(15),
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  helperText: {
    fontSize: moderateScale(12),
    color: Colors.textLightGray,
    marginTop: verticalScale(4),
  },
  submitButton: {
    backgroundColor: Colors.accentGreen,
    padding: moderateScale(14),
    borderRadius: moderateScale(10),
    alignItems: "center",
    marginTop: verticalScale(8),
  },
  submitButtonText: {
    color: Colors.cardWhite,
    fontSize: moderateScale(16),
    fontWeight: "bold",
  },
});

// --- Ad Card Component ---
const AdCard: React.FC<{
  ad: Ad;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}> = ({ ad, onEdit, onDelete, onToggle }) => {
  const now = new Date();
  const start = new Date(ad.startDate);
  const end = new Date(ad.endDate);
  const isExpired = end < now;
  const isUpcoming = start > now;

  const getStatusText = () => {
    if (!ad.isActive) return "Inactive";
    if (isExpired) return "Expired";
    if (isUpcoming) return "Upcoming";
    return "Active";
  };

  const getStatusColor = () => {
    if (!ad.isActive) return Colors.offlineRed;
    if (isExpired) return Colors.textLightGray;
    if (isUpcoming) return Colors.accentYellow;
    return Colors.onlineGreen;
  };

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardContent}>
        <View style={cardStyles.imageContainer}>
          <Image source={{ uri: ad.image }} style={cardStyles.adImage} />
        </View>
        <View style={cardStyles.infoContainer}>
          <Text style={cardStyles.titleText} numberOfLines={1}>
            {ad.title || "Untitled Ad"}
          </Text>
          <View style={cardStyles.metaRow}>
            {ad.isProductAd && (
              <View style={cardStyles.productBadge}>
                <Text style={cardStyles.productBadgeText}>🛍️ Product</Text>
              </View>
            )}
            <View style={cardStyles.statusBadge}>
              <View style={[cardStyles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[cardStyles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>
          <View style={cardStyles.dateRow}>
            <Ionicons name="calendar-outline" size={scale(12)} color={Colors.textLightGray} />
            <Text style={cardStyles.dateText}>
              {new Date(ad.startDate).toLocaleDateString()} - {new Date(ad.endDate).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View style={cardStyles.actions}>
          <TouchableOpacity style={cardStyles.actionButton} onPress={onToggle}>
            <Ionicons
              name={ad.isActive ? "eye-outline" : "eye-off-outline"}
              size={scale(20)}
              color={ad.isActive ? Colors.onlineGreen : Colors.textGray}
            />
          </TouchableOpacity>
          <TouchableOpacity style={cardStyles.actionButton} onPress={onEdit}>
            <Ionicons name="create-outline" size={scale(20)} color={Colors.accentBlue} />
          </TouchableOpacity>
          <TouchableOpacity style={cardStyles.actionButton} onPress={onDelete}>
            <Ionicons name="trash-outline" size={scale(20)} color={Colors.offlineRed} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: moderateScale(12),
    gap: scale(10),
  },
  imageContainer: {
    width: scale(60),
    height: scale(60),
    borderRadius: moderateScale(8),
    overflow: 'hidden',
    backgroundColor: "#2A2A2A",
  },
  adImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  infoContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: moderateScale(15),
    fontWeight: "600",
    color: Colors.cardWhite,
    marginBottom: verticalScale(2),
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    flexWrap: "wrap",
    marginBottom: verticalScale(2),
  },
  productBadge: {
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.3)",
  },
  productBadgeText: {
    color: Colors.accentBlue,
    fontSize: moderateScale(9),
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    marginRight: scale(4),
  },
  statusText: {
    fontSize: moderateScale(10),
    fontWeight: "600",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  dateText: {
    fontSize: moderateScale(10),
    color: Colors.textLightGray,
  },
  actions: {
    flexDirection: "row",
    gap: scale(2),
  },
  actionButton: {
    padding: scale(6),
    borderRadius: moderateScale(6),
  },
});

// --- Main Component ---
const AdManagementScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const { ads, loading } = useSelector((state: RootState) => state.ads);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    dispatch(fetchAds());
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await dispatch(fetchAds());
    setIsRefreshing(false);
  }, [dispatch]);

  const handleCreate = () => {
    setEditingAd(null);
    setShowModal(true);
  };

  const handleEdit = (ad: Ad) => {
    setEditingAd(ad);
    setShowModal(true);
  };

  const handleDelete = (ad: Ad) => {
    Alert.alert(
      "Delete Ad",
      `Are you sure you want to delete this ad?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(deleteAd(ad._id)).unwrap();
              Alert.alert("Success", "Ad deleted successfully");
              dispatch(fetchAds());
            } catch (error: any) {
              Alert.alert("Error", error || "Failed to delete ad");
            }
          },
        },
      ]
    );
  };

  const handleToggle = async (ad: Ad) => {
    try {
      await dispatch(toggleAdStatus({ id: ad._id, isActive: !ad.isActive })).unwrap();
      Alert.alert("Success", `Ad ${!ad.isActive ? 'activated' : 'deactivated'} successfully`);
      dispatch(fetchAds());
    } catch (error: any) {
      Alert.alert("Error", error || "Failed to toggle ad status");
    }
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      if (editingAd) {
        await dispatch(updateAd({ id: editingAd._id, data: formData })).unwrap();
        Alert.alert("Success", "Ad updated successfully");
      } else {
        await dispatch(createAd(formData)).unwrap();
        Alert.alert("Success", "Ad created successfully");
      }
      setShowModal(false);
      dispatch(fetchAds());
    } catch (error: any) {
      Alert.alert("Error", error || "Failed to save ad");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAds = Array.isArray(ads) ? ads.filter((ad) =>
    (ad.title || '').toLowerCase().includes(searchText.toLowerCase())
  ) : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={scale(24)} color={Colors.cardWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Ads</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleCreate}>
            <Ionicons name="add" size={scale(28)} color={Colors.cardWhite} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={scale(20)} color={Colors.textLightGray} />
          <TextInput
            style={styles.searchBarInput}
            placeholder="Search ads..."
            placeholderTextColor={Colors.textLightGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={scale(20)} color={Colors.textLightGray} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{Array.isArray(ads) ? ads.length : 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.onlineGreen }]}>
              {Array.isArray(ads) ? ads.filter((a) => a.isActive).length : 0}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.accentYellow }]}>
              {Array.isArray(ads) ? ads.filter((a) => {
                const now = new Date();
                const start = new Date(a.startDate);
                const end = new Date(a.endDate);
                return a.isActive && start <= now && end >= now;
              }).length : 0}
            </Text>
            <Text style={styles.statLabel}>Running</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.offlineRed }]}>
              {Array.isArray(ads) ? ads.filter((a) => !a.isActive).length : 0}
            </Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
        </View>

        {loading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accentGreen} />
            <Text style={styles.loadingText}>Loading ads...</Text>
          </View>
        ) : filteredAds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="megaphone-outline" size={scale(60)} color={Colors.textLightGray} />
            <Text style={styles.emptyTitle}>{searchText ? "No ads found" : "No ads yet"}</Text>
            <Text style={styles.emptySubtitle}>
              {searchText ? "Try a different search term" : "Create your first ad to promote your content"}
            </Text>
            {!searchText && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
                <Text style={styles.emptyButtonText}>Create Ad</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredAds}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <AdCard
                ad={item}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDelete(item)}
                onToggle={() => handleToggle(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.cardWhite} />
            }
          />
        )}
      </View>

      <AdFormModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        ad={editingAd}
        onSubmit={handleSubmit}
        loading={isSubmitting}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  container: {
    flex: 1,
    padding: moderateScale(16),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: verticalScale(8),
  },
  backButton: {
    padding: scale(4),
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: "bold",
    color: Colors.cardWhite,
  },
  addButton: {
    backgroundColor: Colors.accentGreen,
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    justifyContent: "center",
    alignItems: "center",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F222A",
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(12),
    marginVertical: verticalScale(12),
    borderWidth: 1,
    borderColor: "#333",
  },
  searchBarInput: {
    flex: 1,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    color: Colors.cardWhite,
    fontSize: moderateScale(15),
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#1A1A1A",
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(12),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: moderateScale(20),
    fontWeight: "bold",
    color: Colors.cardWhite,
  },
  statLabel: {
    fontSize: moderateScale(12),
    color: Colors.textLightGray,
    marginTop: verticalScale(2),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: Colors.textLightGray,
    marginTop: verticalScale(8),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(20),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: Colors.cardWhite,
    marginTop: verticalScale(12),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: Colors.textLightGray,
    marginTop: verticalScale(4),
    textAlign: "center",
  },
  emptyButton: {
    marginTop: verticalScale(20),
    backgroundColor: Colors.accentGreen,
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(8),
  },
  emptyButtonText: {
    color: Colors.cardWhite,
    fontWeight: "600",
    fontSize: moderateScale(14),
  },
  listContent: {
    paddingBottom: verticalScale(20),
  },
});

export default AdManagementScreen;