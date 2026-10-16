// src/components/AddressModal.tsx
import React from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Colors, scale, verticalScale, moderateScale } from "../constants/colors";

const { height } = Dimensions.get("window");

// ─────────────────────────────────────────────────────────────
// 👑 ROYAL PALETTE
// ─────────────────────────────────────────────────────────────
const Royal = {
  gold: "#D4AF37",
  goldSoft: "#E8CC7A",
  goldDim: "rgba(212,175,55,0.35)",
  goldFaint: "rgba(212,175,55,0.10)",
  royalGreen: "#0A3D2B",
  royalGreenDeep: "#062318",
  obsidian: "#0B0B0F",
  ivory: "#FBF7EE",
  cream: "#FAF3E0",
};

interface AddressModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (address: any) => void;
  onAddAddress: () => void;
  selectedAddress: any;
  addresses: any[];
  isLoading: boolean;
  onOpenMap: () => void;
}

export const AddressModal: React.FC<AddressModalProps> = ({
  visible,
  onClose,
  onSelectAddress,
  onAddAddress,
  selectedAddress,
  addresses,
  isLoading,
  onOpenMap,
}) => {
  // ✅ Safe area — fixes the bottom button overlap on Android
  const insets = useSafeAreaInsets();
  const footerPaddingBottom = Math.max(insets.bottom, 12) + 12;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={addressModalStyles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={addressModalStyles.bottomSheet}>
          <View style={addressModalStyles.bottomSheetHandle} />

          <View style={addressModalStyles.sheetHeader}>
            <View style={addressModalStyles.sheetTitleRow}>
              <Ionicons name="diamond" size={14} color={Royal.gold} />
              <Text style={addressModalStyles.sheetTitle}>SELECT LOCATION</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={Royal.royalGreenDeep} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={addressModalStyles.addressList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Use current location */}
            <TouchableOpacity
              style={addressModalStyles.currentLocationContainer}
              onPress={onAddAddress}
              activeOpacity={0.75}
            >
              <View style={addressModalStyles.currentLocationIcon}>
                <Ionicons name="locate" size={20} color={Royal.gold} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={addressModalStyles.currentLocationTitle}>
                  Use my current location
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  {selectedAddress
                    ? selectedAddress.addressString
                    : "Fetch GPS & find nearby boutiques"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Royal.gold} />
            </TouchableOpacity>

            {/* Pick from Map */}
            <TouchableOpacity
              style={[
                addressModalStyles.currentLocationContainer,
                { borderTopWidth: 0 },
              ]}
              onPress={onOpenMap}
              activeOpacity={0.75}
            >
              <View style={addressModalStyles.currentLocationIcon}>
                <Ionicons name="map" size={20} color={Royal.gold} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={addressModalStyles.currentLocationTitle}>
                  Pick from Map
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  Search and select a location on map
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Royal.gold} />
            </TouchableOpacity>

            <View style={addressModalStyles.sectionDivider} />

            {addresses.length > 0 && (
              <>
                <Text style={addressModalStyles.savedAddressesHeader}>
                  SAVED ADDRESSES
                </Text>
                {addresses.map((addr) => {
                  const isSelected = selectedAddress?.id === addr.id;
                  let iconName = "location";
                  if (addr.type === "Home") iconName = "home";
                  if (addr.type === "Work") iconName = "briefcase";
                  if (addr.type === "Current Location") iconName = "locate";

                  return (
                    <TouchableOpacity
                      key={addr.id}
                      style={[
                        addressModalStyles.addressItem,
                        isSelected && addressModalStyles.addressItemSelected,
                      ]}
                      onPress={() => onSelectAddress(addr)}
                      activeOpacity={0.75}
                    >
                      <View style={addressModalStyles.iconContainer}>
                        <Ionicons
                          name={iconName as any}
                          size={20}
                          color={isSelected ? Royal.gold : Royal.royalGreenDeep}
                        />
                      </View>
                      <View style={addressModalStyles.addressInfo}>
                        <View style={addressModalStyles.addressTypeRow}>
                          <Text
                            style={[
                              addressModalStyles.addressType,
                              isSelected && { color: Royal.royalGreenDeep },
                            ]}
                          >
                            {addr.type}
                          </Text>
                          {isSelected && (
                            <View style={addressModalStyles.selectedBadge}>
                              <Text style={addressModalStyles.selectedBadgeText}>
                                SELECTED
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={addressModalStyles.addressString}
                          numberOfLines={2}
                        >
                          {addr.addressString}
                        </Text>
                        {addr.landmark && (
                          <Text style={addressModalStyles.landmarkText}>
                            ◆ {addr.landmark}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={Royal.gold}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {isLoading && (
              <View style={addressModalStyles.loadingContainer}>
                <ActivityIndicator size="small" color={Royal.gold} />
              </View>
            )}
          </ScrollView>

          {/* ✅ Footer padded by real device bottom inset */}
          <View
            style={[
              addressModalStyles.addAddressFooter,
              { paddingBottom: footerPaddingBottom },
            ]}
          >
            <TouchableOpacity
              style={addressModalStyles.addAddressButton}
              onPress={onAddAddress}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={Royal.obsidian} />
              <Text style={addressModalStyles.addAddressButtonText}>
                ADD NEW ADDRESS
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────
// 👑 Royal Styles
// ─────────────────────────────────────────────────────────────
const addressModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(11,11,15,0.55)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: Royal.ivory,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 12,
    maxHeight: height * 0.88, // ← raised from 0.8 to give the footer room
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderTopColor: Royal.gold,
  },
  bottomSheetHandle: {
    width: 42,
    height: 4,
    backgroundColor: Royal.gold,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
    opacity: 0.6,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Royal.goldDim,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: Royal.royalGreenDeep,
    letterSpacing: 2,
  },
  addressList: {
    flexGrow: 0, // ← prevents pushing footer off-screen
    maxHeight: height * 0.55,
  },
  currentLocationContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    backgroundColor: Royal.ivory,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Royal.goldFaint,
  },
  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Royal.goldFaint,
    borderWidth: 1,
    borderColor: Royal.goldDim,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  currentLocationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Royal.royalGreenDeep,
    marginBottom: 2,
  },
  addressInfo: {
    flex: 1,
    paddingRight: 10,
  },
  addressString: {
    fontSize: 12,
    color: Royal.royalGreen,
    lineHeight: 18,
    opacity: 0.75,
  },
  landmarkText: {
    fontSize: 11,
    color: Royal.gold,
    marginTop: 3,
    fontWeight: "700",
  },
  sectionDivider: {
    height: 6,
    backgroundColor: Royal.goldFaint,
    width: "100%",
  },
  savedAddressesHeader: {
    fontSize: 10,
    fontWeight: "900",
    color: Royal.gold,
    letterSpacing: 2,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Royal.ivory,
    borderBottomWidth: 1,
    borderBottomColor: Royal.goldFaint,
  },
  addressItemSelected: {
    backgroundColor: Royal.goldFaint,
  },
  iconContainer: {
    width: 30,
    alignItems: "flex-start",
  },
  addressTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  addressType: {
    fontSize: 14,
    fontWeight: "800",
    color: Royal.royalGreenDeep,
  },
  selectedBadge: {
    marginLeft: 8,
    backgroundColor: Royal.royalGreenDeep,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    color: Royal.gold,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  addAddressFooter: {
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: Royal.ivory,
    borderTopWidth: 1,
    borderTopColor: Royal.goldDim,
    // paddingBottom is set dynamically via insets.bottom
  },
  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Royal.gold,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addAddressButtonText: {
    color: Royal.obsidian,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
});