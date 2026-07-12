// src/utils/FloatingCartButton.tsx

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { RootState } from "../../app/store";
import { navigationRef } from "./navigationRef";
const { width, height } = Dimensions.get("window");

// Local Colors for Luxury Theme
const Colors = {
  royalGreen: "#032e18",
  luxuryBackground: "#0A0A0A",
  textLight: "#FFFFFF",
  divider: "rgba(255,255,255,0.4)",
};

const FloatingCartButton = () => {
  const cartItems = useSelector((state: RootState) => state.cart.items);

  // Ref to dynamically store the width of the pill so it snaps perfectly
  const buttonWidth = useRef(120);

  // 🧮 Calculate Totals
  const totalItems =
    cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // 💡 NOTE: If you want to show KG instead of Price, change `item.price` to `item.weight`
  // (or whatever your property is named) and change the '₹' symbol below to 'kg'.
  const totalPrice =
    cartItems?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;

  // 1. Initial Position (Right edge, middle of screen)
  const pan = useRef(
    new Animated.ValueXY({ x: width - 150, y: height / 2 }),
  ).current;

  // 2. Drag & Snap Logic
  const panResponder = useRef(
    PanResponder.create({
      // Only start drag if moved more than 5px (allows normal taps to work)
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset(); // Lock in absolute position

        // Calculate where to snap horizontally (Left or Right Edge)
        const isRightHalf = gestureState.moveX > width / 2;
        const targetX = isRightHalf ? width - buttonWidth.current - 10 : 10;

        // Keep it from going completely off the top or bottom
        const minHeight = 30;
        const maxHeight = height - 120; // Accounts for bottom tabs
        const currentY = pan.y._value;
        const targetY = Math.max(minHeight, Math.min(currentY, maxHeight));

        // Smooth spring animation to the edge
        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          friction: 6, // Bounciness
          tension: 50, // Speed
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  const handlePress = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate("CartScreen");
    }
  };

  // If cart is empty, don't show the button
  if (totalItems === 0) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[pan.getLayout(), styles.draggableWrapper]}
    >
      <TouchableOpacity
        style={styles.pillButton}
        onPress={handlePress}
        activeOpacity={0.85}
        // Capture the dynamic width of the button based on the text inside
        onLayout={(event) => {
          buttonWidth.current = event.nativeEvent.layout.width;
        }}
      >
        <Ionicons
          name="cart"
          size={20}
          color={Colors.textLight}
          style={styles.icon}
        />

        <View style={styles.textContainer}>
          <Text style={styles.itemsText}>{totalItems} Items</Text>
          <View style={styles.divider} />
          {/* Change ₹ to kg here if you swapped the math above! */}
          <Text style={styles.priceText}>₹{totalPrice}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  draggableWrapper: {
    position: "absolute",
    zIndex: 9999,
  },
  pillButton: {
    flexDirection: "row",
    backgroundColor: Colors.royalGreen,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30, // High border radius makes it pill-shaped
    alignItems: "center",
    justifyContent: "center",

    // Smooth Shadow UI
    shadowColor: Colors.royalGreen,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,

    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  icon: {
    marginRight: 8,
  },
  textContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemsText: {
    color: Colors.textLight,
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.divider,
    marginHorizontal: 8,
  },
  priceText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default FloatingCartButton;
