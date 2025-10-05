import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import {
  Power,
  Wallet,
  ShoppingBag,
  Clock,
  Package,
  TrendingUp,
  Info,
} from "lucide-react-native";
import { Vendor, Order } from "../types/models";
import { StackNavigationProp } from "@react-navigation/stack";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";

const { width } = Dimensions.get("window");

type RootStackParamList = {
  VendorLogin: undefined;
  VendorDashboard: undefined;
  VendorCRUD: undefined;
  VendorOrderList: undefined;
  AllDeliveryBoys: { orderId: string };
  GenerateInvoice: { orderData: any; vendorData: any };
  VendorProductCRUD: undefined;
};

interface VendorDashboardSidePanelProps {
  vendor: Vendor | null;
  loading: boolean;
  handleToggleOnlineStatus: () => void;
  handleLogout: () => void;
  getStatusDisplay: (
    isApproved: boolean | undefined,
    isOnline: boolean | undefined
  ) => JSX.Element;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number; // This prop is now the sum of all orders' totals
  statsLoading: boolean;
  navigation: StackNavigationProp<RootStackParamList>;
}

const VendorDashboardSidePanel = ({
  vendor,
  loading,
  handleToggleOnlineStatus,
  handleLogout,
  getStatusDisplay,
  totalOrders,
  pendingOrders,
  totalRevenue, // Now correctly represents the gross collected total
  statsLoading,
  navigation,
}: VendorDashboardSidePanelProps) => {
  const TOTAL_DEDUCTION_RATE = 0.25; // 25% combined fee as per your image.
  const orders = useSelector((state: RootState) => state.vendorOrders.orders);

  // Updated to include all orders in the calculation, including 'cancelled' ones.
  const totalGrossRevenue = orders.reduce(
    (sum: number, order: Order) => sum + order.total,
    0
  );
  
  const totalDeductions = totalGrossRevenue * TOTAL_DEDUCTION_RATE;
  const netVendorPayout = totalGrossRevenue - totalDeductions;

  return (
    <View style={styles.container}>
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
                { color: vendor?.isOnline ? "#00A65A" : "#DD4B39" },
              ]}
            >
              {vendor?.isOnline ? "LIVE" : "OFFLINE"}
            </Text>
          </View>
          <Text style={styles.heroTitle}>COMMAND CENTER</Text>
        </View>

        <View style={styles.heroContent}>
          {vendor ? (
            getStatusDisplay(vendor.isApproved, vendor.isOnline)
          ) : (
            <Text style={styles.noStatusText}>Initializing Systems...</Text>
          )}
        </View>
      </View>

      {/* Premium Action Controls */}
      <View style={styles.controlsCard}>
        <Text style={styles.sectionTitle}>PRECISION CONTROLS</Text>
        <View style={styles.controlsGrid}>
          {vendor && (
            <TouchableOpacity
              onPress={handleToggleOnlineStatus}
              style={[
                styles.primaryControl,
                vendor.isOnline ? styles.controlOffline : styles.controlOnline,
              ]}
              disabled={loading}
              activeOpacity={0.8}
            >
              <View style={styles.controlIconContainer}>
                <Power size={24} color="#FFFFFF" />
              </View>
              <View style={styles.controlTextContainer}>
                <Text style={styles.controlTitle}>
                  {vendor.isOnline ? "DEACTIVATE" : "ACTIVATE"}
                </Text>
                <Text style={styles.controlSubtitle}>
                  {vendor.isOnline ? "Go Offline" : "Go Online"}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleLogout}
            style={styles.secondaryControl}
            disabled={loading}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.controlIconContainer,
                { backgroundColor: "rgba(211, 84, 0, 0.1)" },
              ]}
            >
              <Power
                size={24}
                color="#D35400"
                style={{ transform: [{ rotate: "180deg" }] }}
              />
            </View>
            <View style={styles.controlTextContainer}>
              <Text style={styles.secondaryControlTitle}>LOGOUT</Text>
              <Text style={styles.secondaryControlSubtitle}>Secure Exit</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Suite */}
      <View style={styles.navigationCard}>
        <Text style={styles.sectionTitle}>NAVIGATION SUITE</Text>
        <View style={styles.navigationGrid}>
          <TouchableOpacity
            onPress={() => navigation.navigate("VendorProductCRUD")}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <View style={styles.navIconRing}>
              <Package size={28} color="#D35400" />
            </View>
            <Text style={styles.navTitle}>INVENTORY</Text>
            <Text style={styles.navSubtitle}>Manage Products</Text>
            <View style={styles.navAccent} />
          </TouchableOpacity>

          

          <TouchableOpacity
            onPress={() => navigation.navigate("VendorOrderList")}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <View style={styles.navIconRing}>
              <ShoppingBag size={28} color="#D35400" />
            </View>
            <Text style={styles.navTitle}>ORDERS</Text>
            <Text style={styles.navSubtitle}>View & Manage</Text>
            <View style={styles.navAccent} />
          </TouchableOpacity>
        </View>
        <View style={styles.navigationGrid}>
          <TouchableOpacity
            onPress={() => navigation.navigate("VendorAppointmentsList")}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <View style={styles.navIconRing}>
              <Package size={28} color="#D35400" />
            </View>
            <Text style={styles.navTitle}>VendorAppointmentsList</Text>
            <Text style={styles.navSubtitle}>Manage Products</Text>
            <View style={styles.navAccent} />
          </TouchableOpacity>

           <TouchableOpacity
            onPress={() => navigation.navigate("InsuranceProductCRUD")}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <View style={styles.navIconRing}>
              <Package size={28} color="#D35400" />
            </View>
            <Text style={styles.navTitle}>InsuranceProductCRUD</Text>
            <Text style={styles.navSubtitle}>Manage Products</Text>
            <View style={styles.navAccent} />
          </TouchableOpacity>

       
        </View>
      </View>

      {/* Performance Metrics */}
      {/* <View style={styles.metricsCard}>
        <View style={styles.metricsHeader}>
          <TrendingUp size={24} color="#D35400" />
          <Text style={styles.sectionTitle}>PERFORMANCE METRICS</Text>
        </View>

        {statsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D35400" />
            <Text style={styles.loadingText}>Calibrating Systems...</Text>
          </View>
        ) : (
          <View style={styles.metricsGrid}>
            <View style={styles.metricBlock}>
              <View
                style={[
                  styles.metricIconContainer,
                  { backgroundColor: "#3498DB" },
                ]}
              >
                <ShoppingBag size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.metricValue}>{orders.length}</Text>
              <Text style={styles.metricLabel}>TOTAL ORDERS</Text>
            </View>

            <View style={styles.metricBlock}>
              <View
                style={[
                  styles.metricIconContainer,
                  { backgroundColor: "#F39C12" },
                ]}
              >
                <Clock size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.metricValue}>{pendingOrders}</Text>
              <Text style={styles.metricLabel}>PENDING</Text>
            </View>

            <View style={styles.metricBlockWide}>
              <View
                style={[
                  styles.metricIconContainer,
                  { backgroundColor: "#2ECC71" },
                ]}
              >
                <Wallet size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.metricValueLarge}>
                ₹{netVendorPayout.toFixed(2)}
              </Text>
              <Text style={styles.metricLabel}>ESTIMATED PAYOUT</Text>
              <View style={styles.metricAccentWide} />
            </View>

            {/* Deduction Details Section */}
            {/* <View style={styles.deductionCard}>
              <Text style={styles.deductionTitle}>Deduction Details</Text>
              <View style={styles.deductionRow}>
                <Text style={styles.deductionLabel}>
                  Total Collected (Gross):
                </Text>
                <Text style={[styles.deductionValue, { color: "#333" }]}>
                  ₹{totalGrossRevenue.toFixed(2)}
                </Text>
              </View>
              <View style={styles.deductionRow}>
                <Text style={styles.deductionLabel}>
                  Total Deductions ({TOTAL_DEDUCTION_RATE * 100}%):
                </Text>
                <Text style={styles.deductionValue}>
                  - ₹{totalDeductions.toFixed(2)}
                </Text>
              </View>
              <View style={styles.deductionTotalRow}>
                <Text style={styles.deductionTotalLabel}>Net Payout:</Text>
                <Text style={styles.deductionTotalValue}>
                  ₹{netVendorPayout.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}
      // </View> */} 
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
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
    backgroundColor: "#F2F2F2",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: "#00C851",
  },
  statusOffline: {
    backgroundColor: "#ff4444",
  },
  statusText: {
    fontFamily: "System",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: "System",
    fontSize: 18,
    fontWeight: "700",
    color: "#D35400",
    letterSpacing: 1,
  },
  heroContent: {
    alignItems: "center",
    paddingVertical: 12,
  },
  noStatusText: {
    fontFamily: "System",
    fontSize: 14,
    color: "#757575",
    fontStyle: "italic",
  },
  controlsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "700",
    color: "#D35400",
    letterSpacing: 1.5,
    marginBottom: 20,
    textAlign: "center",
  },
  controlsGrid: {
    gap: 16,
  },
  primaryControl: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
  },
  controlOnline: {
    backgroundColor: "#27AE60",
  },
  controlOffline: {
    backgroundColor: "#E74C3C",
  },
  secondaryControl: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#F8F9F9",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  controlIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  controlTextContainer: {
    flex: 1,
  },
  controlTitle: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  controlSubtitle: {
    fontFamily: "System",
    fontSize: 12,
    fontWeight: "400",
    color: "#F2F2F2",
    marginTop: 2,
  },
  secondaryControlTitle: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "700",
    color: "#D35400",
    letterSpacing: 1,
  },
  secondaryControlSubtitle: {
    fontFamily: "System",
    fontSize: 12,
    fontWeight: "400",
    color: "#757575",
    marginTop: 2,
  },
  navigationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  navigationGrid: {
    flexDirection: "row",
    gap: 16,
  },
  navButton: {
    flex: 1,
    backgroundColor: "#F8F9F9",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  navIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(211, 84, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  navTitle: {
    fontFamily: "System",
    fontSize: 12,
    fontWeight: "700",
    color: "#333333",
    letterSpacing: 1,
    marginBottom: 4,
  },
  navSubtitle: {
    fontFamily: "System",
    fontSize: 10,
    fontWeight: "400",
    color: "#757575",
    textAlign: "center",
  },
  navAccent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#D35400",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  metricsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  metricsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 12,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontFamily: "System",
    fontSize: 14,
    color: "#757575",
    marginTop: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricBlock: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#F8F9F9",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  metricBlockWide: {
    width: "100%",
    backgroundColor: "#F8F9F9",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginTop: 8,
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  metricValue: {
    fontFamily: "System",
    fontSize: 24,
    fontWeight: "700",
    color: "#333333",
    marginBottom: 4,
  },
  metricValueLarge: {
    fontFamily: "System",
    fontSize: 28,
    fontWeight: "700",
    color: "#2ECC71",
    marginBottom: 4,
  },
  metricLabel: {
    fontFamily: "System",
    fontSize: 10,
    fontWeight: "600",
    color: "#757575",
    letterSpacing: 1,
    textAlign: "center",
  },
  metricAccentWide: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#2ECC71",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  deductionCard: {
    width: "100%",
    backgroundColor: "#F8F9F9",
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  deductionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 16,
    textAlign: "center",
  },
  deductionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  deductionLabel: {
    fontSize: 14,
    color: "#555555",
  },
  deductionValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#E74C3C",
  },
  deductionTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#E0E0E0",
  },
  deductionTotalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
  },
  deductionTotalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2ECC71",
  },
});

export default VendorDashboardSidePanel;
