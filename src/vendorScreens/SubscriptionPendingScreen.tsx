// src/screens/SubscriptionPendingScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import { fetchSubscriptionStatus } from '../features/vendor/vendorAuthSlice';
import { useNavigation } from '@react-navigation/native';
import api from '../userScreens/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SubscriptionPendingScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const { subscriptionStatus } = useSelector((state: RootState) => state.vendorAuth);
  const [checkCount, setCheckCount] = useState(0);
  const [verifying, setVerifying] = useState(false);

  // Auto-poll every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchSubscriptionStatus());
      setCheckCount(prev => prev + 1);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Auto-redirect if active or trial
  useEffect(() => {
    if (subscriptionStatus === 'active' || subscriptionStatus === 'trial') {
      navigation.replace('VendorDashboard');
    }
    if (checkCount >= 10) {
      // After 30 seconds, show a message but stay on the screen (don't auto-redirect)
      Alert.alert('Still Pending', 'Payment is taking longer than expected. Please use the "Verify Payment" button to check manually.');
    }
  }, [subscriptionStatus, checkCount]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const token = await AsyncStorage.getItem('vendorToken');
      const res = await api.post('/subscription/verify-subscription', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success && res.data.subscriptionStatus === 'active') {
        Alert.alert('Success', 'Your subscription is now active!');
        navigation.replace('VendorDashboard');
      } else {
        Alert.alert('Still Pending', `Your subscription is currently ${res.data.subscriptionStatus || 'unknown'}. Please wait a moment.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not verify subscription. Please try again later.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#009632" />
      <Text style={styles.title}>Processing your subscription...</Text>
      <Text style={styles.subtitle}>Please wait while we confirm your payment.</Text>
      <Text style={styles.subtitle}>Do not close the app.</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => dispatch(fetchSubscriptionStatus())}
      >
        <Text style={styles.buttonText}>Check Status</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.verifyButton]}
        onPress={handleVerify}
        disabled={verifying}
      >
        <Text style={styles.buttonText}>
          {verifying ? 'Verifying...' : 'Verify Payment'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 20 },
  subtitle: { fontSize: 16, color: '#aaa', marginTop: 10, textAlign: 'center' },
  button: { backgroundColor: '#009632', padding: 12, borderRadius: 8, marginTop: 16, minWidth: 200, alignItems: 'center' },
  verifyButton: { backgroundColor: '#2563eb' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});