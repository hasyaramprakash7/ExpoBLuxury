import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Switch,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import DraggableFlatList, {
  RenderItemParams,
  NestableScrollContainer,
} from "react-native-draggable-flatlist";

// Import your Redux actions and types
import {
  fetchVendorInsuranceProducts,
  createInsuranceProduct,
  updateInsuranceProduct,
  deleteInsuranceProduct,
  clearError,
} from "../features/insuranceSlice";
import { RootState } from "../app/store"; // Assuming your store.ts is in this path

// Define the shape of your product data based on the slice
interface InsuranceProduct {
  _id: string;
  name: string;
  description: string;
  badgeText?: string;
  options?: {
    isNew: boolean;
    isAwardWinning: boolean;
    isPopular: boolean;
  };
  contactNumber: string;
  executiveContact?: {
    phoneNumber: string;
    pointOfContact: string;
  };
  categories?: {
    level1: { name: string };
    level2: { name: string };
    level3: { name: string };
  };
  mainImage: string;
  otherImages?: string[];
}

interface ImageAsset {
  uri: string;
  file?: any; // Native file object for multipart upload
  isNew: boolean;
}

// Initial state for the form
const initialFormState = {
  name: "",
  description: "",
  badgeText: "N/A",
  options: {
    isNew: false,
    isAwardWinning: false,
    isPopular: false,
  },
  contactNumber: "",
  executiveContact: {
    phoneNumber: "",
    pointOfContact: "Executive",
  },
  categories: {
    level1: { name: "" },
    level2: { name: "" },
    level3: { name: "" },
  },
};

const InsuranceProductCRUDScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const {
    vendorProducts: products,
    loading,
    error,
  } = useSelector((state: RootState) => state.insurance);
  const { vendor } = useSelector((state: RootState) => state.vendorAuth);

  const [form, setForm] = useState(initialFormState);
  const [productImages, setProductImages] = useState<ImageAsset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (vendor) {
      dispatch(fetchVendorInsuranceProducts() as any);
    }
  }, [dispatch, vendor]);

  useEffect(() => {
    if (error) {
      Alert.alert("Error", error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleTextChange = (name: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleOptionChange = (name: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        [name]: checked,
      },
    }));
  };

  const handleExecutiveContactChange = (name: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      executiveContact: {
        ...prev.executiveContact,
        [name]: value,
      },
    }));
  };

  const handleCategoryChange = (level: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [level]: {
          ...prev.categories[level],
          name: value,
        },
      },
    }));
  };

  const resetForm = () => {
    setForm(initialFormState);
    setProductImages([]);
    setEditingId(null);
  };

  const handlePickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Permission to access media library is required to upload images."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newAssets: ImageAsset[] = result.assets.map((asset) => ({
        uri: asset.uri,
        file: asset,
        isNew: true,
      }));
      setProductImages((prev) => [...prev, ...newAssets]);
    }
  };

  const handleRemoveImage = (uriToRemove: string) => {
    setProductImages((prevImages) =>
      prevImages.filter((img) => img.uri !== uriToRemove)
    );
  };

  const handleSubmit = async () => {
    if (
      !form.name ||
      !form.description ||
      !form.contactNumber ||
      !form.executiveContact.phoneNumber ||
      !form.categories.level1.name ||
      !form.categories.level2.name ||
      !form.categories.level3.name ||
      productImages.length === 0
    ) {
      Alert.alert(
        "Validation Error",
        "Please fill all required fields and add at least one image."
      );
      return;
    }

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("description", form.description);
    formData.append("badgeText", form.badgeText);
    formData.append("contactNumber", form.contactNumber);

    formData.append("options", JSON.stringify(form.options));
    formData.append("executiveContact", JSON.stringify(form.executiveContact));
    formData.append("categories", JSON.stringify(form.categories));

    const newImageFiles = productImages
      .filter((img) => img.isNew)
      .map((img) => img.file);

    if (editingId) {
      if (newImageFiles.length > 0) {
        newImageFiles.forEach((file) => {
          formData.append("images", {
            uri: file.uri,
            name: file.uri.split("/").pop(),
            type: file.type || "image/jpeg",
          } as any);
        });
      } else {
        // Send only the list of existing Cloudinary URLs
        const existingImageUrls = productImages.map((img) => img.uri);
        formData.append("mainImage", existingImageUrls[0]);
        formData.append(
          "otherImages",
          JSON.stringify(existingImageUrls.slice(1))
        );
      }

      try {
        await dispatch(
          updateInsuranceProduct({ id: editingId, formData }) as any
        ).unwrap();
        Alert.alert("Success", "Insurance product updated!");
        resetForm();
      } catch (err: any) {
        Alert.alert(
          "Operation Failed",
          err?.message || "An unknown error occurred."
        );
      }
    } else {
      if (newImageFiles.length === 0) {
        Alert.alert(
          "Validation Error",
          "A new product requires at least one image."
        );
        return;
      }
      newImageFiles.forEach((file) => {
        formData.append("images", {
          uri: file.uri,
          name: file.uri.split("/").pop(),
          type: file.type || "image/jpeg",
        } as any);
      });

      try {
        await dispatch(createInsuranceProduct(formData) as any).unwrap();
        Alert.alert("Success", "Insurance product created!");
        resetForm();
      } catch (err: any) {
        Alert.alert(
          "Operation Failed",
          err?.message || "An unknown error occurred."
        );
      }
    }
  };

  const handleEdit = (product: InsuranceProduct) => {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      badgeText: product.badgeText || "N/A",
      options: product.options || initialFormState.options,
      contactNumber: product.contactNumber || "",
      executiveContact:
        product.executiveContact || initialFormState.executiveContact,
      categories: product.categories || initialFormState.categories,
    });

    const existingImages: ImageAsset[] = (
      product.mainImage ? [{ uri: product.mainImage, isNew: false }] : []
    ).concat((product.otherImages || []).map((uri) => ({ uri, isNew: false })));
    setProductImages(existingImages);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this insurance product? This will also delete all associated appointments.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: () => dispatch(deleteInsuranceProduct(id) as any),
        },
      ],
      { cancelable: true }
    );
  };

  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(query) ||
      p.badgeText?.toLowerCase().includes(query) ||
      p.categories?.level1?.name?.toLowerCase().includes(query) ||
      p.categories?.level2?.name?.toLowerCase().includes(query) ||
      p.categories?.level3?.name?.toLowerCase().includes(query)
    );
  });

  const renderProductItem = ({ item }: { item: InsuranceProduct }) => (
    <View style={styles.productItem}>
      <Image
        source={{
          uri: item.mainImage
            ? item.mainImage
            : "https://placehold.co/100x100/eee/ccc?text=No+Img",
        }}
        style={styles.productImage}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.productBadge}>{item.badgeText}</Text>
        <Text style={styles.productContact}>Contact: {item.contactNumber}</Text>
        <Text style={styles.productCategories} numberOfLines={1}>
          {item.categories?.level1?.name &&
          item.categories?.level2?.name &&
          item.categories?.level3?.name
            ? `${item.categories.level1.name} > ${item.categories.level2.name} > ${item.categories.level3.name}`
            : `Categories: ${item.categories?.level1?.name || ""} ${
                item.categories?.level2?.name || ""
              } ${item.categories?.level3?.name || ""}`}
        </Text>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEdit(item)}
        >
          <FontAwesome name="pencil" size={20} color="#B79400" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item._id)}
        >
          <FontAwesome name="trash" size={20} color="#D32F2F" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderImageItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<ImageAsset>) => {
    return (
      <TouchableOpacity
        style={[
          styles.imageThumbContainer,
          isActive && { backgroundColor: "rgba(0,0,0,0.2)" },
        ]}
        onLongPress={drag}
      >
        <Image
          source={{ uri: item.uri }}
          style={[
            styles.imageThumb,
            item.isNew ? styles.newImageBorder : styles.existingImageBorder,
          ]}
        />
        <TouchableOpacity
          style={styles.removeImageButton}
          onPress={() => handleRemoveImage(item.uri)}
        >
          <Ionicons name="close-circle" size={24} color="#D32F2F" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const mainImage = productImages[0];
  const otherImages = productImages.slice(1);

  return (
    <NestableScrollContainer style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insurance Product Management</Text>
      </View>

      <View style={styles.contentContainer}>
        {/* Form Section */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {editingId
              ? "Edit Insurance Product"
              : "Create New Insurance Product"}
          </Text>

          <CustomTextInput
            label="Product Name*"
            value={form.name}
            onChangeText={(value) => handleTextChange("name", value)}
          />
          <CustomTextInput
            label="Description*"
            value={form.description}
            onChangeText={(value) => handleTextChange("description", value)}
            multiline
          />
          <CustomTextInput
            label="Badge Text"
            value={form.badgeText}
            onChangeText={(value) => handleTextChange("badgeText", value)}
          />
          <CustomTextInput
            label="Contact Number*"
            value={form.contactNumber}
            onChangeText={(value) => handleTextChange("contactNumber", value)}
            keyboardType="phone-pad"
          />

          {/* Checkbox Options */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionTitle}>Options</Text>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Is New</Text>
              <Switch
                trackColor={{ false: "#767577", true: "#78c257" }}
                thumbColor={form.options.isNew ? "#fff" : "#f4f3f4"}
                value={form.options.isNew}
                onValueChange={(value) => handleOptionChange("isNew", value)}
              />
            </View>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Is Award Winning</Text>
              <Switch
                trackColor={{ false: "#767577", true: "#78c257" }}
                thumbColor={form.options.isAwardWinning ? "#fff" : "#f4f3f4"}
                value={form.options.isAwardWinning}
                onValueChange={(value) =>
                  handleOptionChange("isAwardWinning", value)
                }
              />
            </View>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Is Popular</Text>
              <Switch
                trackColor={{ false: "#767577", true: "#78c257" }}
                thumbColor={form.options.isPopular ? "#fff" : "#f4f3f4"}
                value={form.options.isPopular}
                onValueChange={(value) =>
                  handleOptionChange("isPopular", value)
                }
              />
            </View>
          </View>

          {/* Executive Contact */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionTitle}>Executive Contact</Text>
            <CustomTextInput
              label="Phone Number*"
              value={form.executiveContact.phoneNumber}
              onChangeText={(value) =>
                handleExecutiveContactChange("phoneNumber", value)
              }
              keyboardType="phone-pad"
            />
            <CustomTextInput
              label="Point of Contact"
              value={form.executiveContact.pointOfContact}
              onChangeText={(value) =>
                handleExecutiveContactChange("pointOfContact", value)
              }
            />
          </View>

          {/* Categories */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <CustomTextInput
              label="Level 1 Category*"
              value={form.categories.level1.name}
              onChangeText={(value) => handleCategoryChange("level1", value)}
            />
            <CustomTextInput
              label="Level 2 Category*"
              value={form.categories.level2.name}
              onChangeText={(value) => handleCategoryChange("level2", value)}
            />
            <CustomTextInput
              label="Level 3 Category*"
              value={form.categories.level3.name}
              onChangeText={(value) => handleCategoryChange("level3", value)}
            />
          </View>

          {/* Image Uploader */}
          <View style={styles.imageUploaderContainer}>
            <TouchableOpacity
              style={styles.imageUploader}
              onPress={handlePickImages}
            >
              <FontAwesome name="image" size={24} color="#6B7280" />
              <Text style={styles.imageUploaderText}>
                Click to select images
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image Previews */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionTitle}>Brand/Main Image</Text>
            {mainImage ? (
              <View style={styles.mainImageContainer}>
                <Image
                  source={{ uri: mainImage.uri }}
                  style={[
                    styles.mainImage,
                    mainImage.isNew
                      ? styles.newImageBorder
                      : styles.existingImageBorder,
                  ]}
                />
                <TouchableOpacity
                  style={styles.removeMainImageButton}
                  onPress={() => handleRemoveImage(mainImage.uri)}
                >
                  <Ionicons name="close-circle" size={28} color="#D32F2F" />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.noImageText}>
                No main image selected. The first image you add will be the main
                image.
              </Text>
            )}
          </View>

          {otherImages.length > 0 && (
            <View style={styles.sectionDivider}>
              <Text style={styles.sectionTitle}>
                Other Images (Long press to reorder)
              </Text>
              <DraggableFlatList
                data={otherImages}
                renderItem={renderImageItem}
                keyExtractor={(item) => `drag-item-${item.uri}`}
                onDragEnd={({ data }) => setProductImages([mainImage, ...data])}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.buttonText}>Loading...</Text>
            ) : (
              <Text style={styles.buttonText}>
                {editingId ? "Update Product" : "Create Product"}
              </Text>
            )}
          </TouchableOpacity>
          {editingId && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={resetForm}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Products Section */}
        <View style={styles.productsContainer}>
          <Text style={styles.productsTitle}>My Insurance Products</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <ScrollView style={styles.productsList}>
            {loading && products.length === 0 ? (
              <Text style={styles.loadingText}>Loading products...</Text>
            ) : (
              filteredProducts.map((p) => (
                <View key={p._id} style={styles.productItem}>
                  <Image
                    source={{
                      uri: p.mainImage
                        ? p.mainImage
                        : "https://placehold.co/100x100/eee/ccc?text=No+Img",
                    }}
                    style={styles.productImage}
                  />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.productBadge}>{p.badgeText}</Text>
                    <Text style={styles.productContact}>
                      Contact: {p.contactNumber}
                    </Text>
                    <Text style={styles.productCategories} numberOfLines={1}>
                      {p.categories?.level1?.name &&
                      p.categories?.level2?.name &&
                      p.categories?.level3?.name
                        ? `${p.categories.level1.name} > ${p.categories.level2.name} > ${p.categories.level3.name}`
                        : `Categories: ${p.categories?.level1?.name || ""} ${
                            p.categories?.level2?.name || ""
                          } ${p.categories?.level3?.name || ""}`}
                    </Text>
                  </View>
                  <View style={styles.productActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEdit(p)}
                    >
                      <FontAwesome name="pencil" size={20} color="#B79400" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDelete(p._id)}
                    >
                      <FontAwesome name="trash" size={20} color="#D32F2F" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </NestableScrollContainer>
  );
};

interface CustomTextInputProps {
  label: string;
  multiline?: boolean;
  [key: string]: any;
}

const CustomTextInput: React.FC<CustomTextInputProps> = ({
  label,
  multiline = false,
  ...props
}) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    {multiline ? (
      <TextInput
        style={[styles.input, styles.textArea]}
        multiline={true}
        numberOfLines={4}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    ) : (
      <TextInput
        style={styles.input}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    position: "relative",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    position: "absolute",
    left: 16,
    top: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "center",
  },
  contentContainer: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    flex: 1,
    padding: 16,
  },
  formContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: Platform.OS === "web" ? 0 : 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    color: "#1F2937",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  sectionDivider: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 16,
    color: "#4B5563",
  },
  imageUploaderContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  imageUploader: {
    width: "100%",
    padding: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  imageUploaderText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
  },
  mainImageContainer: {
    position: "relative",
    width: 160,
    height: 160,
    margin: 4,
  },
  mainImage: {
    width: 160,
    height: 160,
    borderRadius: 8,
    resizeMode: "cover",
    borderWidth: 2,
  },
  removeMainImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 14,
  },
  noImageText: {
    color: "#6B7280",
    fontSize: 14,
  },
  imageThumbsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  imageThumbContainer: {
    position: "relative",
    width: 96,
    height: 96,
    margin: 4,
  },
  imageThumb: {
    width: 96,
    height: 96,
    borderRadius: 8,
    resizeMode: "cover",
    borderWidth: 2,
  },
  newImageBorder: {
    borderColor: "#10B981",
  },
  existingImageBorder: {
    borderColor: "#F59E0B",
  },
  removeImageButton: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  submitButton: {
    width: "100%",
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    alignItems: "center",
    marginTop: 16,
  },
  cancelButton: {
    width: "100%",
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#6B7280",
    alignItems: "center",
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: "#D1D5DB",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  productsContainer: {
    flex: 1,
    paddingTop: 24,
  },
  productsTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 16,
  },
  searchInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    fontSize: 16,
    marginBottom: 16,
  },
  productsList: {
    flexGrow: 1,
  },
  loadingText: {
    textAlign: "center",
    color: "#4B5563",
    marginTop: 20,
  },
  productItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    resizeMode: "cover",
  },
  productInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  productName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  productBadge: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 4,
  },
  productContact: {
    fontSize: 14,
    color: "#4B5563",
  },
  productCategories: {
    fontSize: 12,
    color: "#F59E0B",
    fontStyle: "italic",
    marginTop: 4,
  },
  productActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
});

export default InsuranceProductCRUDScreen;