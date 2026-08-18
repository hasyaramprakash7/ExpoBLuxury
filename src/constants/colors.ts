// src/constants/colors.ts
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

// --- Responsive helpers ---
export const scale = (size: number) => (width / 375) * size;
export const verticalScale = (size: number) => (height / 812) * size;
export const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

export const Colors = {
  backgroundDark: "#0A0A0A",
  cardWhite: "#FFFFFF",
  textDark: "#1C1C1E",
  textGray: "#6B7280",
  textLightGray: "#9CA3AF",
  accentGreen: "#1B8C40",
  accentPurple: "#0d3313",
  accentBlue: "#2563EB",
  dividerGray: "#F3F4F6",
  gold: "#FFD700",
  onlineGreen: "#34C759",
  offlineRed: "#FF4444",
  sheetOverlay: "rgba(0, 0, 0, 0.6)",
  sheetBackground: "#F9F9F9",
  successGreen: "#34C759",
  redAlert: "#DC2626",
  swiggyOrange: "#0A3D2B",
  borderGray: "#E5E5EA",
  starYellow: "#FFD700",
  starGray: "#4A4A4A",
  white: "#FFFFFF",
  black: "#000000",
};

// --- Helper to format full address ---
export const getFullAddress = (address: any): string => {
  if (!address) return "Address not available";
  
  const parts = [];
  
  if (address.street) parts.push(address.street);
  if (address.locality) parts.push(address.locality);
  if (address.district) parts.push(address.district);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.pincode) parts.push(address.pincode);
  if (address.country) parts.push(address.country);
  
  return parts.length > 0 ? parts.join(", ") : "Address not available";
};

// --- Calculate distance between two coordinates ---
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};