import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { fetchAllInsuranceProducts } from "../features/insuranceSlice";
import { fetchUserAppointments } from "../features/appointmentSlice";
import ProductGridScreen from "../components/ProductGridScreen";
import Ionicons from "react-native-vector-icons/Ionicons";

// --- Import the brand logo image ---
import brandLogo from "../../assets/b4.jpg";

// --- Design Constants ---
const PRIMARY_COLOR = "#0A3D2B"; // Deep Corporate Green
const BACKGROUND_COLOR = "#F8F5F0"; // Premium Cream Background
const CARD_COLOR = "#FFFFFF";

// --- External URL ---
const EXTERNAL_APPOINTMENT_URL =
  "https://pentakotahashyaramprakash.tataaiapartner.com/site/?camp_id=S0RNMlNUVXRKRlV4THpOVVlBcGdDZz09&content=Social&channel_type=WhatsApp&pid=S0RNMlNURXNSRmxLTlROZ1lBcGdDZz09";

// --- Type Definitions ---
interface Appointment {
  _id: string;
  insuranceProductId?: {
    _id: string;
    name: string;
    mainImage?: string;
  };
  vendorId?: {
    name: string;
  };
  createdAt: string;
}

interface InsuranceProduct {
  _id: string;
  name: string;
  description: string;
  mainImage?: string;
  otherImages?: string[];
  badgeText?: string;
  options?: {
    isNew?: boolean;
    isPopular?: boolean;
    isAwardWinning?: boolean;
  };
  contactNumber?: string;
  executiveContact?: {
    pointOfContact: string;
    phoneNumber: string;
  };
  categories?: {
    level1: { name: string };
    level2: { name: string };
    level3: { name: string };
  };
  vendorId: {
    _id: string;
    name: string;
  };
}

interface State {
  insurance: {
    products: InsuranceProduct[];
    currentProduct: InsuranceProduct | null;
    loading: boolean;
    error: string | null;
  };
  appointments: {
    loading: boolean;
    userAppointments: Appointment[];
  };
  auth: {
    user: {
      _id: string;
    } | null;
  };
}

const InsuranceProductsAndDetails = () => {
  const dispatch = useDispatch();
  const [selectedCategory, setSelectedCategory] = useState<
    string | "My Appointments" | null
  >(null);

  const { products, loading, error } = useSelector(
    (state: State) => state.insurance,
  );
  const { loading: appointmentLoading, userAppointments } = useSelector(
    (state: State) => state.appointments,
  );
  const currentUser = useSelector((state: State) => state.auth.user);
  const currentUserId = currentUser?._id;

  useEffect(() => {
    dispatch(fetchAllInsuranceProducts() as any);
  }, [dispatch]);

  useEffect(() => {
    if (currentUserId) {
      dispatch(fetchUserAppointments(currentUserId) as any);
    }
  }, [dispatch, currentUserId]);

  // --- Handlers ---
  const handleGeneralSchedule = async () => {
    try {
      const supported = await Linking.canOpenURL(EXTERNAL_APPOINTMENT_URL);
      if (supported) {
        await Linking.openURL(EXTERNAL_APPOINTMENT_URL);
      } else {
        Alert.alert(
          "Link Error",
          "We couldn't open the scheduling page. Please try again later.",
        );
      }
    } catch (err) {
      Alert.alert(
        "Error",
        "An unexpected error occurred while trying to connect.",
      );
    }
  };

  const uniqueCategories = useMemo(() => {
    const categoriesMap = new Map<
      string,
      { name: string; imageUrl?: string }
    >();
    products.forEach((product) => {
      const categoryName = product.categories?.level1?.name;
      if (categoryName && !categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          name: categoryName,
          imageUrl: product.mainImage,
        });
      }
    });

    const uniqueList = Array.from(categoriesMap.values());
    uniqueList.push({
      name: "My Appointments",
      imageUrl: "https://cdn-icons-png.flaticon.com/512/3201/3201402.png",
    });

    return uniqueList;
  }, [products]);

  useEffect(() => {
    if (products.length > 0 && !selectedCategory) {
      setSelectedCategory(uniqueCategories[0].name);
    }
  }, [products, selectedCategory, uniqueCategories]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory || selectedCategory === "My Appointments") return [];
    return products.filter(
      (product) => product.categories?.level1?.name === selectedCategory,
    );
  }, [products, selectedCategory]);

  if (loading || appointmentLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Syncing Premium Policies...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => dispatch(fetchAllInsuranceProducts() as any)}
        >
          <Text style={styles.retryButtonText}>Retry Loading</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* The Schedule Button is placed inside the ProductGridScreen 
        or right above it. I've styled it to appear as a "Top Action" bar.
      */}
      <View style={styles.topActionContainer}>
        <TouchableOpacity
          style={styles.scheduleHeaderButton}
          onPress={handleGeneralSchedule}
          activeOpacity={0.85}
        >
          <View style={styles.scheduleIconWrapper}>
            <Ionicons name="calendar-number" size={22} color={PRIMARY_COLOR} />
          </View>
          <View style={styles.scheduleTextWrapper}>
            <Text style={styles.scheduleTitleText}>Need Expert Advice?</Text>
            <Text style={styles.scheduleSubText}>
              Schedule a free 1-on-1 consultation
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      <ProductGridScreen
        uniqueCategories={uniqueCategories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        filteredProducts={filteredProducts}
        userAppointments={userAppointments}
        brandLogo={brandLogo}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    paddingTop: 30,
    backgroundColor: BACKGROUND_COLOR,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 15,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    marginVertical: 15,
    textAlign: "center",
    paddingHorizontal: 30,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  // --- Top Schedule Bar Styles ---
  topActionContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 5,
  },
  scheduleHeaderButton: {
    backgroundColor: CARD_COLOR,
    borderRadius: 15,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  scheduleIconWrapper: {
    backgroundColor: "#E6F0EB",
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  scheduleTextWrapper: {
    flex: 1,
    marginLeft: 15,
  },
  scheduleTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  scheduleSubText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
});

export default InsuranceProductsAndDetails;
