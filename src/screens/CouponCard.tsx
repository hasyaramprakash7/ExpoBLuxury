// src/components/CouponSection.tsx

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import CouponCard from './CouponCard'; // Assuming CouponCard is available

const { width } = Dimensions.get('window');

// --- Reused Color Palette from CartScreen ---
const Colors = {
    primaryGreen: "#00704A", 
    darkText: "#2C3E50",
    grayText: "#95A5A6",
    lightGray: "#ECF0F1",
    redAlert: "#C0392B",
    deepGreen: "#014421",
    white: "#FFFFFF",
    softGray: "#F4F7F9",
    mediumGray: "#BDC3C7",
    blueHighlight: "#3498DB",
};

// --- Type Definitions for internal data ---
interface AvailableCoupon {
    code: string;
    discountAmount: number; // Flat discount amount
    offerDescription: string;
    usageInfo: string;
    isMaxedOut?: boolean;
}

interface CouponSectionProps {
    couponCode: string; // Currently applied code
    couponDiscount: number; // Currently applied discount amount
    isCouponApplied: boolean;
    initialDiscountedSubtotal: number; // For validation logic
    handleApplyCoupon: (code: string, discountAmount: number) => void;
    handleClearCoupon: () => void;
}

// --- DEMO COUPON DATA ---
const DEMO_COUPONS: AvailableCoupon[] = [
    {
        code: "SHIPFREE",
        discountAmount: 0, // This is a free delivery coupon, discount applied elsewhere
        offerDescription: "Get Free Delivery on this order.",
        usageInfo: "No minimum purchase required. Applies to delivery charges.",
    },
    {
        code: "WELCOME250",
        discountAmount: 250,
        offerDescription: "Flat ₹250 OFF for new users.",
        usageInfo: "Min. order ₹1000. Valid once per user.",
    },
    {
        code: "FLAT600",
        discountAmount: 600,
        offerDescription: "Flat ₹600 OFF on orders above ₹2000.",
        usageInfo: "Min. order ₹2800. Check eligibility in Cart.",
    },
    {
        code: "MAXEDOUT",
        discountAmount: 0,
        offerDescription: "Special limited-time offer.",
        usageInfo: "This coupon has reached its usage limit.",
        isMaxedOut: true,
    },
];

