// src/components/AllCategoriesModal.tsx
import React from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Colors, scale, verticalScale, moderateScale } from "../constants/colors";

interface CategoryWithImage {
  name: string;
  image?: string;
  count?: number;
}

interface AllCategoriesModalProps {
  visible: boolean;
  onClose: () => void;
  categories: CategoryWithImage[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export const AllCategoriesModal: React.FC<AllCategoriesModalProps> = ({
  visible,
  onClose,
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={categoryModalStyles.overlay}>
        <View style={categoryModalStyles.modalContent}>
          <View style={categoryModalStyles.modalHeader}>
            <Text style={categoryModalStyles.modalTitle}>All Categories</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textGray} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={categories}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            numColumns={3}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  categoryModalStyles.categoryGridItem,
                  selectedCategory === item.name && categoryModalStyles.selectedGridItem,
                ]}
                onPress={() => {
                  onSelectCategory(item.name);
                  onClose();
                }}
              >
                {item.image ? (
                  <Image 
                    source={{ uri: item.image }} 
                    style={categoryModalStyles.categoryGridImage} 
                  />
                ) : (
                  <View style={categoryModalStyles.categoryGridPlaceholder}>
                    <Ionicons name="pricetag-outline" size={scale(24)} color={Colors.textGray} />
                  </View>
                )}
                <Text 
                  style={[
                    categoryModalStyles.categoryGridName,
                    selectedCategory === item.name && categoryModalStyles.selectedGridText,
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.count !== undefined && (
                  <Text style={categoryModalStyles.categoryGridCount}>
                    {item.count} shops
                  </Text>
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={categoryModalStyles.gridContainer}
            ListEmptyComponent={
              <Text style={categoryModalStyles.emptyText}>No categories found</Text>
            }
          />

          <TouchableOpacity 
            style={categoryModalStyles.clearButton} 
            onPress={() => {
              onSelectCategory(null);
              onClose();
            }}
          >
            <Text style={categoryModalStyles.clearButtonText}>Clear Filter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const categoryModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.backgroundDark,
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    padding: moderateScale(20),
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: 'bold',
    color: Colors.cardWhite,
  },
  gridContainer: {
    paddingVertical: verticalScale(8),
  },
  categoryGridItem: {
    flex: 1,
    alignItems: 'center',
    padding: moderateScale(8),
    margin: scale(4),
    backgroundColor: '#1A1A1A',
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: '#2A2A2A',
    minHeight: verticalScale(100),
  },
  selectedGridItem: {
    borderColor: Colors.accentGreen,
    backgroundColor: 'rgba(27, 140, 64, 0.15)',
  },
  categoryGridImage: {
    width: scale(50),
    height: scale(50),
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(6),
  },
  categoryGridPlaceholder: {
    width: scale(50),
    height: scale(50),
    borderRadius: moderateScale(8),
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  categoryGridName: {
    fontSize: moderateScale(12),
    color: Colors.textGray,
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedGridText: {
    color: Colors.accentGreen,
    fontWeight: '600',
  },
  categoryGridCount: {
    fontSize: moderateScale(10),
    color: Colors.textLightGray,
    textAlign: 'center',
    marginTop: verticalScale(2),
  },
  clearButton: {
    marginTop: verticalScale(12),
    paddingVertical: verticalScale(12),
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  clearButtonText: {
    color: Colors.offlineRed,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  emptyText: {
    color: Colors.textLightGray,
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginVertical: verticalScale(20),
  },
});