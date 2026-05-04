import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  Modal,
  RefreshControl,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import * as ImagePicker from "expo-image-picker";
import {
  createProperty,
  fetchProperties,
  updateProperty,
  deleteProperty,
  Property,
} from "../features/propertySlice";
import { RootState } from "../app/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";

// --- STRICT TYPES MATCHING MONGOOSE ---
type PropertyTypeEnum =
  | "Independent House/Villa"
  | "Apartment"
  | "Plot"
  | "Commercial"
  | "Penthouse"
  | "Studio";
type StatusEnum =
  | "New Launch"
  | "Under Construction"
  | "Ready to Move"
  | "Resale";
type FurnishingEnum = "Unfurnished" | "Semi-Furnished" | "Fully Furnished";
type FacingEnum =
  | "North"
  | "South"
  | "East"
  | "West"
  | "North-East"
  | "North-West"
  | "South-East"
  | "South-West"
  | "";
type OwnershipEnum = "Freehold" | "Leasehold" | "Co-operative Society";

interface PropertyFormData {
  title: string;
  propertyType: PropertyTypeEnum;
  status: StatusEnum;
  minPriceCr: string;
  maxPriceCr: string;
  superBuiltUpSqFt: string;

  // Location
  locationCity: string;
  locationLocality: string;
  lat: string;
  lng: string;

  // Configuration
  bhk: string;
  bathrooms: string;
  balconies: string;
  totalFloors: string;
  propertyFloor: string;
  carParkingAvailable: boolean;
  furnishingStatus: FurnishingEnum;
  facing: FacingEnum;
  ownershipType: OwnershipEnum;

  // Extra Details
  possessionDate: string;
  builtYear: string;

  projectHighlights: string[];
  tags: string[];
  amenities: string[];

  // External & Legal
  websiteUrl: string;
  virtualTourUrl: string;
  registrationId: string;
  maintenanceCharges: string;
}

const initialFormData: PropertyFormData = {
  title: "",
  propertyType: "Apartment",
  status: "Under Construction",
  minPriceCr: "",
  maxPriceCr: "",
  superBuiltUpSqFt: "",
  locationCity: "",
  locationLocality: "",
  lat: "",
  lng: "",

  bhk: "3 BHK",
  bathrooms: "2",
  balconies: "1",
  totalFloors: "",
  propertyFloor: "",
  carParkingAvailable: true,
  furnishingStatus: "Unfurnished",
  facing: "",
  ownershipType: "Freehold",

  possessionDate: "2025-12-31",
  builtYear: "",
  projectHighlights: [],
  tags: [],
  amenities: [],

  websiteUrl: "",
  virtualTourUrl: "",
  registrationId: "",
  maintenanceCharges: "",
};

// --- RICH LISTS FOR MULTI-SELECT DROPDOWNS ---
const PROPERTY_TYPES: PropertyTypeEnum[] = [
  "Apartment",
  "Independent House/Villa",
  "Plot",
  "Commercial",
  "Penthouse",
  "Studio",
];
const STATUS_TYPES: StatusEnum[] = [
  "Under Construction",
  "Ready to Move",
  "New Launch",
  "Resale",
];
const FURNISHING_TYPES: FurnishingEnum[] = [
  "Unfurnished",
  "Semi-Furnished",
  "Fully Furnished",
];
const FACING_TYPES: FacingEnum[] = [
  "North",
  "South",
  "East",
  "West",
  "North-East",
  "North-West",
  "South-East",
  "South-West",
];
const OWNERSHIP_TYPES: OwnershipEnum[] = [
  "Freehold",
  "Leasehold",
  "Co-operative Society",
];

const AMENITIES_LIST = [
  "Gymnasium",
  "Swimming Pool",
  "Club House",
  "24/7 Security",
  "Power Backup",
  "Visitor Parking",
  "Elevator/Lift",
  "Kids Play Area",
  "Jogging Track",
  "Landscaped Gardens",
  "Sports Court",
  "CCTV Surveillance",
  "Fire Safety",
  "Water Treatment",
  "Piped Gas",
  "WIFI / Internet",
];

