// src/screens/admin/AdManagementScreen.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { useNavigation, useIsFocused } from "@react-navigation/native";
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

// ---------- Dimensions & scaling ----------
const { width, height } = Dimensions.get("window");

const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

// ---------- Colors ----------
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
  gold: "#FFD700",
  onlineGreen: "#2E7D32",
  offlineRed: "#D32F2F",
  accentYellow: "#F59E0B",
  shadow: "#00000020",
  inputBackground: "#F5F5F5",
  modalOverlay: "rgba(0,0,0,0.5)",
};

// ---------- Category Selector Modal ----------
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

// ---------- Ad Form Modal ----------
const AdFormModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  ad?: Ad | null;
  onSubmit: (data: FormData) => void;
  loading: boolean;
}> = ({ visible, onClose, ad, onSubmit, loading }) => {
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
      setTitle("");
      setDescription("");
      setCategory("");
      setLink("");
      setIsActive(true);
      setIsProductAd(false);
      setExistingImageUrl(null);
      setImageUri(null);
    }
  }, [ad]);

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
                style={formStyles.input}
                placeholder="Enter ad title"
                placeholderTextColor={Colors.textLightGray}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
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
});

// ---------- AdCard (exported for reuse in detail screen) ----------
export const AdCard: React.FC<{
  ad: Ad;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}> = ({ ad, onEdit, onDelete, onToggle }) => {
  const getStatusText = () => (ad.isActive ? "Active" : "Inactive");
  const getStatusColor = () => (ad.isActive ? Colors.onlineGreen : Colors.offlineRed);

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
          {ad.category ? (
            <Text style={cardStyles.categoryText} numberOfLines={1}>
              {ad.category}
            </Text>
          ) : null}
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
    backgroundColor: Colors.card,
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: Colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    overflow: "hidden",
    backgroundColor: Colors.inputBackground,
  },
  adImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  infoContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: moderateScale(15),
    fontWeight: "600",
    color: Colors.textDark,
    marginBottom: verticalScale(2),
  },
  categoryText: {
    fontSize: moderateScale(12),
    color: Colors.textGray,
    marginBottom: verticalScale(2),
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    flexWrap: "wrap",
  },
  productBadge: {
    backgroundColor: Colors.accentGreenLight,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: Colors.accentGreen,
  },
  productBadgeText: {
    color: Colors.accentGreen,
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
  actions: {
    flexDirection: "row",
    gap: scale(2),
  },
  actionButton: {
    padding: scale(6),
    borderRadius: moderateScale(6),
  },
});

// ---------- GroupCard (updated with delete button) ----------
const GroupCard: React.FC<{
  title: string;
  image: string;
  count: number;
  onPress: () => void;
  onDelete: () => void; // NEW
}> = ({ title, image, count, onPress, onDelete }) => {
  return (
    <TouchableOpacity style={groupCardStyles.card} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: image }} style={groupCardStyles.image} />
      <View style={groupCardStyles.textContainer}>
        <Text style={groupCardStyles.title}>{title}</Text>
        <Text style={groupCardStyles.count}>{count} ad{count > 1 ? "s" : ""}</Text>
      </View>
      <TouchableOpacity
        style={groupCardStyles.deleteButton}
        onPress={(e) => {
          e.stopPropagation(); // Prevent navigating to detail
          onDelete();
        }}
      >
        <Ionicons name="trash-outline" size={24} color={Colors.offlineRed} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const groupCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: Colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  image: {
    width: scale(60),
    height: scale(60),
    borderRadius: moderateScale(8),
    marginRight: scale(12),
    backgroundColor: Colors.inputBackground,
    resizeMode: "cover",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: Colors.textDark,
  },
  count: {
    fontSize: moderateScale(13),
    color: Colors.textGray,
    marginTop: 2,
  },
  deleteButton: {
    padding: scale(8),
  },
});

