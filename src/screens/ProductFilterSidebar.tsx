import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

const { width } = Dimensions.get("window");

// --- 🎨 Luxury Thematic Color Palette (Starbucks Inspired) ---
const LuxuryColors = {
  primaryGreen: "#00704A", // Starbucks green
  darkGreen: "#004F2B", // Even deeper, for strong accents
  lightGreen: "#E6F4ED", // Subtle background, hover states
  cream: "#F9F7F5", // Warm, inviting background
  darkBrown: "#3E2723", // Rich dark brown for primary text
  mediumBrown: "#6D4C41", // For secondary text, less emphasis
  goldAccent: "#B8860B", // Subtle gold for highlights
  lightGray: "#D0D0D0", // For borders, dividers
  redAlert: "#DC2626", // Standard red for errors
  greenSuccess: "#10B981", // Standard green for success
  blueHighlight: "#3498db", // For clickable elements/links
  white: "#FFFFFF",
};

// --- 🖋️ Luxury Thematic Typography ---
const LuxuryTypography = {
  h1: {
    fontSize: width * 0.08,
    fontWeight: "700" as "700",
    color: LuxuryColors.darkBrown,
  },
  h2: {
    fontSize: width * 0.06,
    fontWeight: "600" as "600",
    color: LuxuryColors.darkBrown,
  },
  bodyLarge: {
    fontSize: width * 0.045,
    fontWeight: "400" as "400",
    color: LuxuryColors.mediumBrown,
  },
  bodyMedium: {
    fontSize: width * 0.04,
    fontWeight: "400" as "400",
    color: LuxuryColors.mediumBrown,
  },
  label: {
    fontSize: width * 0.038,
    fontWeight: "500" as "500",
    color: LuxuryColors.darkBrown,
  },
  buttonText: {
    fontSize: width * 0.04,
    fontWeight: "600" as "600",
    color: LuxuryColors.white,
  },
  priceText: {
    fontSize: width * 0.045,
    fontWeight: "bold" as "bold",
    color: LuxuryColors.darkBrown,
  },
};

// --- Simplified Props ---
interface ListSidebarProps {
  viewMode: "vendor" | "category";
  setViewMode: (mode: "vendor" | "category") => void;
  activeSelection: string;
  handleItemClick: (item: string) => void;
  sidebarItems: string[];
  titlePrefix: string;
  onClose: () => void;
}

const ProductListSidebar: React.FC<ListSidebarProps> = ({
  viewMode,
  setViewMode,
  activeSelection,
  handleItemClick,
  sidebarItems,
  titlePrefix,
  onClose,
}) => {
  return (
    <View style={styles.modalContainer}>
      {/* Modal Handle */}
      <View style={styles.handleContainer}>
        <View style={styles.handleBar} />
      </View>

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stickyHeader}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Browse</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons
                name="close-circle-outline"
                size={width * 0.07}
                color={LuxuryColors.mediumBrown}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.switcherContainer}>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                onPress={() => setViewMode("vendor")}
                style={[
                  styles.segmentButton,
                  viewMode === "vendor" && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    viewMode === "vendor" && styles.segmentButtonTextActive,
                  ]}
                >
                  Vendors
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode("category")}
                style={[
                  styles.segmentButton,
                  viewMode === "category" && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    viewMode === "category" && styles.segmentButtonTextActive,
                  ]}
                >
                  Categories
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.listContent}>
          <Text style={styles.listTitle}>{titlePrefix}</Text>
          {sidebarItems.length > 0 ? (
            sidebarItems.map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => {
                  handleItemClick(item);
                }}
                style={[
                  styles.listItem,
                  activeSelection === item && styles.listItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.listItemText,
                    activeSelection === item && styles.listItemTextActive,
                  ]}
                >
                  {item}
                </Text>
                {activeSelection === item && (
                  <Ionicons
                    name="checkmark-circle"
                    size={width * 0.055}
                    color={LuxuryColors.primaryGreen}
                  />
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noItemsText}>No {viewMode}s available.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: LuxuryColors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: LuxuryColors.darkBrown,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  handleContainer: {
    paddingVertical: 10,
    alignItems: "center",
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: LuxuryColors.lightGray,
  },
  stickyHeader: {
    backgroundColor: LuxuryColors.cream,
    ...Platform.select({
      ios: {
        shadowColor: LuxuryColors.darkBrown,
        shadowOffset: { height: 2, width: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: width * 0.05,
  },
  modalTitle: {
    ...LuxuryTypography.h2,
    fontSize: width * 0.065,
  },
  closeButton: {
    position: "absolute",
    right: width * 0.03,
    padding: 8,
  },
  switcherContainer: {
    paddingHorizontal: width * 0.05,
    paddingVertical: 15,
    backgroundColor: LuxuryColors.white,
    borderBottomWidth: 1,
    borderBottomColor: LuxuryColors.lightGray,
    shadowColor: LuxuryColors.darkBrown,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: LuxuryColors.lightGreen,
    borderRadius: 12,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: LuxuryColors.primaryGreen,
    shadowColor: LuxuryColors.darkGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  segmentButtonText: {
    ...LuxuryTypography.bodyLarge,
    fontWeight: "600",
    color: LuxuryColors.mediumBrown,
  },
  segmentButtonTextActive: {
    color: LuxuryColors.white,
  },
  listContent: {
    paddingHorizontal: width * 0.05,
    paddingVertical: 15,
  },
  listTitle: {
    ...LuxuryTypography.h2,
    fontSize: width * 0.05,
    marginBottom: 10,
    color: LuxuryColors.darkBrown,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: LuxuryColors.lightGray,
  },
  listItemActive: {
    backgroundColor: LuxuryColors.lightGreen,
    borderRadius: 8,
    marginVertical: 4,
    paddingHorizontal: 10,
  },
  listItemText: {
    ...LuxuryTypography.bodyLarge,
    color: LuxuryColors.darkBrown,
  },
  listItemTextActive: {
    color: LuxuryColors.primaryGreen,
    fontWeight: "700",
  },
  noItemsText: {
    ...LuxuryTypography.bodyMedium,
    fontStyle: "italic",
    textAlign: "center",
    padding: 25,
    color: LuxuryColors.mediumBrown,
  },
});

export default ProductListSidebar;