const HIGHLIGHTS_LIST = [
  "Sea View",
  "City Skyline View",
  "Near Highway",
  "Premium Finish",
  "Smart Home Automation",
  "Vastu Compliant",
  "Corner Property",
  "Gated Community",
  "High Rental Yield",
  "Close to Metro",
  "Close to Schools",
  "Close to Hospitals",
  "Airport Nearby",
];

const TAGS_LIST = [
  "Luxury",
  "Investment",
  "Ready to Move",
  "Under Construction",
  "Furnished",
  "Spacious",
  "Affordable",
  "Premium",
  "Exclusive",
  "Negotiable",
  "Urgent Sale",
  "Pet Friendly",
  "Bachelor Friendly",
];

// --- CUSTOM SINGLE-SELECT DROPDOWN COMPONENT ---
const CustomDropdown = ({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder,
}: {
  label: string;
  options: string[];
  selectedValue: string;
  onSelect: (val: any) => void;
  placeholder: string;
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setModalVisible(true)}
      >
        <Text
          style={[
            styles.dropdownButtonText,
            !selectedValue && { color: "#999" },
          ]}
        >
          {selectedValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#64748B" />
      </TouchableOpacity>
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.dropdownModalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownOption,
                    selectedValue === item && styles.dropdownOptionActive,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      selectedValue === item && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// --- CUSTOM MULTI-SELECT PILLS COMPONENT ---
const MultiSelectPills = ({
  options,
  selectedValues,
  onToggle,
}: {
  options: string[];
  selectedValues: string[];
  onToggle: (val: string) => void;
}) => (
  <View style={styles.pillContainer}>
    {options.map((option) => {
      const isSelected = selectedValues.includes(option);
      return (
        <TouchableOpacity
          key={option}
          style={[styles.pill, isSelected && styles.pillActive]}
          onPress={() => onToggle(option)}
        >
          <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
            {option} {isSelected && "✓"}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const PropertyCRUDScreen: React.FC = () => {
  const dispatch = useDispatch<any>();

  // 🔥 ENTERPRISE UPGRADE 1: Inline Selector to bypass Circular Dependency crashes
  const properties = useSelector((state: RootState) => {
    const ids = state.property.ids as string[];
    const entities = state.property.entities;
    return ids.map((id) => entities[id] as Property);
  });

  const { loading, error, currentPage, hasMore } = useSelector(
    (state: RootState) => state.property,
  );

  const { location, selectedAddress } = useSelector(
    (state: RootState) => state.location,
  );

  const currentVendorId = useSelector(
    (state: RootState) => state.vendorAuth.vendor?._id,
  );

  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 🔥 ENTERPRISE UPGRADE 2: AbortSignal Integration (Memory Leak Prevention)
  useEffect(() => {
    let promise: any;
    if (currentVendorId) {
      promise = dispatch(
        fetchProperties({ vendorId: currentVendorId, page: 1, limit: 10 }),
      );
    }

    // Cleanup: Kills network request instantly if user navigates away
    return () => {
      if (promise) {
        promise.abort();
      }
    };
  }, [dispatch, currentVendorId]);

  useEffect(() => {
    if (error && !loading) {
      Toast.show({ type: "error", text1: "API Error", text2: error });
    }
  }, [error, loading]);

  const onRefresh = useCallback(async () => {
    if (!currentVendorId) return;
    setRefreshing(true);
    await dispatch(
      fetchProperties({ vendorId: currentVendorId, page: 1, limit: 10 }),
    );
    setRefreshing(false);
  }, [dispatch, currentVendorId]);

  const handleLoadMore = () => {
    if (hasMore && !loading && !refreshing && currentVendorId) {
      dispatch(
        fetchProperties({
          vendorId: currentVendorId,
          page: currentPage + 1,
          limit: 10,
        }),
      );
    }
  };

  const renderFooter = () => {
    if (!loading || properties.length === 0 || refreshing) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="small" color="#4A148C" />
      </View>
    );
  };

  const handleChange = (
    name: keyof PropertyFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleArrayItem = (
    name: "amenities" | "projectHighlights" | "tags",
    value: string,
  ) => {
    setFormData((prev) => {
      const currentArray = prev[name];
      if (currentArray.includes(value)) {
        return {
          ...prev,
          [name]: currentArray.filter((item) => item !== value),
        };
      } else {
        return { ...prev, [name]: [...currentArray, value] };
      }
    });
  };

  const handleAutofillLocation = () => {
    const targetLocation =
      location ||
      (selectedAddress
        ? {
            latitude: selectedAddress.latitude,
            longitude: selectedAddress.longitude,
          }
        : null);
    if (targetLocation) {
      setFormData((prev) => ({
        ...prev,
        lat: targetLocation.latitude.toString(),
        lng: targetLocation.longitude.toString(),
        locationCity: selectedAddress?.district || prev.locationCity,
        locationLocality: selectedAddress?.state || prev.locationLocality,
      }));
      Toast.show({
        type: "success",
        text1: "Location autofilled! Backend will format address.",
      });
    } else {
      Toast.show({
        type: "error",
        text1: "Location Unavailable",
        text2: "No saved address or GPS signal found.",
      });
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri);
      setSelectedImages((prev) => [...prev, ...uris]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.title)
      return Toast.show({ type: "error", text1: "Missing Title" });
    if (!formData.minPriceCr)
      return Toast.show({ type: "error", text1: "Missing Price" });
    if (!formData.superBuiltUpSqFt)
      return Toast.show({ type: "error", text1: "Missing Area" });
    if (!formData.lat || !formData.lng)
      return Toast.show({ type: "error", text1: "Missing Map Coordinates" });

    const payload = new FormData();

    // Core details
    payload.append("title", formData.title);
    payload.append("propertyType", formData.propertyType);
    payload.append("status", formData.status);
    payload.append("minPriceCr", formData.minPriceCr);
    payload.append("maxPriceCr", formData.maxPriceCr || formData.minPriceCr);
    payload.append("possessionDate", formData.possessionDate);
    if (formData.builtYear) payload.append("builtYear", formData.builtYear);

    // Deep Specs / Configuration
    payload.append("configuration.bhk", formData.bhk);
    payload.append("configuration.totalFloors", formData.totalFloors);
    if (formData.bathrooms)
      payload.append("configuration.bathrooms", formData.bathrooms);
    if (formData.balconies)
      payload.append("configuration.balconies", formData.balconies);
    if (formData.propertyFloor)
      payload.append("configuration.propertyFloor", formData.propertyFloor);
    payload.append(
      "carParkingAvailable",
      formData.carParkingAvailable ? "true" : "false",
    );
    payload.append("furnishingStatus", formData.furnishingStatus);
    if (formData.facing) payload.append("facing", formData.facing);
    payload.append("ownershipType", formData.ownershipType);

    // External & Legal
    if (formData.websiteUrl) payload.append("websiteUrl", formData.websiteUrl);
    if (formData.virtualTourUrl)
      payload.append("virtualTourUrl", formData.virtualTourUrl);
    if (formData.registrationId)
      payload.append("registrationId", formData.registrationId);
    if (formData.maintenanceCharges)
      payload.append("maintenanceCharges", formData.maintenanceCharges);

    // Location
    if (formData.locationCity)
      payload.append("location.city", formData.locationCity);
    if (formData.locationLocality)
      payload.append("location.locality", formData.locationLocality);
    payload.append("lat", formData.lat);
    payload.append("lng", formData.lng);

    // Arrays (Backend handles parsing automatically)
    payload.append(
      "projectHighlights",
      JSON.stringify(formData.projectHighlights),
    );
    payload.append("tags", JSON.stringify(formData.tags));
    payload.append("amenities", JSON.stringify(formData.amenities));

    // Area Options Calculation
    const sqft = parseFloat(formData.superBuiltUpSqFt);
    const priceCr = parseFloat(formData.minPriceCr);
    const calculatedRate =
      sqft > 0 ? Math.round((priceCr * 10000000) / sqft) : 0;
    payload.append(
      "areaOptions",
      JSON.stringify([
        {
          optionName: "Standard",
          superBuiltUpSqFt: sqft,
          priceCr: priceCr,
          ratePerSqFt: calculatedRate,
          govtChargesIncluded: false,
        },
      ]),
    );

    // Images
    let hasNewImages = false;
    selectedImages.forEach((uri, index) => {
      // 🔥 ENTERPRISE UPGRADE 3: Safer check for local device URIs across iOS/Android
      if (!uri.startsWith("http")) {
        hasNewImages = true;
        const filename = uri.split("/").pop() || `image_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        payload.append("images", { uri, name: filename, type } as any);
      }
    });

    if (!editingId && !hasNewImages) {
      return Toast.show({ type: "error", text1: "Select at least one image." });
    }

    let resultAction;
    if (editingId) {
      resultAction = await dispatch(
        updateProperty({ id: editingId, formData: payload }),
      );
    } else {
      resultAction = await dispatch(createProperty(payload));
    }

    if (
      createProperty.fulfilled.match(resultAction) ||
      updateProperty.fulfilled.match(resultAction)
    ) {
      Toast.show({ type: "success", text1: "Property saved successfully!" });
      closeForm();
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Listing",
      "Are you sure you want to permanently delete this property?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => dispatch(deleteProperty(id)), // Optimistic deletion works smoothly here
        },
      ],
    );
  };

  const openEditForm = (property: Property) => {
    const hasCoords =
      Array.isArray(property?.location?.coordinates?.coordinates) &&
      property.location.coordinates.coordinates.length === 2;

    setFormData({
      title: property?.title || "",
      propertyType: property?.propertyType || "Apartment",
      status: property?.status || "Under Construction",
      minPriceCr: property?.minPriceCr?.toString() || "",
      maxPriceCr: property?.maxPriceCr?.toString() || "",
      superBuiltUpSqFt:
        property?.areaOptions?.[0]?.superBuiltUpSqFt?.toString() || "",
      locationCity: property?.location?.city || "",
      locationLocality: property?.location?.locality || "",
      lat: hasCoords
        ? property.location.coordinates!.coordinates[1].toString()
        : "",
      lng: hasCoords
        ? property.location.coordinates!.coordinates[0].toString()
        : "",

      bhk: property?.configuration?.bhk || "3 BHK",
      bathrooms: property?.configuration?.bathrooms?.toString() || "2",
      balconies: property?.configuration?.balconies?.toString() || "1",
      totalFloors: property?.configuration?.totalFloors?.toString() || "",
      propertyFloor: property?.configuration?.propertyFloor?.toString() || "",
      carParkingAvailable: property?.configuration?.carParkingAvailable ?? true,
      furnishingStatus:
        property?.configuration?.furnishingStatus || "Unfurnished",
      facing: property?.configuration?.facing || "",
      ownershipType: property?.configuration?.ownershipType || "Freehold",

      possessionDate: property?.possessionDate
        ? new Date(property.possessionDate).toISOString().split("T")[0]
        : "2025-12-31",
      builtYear: property?.builtYear?.toString() || "",

      projectHighlights: property?.projectHighlights || [],
      tags: property?.tags || [],
      amenities: property?.amenities || [],

      websiteUrl: property?.websiteUrl || "",
      virtualTourUrl: property?.virtualTourUrl || "",
      registrationId: property?.registrationId || "",
      maintenanceCharges: property?.maintenanceCharges?.toString() || "",
    });
    setSelectedImages(property?.images || []);
    setEditingId(property?._id || null);
    setIsFormVisible(true);
  };

  const closeForm = () => {
    setFormData(initialFormData);
    setSelectedImages([]);
    setEditingId(null);
    setIsFormVisible(false);
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  const renderForm = () => (
    <ScrollView
      style={styles.formContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.formHeader}>
        <TouchableOpacity onPress={closeForm} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editingId ? "Edit Property" : "Add New Listing"}
        </Text>
      </View>

      {/* --- BASIC DETAILS --- */}
      <View style={styles.cardSection}>
        <SectionTitle title="Basic Details" />
        <Text style={styles.label}>Property Title</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => handleChange("title", text)}
          placeholder="e.g. 3BHK Luxury Villa in Downtown"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Property Type</Text>
        <View style={styles.pillContainer}>
          {PROPERTY_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.pill,
                formData.propertyType === type && styles.pillActive,
              ]}
              onPress={() => handleChange("propertyType", type)}
            >
              <Text
                style={[
                  styles.pillText,
                  formData.propertyType === type && styles.pillTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Construction Status</Text>
        <View style={styles.pillContainer}>
          {STATUS_TYPES.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.pill,
                formData.status === status && styles.pillActive,
              ]}
              onPress={() => handleChange("status", status)}
            >
              <Text
                style={[
                  styles.pillText,
                  formData.status === status && styles.pillTextActive,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Possession Date</Text>
            <TextInput
              style={styles.input}
              value={formData.possessionDate}
              onChangeText={(text) => handleChange("possessionDate", text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Built Year</Text>
            <TextInput
              style={styles.input}
              value={formData.builtYear}
              onChangeText={(text) => handleChange("builtYear", text)}
              placeholder="e.g. 2022"
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      {/* --- PRICING & AREA --- */}
      <View style={styles.cardSection}>
        <SectionTitle title="Pricing & Area" />
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Min Price (Cr)</Text>
            <TextInput
              style={styles.input}
              value={formData.minPriceCr}
              onChangeText={(text) => handleChange("minPriceCr", text)}
              placeholder="e.g. 1.5"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Max Price (Cr)</Text>
            <TextInput
              style={styles.input}
              value={formData.maxPriceCr}
              onChangeText={(text) => handleChange("maxPriceCr", text)}
              placeholder="e.g. 2.0"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Text style={styles.label}>Super Built-up Area (Sq.Ft)</Text>
        <TextInput
          style={styles.input}
          value={formData.superBuiltUpSqFt}
          onChangeText={(text) => handleChange("superBuiltUpSqFt", text)}
          placeholder="e.g. 1500"
          keyboardType="numeric"
        />
      </View>

      {/* --- DEEP SPECIFICATIONS --- */}
      <View style={styles.cardSection}>
        <SectionTitle title="Deep Specifications" />

        <Text style={styles.label}>Furnishing Status</Text>
        <View style={styles.pillContainer}>
          {FURNISHING_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.pill,
                formData.furnishingStatus === type && styles.pillActive,
              ]}
              onPress={() => handleChange("furnishingStatus", type)}
            >
              <Text
                style={[
                  styles.pillText,
                  formData.furnishingStatus === type && styles.pillTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <CustomDropdown
          label="Property Facing"
          options={FACING_TYPES}
          selectedValue={formData.facing}
          onSelect={(val: any) => handleChange("facing", val)}
          placeholder="Select Facing Direction"
        />
        <CustomDropdown
          label="Ownership Type"
          options={OWNERSHIP_TYPES}
          selectedValue={formData.ownershipType}
          onSelect={(val: any) => handleChange("ownershipType", val)}
          placeholder="Select Ownership"
        />

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>BHK Format</Text>
            <TextInput
              style={styles.input}
              value={formData.bhk}
              onChangeText={(text) => handleChange("bhk", text)}
              placeholder="e.g. 3 BHK"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Total Floors in Bldg</Text>
            <TextInput
              style={styles.input}
              value={formData.totalFloors}
              onChangeText={(text) => handleChange("totalFloors", text)}
              placeholder="e.g. 15"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Bathrooms</Text>
            <TextInput
              style={styles.input}
              value={formData.bathrooms}
              onChangeText={(text) => handleChange("bathrooms", text)}
              placeholder="e.g. 2"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Balconies</Text>
            <TextInput
              style={styles.input}
              value={formData.balconies}
              onChangeText={(text) => handleChange("balconies", text)}
              placeholder="e.g. 1"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.label}>
          Property Floor Number (e.g. 4 for 4th floor)
        </Text>
        <TextInput
          style={styles.input}
          value={formData.propertyFloor}
          onChangeText={(text) => handleChange("propertyFloor", text)}
          placeholder="e.g. 4"
          keyboardType="numeric"
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Car Parking Available</Text>
          <TouchableOpacity
            style={[
              styles.switchTrack,
              formData.carParkingAvailable && styles.switchTrackActive,
            ]}
            onPress={() =>
              handleChange("carParkingAvailable", !formData.carParkingAvailable)
            }
          >
            <View
              style={[
                styles.switchThumb,
                formData.carParkingAvailable && styles.switchThumbActive,
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* --- LOCATION --- */}
      <View style={styles.cardSection}>
        <View style={[styles.row, { alignItems: "center", marginBottom: 10 }]}>
          <SectionTitle title="Location & Map" />
          <TouchableOpacity
            onPress={handleAutofillLocation}
            style={styles.gpsBtn}
          >
            <Ionicons name="navigate" size={14} color="#fff" />
            <Text style={styles.gpsBtnText}>Use GPS</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 12, color: "#64748B", marginBottom: 15 }}>
          Backend will automatically generate full address based on coordinates.
        </Text>
        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          value={formData.locationCity}
          onChangeText={(text) => handleChange("locationCity", text)}
          placeholder="City (Optional if GPS used)"
        />
        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          value={formData.locationLocality}
          onChangeText={(text) => handleChange("locationLocality", text)}
          placeholder="Locality (Optional if GPS used)"
        />
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <TextInput
              style={styles.input}
              value={formData.lat}
              onChangeText={(text) => handleChange("lat", text)}
              placeholder="Latitude"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfWidth}>
            <TextInput
              style={styles.input}
              value={formData.lng}
              onChangeText={(text) => handleChange("lng", text)}
              placeholder="Longitude"
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      {/* --- LEGAL & EXTERNAL --- */}
      <View style={styles.cardSection}>
        <SectionTitle title="Legal & External Links" />
        <Text style={styles.label}>RERA / Registration ID</Text>
        <TextInput
          style={styles.input}
          value={formData.registrationId}
          onChangeText={(text) => handleChange("registrationId", text)}
          placeholder="e.g. RERA-AP-12345"
        />

        <Text style={styles.label}>Monthly Maintenance (₹)</Text>
        <TextInput
          style={styles.input}
          value={formData.maintenanceCharges}
          onChangeText={(text) => handleChange("maintenanceCharges", text)}
          placeholder="e.g. 5000"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Project Website URL</Text>
        <TextInput
          style={styles.input}
          value={formData.websiteUrl}
          onChangeText={(text) => handleChange("websiteUrl", text)}
          placeholder="https://..."
          keyboardType="url"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Virtual Tour URL (3D/YouTube)</Text>
        <TextInput
          style={styles.input}
          value={formData.virtualTourUrl}
          onChangeText={(text) => handleChange("virtualTourUrl", text)}
          placeholder="https://..."
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>

      {/* --- RICH HIGHLIGHTS, AMENITIES, AND TAGS --- */}
      <View style={styles.cardSection}>
        <SectionTitle title="Highlights & Tags" />

        <Text style={styles.label}>Select Amenities</Text>
        <MultiSelectPills
          options={AMENITIES_LIST}
          selectedValues={formData.amenities}
          onToggle={(val) => handleToggleArrayItem("amenities", val)}
        />

        <Text style={[styles.label, { marginTop: 10 }]}>
          Project Highlights
        </Text>
        <MultiSelectPills
          options={HIGHLIGHTS_LIST}
          selectedValues={formData.projectHighlights}
          onToggle={(val) => handleToggleArrayItem("projectHighlights", val)}
        />

        <Text style={[styles.label, { marginTop: 10 }]}>Search Tags</Text>
        <MultiSelectPills
          options={TAGS_LIST}
          selectedValues={formData.tags}
          onToggle={(val) => handleToggleArrayItem("tags", val)}
        />
      </View>

      {/* --- MEDIA --- */}
      <View style={[styles.cardSection, { marginBottom: 40 }]}>
        <SectionTitle title="Property Media" />
        <TouchableOpacity style={styles.uploadBtn} onPress={pickImages}>
          <Ionicons name="images" size={24} color="#4A148C" />
          <Text style={styles.uploadBtnText}>Select Photos from Gallery</Text>
        </TouchableOpacity>

        <View style={styles.galleryGrid}>
          {selectedImages.map((uri, index) => (
            <View key={index} style={styles.galleryItem}>
              <Image source={{ uri }} style={styles.galleryImage} />
              <TouchableOpacity
                style={styles.deleteBadge}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.stickyFooter}>
        <TouchableOpacity
          onPress={handleSubmit}
          style={styles.submitBtn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {editingId ? "Update Property" : "Publish Listing"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (isFormVisible) return renderForm();

  if (loading && properties.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A148C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.greetingText}>Vendor Dashboard</Text>
          <Text style={styles.mainTitle}>My Properties</Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsFormVisible(true)}
          style={styles.floatingAddBtn}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={properties}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        // Pagination Props
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4A148C"
            colors={["#4A148C"]}
          />
        }
        renderItem={({ item }) => {
          const coverImage =
            item?.images?.[0] || "https://via.placeholder.com/300";
          return (
            <View style={styles.listingCard}>
              <View style={styles.listingImageContainer}>
                <Image
                  source={{ uri: coverImage }}
                  style={styles.listingImage}
                />
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.listingBody}>
                <View style={styles.listingRow}>
                  <Text style={styles.listingPrice}>
                    ₹ {item.minPriceCr} Cr
                  </Text>
                  <Text style={styles.listingBhk}>
                    {item.configuration?.bhk}
                  </Text>
                </View>
                <Text style={styles.listingTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.listingLocation}>
                  <Ionicons name="location-outline" size={12} />{" "}
                  {item.location?.locality}, {item.location?.city}
                </Text>

                <View style={styles.listingActions}>
                  <TouchableOpacity
                    onPress={() => openEditForm(item)}
                    style={[styles.actionBtn, styles.editBtn]}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#4A148C" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item._id)}
                    style={[styles.actionBtn, styles.deleteBtn]}
                  >
                    <Ionicons name="trash-outline" size={18} color="#E53E3E" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No properties listed yet.</Text>
            <Text style={styles.emptyStateSub}>
              Tap the + button to add your first listing.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  dropdownButton: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownButtonText: { fontSize: 15, color: "#1E293B" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  dropdownModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 16,
    textAlign: "center",
  },
  dropdownOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownOptionActive: {
    backgroundColor: "#F3E8FF",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  dropdownOptionText: { fontSize: 16, color: "#475569", textAlign: "center" },
  dropdownOptionTextActive: { color: "#4A148C", fontWeight: "700" },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  greetingText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 4,
  },
  floatingAddBtn: {
    backgroundColor: "#4A148C",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4A148C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  listContent: { padding: 20, paddingBottom: 100 },
  listingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden",
  },
  listingImageContainer: {
    width: "100%",
    height: 180,
    backgroundColor: "#E2E8F0",
  },
  listingImage: { width: "100%", height: "100%", resizeMode: "cover" },
  statusBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  listingBody: { padding: 16 },
  listingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  listingPrice: { fontSize: 20, fontWeight: "800", color: "#4A148C" },
  listingBhk: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  listingLocation: { fontSize: 14, color: "#64748B", marginBottom: 16 },
  listingActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
  },
  editBtn: { backgroundColor: "#F3E8FF", marginRight: 10 },
  editBtnText: { color: "#4A148C", fontWeight: "700", marginLeft: 6 },
  deleteBtn: { backgroundColor: "#FEF2F2", flex: 0.3 },
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 80 },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#334155",
    marginTop: 16,
  },
  emptyStateSub: { fontSize: 14, color: "#94A3B8", marginTop: 8 },
  formContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  backButton: { marginRight: 16, padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  cardSection: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 20,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  halfWidth: { width: "48%" },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1E293B",
    marginBottom: 20,
  },
  pillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
    gap: 10,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillActive: { backgroundColor: "#F3E8FF", borderColor: "#C084FC" },
  pillText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  pillTextActive: { color: "#4A148C" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#CBD5E1",
    justifyContent: "center",
    padding: 2,
  },
  switchTrackActive: { backgroundColor: "#4A148C" },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  switchThumbActive: { transform: [{ translateX: 22 }] },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsBtnText: { color: "#fff", fontSize: 12, fontWeight: "700", marginLeft: 4 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#D8B4FE",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 20,
  },
  uploadBtnText: {
    color: "#4A148C",
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 10,
  },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  galleryItem: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  galleryImage: { width: "100%", height: "100%", borderRadius: 12 },
  deleteBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#E53E3E",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  submitBtn: {
    backgroundColor: "#4A148C",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#4A148C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});

export default PropertyCRUDScreen;