// ---------- Main Screen ----------
const AdManagementScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { ads, loading } = useSelector((state: RootState) => state.ads);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null); // track which group is being deleted

  useEffect(() => {
    if (isFocused) {
      dispatch(fetchAds({ search: searchText || undefined }));
    }
  }, [isFocused, dispatch, searchText]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await dispatch(fetchAds({ search: searchText || undefined }));
    setIsRefreshing(false);
  }, [dispatch, searchText]);

  const handleGoBack = useCallback(() => {
    try {
      if (navigation && typeof navigation.canGoBack === "function" && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        console.warn("Cannot go back from this screen");
      }
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [navigation]);

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
              dispatch(fetchAds({ search: searchText || undefined }));
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Failed to delete ad");
            }
          },
        },
      ]
    );
  };

  const handleToggle = async (ad: Ad) => {
    try {
      await dispatch(toggleAdStatus({ id: ad._id, isActive: !ad.isActive })).unwrap();
      Alert.alert("Success", `Ad ${!ad.isActive ? "activated" : "deactivated"} successfully`);
      dispatch(fetchAds({ search: searchText || undefined }));
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to toggle ad status");
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
      dispatch(fetchAds({ search: searchText || undefined }));
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save ad");
    } finally {
      setIsSubmitting(false);
    }
  };

  // NEW: Delete entire group
  const handleDeleteGroup = (groupTitle: string) => {
    Alert.alert(
      "Delete Group",
      `Are you sure you want to delete ALL ads under "${groupTitle}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            setDeletingGroup(groupTitle);
            try {
              // Find all ads with this title
              const adsToDelete = ads.filter(
                (ad) => (ad.title || "Untitled").toLowerCase() === groupTitle.toLowerCase()
              );
              if (adsToDelete.length === 0) {
                Alert.alert("Info", "No ads found in this group.");
                setDeletingGroup(null);
                return;
              }

              // Delete each ad
              await Promise.all(
                adsToDelete.map((ad) => dispatch(deleteAd(ad._id)).unwrap())
              );

              Alert.alert("Success", `All ${adsToDelete.length} ads deleted.`);
              // Refresh list
              dispatch(fetchAds({ search: searchText || undefined }));
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Failed to delete group");
            } finally {
              setDeletingGroup(null);
            }
          },
        },
      ]
    );
  };

  const filteredAds = Array.isArray(ads) ? ads : [];

  // Build grouped data: unique titles with first image and count
  const groupedAds = useMemo(() => {
    const groups: { [key: string]: { title: string; image: string; count: number } } = {};
    filteredAds.forEach((ad) => {
      const key = (ad.title || "Untitled").trim().toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          title: ad.title || "Untitled",
          image: ad.image,
          count: 0,
        };
      }
      groups[key].count += 1;
    });
    return Object.values(groups);
  }, [filteredAds]);

  const handleGroupPress = (title: string) => {
    // @ts-ignore – add this route to your navigator types
    navigation.navigate("AdGroupDetail", { title });
  };

  if (!navigation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accentGreen} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={scale(24)} color={Colors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Ads</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleCreate}>
            <Ionicons name="add" size={scale(28)} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={scale(20)} color={Colors.textLightGray} />
          <TextInput
            style={styles.searchBarInput}
            placeholder="Search by title, description or category..."
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
            <Text style={styles.statNumber}>{filteredAds.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.onlineGreen }]}>
              {filteredAds.filter((a) => a.isActive).length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.offlineRed }]}>
              {filteredAds.filter((a) => !a.isActive).length}
            </Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
        </View>

        {loading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accentGreen} />
            <Text style={styles.loadingText}>Loading ads...</Text>
          </View>
        ) : groupedAds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="megaphone-outline" size={scale(60)} color={Colors.textLightGray} />
            <Text style={styles.emptyTitle}>{searchText ? "No ads found" : "No ads yet"}</Text>
            <Text style={styles.emptySubtitle}>
              {searchText
                ? "Try a different search term"
                : "Create your first ad to promote your content"}
            </Text>
            {!searchText && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
                <Text style={styles.emptyButtonText}>Create Ad</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={groupedAds}
            keyExtractor={(item, index) => `${item.title}-${index}`}
            renderItem={({ item }) => (
              <GroupCard
                title={item.title}
                image={item.image}
                count={item.count}
                onPress={() => handleGroupPress(item.title)}
                onDelete={() => handleDeleteGroup(item.title)}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={Colors.accentGreen}
              />
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
    backgroundColor: Colors.background,
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
    color: Colors.textDark,
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
    backgroundColor: Colors.inputBackground,
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(12),
    marginVertical: verticalScale(12),
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  searchBarInput: {
    flex: 1,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    color: Colors.textDark,
    fontSize: moderateScale(15),
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: Colors.card,
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(12),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: Colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: moderateScale(20),
    fontWeight: "bold",
    color: Colors.textDark,
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
    color: Colors.textDark,
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
    color: "#fff",
    fontWeight: "600",
    fontSize: moderateScale(14),
  },
  listContent: {
    paddingBottom: verticalScale(20),
  },
});

export default AdManagementScreen;