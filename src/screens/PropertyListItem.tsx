import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { deleteProperty, Property } from "../features/propertySlice";

interface PropertyListItemProps {
  item: Property;
}

const PropertyListItem: React.FC<PropertyListItemProps> = ({ item }) => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();

  // Guard Clause: Fails gracefully instead of crashing the whole screen
  if (!item || !item._id) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading property data.</Text>
      </View>
    );
  }

  const handleDelete = async (id: string) => {
    const resultAction = await dispatch(deleteProperty(id) as any);
    if (deleteProperty.fulfilled.match(resultAction)) {
      Toast.show({
        type: "success",
        text1: "Deleted",
        text2: "Property removed successfully.",
      });
    } else if (deleteProperty.rejected.match(resultAction)) {
      const errorPayload = resultAction.payload || resultAction.error.message;
      Toast.show({
        type: "error",
        text1: "Delete Failed",
        text2: String(errorPayload),
      });
    }
  };

  const handleViewDetails = () => {
    navigation.navigate("PropertyDetail", { propertyId: item._id });
  };

  return (
    <TouchableOpacity
      onPress={handleViewDetails}
      style={styles.itemContainer}
      activeOpacity={0.8}
    >
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item?.title || "Untitled Property"}
        </Text>

        <Text style={styles.itemSubtitle} numberOfLines={1}>
          {item?.location?.locality || "Unknown Locality"},{" "}
          {item?.location?.city || "Unknown City"}
        </Text>

        <Text style={styles.itemPrice}>
          <Text style={{ fontWeight: "bold" }}>
            {item?.configuration?.bhk || "N/A"}
          </Text>{" "}
          | {item?.status || "Unknown"} |{" "}
          {item?.minPriceCr ? String(item.minPriceCr) : "0"} Cr
        </Text>

        {/* Rich Vendor Info */}
        <View style={styles.vendorRow}>
          <Image
            source={{
              uri: item?.vendor?.shopImage || "https://via.placeholder.com/40",
            }}
            style={styles.vendorAvatar}
          />
          <Text style={styles.vendorName} numberOfLines={1}>
            {item?.vendor?.shopName || item?.vendor?.name || "Verified Vendor"}
          </Text>
          {item?.vendor?.isApproved && (
            <Ionicons
              name="checkmark-circle"
              size={14}
              color="#4A148C"
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </View>

      <View style={styles.itemActions}>
        <TouchableOpacity
          onPress={() => {
            // 🚨 REMOVED e.stopPropagation() - It causes crashes in React Native!
            Toast.show({
              type: "info",
              text1: "Edit",
              text2: "Edit functionality handled in CRUD screen.",
            });
          }}
          style={[
            styles.actionButton,
            { backgroundColor: "#FFC107", marginRight: 10 },
          ]}
        >
          <Ionicons name="create-outline" size={20} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleDelete(item._id)}
          style={[styles.actionButton, { backgroundColor: "#E53E3E" }]}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginVertical: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  itemDetails: { flex: 3, paddingRight: 10, justifyContent: "center" },
  itemTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
  itemSubtitle: { fontSize: 13, color: "#666", marginTop: 3 },
  itemPrice: { fontSize: 14, color: "#C2185B", marginTop: 5 },
  vendorRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  vendorAvatar: { width: 20, height: 20, borderRadius: 10, marginRight: 5 },
  vendorName: { fontSize: 12, color: "#555", fontWeight: "500", flexShrink: 1 },
  itemActions: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  actionButton: { padding: 8, borderRadius: 5 },
  errorContainer: {
    padding: 15,
    backgroundColor: "#ffebee",
    borderRadius: 10,
    marginVertical: 8,
  },
  errorText: { color: "#c62828", fontSize: 14 },
});

export default PropertyListItem;
