// src/screens/SubscriptionChoiceScreen.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import {
  startFreeTrial,
  createPaidSubscription,
  fetchSubscriptionStatus,
} from '../features/vendor/vendorAuthSlice';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  VendorDashboard: undefined;
  SubscriptionChoice: undefined;
  SubscriptionPending: undefined;
};

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SubscriptionChoice'
>;

export default function SubscriptionChoiceScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<NavigationProp>();
  const { loading, error, subscriptionStatus } = useSelector(
    (state: RootState) => state.vendorAuth
  );

  // Fetch status on mount
  useEffect(() => {
    dispatch(fetchSubscriptionStatus());
  }, []);

  // 🔥 Redirect to dashboard if already trial/active/pending (moved to useEffect)
  useEffect(() => {
    if (
      subscriptionStatus === 'trial' ||
      subscriptionStatus === 'active' ||
      subscriptionStatus === 'pending'
    ) {
      navigation.replace('VendorDashboard');
    }
  }, [subscriptionStatus, navigation]);

  const handleFreeTrial = async () => {
    const result = await dispatch(startFreeTrial());
    if (startFreeTrial.fulfilled.match(result)) {
      Alert.alert('Success', 'Your 3‑month free trial has started!');
      navigation.replace('VendorDashboard');
    } else {
      Alert.alert('Error', result.payload as string || 'Could not start trial');
    }
  };

  const handlePaidSubscribe = async () => {
  const result = await dispatch(createPaidSubscription());
  if (createPaidSubscription.fulfilled.match(result)) {
    const shortUrl = result.payload.shortUrl;
    if (shortUrl) {
      Linking.openURL(shortUrl).catch(() =>
        Alert.alert('Error', 'Could not open payment page. Please try again.')
      );
      // 🔥 Navigate to pending screen – this is the key
      navigation.replace('SubscriptionPending');
    } else {
      Alert.alert('Success', 'Subscription initiated. Please complete payment.');
    }
  } else {
    Alert.alert('Error', result.payload as string || 'Subscription failed');
  }
};

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#009632" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Plan</Text>
      <Text style={styles.subtitle}>Start selling with BLuxury</Text>

      <View style={styles.card}>
        <Text style={styles.planTitle}>Free Trial</Text>
        <Text style={styles.planPrice}>₹0 for 3 months</Text>
        <Text style={styles.planDesc}>
          Perfect to get started. No payment required.
        </Text>
        <TouchableOpacity
          style={styles.trialButton}
          onPress={handleFreeTrial}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Start Free Trial</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, styles.paidCard]}>
        <Text style={styles.planTitle}>Premium Plan</Text>
        <Text style={styles.planPrice}>₹100 / month</Text>
        <Text style={styles.planDesc}>
          Auto‑renew, cancel anytime.
        </Text>
        <TouchableOpacity
          style={styles.subscribeButton}
          onPress={handlePaidSubscribe}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Subscribe Now</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 30,
  },
  card: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  paidCard: {
    backgroundColor: '#1a3a2a',
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#009632',
    marginVertical: 5,
  },
  planDesc: {
    color: '#aaa',
    marginBottom: 15,
  },
  trialButton: {
    backgroundColor: '#009632',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  subscribeButton: {
    backgroundColor: '#005612',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  error: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 10,
  },
});