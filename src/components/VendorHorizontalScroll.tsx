// src/components/VendorHorizontalScroll.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import config from '../../src/config/config';
import NewProductCard from "../components/NewProductCard10";

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;                // for properties & rentals
const PRODUCT_CARD_WIDTH = width;              // full width for products

interface VendorHorizontalScrollProps {
  vendorId: string;
  vendorName: string;
  isVendorOffline?: boolean;
  onSeeAll?: () => void;                       // <-- NEW: custom handler for See All
}

interface DisplayItem {
  id: string;
  type: 'property' | 'rental' | 'product';
  title: string;
  image: string;
  price: string;
  subtitle?: string;
  productData?: any;
}

export const VendorHorizontalScroll: React.FC<VendorHorizontalScrollProps> = ({
  vendorId,
  vendorName,
  isVendorOffline = false,
  onSeeAll,
}) => {
  if (!vendorId || !vendorName) {
    console.warn('⚠️ VendorHorizontalScroll: Missing vendorId or vendorName');
    return null;
  }

  const navigation = useNavigation();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchVendorData = async () => {
      try {
        const baseUrl = config.apiUrl;

        const [propertiesRes, rentalsRes, productsRes] = await Promise.all([
          axios.get(`${baseUrl}/v1/properties`, {
            params: { 'vendor.vendorId': vendorId, limit: 10 },
          }),
          axios.get(`${baseUrl}/v1/rentals`, {
            params: { vendorId, limit: 10 },
          }),
          axios.get(`${baseUrl}/vendor-products/vendor/${vendorId}?limit=10`),
        ]);

        const combined: DisplayItem[] = [];

        // Properties
        (propertiesRes.data.data || []).forEach((p: any) => {
          combined.push({
            id: p._id,
            type: 'property',
            title: p.title,
            image: p.images?.[0] || 'https://via.placeholder.com/300',
            price: `₹${p.minPriceCr}Cr - ₹${p.maxPriceCr}Cr`,
            subtitle: `${p.propertyType} • ${p.configuration?.bhk || ''}`,
          });
        });

        // Rentals
        (rentalsRes.data.data || []).forEach((r: any) => {
          combined.push({
            id: r._id,
            type: 'rental',
            title: r.title,
            image: r.images?.[0] || 'https://via.placeholder.com/300',
            price: `₹${r.monthlyRent}/mo`,
            subtitle: `${r.rentalType} • ${r.bedrooms || 0} BHK`,
          });
        });

        // Products – store full product object
        (productsRes.data.products || []).forEach((prod: any) => {
          combined.push({
            id: prod._id,
            type: 'product',
            title: prod.name,
            image: prod.images?.[0] || 'https://via.placeholder.com/300',
            price: `₹${prod.price}`,
            subtitle: prod.category || prod.brandName || '',
            productData: prod,
          });
        });

        if (isMounted) {
          setItems(combined);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching vendor data:', err);
        if (isMounted) {
          setError('Failed to load listings');
          setLoading(false);
        }
      }
    };

    fetchVendorData();

    return () => {
      isMounted = false;
    };
  }, [vendorId]);

  const handleItemPress = (item: DisplayItem) => {
    if (item.type === 'product') return;
    switch (item.type) {
      case 'property':
        navigation.navigate('PropertyDetailScreen', { propertyId: item.id });
        break;
      case 'rental':
        navigation.navigate('RentalDetail', { rentalId: item.id });
        break;
      default:
        break;
    }
  };

  const handleSeeAll = () => {
    if (onSeeAll) {
      onSeeAll();
    } else {
      navigation.navigate('VendorListings', { vendorId });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#006039" />
        <Text style={styles.loadingText}>Loading {vendorName}'s listings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>⚠️ {error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No listings available for {vendorName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{vendorName} – All Listings</Text>
        <TouchableOpacity onPress={handleSeeAll}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View> */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item) => {
          // ----- Product: full‑width card (same as ShopDetails) -----
          if (item.type === 'product' && item.productData) {
            return (
              <View key={`${item.type}-${item.id}`} style={styles.productCardWrapper}>
                <NewProductCard
                  product={item.productData}
                  isVendorOffline={isVendorOffline}
                />
              </View>
            );
          }

          // ----- Property / Rental: smaller card (70% width) -----
          return (
            <TouchableOpacity
              key={`${item.type}-${item.id}`}
              style={styles.card}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: item.image }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <View style={styles.cardOverlay}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {item.type.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
                <Text style={styles.cardPrice}>{item.price}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#006039',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  // ---- Property / Rental cards ----
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#E5E7EB',
  },
  cardOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  typeBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#006039',
  },
  // ---- Product card wrapper - full width, same padding as ShopDetails ----
  productCardWrapper: {
    width: PRODUCT_CARD_WIDTH,                // full screen width
    paddingHorizontal: 20,                   // matches infoContainer padding in ShopDetails
    marginHorizontal: 0,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
});

export default VendorHorizontalScroll;