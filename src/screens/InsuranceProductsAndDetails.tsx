import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { fetchAllInsuranceProducts } from "../features/insuranceSlice";
import { fetchUserAppointments } from "../features/appointmentSlice";

import ProductGridScreen from "../components/ProductGridScreen";

// --- Import the brand logo image from your assets folder ---
import brandLogo from "../../assets/Gemini_Generated_Image_an9bnuan9bnuan9b.png"

// --- Type Definitions (kept here for clarity) ---
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
    (state: State) => state.insurance
  );
  const { loading: appointmentLoading, userAppointments } = useSelector(
    (state: State) => state.appointments
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

    // Add "My Appointments" to the end of the list
    uniqueList.push({
      name: "My Appointments",
      imageUrl: "https://cdn-icons-png.flaticon.com/512/3201/3201402.png",
    });

    return uniqueList;
  }, [products]);

  // Set the first category when products are loaded
  useEffect(() => {
    if (products.length > 0 && !selectedCategory) {
      setSelectedCategory(uniqueCategories[0].name);
    }
  }, [products, selectedCategory, uniqueCategories]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory || selectedCategory === "My Appointments") return [];
    return products.filter(
      (product) => product.categories?.level1?.name === selectedCategory
    );
  }, [products, selectedCategory]);

  if (loading || appointmentLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => {}}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <ProductGridScreen
        uniqueCategories={uniqueCategories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        filteredProducts={filteredProducts}
        userAppointments={userAppointments}
        // --- Pass the brand logo as a prop here ---
        brandLogo={brandLogo}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    paddingTop: 30,
    backgroundColor: "#F8F5F0",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  loadingText: {
    fontSize: 18,
    color: "#4b5563",
    marginTop: 10,
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    marginBottom: 10,
    textAlign: "center",
  },
  goBackButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  goBackButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default InsuranceProductsAndDetails;
