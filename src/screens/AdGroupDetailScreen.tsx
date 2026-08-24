// src/screens/admin/AdGroupDetailScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  RefreshControl,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Switch,
  Image,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { RootState, AppDispatch } from "../../src/app/store";
import {
  fetchAds,
  createAd,
  updateAd,
  deleteAd,
  toggleAdStatus,
  Ad,
} from "../../src/features/adSlice";
import { CATEGORIES } from "../constants/categories";
import { AdCard } from "./AdManagementScreen"; // exported from main screen

const { width, height } = Dimensions.get("window");

const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const Colors = {
  background: "#FFFFFF",
  card: "#FFFFFF",
  textDark: "#1C1C1E",
  textGray: "#6B7280",
  textLightGray: "#9CA3AF",
  accentGreen: "#0A5E2A",
  accentGreenLight: "#E8F5E9",
  accentBlue: "#2563EB",
  accentRed: "#D32F2F",
  borderGray: "#E5E5EA",
  onlineGreen: "#2E7D32",
  offlineRed: "#D32F2F",
  inputBackground: "#F5F5F5",
  modalOverlay: "rgba(0,0,0,0.5)",
};

// ---------- Category Selector (copy from main screen) ----------
const CategorySelector: React.FC<{
  visible: boolean;
  onClose: () => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}> = ({ visible, onClose, selectedCategory, onSelectCategory }) => {
  const [searchText, setSearchText] = useState("");

  const filteredCategories = CATEGORIES.filter((cat) =>
    cat.toLowerCase().includes(searchText.toLowerCase())
  );
  const exactMatch = CATEGORIES.some(
    (cat) => cat.toLowerCase() === searchText.toLowerCase().trim()
  );
  const showAddOption = searchText.trim().length > 0 && !exactMatch;

  const data = [];
  if (showAddOption) {
    data.push({ type: "add", label: `Add "${searchText.trim()}"` });
  }
  data.push(...filteredCategories.map((cat) => ({ type: "category", label: cat })));

  const handleSelect = (item: { type: string; label: string }) => {
    if (item.type === "add") {
      const newCategory = searchText.trim();
      if (newCategory) {
        onSelectCategory(newCategory);
        onClose();
        setSearchText("");
      }
    } else {
      onSelectCategory(item.label);
      onClose();
      setSearchText("");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={categorySelectorStyles.overlay}>
        <View style={categorySelectorStyles.modalContent}>
          <View style={categorySelectorStyles.header}>
            <Text style={categorySelectorStyles.title}>Select Category</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textGray} />
            </TouchableOpacity>
          </View>
          <View style={categorySelectorStyles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textLightGray} />
            <TextInput
              style={categorySelectorStyles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={20} color={Colors.textLightGray} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={data}
            keyExtractor={(item, index) => `${item.type}-${index}`}
            renderItem={({ item }) => {
              const isActive = item.type === "category" && selectedCategory === item.label;
              const isAdd = item.type === "add";
              return (
                <TouchableOpacity
                  style={[
                    categorySelectorStyles.categoryItem,
                    isActive && categorySelectorStyles.categoryItemActive,
                    isAdd && categorySelectorStyles.addItem,
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Text
                    style={[
                      categorySelectorStyles.categoryText,
                      isActive && categorySelectorStyles.categoryTextActive,
                      isAdd && categorySelectorStyles.addItemText,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.accentGreen} />
                  )}
                  {isAdd && (
                    <Ionicons name="add-circle" size={20} color={Colors.accentGreen} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              !showAddOption && searchText.trim().length > 0 ? (
                <View style={categorySelectorStyles.emptyState}>
                  <Text style={categorySelectorStyles.emptyStateText}>
                    No categories found
                  </Text>
                </View>
              ) : null
            }
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </View>
    </Modal>
  );
};

const categorySelectorStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.modalOverlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: moderateScale(20),
    padding: moderateScale(20),
    width: "90%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: Colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(12),
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: Colors.textDark,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBackground,
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  searchInput: {
    flex: 1,
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(8),
    color: Colors.textDark,
    fontSize: moderateScale(15),
  },
  categoryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(8),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  categoryItemActive: {
    backgroundColor: Colors.accentGreenLight,
  },
  categoryText: {
    fontSize: moderateScale(16),
    color: Colors.textDark,
  },
  categoryTextActive: {
    color: Colors.accentGreen,
    fontWeight: "600",
  },
  addItem: {
    backgroundColor: Colors.accentGreenLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accentGreen,
  },
  addItemText: {
    color: Colors.accentGreen,
    fontWeight: "600",
  },
  emptyState: {
    padding: verticalScale(20),
    alignItems: "center",
  },
  emptyStateText: {
    color: Colors.textLightGray,
    fontSize: moderateScale(14),
  },
});

// ---------- Ad Form Modal (with support for default title and read-only title) ----------
const AdFormModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  ad?: Ad | null;
  onSubmit: (data: FormData) => void;
  loading: boolean;
  defaultTitle?: string; // pre-filled title for new ads
  titleEditable?: boolean; // if false, title is read-only
}> = ({ visible, onClose, ad, onSubmit, loading, defaultTitle, titleEditable = true }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [link, setLink] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [isProductAd, setIsProductAd] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  useEffect(() => {
    if (ad) {
      setTitle(ad.title || "");
      setDescription(ad.description || "");
      setCategory(ad.category || "");
      setLink(ad.link || "");
      setIsActive(ad.isActive !== undefined ? ad.isActive : true);
      setIsProductAd(ad.isProductAd || false);
      setExistingImageUrl(ad.image || null);
      setImageUri(null);
    } else {
      setTitle(defaultTitle || "");
      setDescription("");
      setCategory("");
      setLink("");
      setIsActive(true);
      setIsProductAd(false);
      setExistingImageUrl(null);
      setImageUri(null);
    }
  }, [ad, defaultTitle]);

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow access to your photo library to upload ad images."
      );
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

    try {
      const formData = new FormData();
      if (title && title.trim()) formData.append("title", title.trim());
      if (description && description.trim())
        formData.append("description", description.trim());
      if (category && category.trim()) formData.append("category", category.trim());
      if (link && link.trim()) formData.append("link", link.trim());
      formData.append("isActive", isActive ? "true" : "false");
      formData.append("isProductAd", isProductAd ? "true" : "false");

      if (imageUri) {
        const filename = imageUri.split("/").pop() || "image.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";
        // @ts-ignore
        formData.append("image", {
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={formStyles.overlay}
      >
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
                style={[formStyles.input, !titleEditable && formStyles.inputDisabled]}
                placeholder="Enter ad title"
                placeholderTextColor={Colors.textLightGray}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                editable={titleEditable}
                selectTextOnFocus={titleEditable}
              />
              {!titleEditable && (
                <Text style={formStyles.lockedHint}>Title is locked for this group</Text>
              )}
            </View>

            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Description (Optional)</Text>
              <TextInput
                style={[formStyles.input, formStyles.textArea]}
                placeholder="Enter ad description"
                placeholderTextColor={Colors.textLightGray}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>

            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Category (Optional)</Text>
              <TouchableOpacity
                style={formStyles.categoryPicker}
                onPress={() => setShowCategorySelector(true)}
              >
                <Text
                  style={
                    category ? formStyles.categoryText : formStyles.categoryPlaceholder
                  }
                >
                  {category || "Select a category"}
                </Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textGray} />
              </TouchableOpacity>
              {category ? (
                <TouchableOpacity
                  style={formStyles.clearCategoryButton}
                  onPress={() => setCategory("")}
                >
                  <Text style={formStyles.clearCategoryText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
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
                  trackColor={{ false: "#ccc", true: Colors.accentGreen }}
                  thumbColor={isProductAd ? Colors.accentGreen : Colors.textLightGray}
                />
              </View>
              <Text style={formStyles.helperText}>
                {isProductAd
                  ? "This ad will be styled as a product promotion"
                  : "This ad will be displayed as a generic banner"}
              </Text>
            </View>

            <View style={formStyles.formGroup}>
              <View style={formStyles.switchRow}>
                <Text style={formStyles.label}>Active</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: "#ccc", true: Colors.accentGreen }}
                  thumbColor={isActive ? Colors.accentGreen : Colors.textLightGray}
                />
              </View>
              <Text style={formStyles.helperText}>
                {isActive ? "Ad will be visible to users" : "Ad will be hidden from users"}
              </Text>
            </View>

            <TouchableOpacity
              style={formStyles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={formStyles.submitButtonText}>
                  {ad ? "Update Ad" : "Create Ad"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CategorySelector
        visible={showCategorySelector}
        onClose={() => setShowCategorySelector(false)}
        selectedCategory={category}
        onSelectCategory={(cat) => setCategory(cat)}
      />
    </Modal>
  );
};

const formStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.modalOverlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: moderateScale(20),
    padding: moderateScale(20),
    width: "92%",
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: Colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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
    color: Colors.textDark,
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
    backgroundColor: Colors.inputBackground,
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    color: Colors.textDark,
    fontSize: moderateScale(15),
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  inputDisabled: {
    backgroundColor: "#E5E5EA",
    color: Colors.textGray,
  },
  textArea: {
    minHeight: verticalScale(80),
    textAlignVertical: "top",
  },
  categoryPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.inputBackground,
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  categoryText: {
    fontSize: moderateScale(15),
    color: Colors.textDark,
  },
  categoryPlaceholder: {
    fontSize: moderateScale(15),
    color: Colors.textLightGray,
  },
  clearCategoryButton: {
    alignSelf: "flex-start",
    marginTop: verticalScale(4),
  },
  clearCategoryText: {
    color: Colors.offlineRed,
    fontSize: moderateScale(12),
  },
  imagePickerButton: {
    backgroundColor: Colors.inputBackground,
    borderRadius: moderateScale(10),
    padding: moderateScale(8),
    borderWidth: 1,
    borderColor: Colors.borderGray,
    alignItems: "center",
    justifyContent: "center",
    minHeight: scale(120),
  },
  imagePreview: {
    width: "100%",
    height: scale(150),
    borderRadius: moderateScale(8),
    resizeMode: "cover",
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
    color: "#fff",
    fontSize: moderateScale(16),
    fontWeight: "bold",
  },
  lockedHint: {
    fontSize: moderateScale(11),
    color: Colors.textLightGray,
    marginTop: verticalScale(4),
    fontStyle: "italic",
  },
});

// ---------- Main Component ----------
const AdGroupDetailScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const route = useRoute();
  const { title } = route.params as { title: string };

  const { ads, loading } = useSelector((state: RootState) => state.ads);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAdsForGroup = useCallback(() => {
    dispatch(fetchAds({ search: title }));
  }, [dispatch, title]);

  useEffect(() => {
    fetchAdsForGroup();
  }, [fetchAdsForGroup]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAdsForGroup();
    setIsRefreshing(false);
  }, [fetchAdsForGroup]);

  const handleGoBack = () => navigation.goBack();

  const handleAdd = () => {
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
              Alert.alert("Success", "Ad deleted");
              fetchAdsForGroup();
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Failed to delete");
            }
          },
        },
      ]
    );
  };

  const handleToggle = async (ad: Ad) => {
    try {
      await dispatch(toggleAdStatus({ id: ad._id, isActive: !ad.isActive })).unwrap();
      Alert.alert("Success", `Ad ${!ad.isActive ? "activated" : "deactivated"}`);
      fetchAdsForGroup();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to toggle");
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
      fetchAdsForGroup();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save ad");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAds = ads.filter(
    (ad) => (ad.title || "Untitled").toLowerCase() === title.toLowerCase()
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && !isRefreshing ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.accentGreen} />
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accentGreen}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No ads found for "{title}"</Text>
              <Text style={styles.emptySubtext}>Tap the "+" button to add one</Text>
            </View>
          }
          contentContainerStyle={styles.list}
        />
      )}

      <AdFormModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        ad={editingAd}
        onSubmit={handleSubmit}
        loading={isSubmitting}
        defaultTitle={title}           // pre‑fill title
        titleEditable={!editingAd}     // only editable when creating new ad (not editing)
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: Colors.textDark,
    flex: 1,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: Colors.accentGreen,
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    justifyContent: "center",
    alignItems: "center",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: moderateScale(16),
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    fontSize: moderateScale(16),
    color: Colors.textLightGray,
  },
  emptySubtext: {
    fontSize: moderateScale(14),
    color: Colors.textLightGray,
    marginTop: 8,
  },
});

export default AdGroupDetailScreen;