import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
  Platform,
  Modal,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { categories } from "./categories";
import {
  fetchMyProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  clearError,
} from "../features/vendor/vendorProductSlices";
import { RootState, AppDispatch } from "../app/store";

// --- Type Definitions ---
type VendorStackParamList = {
  VendorDashboard: undefined;
  VendorProductCRUD: undefined;
};

type VendorProductCRUDScreenNavigationProp = NativeStackNavigationProp<
  VendorStackParamList,
  "VendorProductCRUD"
>;

const initialFormState = {
  name: "",
  description: "",
  brandName: "",
  price: "",
  discountedPrice: "",
  discountPercent: "",
  category: "",
  stock: "",
  isAvailable: true,
  bulkPrice: "",
  bulkMinimumUnits: "",
  largeQuantityPrice: "",
  largeQuantityMinimumUnits: "",
};

export default function VendorProductCRUDScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<VendorProductCRUDScreenNavigationProp>();
  const {
    myProducts: products,
    loading,
    error,
  } = useSelector((state: RootState) => state.vendorProducts);
  const { vendor } = useSelector((state: RootState) => state.vendorAuth);

  const [form, setForm] = useState(initialFormState);
  const [selectedMainCategory, setSelectedMainCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [newImageFiles, setNewImageFiles] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [currentProductImageUrls, setCurrentProductImageUrls] = useState<
    string[]
  >([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentLevel, setCurrentLevel] = useState("main");
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    if (vendor?._id) {
      dispatch(fetchMyProducts());
    }
  }, [dispatch, vendor]);

  useEffect(() => {
    if (error) {
      Alert.alert("An Error Occurred", error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleChange = (name: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(initialFormState);
    setSelectedMainCategory("");
    setSelectedSubCategory("");
    setNewImageFiles([]);
    setCurrentProductImageUrls([]);
    setEditingId(null);
  };

  const handlePickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewImageFiles((prev) => [...prev, ...result.assets]);
    }
  };

  const handleRemoveNewImage = (indexToRemove: number) => {
    setNewImageFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleRemoveCurrentImage = (urlToRemove: string) => {
    setCurrentProductImageUrls((prevUrls) =>
      prevUrls.filter((url) => url !== urlToRemove)
    );
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.stock) {
      Alert.alert("Validation Error", "Please fill Name, Price, and Stock.");
      return;
    }

    const brandName = form.brandName.trim();
    if (
      brandName.length > 0 &&
      (brandName.length < 2 || brandName.length > 50)
    ) {
      Alert.alert(
        "Validation Error",
        "Brand Name must be between 2 and 50 characters, or empty."
      );
      return;
    }

    // Check if a category has been selected for new products
    // For updates, the category might not change, so this check is only for new products
    if (!editingId && !selectedMainCategory) {
      Alert.alert("Validation Error", "Please select a category.");
      return;
    }

    const formData = new FormData();
    Object.keys(form).forEach((key) => {
      const value = form[key as keyof typeof form];
      if (value !== "") {
        // Ensure correct string and boolean handling
        if (typeof value === "boolean") {
          formData.append(key, value.toString());
        } else if (typeof value === "string") {
          formData.append(key, value);
        } else if (typeof value === "number") {
          formData.append(key, value.toString());
        }
      }
    });

    // Construct the full category string to send to the backend
    let finalCategory = selectedMainCategory;
    if (selectedSubCategory) {
      finalCategory += `_${selectedSubCategory}`;
    }
    if (form.category) {
      finalCategory += `_${form.category}`;
    }
    formData.set("category", finalCategory);

    // Append new image files
    newImageFiles.forEach((file) => {
      const uriParts = file.uri.split(".");
      const fileType = uriParts[uriParts.length - 1];
      formData.append("images", {
        uri: file.uri,
        name: `photo-${Date.now()}.${fileType}`,
        type: `image/${fileType}`,
      } as any);
    });

    // For update, append the current images to keep them
    if (editingId && currentProductImageUrls.length > 0) {
      currentProductImageUrls.forEach((url) => {
        formData.append("images", url);
      });
    }

    try {
      if (editingId) {
        await dispatch(
          updateProduct({
            id: editingId,
            formData,
          })
        ).unwrap();
        Alert.alert("Success", "Product updated!");
      } else {
        await dispatch(addProduct(formData)).unwrap();
        Alert.alert("Success", "Product added!");
      }
      resetForm();
    } catch (err: any) {
      Alert.alert(
        "Operation Failed",
        err?.message || "An unknown error occurred."
      );
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product._id);
    const categoryString = product.category || "";
    const categoryParts = categoryString.split("_");

    // Reset category states
    setSelectedMainCategory(categoryParts[0] || "");
    setSelectedSubCategory(categoryParts[1] || "");

    // Populate all form fields from the product object
    setForm({
      name: product.name || "",
      description: product.description || "",
      brandName: product.brandName || "", // FIX: Populate brandName
      price: product.price !== undefined ? String(product.price) : "",
      discountedPrice:
        product.discountedPrice !== undefined
          ? String(product.discountedPrice)
          : "",
      discountPercent:
        product.discountPercent !== undefined
          ? String(product.discountPercent)
          : "",
      category: categoryParts.slice(2).join("_") || "", // FIX: Correctly set the last part of the category
      stock: product.stock !== undefined ? String(product.stock) : "", // FIX: Populate stock
      isAvailable: product.isAvailable,
      bulkPrice:
        product.bulkPrice !== undefined ? String(product.bulkPrice) : "",
      bulkMinimumUnits:
        product.bulkMinimumUnits !== undefined
          ? String(product.bulkMinimumUnits)
          : "",
      largeQuantityPrice:
        product.largeQuantityPrice !== undefined
          ? String(product.largeQuantityPrice)
          : "",
      largeQuantityMinimumUnits:
        product.largeQuantityMinimumUnits !== undefined
          ? String(product.largeQuantityMinimumUnits)
          : "",
    });

    // Set images
    setCurrentProductImageUrls(product.images || []);
    setNewImageFiles([]);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Confirm Deletion", "Are you sure?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => dispatch(deleteProduct(id)),
      },
    ]);
  };

  // --- Category Modal Logic ---
  const handleSelectCategory = (value: string) => {
    if (currentLevel === "main") {
      setSelectedMainCategory(value);
      setSelectedSubCategory("");
      setForm((prev) => ({ ...prev, category: "" }));

      const subcategories = categories[value as keyof typeof categories];
      if (
        subcategories &&
        typeof subcategories === "object" &&
        !Array.isArray(subcategories)
      ) {
        setCurrentLevel("sub");
      } else {
        setForm((prev) => ({ ...prev, category: value }));
        setIsModalVisible(false);
      }
    } else if (currentLevel === "sub") {
      setSelectedSubCategory(value);
      setForm((prev) => ({ ...prev, category: "" }));

      const subSubcategories =
        categories[selectedMainCategory as keyof typeof categories]?.[
          value as keyof (typeof categories)[keyof typeof categories]
        ];
      if (
        subSubcategories &&
        Array.isArray(subSubcategories) &&
        subSubcategories.length > 0
      ) {
        setCurrentLevel("sub-sub");
      } else {
        setForm((prev) => ({ ...prev, category: value }));
        setIsModalVisible(false);
      }
    } else if (currentLevel === "sub-sub") {
      setForm((prev) => ({ ...prev, category: value }));
      setIsModalVisible(false);
    }
    setFilterQuery("");
  };

  const getCategoryOptions = () => {
    let options: string[] = [];
    let currentCategoryData: any = {};

    if (currentLevel === "main") {
      currentCategoryData = categories;
    } else if (currentLevel === "sub" && selectedMainCategory) {
      currentCategoryData =
        categories[selectedMainCategory as keyof typeof categories];
    } else if (
      currentLevel === "sub-sub" &&
      selectedMainCategory &&
      selectedSubCategory
    ) {
      const subCategoryData =
        categories[selectedMainCategory as keyof typeof categories][
          selectedSubCategory as keyof (typeof categories)[keyof typeof categories]
        ];
      if (Array.isArray(subCategoryData)) {
        options = subCategoryData;
      }
    }

    if (currentLevel !== "sub-sub") {
      options = Object.keys(currentCategoryData);
    }

    return options.filter((option) =>
      option.toLowerCase().includes(filterQuery.toLowerCase())
    );
  };

  const getCategoryLabel = () => {
    if (currentLevel === "main") return "Main Category";
    if (currentLevel === "sub") return "Subcategory";
    if (currentLevel === "sub-sub") return "Sub-Subcategory";
    return "";
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {editingId ? "Edit Product" : "Manage Products"}
        </Text>
      </View>
      <View style={styles.form}>
        <CustomTextInput
          label="Name*"
          value={form.name}
          onChangeText={(v) => handleChange("name", v)}
        />
        <CustomTextInput
          label="Description"
          value={form.description}
          onChangeText={(v) => handleChange("description", v)}
          multiline
        />
        <CustomTextInput
          label="Brand Name"
          value={form.brandName}
          onChangeText={(v) => handleChange("brandName", v)}
        />
        <CustomTextInput
          label="Price (₹)*"
          value={form.price}
          onChangeText={(v) => handleChange("price", v)}
          keyboardType="numeric"
        />
        <CustomTextInput
          label="Discounted Price (₹)"
          value={form.discountedPrice}
          onChangeText={(v) => handleChange("discountedPrice", v)}
          keyboardType="numeric"
        />
        <CustomTextInput
          label="Discount Percent (%)"
          value={form.discountPercent}
          onChangeText={(v) => handleChange("discountPercent", v)}
          keyboardType="numeric"
        />
        <CustomTextInput
          label="Stock*"
          value={form.stock}
          onChangeText={(v) => handleChange("stock", v)}
          keyboardType="numeric"
        />

        {/* Category Inputs with Modal Trigger */}
        <Text style={styles.label}>Category Selection</Text>
        <TouchableOpacity
          style={styles.categoryInput}
          onPress={() => {
            setCurrentLevel("main");
            setIsModalVisible(true);
          }}
        >
          <Text style={styles.categoryInputText}>
            {selectedMainCategory || "-- Select Main Category --"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.categoryInput,
            !selectedMainCategory && styles.disabledInput,
          ]}
          onPress={() => {
            if (selectedMainCategory) {
              setCurrentLevel("sub");
              setIsModalVisible(true);
            }
          }}
          disabled={!selectedMainCategory}
        >
          <Text style={styles.categoryInputText}>
            {selectedSubCategory || "-- Select Subcategory --"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.categoryInput,
            !selectedSubCategory && styles.disabledInput,
          ]}
          onPress={() => {
            if (
              selectedSubCategory &&
              categories[selectedMainCategory as keyof typeof categories]?.[
                selectedSubCategory as keyof (typeof categories)[keyof typeof categories]
              ]?.length > 0
            ) {
              setCurrentLevel("sub-sub");
              setIsModalVisible(true);
            }
          }}
          disabled={!selectedSubCategory}
        >
          <Text style={styles.categoryInputText}>
            {form.category || "-- Select Sub-Subcategory (Optional) --"}
          </Text>
        </TouchableOpacity>
        {editingId && products.find((p) => p._id === editingId)?.category && (
          <View style={styles.currentCategoryContainer}>
            <Text style={styles.editingCategoryText}>Current Category:</Text>
            <Text style={styles.editingCategoryValue}>
              {products
                .find((p) => p._id === editingId)
                ?.category.replace(/_/g, " ")}
            </Text>
          </View>
        )}
        {/* --- End Category Inputs --- */}

        <Text style={styles.sectionTitle}>Bulk Pricing (Optional)</Text>
        <CustomTextInput
          label="Bulk Price (₹)"
          value={form.bulkPrice}
          onChangeText={(v) => handleChange("bulkPrice", v)}
          keyboardType="numeric"
        />
        <CustomTextInput
          label="Minimum Units for Bulk Price"
          value={form.bulkMinimumUnits}
          onChangeText={(v) => handleChange("bulkMinimumUnits", v)}
          keyboardType="numeric"
        />
        <Text style={styles.sectionTitle}>
          Large Quantity Pricing (Optional)
        </Text>
        <CustomTextInput
          label="Large Qty Price (₹)"
          value={form.largeQuantityPrice}
          onChangeText={(v) => handleChange("largeQuantityPrice", v)}
          keyboardType="numeric"
        />
        <CustomTextInput
          label="Minimum Units for Large Qty"
          value={form.largeQuantityMinimumUnits}
          onChangeText={(v) => handleChange("largeQuantityMinimumUnits", v)}
          keyboardType="numeric"
        />
        <View style={styles.switchContainer}>
          <Text style={styles.label}>Is Available</Text>
          <Switch
            value={form.isAvailable}
            onValueChange={(v) => handleChange("isAvailable", v)}
            trackColor={{
              false: "#767577",
              true: "#C5E1A5",
            }}
            thumbColor={form.isAvailable ? "#005612" : "#f4f3f4"}
          />
        </View>
        <TouchableOpacity style={styles.button} onPress={handlePickImages}>
          <FontAwesome name="image" size={18} color="#fff" />
          <Text style={styles.buttonText}>Select Images</Text>
        </TouchableOpacity>
        <View style={styles.imagePreviewContainer}>
          {currentProductImageUrls.map((url, index) => (
            <View key={`current-${index}`} style={styles.imageWrapper}>
              <Image source={{ uri: url }} style={styles.image} />
              <TouchableOpacity
                onPress={() => handleRemoveCurrentImage(url)}
                style={styles.removeImageButton}
              >
                <Ionicons name="close-circle" size={24} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          ))}
          {newImageFiles.map((file, index) => (
            <View key={`new-${index}`} style={styles.imageWrapper}>
              <Image source={{ uri: file.uri }} style={styles.image} />
              <TouchableOpacity
                onPress={() => handleRemoveNewImage(index)}
                style={styles.removeImageButton}
              >
                <Ionicons name="close-circle" size={24} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {editingId ? "Update Product" : "Add Product"}
            </Text>
          )}
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.buttonText}>Cancel Edit</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text
        style={[
          styles.title,
          {
            marginTop: 20,
          },
        ]}
      >
        My Products
      </Text>
      {loading && products.length === 0 ? (
        <ActivityIndicator size="large" color="#005612" />
      ) : (
        products.map((p) => (
          <View key={p._id} style={styles.productCard}>
            <Image
              source={{
                uri:
                  p.images && p.images.length > 0
                    ? p.images[0]
                    : "https://placehold.co/100x100/eee/ccc?text=No+Img",
              }}
              style={styles.productImage}
            />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {p.name}
              </Text>
              <Text style={styles.productBrand}>{p.brandName}</Text>
              <View style={styles.priceContainer}>
                {p.discountedPrice ? (
                  <>
                    <Text style={styles.productPrice}>
                      ₹{Number(p.discountedPrice).toFixed(2)}
                    </Text>
                    <Text style={styles.productDiscountedPrice}>
                      ₹{Number(p.price).toFixed(2)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.productPrice}>
                    ₹{Number(p.price).toFixed(2)}
                  </Text>
                )}
              </View>
              <Text style={styles.productStock}>Stock: {p.stock}</Text>
              <Text style={styles.productCategory} numberOfLines={1}>
                {p.category.replace(/_/g, " ")}
              </Text>
              {p.bulkPrice && p.bulkMinimumUnits && (
                <Text style={styles.productTierPrice}>
                  Bulk: {p.bulkMinimumUnits}+ @ ₹
                  {Number(p.bulkPrice).toFixed(2)}/unit
                </Text>
              )}
              {p.largeQuantityPrice && p.largeQuantityMinimumUnits && (
                <Text style={styles.productTierPrice}>
                  Large Qty: {p.largeQuantityMinimumUnits}+ @ ₹
                  {Number(p.largeQuantityPrice).toFixed(2)}/unit
                </Text>
              )}
            </View>
            <View style={styles.buttonColumn}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleEdit(p)}
              >
                <FontAwesome name="pencil" size={20} color="#BFA440" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleDelete(p._id)}
              >
                <FontAwesome name="trash" size={20} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Category Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => {
          setIsModalVisible(!isModalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Select {getCategoryLabel()}</Text>
            <TextInput
              style={styles.modalTextInput}
              placeholder="Search..."
              value={filterQuery}
              onChangeText={setFilterQuery}
            />
            <ScrollView style={styles.modalList}>
              {getCategoryOptions().map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.modalOption}
                  onPress={() => handleSelectCategory(option)}
                >
                  <Text style={styles.modalOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.button, styles.modalCloseButton]}
              onPress={() => setIsModalVisible(!isModalVisible)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const CustomTextInput = ({
  label,
  ...props
}: {
  label: string;
  [key: string]: any;
}) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor="#999" {...props} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  contentContainer: {
    padding: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
    width: "100%",
  },
  backButton: {
    position: "absolute",
    left: 0,
    padding: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1C1C1C",
    textAlign: "center",
    flex: 1,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  form: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: "#6c757d",
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: "#F8F9FA",
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#BFA440",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    gap: 10,
  },
  submitButton: {
    backgroundColor: "#005612",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  cancelButton: {
    backgroundColor: "#6c757d",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  imagePreviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  imageWrapper: {
    position: "relative",
    margin: 5,
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#BFA440",
  },
  removeImageButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "white",
    borderRadius: 12,
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: "center",
  },
  productName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1C1C1C",
  },
  productBrand: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  productPrice: {
    fontSize: 16,
    color: "#005612",
    fontWeight: "bold",
  },
  productDiscountedPrice: {
    fontSize: 14,
    color: "#D32F2F",
    textDecorationLine: "line-through",
    marginLeft: 8,
  },
  productStock: {
    fontSize: 14,
    color: "#6c757d",
  },
  productCategory: {
    fontSize: 12,
    color: "#BFA440",
    marginTop: 4,
    fontStyle: "italic",
  },
  productTierPrice: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  buttonColumn: {
    justifyContent: "space-around",
    marginLeft: 10,
  },
  iconButton: {
    padding: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#F8F9FA",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#005612",
    marginTop: 20,
    marginBottom: 10,
    borderTopColor: "#e0e0e0",
    borderTopWidth: 1,
    paddingTop: 15,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  // New Styles for Modal
  categoryInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
    marginBottom: 15,
  },
  categoryInputText: {
    fontSize: 16,
    color: "#1C1C1C",
  },
  disabledInput: {
    backgroundColor: "#e9ecef",
    color: "#6c757d",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "90%",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1C1C1C",
  },
  modalTextInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  modalList: {
    width: "100%",
    marginBottom: 15,
  },
  modalOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalOptionText: {
    fontSize: 16,
  },
  modalCloseButton: {
    backgroundColor: "#D32F2F",
    marginTop: 10,
  },
  currentCategoryContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    marginTop: -5,
    flexWrap: "wrap",
  },
  editingCategoryText: {
    fontSize: 16,
    color: "#6c757d",
    marginRight: 5,
  },
  editingCategoryValue: {
    fontWeight: "bold",
    color: "#1C1C1C",
  },
});
