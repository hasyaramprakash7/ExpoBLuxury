// ProductCard.tsx (Updated)
import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Dimensions, ActivityIndicator } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useDispatch, useSelector } from "react-redux";
import { addOrUpdateItem } from "../features/cart/cartSlice"; // Assuming this path

const { width } = Dimensions.get("window");

// --- Color Palette (Re-used from OrderScreen for consistency) ---
const Colors = {
    starbucksGreen: "#00704A",
    starbucksDarkGreen: "#009632",
    starbucksGold: "#FFD700",
    backgroundWhite: "#FFFFFF",
    textDarkBrown: "#4A2C2A",
    textGray: "gray",
    borderGray: "#DDDDDD",
    redAlert: "#DC2626",
    yellowStar: "#F59E0B",
    greenSuccess: "#10B981",
    blueHighlight: "#3498db",
    textLight: "#FFFFFF",
    greenDark: "#00563F",
};

interface Product {
    _id: string;
    name: string;
    price: number;
    discountedPrice?: number;
    stock: number;
    isAvailable: boolean;
    images?: string[];
    companyName?: string;
    brand?: string;
    category?: string;
    location?: string;
    rating?: number;
    numReviews?: number;
    vendorId?: string;
    vendor?: {
        _id: string;
    };
    bulkPrice?: number;
    bulkMinimumUnits?: number;
    largeQuantityPrice?: number;
    largeQuantityMinimumUnits?: number;
}

