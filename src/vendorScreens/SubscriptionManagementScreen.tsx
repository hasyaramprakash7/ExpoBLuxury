// src/screens/SubscriptionManagementScreen.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import {
  fetchSubscriptionStatus,
  cancelSubscription,
} from '../features/vendor/vendorAuthSlice';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  VendorDashboard: undefined;
  SubscriptionManagement: undefined;
  SubscriptionChoice: undefined;
};

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SubscriptionManagement'
>;

export default function SubscriptionManagementScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<NavigationProp>();
  const { subscriptionStatus, trialEndDate, loading, error, vendor } =
    useSelector((state: RootState) => state.vendorAuth);

  useEffect(() => {
    dispatch(fetchSubscriptionStatus());
  }, []);

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? You will continue to have access until the end of the current billing period.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            const result = await dispatch(cancelSubscription());
            if (cancelSubscription.fulfilled.match(result)) {
              Alert.alert('Cancelled', 'Subscription will end at current cycle.');
            } else {
              Alert.alert('Error', result.payload as string || 'Cancellation failed');
            }
          },
        },
      ]
    );
  };

  const handleRenew = () => {
    navigation.navigate('SubscriptionChoice');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#009632" />
      </View>
    );
  }

  const isTrial = subscriptionStatus === 'trial';
  const isActive = subscriptionStatus === 'active';
  const isExpired = subscriptionStatus === 'expired';
  const isCancelled = subscriptionStatus === 'cancelled';
  const isPending = subscriptionStatus === 'pending';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Subscription</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text
          style={[
            styles.value,
            {
              color: isActive ? '#22c55e' : isTrial ? '#f59e0b' : '#ef4444',
            },
          ]}
        >
          {subscriptionStatus?.toUpperCase() || 'INACTIVE'}
        </Text>
      </View>

      {isTrial && trialEndDate && (
        <View style={styles.card}>
          <Text style={styles.label}>Trial ends on</Text>
          <Text style={styles.value}>
            {format(new Date(trialEndDate), 'dd MMM yyyy')}
          </Text>
          <Text style={styles.info}>
            After trial, ₹100/month will be charged automatically.
          </Text>
        </View>
      )}

      {(isActive || isCancelled) && vendor && (
        <View style={styles.card}>
          <Text style={styles.label}>Billing Period</Text>
          <Text style={styles.value}>
            {vendor.subscriptionStartDate
              ? format(new Date(vendor.subscriptionStartDate), 'dd MMM yyyy')
              : 'N/A'}{' '}
            -{' '}
            {vendor.subscriptionEndDate
              ? format(new Date(vendor.subscriptionEndDate), 'dd MMM yyyy')
              : 'Ongoing'}
          </Text>
        </View>
      )}

      {isExpired && (
        <View style={styles.card}>
          <Text style={styles.label}>Your subscription has expired.</Text>
        </View>
      )}

      {isPending && (
        <View style={styles.card}>
          <Text style={styles.label}>
            Payment pending. Please complete the payment.
          </Text>
        </View>
      )}

      {isActive && (
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
        >
          <Text style={styles.buttonText}>Cancel Subscription</Text>
        </TouchableOpacity>
      )}

      {(isExpired || isCancelled) && (
        <TouchableOpacity style={styles.button} onPress={handleRenew}>
          <Text style={styles.buttonText}>Renew Subscription</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#222',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  label: {
    color: '#aaa',
    fontSize: 14,
  },
  value: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 5,
  },
  info: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 5,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#009632',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#b91c1c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});