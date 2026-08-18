// src/vendorScreens/VendorDashboardSidePanel.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from "react-native";
import {
  Power,
  Wallet,
  ShoppingBag,
  Clock,
  Package,
  TrendingUp,
  Info,
  Store,
  Home,
  Key,
  Eye,
  Users,
  BarChart3,
  LucideIcon,
} from "lucide-react-native";
import { Vendor, Order } from "../types/models";
import { StackNavigationProp } from "@react-navigation/stack";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../app/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { fetchVendorStats } from "../features/vendor/vendorAuthSlice";

const { width } = Dimensions.get("window");

type RootStackParamList = {
  VendorLogin: undefined;
  VendorDashboard: undefined;
  VendorCRUD: undefined;
  VendorOrderList: undefined;
  AllDeliveryBoys: { orderId: string };
  GenerateInvoice: { orderData: any; vendorData: any };
  VendorProductCRUD: undefined;
  VendorLeads: undefined;
  PropertyCRUDScreen: undefined;
  RentalCRUD: undefined;
  VendorProductViews: undefined;
  VendorChatScreen: undefined;
};

interface VendorDashboardSidePanelProps {
  vendor: Vendor | null;
  loading: boolean;
  handleToggleOnlineStatus: () => void;
  handleLogout: () => void;
  getStatusDisplay: (
    isApproved: boolean | undefined,
    isOnline: boolean | undefined,
  ) => JSX.Element;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  statsLoading: boolean;
  navigation: StackNavigationProp<RootStackParamList>;
}

// --- Royal Green Color Palette ---
const Colors = {
  background: "#0A0A0A",
  cardBackground: "#141414",
  cardBorder: "#1F1F1F",
  royalGreen: "#1B8C40",
  royalGreenLight: "#2A9D4A",
  royalGreenDark: "#0F5A28",
  royalGreenGlow: "rgba(27, 140, 64, 0.15)",
  royalGreenGlowStrong: "rgba(27, 140, 64, 0.3)",
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B0B0",
  textMuted: "#6B7280",
  gold: "#FFD700",
  onlineGreen: "#34C759",
  offlineRed: "#FF4444",
  accentBlue: "#2563EB",
  accentPurple: "#7C3AED",
};

interface MetricItem {
  id: string;
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: string;
  onPress?: () => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}

