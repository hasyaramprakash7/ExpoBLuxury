import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDispatch } from 'react-redux';
import { clearCart } from '../features/cart/cartSlice';

// --- Color Palette (Matching App.tsx and OrderSummary.tsx) ---
const Colors = {
    luxuryBackground: "#0A0A0A",
    luxuryCard: "#1C1C1C",
    luxuryTextPrimary: "#E0E0E0",
    luxuryTextSecondary: "#B0B0B0",
    luxuryAccent: "#FFD700",
    luxuryError: "#FF6347",
    luxurySuccess: "#34C759",
    rolexGreen: "#00563F",
};

// FIX: Removed TypeScript interfaces/generics that caused Syntax Errors
const OrderConfirmationScreen = () => {

    // NOTE: useRoute() returns the route object which contains the params.
    const route = useRoute();
    const navigation = useNavigation();
    const dispatch = useDispatch();

    // Access params dynamically from the route object
    const { paymentId, paymentFailed } = route.params || {};

    const [status, setStatus] = useState('pending');
    const [message, setMessage] = useState('Verifying payment status...');

    useEffect(() => {
        // --- Payment Status Logic ---

        // 1. If payment failed parameter is explicitly true (from backend redirect)
        if (paymentFailed) {
            setStatus('failed');
            setMessage('Payment failed or was cancelled by the user. Please try again.');

            // 2. If a payment ID is present (success or pending final capture)
        } else if (paymentId) {
            // In a real app, you might trigger a check API call here 
            // to verify paymentId status before setting success.

            // Simulating success upon receiving the ID:
            setStatus('success');
            setMessage(`Payment confirmed! Your Order has been placed successfully (Payment ID: ${String(paymentId).substring(0, 10)}...).`);

            // Clear cart upon assumed successful order completion
            dispatch(clearCart());

            // 3. If no clear payment data is received
        } else {
            setStatus('failed');
            setMessage('No payment confirmation was received. Please check your Orders page or contact support.');
        }
    }, [paymentId, paymentFailed, dispatch]);

    const isSuccess = status === 'success';
    const isPending = status === 'pending';

    const renderContent = () => {
        if (isPending) {
            return (
                <View style={styles.content}>
                    <ActivityIndicator size="large" color={Colors.luxuryAccent} />
                    <Text style={styles.titlePending}>Payment Verification</Text>
                    <Text style={styles.messagePending}>{message}</Text>
                    <Text style={styles.smallText}>Please wait, this may take a moment.</Text>
                </View>
            );
        }

        return (
            <View style={styles.content}>
                <Ionicons
                    name={isSuccess ? "checkmark-circle" : "close-circle"}
                    size={100}
                    color={isSuccess ? Colors.luxurySuccess : Colors.luxuryError}
                />
                <Text style={isSuccess ? styles.titleSuccess : styles.titleError}>
                    {isSuccess ? "Order Confirmed!" : "Payment Failed"}
                </Text>
                <Text style={styles.message}>{message}</Text>

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate('UserOrderScreen')}
                >
                    <Text style={styles.buttonText}>View My Orders</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.luxuryTextPrimary} style={{ marginLeft: 5 }} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('UserTabs', { screen: 'Home' })}
                >
                    <Text style={styles.secondaryButtonText}>Back to Shopping</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {renderContent()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.luxuryBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: Colors.luxuryCard,
        borderRadius: 15,
        width: '90%',
        shadowColor: Colors.luxuryAccent,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    titleSuccess: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.luxurySuccess,
        marginTop: 15,
        marginBottom: 10,
        textAlign: 'center',
    },
    titleError: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.luxuryError,
        marginTop: 15,
        marginBottom: 10,
        textAlign: 'center',
    },
    titlePending: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.luxuryAccent,
        marginTop: 15,
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: Colors.luxuryTextSecondary,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    messagePending: {
        fontSize: 16,
        color: Colors.luxuryTextPrimary,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    smallText: {
        fontSize: 12,
        color: Colors.luxuryTextSecondary,
        marginTop: 10,
    },
    button: {
        backgroundColor: Colors.rolexGreen,
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        width: '100%',
    },
    buttonText: {
        color: Colors.luxuryTextPrimary,
        fontSize: 18,
        fontWeight: '600',
    },
    secondaryButton: {
        marginTop: 15,
        padding: 10,
        width: '100%',
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: Colors.luxuryAccent,
        fontSize: 16,
        fontWeight: '500',
    },
});

export default OrderConfirmationScreen;
