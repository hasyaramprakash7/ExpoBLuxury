import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import {
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  Upload,
  Save,
  X,
  Edit2,
} from "lucide-react-native";
import { Vendor, Address } from "../types/models"; // Import Vendor type

interface VendorProfileCardProps {
  vendor: Vendor;
  loading: boolean;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  formData: Vendor; // Use Vendor type for formData
  handleChange: (name: string, value: string) => void;
  handleImageChange: () => void; // No event object in RN picker
  handleSave: () => void;
  getStatusDisplay: (
    isApproved: boolean | undefined,
    isOnline: boolean | undefined
  ) => JSX.Element;
  handleFetchLocation: () => void;
  handlePincodeBlur: () => void;
  loadingAddress: boolean;
  signupError: string | null;
  showModal: (message: string) => void;
}

export default function VendorProfileCard({
  vendor,
  loading,
  isEditing,
  setIsEditing,
  formData,
  handleChange,
  handleImageChange,
  handleSave,
  getStatusDisplay,
  handleFetchLocation,
  handlePincodeBlur,
  loadingAddress,
  signupError,
  showModal,
}: VendorProfileCardProps) {
  // If vendor data is still loading, show a loading indicator
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading vendor profile...</Text>
      </View>
    );
  }

  // If no vendor data, this case should ideally be handled by the parent
  // VendorDashboard which renders the "Access Denied" message.
  if (!vendor) {
    return (
      <View style={styles.noDataContainer}>
        <AlertCircle size={24} color="#dc2626" />
        <Text style={styles.noDataText}>No vendor data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Profile</Text>
        {!isEditing ? (
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            style={styles.editButton}
          >
            <Edit2 size={16} color="#ffffff" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              setIsEditing(false);
              // Optionally, reset formData to original vendor data here if edit is cancelled
              // dispatch(fetchVendorProfile()); // Re-fetch to revert changes
            }}
            style={styles.cancelButton}
          >
            <X size={16} color="#4b5563" />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.profileGrid}>
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                formData.shopImage ||
                "https://via.placeholder.com/150?text=Shop+Image",
            }}
            style={styles.shopImage}
          />
          {isEditing && (
            <TouchableOpacity
              onPress={handleImageChange}
              style={styles.imageUploadOverlay}
            >
              <Upload size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.shopInfo}>
          <Text style={styles.label}>Shop Name:</Text>
          <Text style={styles.shopNameText}>{vendor.shopName}</Text>
          <Text style={styles.label}>Status:</Text>
          {getStatusDisplay(vendor.isApproved, vendor.isOnline)}
        </View>
      </View>

      {isEditing && (
        <View style={styles.editForm}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vendor Name</Text>
            <TextInput
              style={styles.textInput}
              onChangeText={(text) => handleChange("name", text)}
              value={formData.name}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              onChangeText={(text) => handleChange("email", text)}
              value={formData.email}
              keyboardType="email-address"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              onChangeText={(text) => handleChange("phone", text)}
              value={formData.phone}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Shop Name</Text>
            <TextInput
              style={styles.textInput}
              onChangeText={(text) => handleChange("shopName", text)}
              value={formData.shopName}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Business Type</Text>
            <TextInput
              style={styles.textInput}
              onChangeText={(text) => handleChange("businessType", text)}
              value={formData.businessType || ""}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>GST Number</Text>
            <TextInput
              style={styles.textInput}
              onChangeText={(text) => handleChange("gstNo", text)}
              value={formData.gstNo || ""}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Delivery Range (in km)</Text>
            <TextInput
              style={styles.textInput}
              onChangeText={(text) => handleChange("deliveryRange", text)}
              value={formData.deliveryRange?.toString() || ""}
              keyboardType="numeric"
            />
          </View>

          {/* --- Address Fields --- */}
          <View style={styles.addressSection}>
            <Text style={styles.addressTitle}>Business Address</Text>

            {/* Pincode Input with Auto-fill */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pincode</Text>
              <View style={styles.pincodeInputContainer}>
                <TextInput
                  style={styles.textInput}
                  onChangeText={(text) => handleChange("address.pincode", text)}
                  value={formData.address.pincode}
                  onBlur={handlePincodeBlur} // Trigger auto-fill on blur
                  placeholder="Enter 6-digit Pincode"
                  maxLength={6}
                  keyboardType="numeric"
                />
                {loadingAddress && formData.address.pincode && (
                  <View style={styles.pincodeLoader}>
                    <ActivityIndicator size="small" color="#94a3b8" />
                  </View>
                )}
              </View>
              {signupError && (
                <Text style={styles.errorText}>{signupError}</Text>
              )}
            </View>

            {/* Fetch Current Location Button */}
            <View style={styles.locationButtonContainer}>
              <TouchableOpacity
                onPress={handleFetchLocation}
                disabled={loadingAddress}
                style={styles.locationButton}
              >
                {loadingAddress ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#ffffff"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.locationButtonText}>
                      Fetching Location...
                    </Text>
                  </>
                ) : (
                  <>
                    <MapPin
                      size={16}
                      color="#ffffff"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.locationButtonText}>
                      Fetch Current Location
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Display auto-filled address details (read-only for user clarity) */}
            <View style={styles.addressDetailsGrid}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={styles.readOnlyInput}
                  value={formData.address.state}
                  editable={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>District</Text>
                <TextInput
                  style={styles.readOnlyInput}
                  value={formData.address.district}
                  editable={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Country</Text>
                <TextInput
                  style={styles.readOnlyInput}
                  value={formData.address.country}
                  editable={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Latitude</Text>
                <TextInput
                  style={styles.readOnlyInput}
                  value={formData.address.latitude?.toString() || ""}
                  editable={false}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Longitude</Text>
                <TextInput
                  style={styles.readOnlyInput}
                  value={formData.address.longitude?.toString() || ""}
                  editable={false}
                />
              </View>
            </View>
          </View>

          {/* Save Changes Button */}
          <View style={styles.saveButtonContainer}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={loading} // Disable save button if vendorAuth is loading
              style={styles.saveButton}
            >
              {loading ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.saveButtonText}>Saving...</Text>
                </>
              ) : (
                <>
                  <Save size={20} color="#ffffff" style={styles.buttonIcon} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 24,
  },
  loadingContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 24,
    height: 256, // Fixed height for loading state
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginLeft: 12,
    color: "#475569", // gray-600
    fontSize: 16,
  },
  noDataContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    color: "#dc2626", // red-600
  },
  noDataText: {
    color: "#dc2626",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b", // gray-800
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#2563eb", // blue-600
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderColor: "#d1d5db", // gray-300
    borderWidth: 1,
    backgroundColor: "#ffffff",
  },
  cancelButtonText: {
    color: "#4b5563", // gray-700
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  profileGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap", // Allow wrapping on small screens
  },
  imageContainer: {
    width: 128,
    height: 128,
    borderRadius: 9999, // rounded-full
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#e5e7eb", // gray-200
    marginRight: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imageUploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  shopInfo: {
    flex: 1,
    marginTop: 16, // Adjust for small screens
  },
  label: {
    fontSize: 12,
    color: "#6b7280", // gray-500
  },
  shopNameText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827", // gray-900
    marginBottom: 8,
  },
  editForm: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb", // gray-200
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151", // gray-700
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#d1d5db", // gray-300
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827", // gray-900
    backgroundColor: "#ffffff",
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb", // gray-200
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#475569", // gray-600
    backgroundColor: "#f9fafb", // gray-50
  },
  addressSection: {
    marginTop: 24,
  },
  addressTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#111827", // gray-900
    marginBottom: 16,
  },
  pincodeInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  pincodeLoader: {
    position: "absolute",
    right: 12,
  },
  locationButtonContainer: {
    marginTop: 16,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: "#4f46e5", // indigo-600
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  locationButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  addressDetailsGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  saveButtonContainer: {
    marginTop: 24,
    alignItems: "flex-end",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: "#10b981", // green-600
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: "#ef4444", // red-600
  },
});
