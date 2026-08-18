// src/screens/admin/CategoryManagementScreen.tsx
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
import { RootState, AppDispatch } from "../../src/app/store";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  Category,
} from "../../src/features/categorySlice";

const { width, height } = Dimensions.get("window");

// --- Responsive helpers ---
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
};

// --- Common Emoji Icons for Categories ---
const CATEGORY_ICONS = [
  "🛍️", "🛒", "👕", "👗", "👠", "👜", "💼", "⌚", "💍", 
  "📱", "💻", "🖥️", "📺", "🎧", "📷", "🎮", 
  "🍕", "🍔", "🍣", "🍜", "🍰", "🍩", "☕", "🍷",
  "📚", "✏️", "🎨", "🎵", "🎭", "🎪",
  "🏠", "🛋️", "🪑", "💡", "🔧", "🧹",
  "🏥", "💊", "🧴", "🧪",
  "⚽", "🏀", "🎾", "🏈", "⚾", "🎱",
  "🚗", "🚲", "✈️", "🚢", "🚂",
  "🌿", "🌸", "🌳", "🌻",
  "🎁", "🎀", "🎈", "🎉",
];

// --- Category Form Modal (with image picker) ---
const CategoryFormModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  category?: Category | null;
  onSubmit: (data: FormData) => void;
  loading: boolean;
}> = ({ visible, onClose, category, onSubmit, loading }) => {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [order, setOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setIcon(category.icon || "");
      setOrder(String(category.order || 0));
      setIsActive(category.isActive !== undefined ? category.isActive : true);
      setExistingImageUrl(category.image || null);
      setImageUri(null); // reset local image picker state
    } else {
      setName("");
      setIcon("");
      setOrder("0");
      setIsActive(true);
      setExistingImageUrl(null);
      setImageUri(null);
    }
  }, [category]);

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to upload category images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      // If user selects a new image, we clear the existing URL so the form will send the new image
      setExistingImageUrl(null);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Category name is required");
      return;
    }
    const formData = new FormData();
    formData.append('name', name.trim());
    if (icon) formData.append('icon', icon);
    formData.append('order', order || '0');
    formData.append('isActive', isActive ? 'true' : 'false');

    if (imageUri) {
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      // @ts-ignore – FormData expects Blob, but we send object with uri/name/type
      formData.append('image', { uri: imageUri, name: filename, type });
    }
    // If no imageUri and existingImageUrl is null, we do not send an image,
    // so the backend will keep the existing image if any (for updates).
    onSubmit(formData);
  };

  const renderIconPicker = () => (
    <Modal
      visible={showIconPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowIconPicker(false)}
    >
      <View style={formStyles.iconPickerOverlay}>
        <View style={formStyles.iconPickerContent}>
          <View style={formStyles.iconPickerHeader}>
            <Text style={formStyles.iconPickerTitle}>Choose an Icon</Text>
            <TouchableOpacity onPress={() => setShowIconPicker(false)}>
              <Ionicons name="close" size={24} color={Colors.textGray} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={CATEGORY_ICONS}
            keyExtractor={(item, index) => `${item}-${index}`}
            numColumns={6}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  formStyles.iconOption,
                  icon === item && formStyles.iconOptionSelected,
                ]}
                onPress={() => {
                  setIcon(item);
                  setShowIconPicker(false);
                }}
              >
                <Text style={formStyles.iconOptionText}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={formStyles.iconPickerGrid}
          />
          <TouchableOpacity
            style={formStyles.clearIconButton}
            onPress={() => {
              setIcon("");
              setShowIconPicker(false);
            }}
          >
            <Text style={formStyles.clearIconText}>Clear Icon</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={formStyles.overlay}
      >
        <View style={formStyles.modalContent}>
          <View style={formStyles.modalHeader}>
            <Text style={formStyles.modalTitle}>
              {category ? "Edit Category" : "Create Category"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textGray} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Category Name */}
            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Category Name *</Text>
              <TextInput
                style={formStyles.input}
                placeholder="Enter category name"
                placeholderTextColor={Colors.textLightGray}
                value={name}
                onChangeText={setName}
                maxLength={50}
              />
            </View>

            {/* Icon Picker */}
            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Icon</Text>
              <TouchableOpacity
                style={formStyles.iconPickerButton}
                onPress={() => setShowIconPicker(true)}
              >
                {icon ? (
                  <Text style={formStyles.selectedIcon}>{icon}</Text>
                ) : (
                  <Text style={formStyles.iconPlaceholder}>Tap to select icon</Text>
                )}
                <Ionicons name="chevron-down" size={20} color={Colors.textGray} />
              </TouchableOpacity>
            </View>

            {/* Image Picker */}
            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Category Image</Text>
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

            {/* Order */}
            <View style={formStyles.formGroup}>
              <Text style={formStyles.label}>Display Order</Text>
              <TextInput
                style={formStyles.input}
                placeholder="Enter display order (0 = first)"
                placeholderTextColor={Colors.textLightGray}
                value={order}
                onChangeText={setOrder}
                keyboardType="numeric"
              />
            </View>

            {/* Active Status */}
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
                  ? "Category will be visible to users"
                  : "Category will be hidden from users"}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={formStyles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.cardWhite} />
              ) : (
                <Text style={formStyles.submitButtonText}>
                  {category ? "Update Category" : "Create Category"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      {renderIconPicker()}
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
  iconPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A1A1A",
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: "#333",
  },
  selectedIcon: {
    fontSize: moderateScale(28),
  },
  iconPlaceholder: {
    color: Colors.textLightGray,
    fontSize: moderateScale(15),
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
  iconPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconPickerContent: {
    backgroundColor: Colors.backgroundDark,
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    width: "92%",
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "#333",
  },
  iconPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(12),
  },
  iconPickerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "bold",
    color: Colors.cardWhite,
  },
  iconPickerGrid: {
    paddingVertical: verticalScale(8),
  },
  iconOption: {
    width: scale(45),
    height: scale(45),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: moderateScale(8),
    margin: scale(4),
    backgroundColor: "#1A1A1A",
  },
  iconOptionSelected: {
    backgroundColor: Colors.accentGreen,
    borderWidth: 2,
    borderColor: Colors.cardWhite,
  },
  iconOptionText: {
    fontSize: moderateScale(24),
  },
  clearIconButton: {
    marginTop: verticalScale(12),
    paddingVertical: verticalScale(10),
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  clearIconText: {
    color: Colors.offlineRed,
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
});

