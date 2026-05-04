import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ViewStyle, TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Define the shape of the shop object passed to the card
interface ShopProduct {
    imageUrl: string;
}

interface ShopAddress {
    city?: string;
    state?: string;
    postalCode?: string;
    fullAddress?: string;
}

interface ShopData {
    id: string;
    name: string;
    shopImageUrl?: string;
    distance?: number;
    address?: ShopAddress; // Keeping interface but removing usage for clarity
    products?: ShopProduct[];
}

interface ShopCardProps {
    shop: ShopData;
    onPress: (shop: ShopData) => void;
}

const Colors = {
    white: "#FFFFFF",
    grayText: "#777777", // Slightly darker gray for better contrast
    dark: "#0a0a09ff",
    borderGray: "#EEEEEE", // Lighter border for premium feel
    greenDark: "#0A3D2B", 
    lightgreen: "#c7e6dbff", 
    orange: "#FF6600",
};

const PLACEHOLDER_PRODUCT_IMAGES = [
    'https://via.placeholder.com/50/a5c4ec?text=P1',
    'https://via.placeholder.com/50/d0e0ed?text=P2',
    'https://via.placeholder.com/50/f0d7d7?text=P3',
];

const ShopCard: React.FC<ShopCardProps> = ({ shop, onPress }) => {
    const products = shop.products || [];
    const displayedProducts = products
        .slice(0, 3)
        .map((p, index) => ({ 
            uri: p.imageUrl || PLACEHOLDER_PRODUCT_IMAGES[index] 
        }));
    
    // Address logic removed as requested.

    return (
        <TouchableOpacity style={styles.cardContainer} onPress={() => onPress(shop)} activeOpacity={0.8}>
            
            {/* Header Section: Avatar, Name, Badge, and Distance */}
            <View style={styles.header}>
                {/* Left Side: Avatar & Name */}
                <View style={styles.shopInfo}>
                    <Image
                        source={{ uri: shop.shopImageUrl || 'https://via.placeholder.com/60/ccc' }}
                        style={styles.avatar}
                    />
                    <View style={styles.shopNameAndBadge}>
                        <Text style={styles.shopName} numberOfLines={1}>
                            @{shop.name}.collections
                        </Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>Local Seller</Text>
                        </View>
                    </View>
                </View>

                {/* Right Side: Distance */}
                <View style={styles.distanceContainer}>
                    <Ionicons name="compass-outline" size={16} color={Colors.greenDark} />
                    <Text style={styles.distanceText}>
                        {shop.distance ? `${shop.distance.toFixed(1)} km` : 'Near'}
                    </Text>
                </View>
            </View>

            {/* --- Product Previews and Call to Action --- */}
            <View style={styles.productsRow}>
                
                {/* Product Images (Mini-Thumbnails) */}
                <View style={styles.productImagesContainer}>
                    {displayedProducts.map((img, index) => (
                        <Image
                            key={index}
                            source={img}
                            style={styles.productImage}
                            resizeMode="cover"
                        />
                    ))}
                    {products.length > 3 && (
                        <View style={styles.moreProductsOverlay}>
                            <Text style={styles.moreProductsText}>+{products.length - 3}</Text>
                        </View>
                    )}
                </View>

                {/* Luxury "View Collection" Button */}
                <TouchableOpacity style={styles.viewCollectionButton} onPress={() => onPress(shop)} activeOpacity={0.9}>
                    <Text style={styles.viewCollectionButtonText}>View Collection</Text>
                    <Ionicons name="arrow-forward-sharp" size={16} color={Colors.white} style={{ marginLeft: 5 }} />
                </TouchableOpacity>
            </View>

            {/* Product Count Footer (Cleanly placed at the bottom) */}
            <View style={styles.footerRow}>
                <Text style={styles.productsCountText}>
                    Total Products: <Text style={styles.productsCountNumber}>{products.length}</Text>
                </Text>
            </View>

        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        backgroundColor: Colors.white,
        borderRadius: 12, // More rounded corners
        padding: 18,
        marginHorizontal: 2,
        shadowColor: Colors.dark,
        shadowOffset: { width: 0, height: 4 }, // Elevated shadow
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 6,
        borderWidth: 1,
        borderColor: Colors.borderGray,
    } as ViewStyle,
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 15,
        borderBottomWidth: 1, // Separator for header
        borderBottomColor: Colors.borderGray,
    } as ViewStyle,
    shopInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    } as ViewStyle,
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 10,
        backgroundColor: Colors.borderGray,
    },
    shopNameAndBadge: {
        flexShrink: 1,
    } as ViewStyle,
    shopName: {
        fontSize: 18, // Slightly larger
        fontWeight: '700', // Bolder name
        color: Colors.dark,
    } as TextStyle,
    badge: {
        backgroundColor: Colors.lightgreen,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
        alignSelf: 'flex-start',
        marginTop: 4,
    } as ViewStyle,
    badgeText: {
        color: Colors.greenDark, // Using the dark green on the light green badge
        fontSize: 10,
        fontWeight: '700',
    } as TextStyle,
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: '#F5FFF9', // Very light background for distance
        borderWidth: 1,
        borderColor: Colors.lightgreen, 
    } as ViewStyle,
    distanceText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.greenDark,
        marginLeft: 4,
    } as TextStyle,

    // Product Row and CTA (New Layout)
    productsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15,
    } as ViewStyle,
    productImagesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    } as ViewStyle,
    productImage: {
        width: 55,
        height: 55,
        borderRadius: 10,
        marginLeft: -10, // Overlap effect
        borderWidth: 2,
        borderColor: Colors.white,
        shadowColor: Colors.dark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        backgroundColor: Colors.borderGray, // Fallback color
    },
    moreProductsOverlay: {
        width: 55,
        height: 55,
        borderRadius: 10,
        marginLeft: -10,
        backgroundColor: Colors.greenDark,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.white,
    } as ViewStyle,
    moreProductsText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: 16,
    } as TextStyle,
    viewCollectionButton: {
        backgroundColor: Colors.greenDark,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
    } as ViewStyle,
    viewCollectionButtonText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: '600',
    } as TextStyle,

    // Footer
    footerRow: {
        borderTopWidth: 1,
        borderTopColor: Colors.borderGray,
        paddingTop: 10,
    } as ViewStyle,
    productsCountText: {
        fontSize: 14,
        color: Colors.grayText,
        fontWeight: '400',
    } as TextStyle,
    productsCountNumber: {
        fontWeight: '600',
        color: Colors.dark,
    } as TextStyle,

});

export default ShopCard;