const CouponSection: React.FC<CouponSectionProps> = ({
    couponCode,
    isCouponApplied,
    initialDiscountedSubtotal,
    handleApplyCoupon,
    handleClearCoupon,
}) => {
    const [manualCode, setManualCode] = useState('');

    // 💡 CRITICAL: Sorting Logic to ensure applied card comes first
    const sortedCoupons = useMemo(() => {
        const list = [...DEMO_COUPONS]; // Create a mutable copy

        list.sort((a, b) => {
            const aIsApplied = isCouponApplied && a.code === couponCode;
            const bIsApplied = isCouponApplied && b.code === couponCode;

            // Applied coupon (true) comes before non-applied (false)
            if (aIsApplied && !bIsApplied) return -1;
            if (!aIsApplied && bIsApplied) return 1;

            // Secondary sort: Applied comes before expired
            if (!aIsApplied && !a.isMaxedOut && b.isMaxedOut) return -1;
            if (!aIsApplied && a.isMaxedOut && !b.isMaxedOut) return 1;

            // Default order
            return 0;
        });

        return list;
    }, [isCouponApplied, couponCode]);
    
    // --- Manual Code Handler ---
    const handleManualApply = () => {
        const code = manualCode.trim().toUpperCase();
        const coupon = DEMO_COUPONS.find(c => c.code === code);

        if (!code) {
            // Check if user is removing the currently applied coupon
             if (isCouponApplied) {
                 handleClearCoupon();
             } else {
                 // Nothing to apply and nothing to clear
                 // Show a gentle error
             }
             return;
        }

        if (coupon) {
            if (coupon.isMaxedOut) {
                 // Already handled by the card visual, but for manual input:
                 alert("This coupon has expired or reached its limit.");
                 return;
            }
            // Logic handled by CartScreen.tsx via handleApplyCoupon:
            // 1. Checks if current code is FLAT200 and subtotal is < 2000
            // 2. Clears existing coupon if needed
            handleApplyCoupon(coupon.code, coupon.discountAmount);
            setManualCode('');
        } else {
            alert("Invalid coupon code entered.");
        }
    };

    const isManualApplyButtonDisabled = manualCode.trim() === '' && !isCouponApplied;

    return (
        <View style={sectionStyles.container}>
            <View style={sectionStyles.headerRow}>
                <Ionicons name="pricetag" size={width * 0.05} color={Colors.darkText} />
                <Text style={sectionStyles.headerTitle}>Available Offers</Text>
            </View>

            {/* 1. Horizontal Scroll View for Coupon Cards */}
            <ScrollView 
                horizontal={true} 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={sectionStyles.cardScrollContent}
            >
                {sortedCoupons.map((coupon) => (
                    <CouponCard
                        key={coupon.code}
                        code={coupon.code}
                        discount={coupon.discountAmount}
                        usageInfo={coupon.usageInfo}
                        offerDescription={coupon.offerDescription}
                        isApplied={isCouponApplied && coupon.code === couponCode}
                        isMaxedOut={coupon.isMaxedOut || false}
                        // Use a wrapper to pass the required discount amount back to CartScreen
                        onApply={(code) => {
                            const foundCoupon = DEMO_COUPONS.find(c => c.code === code);
                            if (foundCoupon) {
                                handleApplyCoupon(code, foundCoupon.discountAmount);
                            }
                        }}
                        onRemove={handleClearCoupon}
                    />
                ))}
            </ScrollView>

            {/* 2. Manual Input Field */}
            <View style={sectionStyles.manualInputContainer}>
                <TextInput
                    style={sectionStyles.textInput}
                    placeholder={isCouponApplied ? `Coupon ${couponCode} active` : "Enter Coupon Code manually"}
                    placeholderTextColor={isCouponApplied ? Colors.primaryGreen : Colors.grayText}
                    value={manualCode}
                    onChangeText={setManualCode}
                    autoCapitalize="characters"
                    editable={!isCouponApplied} // Disable manual entry if a coupon is active
                />
                <TouchableOpacity
                    style={[
                        sectionStyles.manualApplyButton,
                        isCouponApplied && sectionStyles.manualApplyButtonApplied,
                        isManualApplyButtonDisabled && sectionStyles.manualApplyButtonDisabled,
                    ]}
                    onPress={isCouponApplied ? handleClearCoupon : handleManualApply}
                    disabled={isManualApplyButtonDisabled}
                >
                    <Text style={sectionStyles.manualApplyButtonText}>
                        {isCouponApplied ? 'REMOVE' : 'APPLY'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* 3. Applied Coupon Banner */}
            {isCouponApplied && (
                <View style={sectionStyles.appliedBanner}>
                    <Ionicons name="checkmark-circle" size={width * 0.05} color={Colors.primaryGreen} />
                    <Text style={sectionStyles.appliedText}>
                        Coupon **{couponCode}** Applied. Saving ₹{couponDiscount.toFixed(2)}!
                    </Text>
                </View>
            )}
            
        </View>
    );
};

// --- STYLES FOR COUPON SECTION ---
const sectionStyles = StyleSheet.create({
    container: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        paddingVertical: 15,
        marginBottom: 20,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: Colors.lightGray,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    headerTitle: {
        fontSize: width * 0.05,
        fontWeight: 'bold',
        color: Colors.darkText,
        marginLeft: 8,
    },
    cardScrollContent: {
        paddingHorizontal: 5,
        paddingVertical: 10,
    },
    manualInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        borderTopWidth: 1,
        borderTopColor: Colors.lightGray,
        paddingTop: 15,
    },
    textInput: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderColor: Colors.mediumGray,
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: width * 0.04,
        marginRight: 10,
        backgroundColor: Colors.softGray,
    },
    manualApplyButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: Colors.blueHighlight,
    },
    manualApplyButtonApplied: {
        backgroundColor: Colors.redAlert,
    },
    manualApplyButtonDisabled: {
        backgroundColor: Colors.mediumGray,
    },
    manualApplyButtonText: {
        color: Colors.white,
        fontWeight: 'bold',
        fontSize: width * 0.04,
    },
    appliedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.lightGray,
        padding: 10,
        borderRadius: 8,
        marginTop: 15,
        borderColor: Colors.primaryGreen,
        borderWidth: 1,
    },
    appliedText: {
        marginLeft: 10,
        fontSize: width * 0.04,
        fontWeight: '600',
        color: Colors.darkText,
    }
});

export default CouponSection;