const VendorDashboardSidePanel = ({
  vendor,
  loading,
  handleToggleOnlineStatus,
  handleLogout,
  getStatusDisplay,
  totalOrders,
  pendingOrders,
  totalRevenue,
  statsLoading,
  navigation,
}: VendorDashboardSidePanelProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const orders = useSelector((state: RootState) => state.vendorOrders.orders);
  const { leads, stats: leadStats } = useSelector((state: RootState) => state.leads);
  const { vendor: vendorAuth } = useSelector((state: RootState) => state.vendorAuth);
  const { views } = useSelector((state: RootState) => state.productViews);

  // 🔥 Fetch vendor stats on mount and when component updates
  useEffect(() => {
    // Fetch initial stats
    dispatch(fetchVendorStats());
    
    // Set up interval to refresh stats every 30 seconds
    const interval = setInterval(() => {
      dispatch(fetchVendorStats());
    }, 30000);
    
    return () => clearInterval(interval);
  }, [dispatch]);

  // Get property and rental counts from their respective slices
  const propertyCount = 0; // TODO: Connect to property slice
  const rentalCount = 0; // TODO: Connect to rental slice

  // --- Metrics Data ---
  const metrics: MetricItem[] = [
    {
      id: "orders",
      label: "Orders",
      value: totalOrders,
      icon: ShoppingBag,
      color: Colors.accentBlue,
      onPress: () => navigation.navigate("VendorOrderList"),
    },
    {
      id: "leads",
      label: "Leads",
      value: leadStats?.total || 0,
      icon: Users,
      color: Colors.gold,
      onPress: () => navigation.navigate("VendorLeads"),
    },
    {
      id: "views",
      label: "Views",
      value: vendorAuth?.totalViews || 0,
      icon: Eye,
      color: Colors.accentPurple,
      onPress: () => navigation.navigate("VendorProductViews"),
    },
    {
      id: "properties",
      label: "Properties",
      value: propertyCount,
      icon: Home,
      color: "#FF6B6B",
      onPress: () => navigation.navigate("PropertyCRUDScreen"),
    },
    {
      id: "rentals",
      label: "Rentals",
      value: rentalCount,
      icon: Key,
      color: "#4ECDC4",
      onPress: () => navigation.navigate("RentalCRUD"),
    },
    {
      id: "revenue",
      label: "Revenue",
      value: `₹${totalRevenue.toFixed(2)}`,
      icon: Wallet,
      color: Colors.royalGreen,
      onPress: () => navigation.navigate("VendorOrderList"),
    },
  ];

  // --- Quick Actions ---
  const quickActions: QuickAction[] = [
    {
      id: "inventory",
      label: "Inventory",
      icon: "cube-outline",
      color: Colors.accentBlue,
      onPress: () => navigation.navigate("VendorProductCRUD"),
    },
    {
      id: "orders",
      label: "Orders",
      icon: "receipt-outline",
      color: Colors.gold,
      onPress: () => navigation.navigate("VendorOrderList"),
    },
    {
      id: "leads",
      label: "Leads",
      icon: "people-outline",
      color: Colors.royalGreen,
      onPress: () => navigation.navigate("VendorLeads"),
    },
    {
      id: "views",
      label: "Views",
      icon: "eye-outline",
      color: Colors.accentPurple,
      onPress: () => navigation.navigate("VendorProductViews"),
    },
    {
      id: "properties",
      label: "Properties",
      icon: "home-outline",
      color: "#FF6B6B",
      onPress: () => navigation.navigate("PropertyCRUDScreen"),
    },
    {
      id: "rentals",
      label: "Rentals",
      icon: "key-outline",
      color: "#4ECDC4",
      onPress: () => navigation.navigate("RentalCRUD"),
    },
  ];

  const renderMetricItem = (metric: MetricItem) => (
    <TouchableOpacity
      key={metric.id}
      style={[styles.metricCard, { borderLeftColor: metric.color }]}
      onPress={metric.onPress}
      activeOpacity={0.8}
    >
      <View style={styles.metricHeader}>
        <View style={[styles.metricIconWrapper, { backgroundColor: metric.color + '20' }]}>
          <metric.icon size={20} color={metric.color} />
        </View>
        <Text style={styles.metricValue}>
          {statsLoading ? (
            <ActivityIndicator size="small" color={Colors.royalGreen} />
          ) : (
            metric.value
          )}
        </Text>
      </View>
      <Text style={styles.metricLabel}>{metric.label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Hero Status Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                vendor?.isOnline ? styles.statusOnline : styles.statusOffline,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: vendor?.isOnline ? Colors.onlineGreen : Colors.offlineRed },
              ]}
            >
              {vendor?.isOnline ? "● LIVE" : "● OFFLINE"}
            </Text>
          </View>
          <View style={styles.brandBadge}>
            <Text style={styles.brandText}>BLUXURY</Text>
          </View>
        </View>

        <View style={styles.heroContent}>
          <Text style={styles.vendorName}>{vendor?.shopName || vendor?.name || 'Vendor'}</Text>
          <Text style={styles.vendorType}>{vendor?.businessType || 'Shop'}</Text>
          <View style={styles.approvalBadge}>
            {vendor?.isApproved ? (
              <Ionicons name="checkmark-circle" size={16} color={Colors.royalGreen} />
            ) : (
              <Ionicons name="time-outline" size={16} color={Colors.gold} />
            )}
            <Text style={[
              styles.approvalText,
              { color: vendor?.isApproved ? Colors.royalGreen : Colors.gold }
            ]}>
              {vendor?.isApproved ? 'Approved' : 'Pending Approval'}
            </Text>
          </View>
        </View>
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsSection}>
        <Text style={styles.sectionTitle}>PERFORMANCE METRICS</Text>
        <View style={styles.metricsGrid}>
          {metrics.map(renderMetricItem)}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionButton}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconWrapper, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsSection}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={handleToggleOnlineStatus}
            style={[
              styles.controlButton,
              vendor?.isOnline ? styles.offlineControl : styles.onlineControl,
            ]}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Power size={20} color="#FFFFFF" />
            <Text style={styles.controlText}>
              {vendor?.isOnline ? "Go Offline" : "Go Online"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButton}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Power size={20} color={Colors.offlineRed} style={{ transform: [{ rotate: "180deg" }] }} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("VendorChatScreen")}
          style={styles.chatButton}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubbles-outline" size={20} color={Colors.textPrimary} />
          <Text style={styles.chatText}>Chat Support</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  // --- Hero Card ---
  heroCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.royalGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: Colors.onlineGreen,
    shadowColor: Colors.onlineGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  statusOffline: {
    backgroundColor: Colors.offlineRed,
    shadowColor: Colors.offlineRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  brandBadge: {
    backgroundColor: Colors.royalGreen,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.royalGreenLight,
  },
  brandText: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroContent: {
    alignItems: "center",
    paddingVertical: 8,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  vendorType: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  approvalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  approvalText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // --- Metrics ---
  metricsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: (width - 48) / 3 - 8,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftColor: Colors.royalGreen,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metricIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  // --- Actions ---
  actionsSection: {
    marginBottom: 20,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: (width - 48) / 3 - 8,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
    textAlign: "center",
  },
  // --- Controls ---
  controlsSection: {
    gap: 8,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
  },
  controlButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  onlineControl: {
    backgroundColor: Colors.royalGreen,
    borderColor: Colors.royalGreenLight,
    shadowColor: Colors.royalGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  offlineControl: {
    backgroundColor: Colors.offlineRed,
    borderColor: "#FF6666",
    shadowColor: Colors.offlineRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  controlText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  logoutButton: {
    flex: 0.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.2)",
  },
  logoutText: {
    color: Colors.offlineRed,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chatText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default VendorDashboardSidePanel;