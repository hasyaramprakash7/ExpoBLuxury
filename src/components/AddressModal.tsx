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
  Platform,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Colors, scale, verticalScale, moderateScale } from "../constants/colors";

const { height } = Dimensions.get("window");

interface AddressModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (address: any) => void;
  onAddAddress: () => void;         // For "Use my current location"
  selectedAddress: any;
  addresses: any[];
  isLoading: boolean;
  onOpenMap: () => void;            // For "Pick from Map"
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
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
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
            <Text style={addressModalStyles.sheetTitle}>Select Location</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView style={addressModalStyles.addressList} showsVerticalScrollIndicator={false}>
            {/* 🔥 UNCOMMENTED: Use my current location */}
            <TouchableOpacity
              style={addressModalStyles.currentLocationContainer}
              onPress={onAddAddress}
            >
              <View style={addressModalStyles.currentLocationIcon}>
                <Ionicons name="locate" size={22} color={Colors.swiggyOrange} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={addressModalStyles.currentLocationTitle}>
                  Use my current location
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  {selectedAddress
                    ? selectedAddress.addressString
                    : "Fetch GPS & find nearby shops"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
            </TouchableOpacity>

            {/* Pick from Map */}
            <TouchableOpacity
              style={[addressModalStyles.currentLocationContainer, { borderTopWidth: 0 }]}
              onPress={onOpenMap}
            >
              <View style={[addressModalStyles.currentLocationIcon, { backgroundColor: 'rgba(27, 140, 64, 0.1)' }]}>
                <Ionicons name="map" size={22} color={Colors.accentGreen} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={[addressModalStyles.currentLocationTitle, { color: Colors.accentGreen }]}>
                  Pick from Map
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  Search and select location on map
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
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
                    >
                      <View style={addressModalStyles.iconContainer}>
                        <Ionicons
                          name={iconName as any}
                          size={22}
                          color={isSelected ? Colors.swiggyOrange : Colors.textDark}
                        />
                      </View>
                      <View style={addressModalStyles.addressInfo}>
                        <View style={addressModalStyles.addressTypeRow}>
                          <Text
                            style={[
                              addressModalStyles.addressType,
                              isSelected && { color: Colors.swiggyOrange },
                            ]}
                          >
                            {addr.type}
                          </Text>
                          {isSelected && (
                            <View style={addressModalStyles.selectedBadge}>
                              <Text style={addressModalStyles.selectedBadgeText}>
                                Selected
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={addressModalStyles.addressString} numberOfLines={2}>
                          {addr.addressString}
                        </Text>
                        {addr.landmark && (
                          <Text style={addressModalStyles.landmarkText}>
                            📍 {addr.landmark}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color={Colors.successGreen}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            {isLoading && (
              <View style={addressModalStyles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.swiggyOrange} />
              </View>
            )}
          </ScrollView>

          <View style={addressModalStyles.addAddressFooter}>
            <TouchableOpacity
              style={addressModalStyles.addAddressButton}
              onPress={onAddAddress}
            >
              <Ionicons name="add" size={20} color={Colors.swiggyOrange} />
              <Text style={addressModalStyles.addAddressButtonText}>
                Add new address
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const addressModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.sheetBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: height * 0.8,
    overflow: 'hidden',
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  addressList: {
    maxHeight: height * 0.55,
  },
  currentLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.white,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGray,
  },
  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(252, 128, 25, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.swiggyOrange,
    marginBottom: 2,
  },
  addressInfo: {
    flex: 1,
    paddingRight: 10,
  },
  addressString: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
  },
  landmarkText: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 2,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F0F0F0',
    width: '100%',
  },
  savedAddressesHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  addressItemSelected: {
    backgroundColor: 'rgba(52, 199, 89, 0.04)',
  },
  iconContainer: {
    width: 30,
    alignItems: 'flex-start',
  },
  addressTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressType: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
  },
  selectedBadge: {
    marginLeft: 8,
    backgroundColor: Colors.successGreen,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  addAddressFooter: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGray,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addAddressButtonText: {
    color: Colors.swiggyOrange,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
});