// --- Category Card Component (updated to show image) ---
const CategoryCard: React.FC<{
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ category, onEdit, onDelete }) => {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardContent}>
        <View style={cardStyles.iconContainer}>
          {category.image ? (
            <Image source={{ uri: category.image }} style={cardStyles.categoryImage} />
          ) : category.icon ? (
            <Text style={cardStyles.iconText}>{category.icon}</Text>
          ) : (
            <Ionicons name="pricetag-outline" size={scale(24)} color={Colors.textGray} />
          )}
        </View>
        <View style={cardStyles.infoContainer}>
          <Text style={cardStyles.nameText} numberOfLines={1}>
            {category.name}
          </Text>
          <View style={cardStyles.metaRow}>
            <Text style={cardStyles.metaText}>Order: {category.order}</Text>
            <View style={cardStyles.statusBadge}>
              <View
                style={[
                  cardStyles.statusDot,
                  { backgroundColor: category.isActive ? Colors.onlineGreen : Colors.offlineRed },
                ]}
              />
              <Text
                style={[
                  cardStyles.statusText,
                  { color: category.isActive ? Colors.onlineGreen : Colors.offlineRed },
                ]}
              >
                {category.isActive ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
        </View>
        <View style={cardStyles.actions}>
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
  },
  iconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: moderateScale(8),
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
    overflow: 'hidden',
  },
  iconText: {
    fontSize: moderateScale(24),
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  infoContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: Colors.cardWhite,
    marginBottom: verticalScale(2),
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  metaText: {
    fontSize: moderateScale(12),
    color: Colors.textLightGray,
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
    fontSize: moderateScale(11),
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: scale(4),
  },
  actionButton: {
    padding: scale(6),
    borderRadius: moderateScale(6),
  },
});

// --- Main Component ---
const CategoryManagementScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const { categories, loading } = useSelector((state: RootState) => state.categories);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    dispatch(fetchCategories());
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await dispatch(fetchCategories());
    setIsRefreshing(false);
  }, [dispatch]);

  const handleCreate = () => {
    setEditingCategory(null);
    setShowModal(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowModal(true);
  };

  const handleDelete = (category: Category) => {
    Alert.alert(
      "Delete Category",
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await dispatch(deleteCategory(category._id)).unwrap();
              Alert.alert("Success", "Category deleted successfully");
              dispatch(fetchCategories());
            } catch (error: any) {
              Alert.alert("Error", error || "Failed to delete category");
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await dispatch(
          updateCategory({
            id: editingCategory._id,
            data: formData,
          })
        ).unwrap();
        Alert.alert("Success", "Category updated successfully");
      } else {
        await dispatch(createCategory(formData)).unwrap();
        Alert.alert("Success", "Category created successfully");
      }
      setShowModal(false);
      dispatch(fetchCategories());
    } catch (error: any) {
      Alert.alert("Error", error || "Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = searchText
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(searchText.toLowerCase())
      )
    : categories;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={scale(24)} color={Colors.cardWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Categories</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleCreate}>
            <Ionicons name="add" size={scale(28)} color={Colors.cardWhite} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={scale(20)} color={Colors.textLightGray} />
          <TextInput
            style={styles.searchBarInput}
            placeholder="Search categories..."
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

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{categories.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.onlineGreen }]}>
              {categories.filter((c) => c.isActive).length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: Colors.offlineRed }]}>
              {categories.filter((c) => !c.isActive).length}
            </Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
        </View>

        {/* Category List */}
        {loading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accentGreen} />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : filteredCategories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="pricetags-outline" size={scale(60)} color={Colors.textLightGray} />
            <Text style={styles.emptyTitle}>
              {searchText ? "No categories found" : "No categories yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchText
                ? "Try a different search term"
                : "Create your first category to get started"}
            </Text>
            {!searchText && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleCreate}>
                <Text style={styles.emptyButtonText}>Create Category</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <CategoryCard
                category={item}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDelete(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={Colors.cardWhite}
              />
            }
          />
        )}
      </View>

      {/* Category Form Modal */}
      <CategoryFormModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        category={editingCategory}
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

export default CategoryManagementScreen;