interface ProductCardProps {
    product: Product;
    isVendorOffline: boolean;
    isVendorOutOfRange: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, isVendorOffline, isVendorOutOfRange }) => {
    const dispatch = useDispatch();
    const cartItem = useSelector((state) => state.cart.items[product?._id]);

    const [quantity, setQuantity] = useState(cartItem?.quantity || 0);
    const [effectivePrice, setEffectivePrice] = useState(product.discountedPrice || product.price);
    const [showQuantityControls, setShowQuantityControls] = useState(false);
    const [displayStock, setDisplayStock] = useState(product.stock);
    const [isAddingToCart, setIsAddingToCart] = useState(false); // For loading spinner

    const PRODUCT_NAME_MAX_LENGTH = 20;

    useEffect(() => {
        setQuantity(cartItem?.quantity || 0);
        setShowQuantityControls((cartItem?.quantity || 0) > 0);
    }, [cartItem]);

    useEffect(() => {
        setDisplayStock(product.stock);
    }, [product.stock]);

    const amountSaved = useMemo(() => {
        if (product.price > 0 && product.discountedPrice && product.discountedPrice < product.price) {
            return (product.price - product.discountedPrice).toFixed(2);
        }
        return 0;
    }, [product.price, product.discountedPrice]);

    const priceTiers = useMemo(() => {
        const tiers = [];
        let bulkMin = product.bulkMinimumUnits || Infinity;
        let largeQtyMin = product.largeQuantityMinimumUnits || Infinity;

        let defaultMax = Math.min(bulkMin, largeQtyMin) - 1;
        if (defaultMax < 1) defaultMax = Infinity;

        tiers.push({
            minQty: 1,
            maxQty: defaultMax,
            price: product.discountedPrice || product.price,
            label: `1 - ${defaultMax === Infinity ? 'max' : defaultMax} pcs`
        });

        if (product.bulkPrice && product.bulkMinimumUnits) {
            let bulkMax = largeQtyMin - 1;
            tiers.push({
                minQty: product.bulkMinimumUnits,
                maxQty: bulkMax,
                price: product.bulkPrice,
                label: `${product.bulkMinimumUnits} - ${bulkMax === Infinity ? 'max' : bulkMax} pcs`
            });
        }

        if (product.largeQuantityPrice && product.largeQuantityMinimumUnits) {
            tiers.push({
                minQty: product.largeQuantityMinimumUnits,
                maxQty: Infinity,
                price: product.largeQuantityPrice,
                label: `>= ${product.largeQuantityMinimumUnits} pcs`
            });
        }

        tiers.sort((a, b) => a.minQty - b.minQty);

        const filteredTiers = tiers.filter(tier => tier.minQty <= tier.maxQty);

        return filteredTiers.map(tier => ({
            ...tier,
            isActive: quantity >= tier.minQty && (tier.maxQty === Infinity || quantity <= tier.maxQty)
        }));
    }, [quantity, product.price, product.discountedPrice, product.bulkPrice, product.bulkMinimumUnits, product.largeQuantityPrice, product.largeQuantityMinimumUnits]);

    useEffect(() => {
        let currentPrice = product.discountedPrice || product.price;
        const activeTier = priceTiers.find(tier =>
            quantity >= tier.minQty && (tier.maxQty === Infinity || quantity <= tier.maxQty)
        );
        if (activeTier) {
            currentPrice = activeTier.price;
        }
        setEffectivePrice(currentPrice);
    }, [quantity, product.price, product.discountedPrice, priceTiers]);

    const showToast = (msg: string, type: "success" | "error" | "info" | "warn") => {
        Alert.alert(
            type.charAt(0).toUpperCase() + type.slice(1),
            msg,
            [{ text: "OK" }],
            { cancelable: true }
        );
    };

    const handleCartAction = async (newQty: number) => {
        if (isVendorOffline) {
            showToast("Vendor is currently offline. Cannot add products from this shop.", "error");
            return;
        }
        if (isVendorOutOfRange) {
            showToast("Vendor is out of your delivery range. Cannot add products from this shop.", "error");
            return;
        }

        if (newQty < 0) {
            showToast("Quantity cannot be negative.", "error");
            return;
        }
        if (newQty > displayStock) {
            showToast(`Cannot add more than available stock (${displayStock})`, "error");
            return;
        }

        setIsAddingToCart(true);
        try {
            await dispatch(addOrUpdateItem({
                productId: product._id,
                quantity: newQty,
                price: effectivePrice,
                vendorId: product.vendorId,
            })).unwrap();

            if (newQty === 0) {
                showToast(`Removed ${product.name} from cart.`, "success");
            } else if (!cartItem || cartItem.quantity === 0) {
                showToast(`Added ${newQty} x ${product.name} to cart!`, "success");
            } else {
                showToast(`Updated cart: ${newQty} x ${product.name}`, "success");
            }
            setQuantity(newQty); // Update local state based on successful dispatch
            setShowQuantityControls(newQty > 0);
        } catch (error: any) {
            console.error("Failed to update cart:", error);
            showToast(error.message || "Failed to update item in cart. Please try again.", "error");
        } finally {
            setIsAddingToCart(false);
        }
    };

    const handleQuantityChange = (type: 'increment' | 'decrement') => {
        let newQty = quantity;
        if (type === 'increment') {
            newQty += 1;
            if (newQty > displayStock) {
                showToast(`Max stock reached (${displayStock})`, "info");
                return;
            }
        } else {
            newQty -= 1;
            if (newQty < 0) {
                newQty = 0;
            }
        }
        handleCartAction(newQty);
    };

    const isDisabled = isVendorOffline || isVendorOutOfRange || displayStock === 0;

    const truncatedProductName = product.name.length > PRODUCT_NAME_MAX_LENGTH
        ? `${product.name.substring(0, PRODUCT_NAME_MAX_LENGTH)}...`
        : product.name;

    return (
        <View style={[
            productCardStyles.cardContainer,
            isDisabled && productCardStyles.cardDisabled
        ]}>
            {/* Left Section: Product Details */}
            <View style={productCardStyles.detailsContainer}>
                <TouchableOpacity style={productCardStyles.productLink}>
                    <Text style={productCardStyles.productName}>{truncatedProductName}</Text>
                    {product.companyName && <Text style={productCardStyles.detailText}>{product.companyName}</Text>}
                    {product.brand && <Text style={productCardStyles.detailText}>Brand: {product.brand}</Text>}
                    {product.location && <Text style={productCardStyles.detailText}>📍 {product.location}</Text>}
                    {product.rating !== undefined && (
                        <View style={productCardStyles.ratingContainer}>
                            <Ionicons name="star" size={12} color={Colors.yellowStar} />
                            <Text style={productCardStyles.detailText}>{product.rating.toFixed(1)} {product.numReviews ? `(${product.numReviews})` : ''}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={productCardStyles.bottomDetails}>
                    {/* Stock Info */}
                    <View style={productCardStyles.stockContainer}>
                        {displayStock > 0 ? (
                            displayStock <= 10 ? (
                                <Text style={productCardStyles.stockLimited}>
                                    Limited! ({displayStock} in stock)
                                </Text>
                            ) : (
                                <View style={productCardStyles.stockAvailable}>
                                    <Ionicons name="checkmark-circle" size={12} color={Colors.greenSuccess} />
                                    <Text style={productCardStyles.stockAvailableText}>Avail: {displayStock} in stock</Text>
                                </View>
                            )
                        ) : (
                            <View style={productCardStyles.stockUnavailable}>
                                <Ionicons name="close-circle" size={12} color={Colors.redAlert} />
                                <Text style={productCardStyles.stockUnavailableText}>Unavail.</Text>
                            </View>
                        )}
                    </View>

                    {/* Price Tier Display */}
                    {priceTiers.length > 0 && (
                        <View style={productCardStyles.priceTiersContainer}>
                            {priceTiers.map((tier, index) => (
                                <View key={index} style={[
                                    productCardStyles.priceTier,
                                    tier.isActive && productCardStyles.priceTierActive
                                ]}>
                                    <Text style={[productCardStyles.priceTierLabel, tier.isActive && productCardStyles.priceTierLabelActive]}>
                                        {tier.label}
                                    </Text>
                                    <Text style={[productCardStyles.priceTierPrice, tier.isActive && productCardStyles.priceTierPriceActive]}>
                                        ₹{tier.price.toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Add to Cart / Quantity Controls */}
                    {isDisabled ? (
                        <View style={productCardStyles.disabledButton}>
                            <Text style={productCardStyles.disabledButtonText}>
                                {displayStock === 0 ? "Out of Stock" : (isVendorOffline ? "Vendor Offline" : "Out of Range")}
                            </Text>
                        </View>
                    ) : (
                        showQuantityControls ? (
                            <View style={productCardStyles.quantityControls}>
                                {cartItem?.quantity > 0 && (
                                    <View style={productCardStyles.addedToCartMessage}>
                                        <Ionicons name="checkmark-circle" size={12} color={Colors.textLight} />
                                        <Text style={productCardStyles.addedToCartText}>Added ({cartItem.quantity})</Text>
                                    </View>
                                )}
                                <View style={productCardStyles.quantityButtonsContainer}>
                                    <TouchableOpacity
                                        onPress={() => handleQuantityChange('decrement')}
                                        disabled={quantity <= 0 || isAddingToCart}
                                        style={[productCardStyles.quantityButton, productCardStyles.quantityButtonLeft, (quantity <= 0 || isAddingToCart) && productCardStyles.quantityButtonDisabled]}
                                    >
                                        <Ionicons name="remove" size={14} color={Colors.textLight} />
                                    </TouchableOpacity>
                                    <View style={productCardStyles.quantityDisplay}>
                                        {isAddingToCart ? (
                                            <ActivityIndicator size="small" color={Colors.starbucksGreen} />
                                        ) : (
                                            <Text style={productCardStyles.quantityText}>{quantity}</Text>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleQuantityChange('increment')}
                                        disabled={quantity >= displayStock || isAddingToCart}
                                        style={[productCardStyles.quantityButton, productCardStyles.quantityButtonRight, (quantity >= displayStock || isAddingToCart) && productCardStyles.quantityButtonDisabled]}
                                    >
                                        <Ionicons name="add" size={14} color={Colors.textLight} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => handleCartAction(1)}
                                disabled={!product.isAvailable || displayStock === 0 || isAddingToCart}
                                style={[
                                    productCardStyles.addToCartButton,
                                    (!product.isAvailable || displayStock === 0 || isAddingToCart) && productCardStyles.addToCartButtonDisabled
                                ]}
                            >
                                {isAddingToCart ? (
                                    <ActivityIndicator size="small" color={Colors.textLight} style={{ marginRight: 5 }} />
                                ) : (
                                    <Ionicons name="cart" size={14} color={Colors.textLight} style={{ marginRight: 5 }} />
                                )}
                                <Text style={productCardStyles.addToCartButtonText}>Add to Cart</Text>
                            </TouchableOpacity>
                        )
                    )}
                </View>
            </View>

            {/* Right Section: Product Image and Price */}
            <TouchableOpacity style={productCardStyles.imageContainer}>
                <View style={productCardStyles.imageWrapper}>
                    {product.images && product.images.length > 0 ? (
                        <Image
                            source={{ uri: product.images[0] }} // Display first image only
                            style={productCardStyles.productImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={productCardStyles.noImage}>
                            <Ionicons name="image-outline" size={30} color={Colors.textGray} />
                            <Text style={productCardStyles.noImageText}>No Image</Text>
                        </View>
                    )}

                    {isVendorOffline && (
                        <View style={productCardStyles.overlay}>
                            <Text style={productCardStyles.overlayText}>Vendor Offline</Text>
                        </View>
                    )}

                    {isVendorOutOfRange && !isVendorOffline && (
                        <View style={[productCardStyles.overlay, productCardStyles.overlayRed]}>
                            <Text style={productCardStyles.overlayText}>Out of Range</Text>
                        </View>
                    )}

                    {amountSaved > 0 && (
                        <View style={productCardStyles.saveTag}>
                            <Text style={productCardStyles.saveTagText}>Save ₹{amountSaved}</Text>
                        </View>
                    )}

                    <View style={productCardStyles.priceDisplay}>
                        <Text style={productCardStyles.priceDisplayText}>₹{effectivePrice.toFixed(2)}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const productCardStyles = StyleSheet.create({
    cardContainer: {
        flexDirection: "row",
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 12,
        margin: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        overflow: "hidden",
        // Adjusted width to make cards appear one by one
        width: width - 20, // This makes the card take up full width minus a bit of margin
        height: width * 0.55, // Adjusted height proportionally
    },
    cardDisabled: {
        opacity: 0.7,
        backgroundColor: Colors.borderGray,
    },
    detailsContainer: {
        flex: 3, // 3/5 width for details
        padding: 8,
        justifyContent: "space-between",
    },
    productLink: {
        marginBottom: 5,
    },
    productName: {
        fontSize: 13, // Adjusted font size
        fontWeight: "bold",
        color: Colors.textDarkBrown,
        marginBottom: 3,
    },
    detailText: {
        fontSize: 9, // Smaller font size for details
        color: Colors.textGray,
        lineHeight: 12, // Tighter line height
    },
    ratingContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
    },
    bottomDetails: {
        flexGrow: 1,
        justifyContent: "flex-end",
    },
    stockContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    stockLimited: {
        fontSize: 9,
        fontWeight: "600",
        color: Colors.redAlert,
    },
    stockAvailable: {
        flexDirection: "row",
        alignItems: "center",
    },
    stockAvailableText: {
        fontSize: 9,
        fontWeight: "600",
        color: Colors.greenSuccess,
        marginLeft: 2,
    },
    stockUnavailable: {
        flexDirection: "row",
        alignItems: "center",
    },
    stockUnavailableText: {
        fontSize: 9,
        fontWeight: "600",
        color: Colors.redAlert,
        marginLeft: 2,
    },
    priceTiersContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        marginTop: 5,
        marginBottom: 5,
        gap: 3, // Smaller gap
    },
    priceTier: {
        flexDirection: "column",
        alignItems: "center",
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: Colors.borderGray,
    },
    priceTierActive: {
        backgroundColor: Colors.greenDark,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 1,
    },
    priceTierLabel: {
        fontSize: 8, // Very small font
        color: Colors.textDarkBrown,
    },
    priceTierLabelActive: {
        color: Colors.greenSuccess, // A lighter green for active label
    },
    priceTierPrice: {
        fontSize: 12, // Larger for price
        fontWeight: "bold",
        color: Colors.starbucksGreen,
    },
    priceTierPriceActive: {
        color: Colors.textLight,
    },
    addToCartButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.starbucksGreen,
        borderRadius: 8,
        paddingVertical: 8,
        marginTop: 5,
    },
    addToCartButtonDisabled: {
        backgroundColor: Colors.borderGray,
        opacity: 0.6,
    },
    addToCartButtonText: {
        color: Colors.textLight,
        fontSize: 12,
        fontWeight: "bold",
    },
    disabledButton: {
        backgroundColor: Colors.borderGray,
        borderRadius: 8,
        paddingVertical: 8,
        marginTop: 5,
        alignItems: "center",
        justifyContent: "center",
    },
    disabledButtonText: {
        color: Colors.textGray,
        fontSize: 12,
        fontWeight: "bold",
    },
    quantityControls: {
        marginTop: 5,
        alignItems: "center",
    },
    addedToCartMessage: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.greenDark,
        borderRadius: 8,
        paddingVertical: 5,
        marginBottom: 5,
        width: "100%",
    },
    addedToCartText: {
        color: Colors.textLight,
        fontSize: 10,
        fontWeight: "bold",
        marginLeft: 5,
    },
    quantityButtonsContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: Colors.greenDark,
        borderRadius: 20,
        overflow: "hidden",
        width: "100%",
        height: 30, // Fixed height for quantity controls
    },
    quantityButton: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 5,
        backgroundColor: Colors.starbucksGreen,
        height: "100%",
    },
    quantityButtonLeft: {
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    quantityButtonRight: {
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
    },
    quantityButtonDisabled: {
        opacity: 0.5,
    },
    quantityDisplay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.backgroundWhite,
        height: "100%",
    },
    quantityText: {
        fontSize: 14,
        fontWeight: "bold",
        color: Colors.textDarkBrown,
    },
    imageContainer: {
        flex: 2, // 2/5 width for image
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
        overflow: "hidden",
    },
    imageWrapper: {
        width: "100%",
        height: "100%",
        position: "relative",
    },
    productImage: {
        width: "100%",
        height: "100%",
    },
    noImage: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: Colors.borderGray,
    },
    noImageText: {
        fontSize: 10,
        color: Colors.textGray,
        marginTop: 5,
    },
    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 12, // Match card border radius
    },
    overlayRed: {
        backgroundColor: "rgba(220, 38, 38, 0.6)", // RedAlert with opacity
    },
    overlayText: {
        color: Colors.textLight,
        fontWeight: "bold",
        fontSize: 14,
        textAlign: "center",
    },
    saveTag: {
        position: "absolute",
        top: 5,
        left: 5,
        backgroundColor: Colors.starbucksGold, // Using Starbucks Gold for Save Tag
        borderRadius: 15,
        paddingHorizontal: 8,
        paddingVertical: 3,
        zIndex: 10,
    },
    saveTagText: {
        color: Colors.textLight,
        fontSize: 9,
        fontWeight: "bold",
    },
    priceDisplay: {
        position: "absolute",
        bottom: 5,
        left: 5,
        right: 5,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 8,
        paddingVertical: 3,
        alignItems: "center",
    },
    priceDisplayText: {
        color: Colors.textLight,
        fontSize: 15,
        fontWeight: "bold",
    },
});

export default ProductCard;
