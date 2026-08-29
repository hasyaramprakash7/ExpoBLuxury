// src/userScreens/utils/NotificationHelper.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import config from '../../config/config';
import { navigationRef } from './navigationRef';

// ============================================================
// Configure notification handler
// ============================================================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ============================================================
// Setup notification channels (Android)
// ============================================================
export const setupNotifications = async () => {
  console.log('📱 [setupNotifications] Setting up notification channels...');
  
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('high-priority-chat', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
        showBadge: true,
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      
      await Notifications.setNotificationChannelAsync('lead-notifications', {
        name: 'Lead Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1B8C40',
        showBadge: true,
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      
      await Notifications.setNotificationChannelAsync('call-notifications', {
        name: 'Call Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        showBadge: true,
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      
      await Notifications.setNotificationChannelAsync('whatsapp-notifications', {
        name: 'WhatsApp Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#25D366',
        showBadge: true,
        enableVibrate: true,
        enableLights: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      
      console.log('✅ [setupNotifications] Android channels created.');
    } catch (error) {
      console.error('Error setting up notification channels:', error);
    }
  }
};

// ============================================================
// Backend communication for push tokens
// ============================================================

/**
 * Send the push token to your backend server
 */
async function sendTokenToBackend(userId: string, token: string, platform: string) {
  console.log('📤 [sendTokenToBackend] Called with:', { 
    userId, 
    token: token?.substring(0, 20) + '...', 
    platform 
  });
  
  if (!userId || !token) {
    console.warn('⚠️ Cannot register push token: missing userId or token');
    return;
  }

  try {
    const url = `${config.apiUrl}/push/register`;
    console.log('🌐 [sendTokenToBackend] POST to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        userId, 
        token, 
        platform,
        deviceInfo: {
          model: Device.modelName,
          os: Platform.OS,
          osVersion: Device.osVersion,
          isDevice: Device.isDevice,
        },
      }),
    });
    
    console.log('📨 [sendTokenToBackend] Response status:', response.status);
    
    const result = await response.json();
    
    if (!response.ok) {
      if (result.error === 'Token already registered') {
        console.log('ℹ️ Push token already registered (this is fine)');
        return;
      }
      console.error('❌ [sendTokenToBackend] Backend error:', result);
      throw new Error(result.error || 'Failed to register push token');
    }
    
    console.log('✅ [sendTokenToBackend] Push token registered with backend');
  } catch (error) {
    console.error('❌ Error in sendTokenToBackend:', error);
  }
}

/**
 * Unregister the push token (on logout)
 */
export async function unregisterPushToken(userId: string, token: string) {
  console.log('🗑️ [unregisterPushToken] Called with:', { 
    userId, 
    token: token?.substring(0, 20) + '...' 
  });
  
  if (!userId || !token) return;
  
  try {
    const url = `${config.apiUrl}/push/unregister`;
    console.log('🌐 [unregisterPushToken] DELETE to:', url);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    });
    
    if (response.ok) {
      console.log('✅ Push token unregistered from backend');
    } else {
      console.warn('Failed to unregister push token');
    }
  } catch (error) {
    console.error('Error unregistering push token:', error);
  }
}

// ============================================================
// Main registration function
// ============================================================

export const registerForPushNotificationsAsync = async (userId?: string) => {
  console.log('📱 [registerForPushNotificationsAsync] Called with userId:', userId);
  
  if (!Device.isDevice) {
    console.log('❌ Must use physical device for Push Notifications');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('📱 Existing permission status:', existingStatus);
    
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('📱 Permission requested, new status:', finalStatus);
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ Permission not granted for push notifications');
      return null;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    console.log('📱 Project ID:', projectId);
    
    if (!projectId) {
      console.error('❌ No project ID found! This is required for push notifications.');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('🔥 YOUR EXPO PUSH TOKEN:', token);

    // Send token to backend if userId is provided
    if (userId && token) {
      console.log(`📤 Sending token to backend for userId: ${userId}`);
      await sendTokenToBackend(userId, token, Platform.OS);
    } else {
      console.warn('⚠️ No userId provided, token NOT sent to backend');
    }

    return token;
  } catch (e) {
    console.error('❌ Token Registration Error:', e);
    return null;
  }
};

// ============================================================
// Handle Notification Response (Navigation)
// ============================================================

export const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  const data = response.notification.request.content.data;
  console.log('🔔 Notification tapped:', data);
  
  if (!data || !data.type) {
    console.warn('⚠️ Notification missing type data');
    return;
  }

  switch (data.type) {
    case 'view':
      if (data.vendorId) {
        navigationRef.current?.navigate('ShopDetails', { 
          vendorId: data.vendorId 
        });
      } else {
        navigationRef.current?.navigate('ShopListings');
      }
      break;
      
    case 'lead':
      navigationRef.current?.navigate('VendorLeads');
      break;
      
    case 'call':
      navigationRef.current?.navigate('VendorLeads');
      break;
      
    case 'whatsapp':
      navigationRef.current?.navigate('VendorLeads');
      break;
      
    case 'product':
      if (data.id) {
        navigationRef.current?.navigate('ProductDetails', { productId: data.id });
      }
      break;
      
    case 'property':
      if (data.id) {
        navigationRef.current?.navigate('PropertyDetailScreen', { propertyId: data.id });
      }
      break;
      
    case 'rental':
      if (data.id) {
        navigationRef.current?.navigate('RentalDetail', { rentalId: data.id });
      }
      break;
      
    case 'chat':
      navigationRef.current?.navigate('ChatScreen');
      break;
      
    case 'daily_update':
      navigationRef.current?.navigate('VendorDashboard');
      break;
      
    default:
      navigationRef.current?.navigate('UserTabs');
      break;
  }
};

// ============================================================
// Lead Notification Listener Setup
// ============================================================

let foregroundSubscription: Notifications.Subscription | null = null;
let responseSubscription: Notifications.Subscription | null = null;

export const setupLeadNotificationListener = () => {
  console.log('📱 [setupLeadNotificationListener] Setting up listeners...');
  
  // Remove existing listeners
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
  }
  
  // Foreground listener
  foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('📱 [Foreground Notification] Received:');
      console.log('  Title:', notification.request.content.title);
      console.log('  Body:', notification.request.content.body);
      console.log('  Data:', notification.request.content.data);
    }
  );
  
  // Response listener (when tapped)
  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('📱 [Notification Response] Tapped');
      handleNotificationResponse(response);
    }
  );
  
  console.log('✅ [setupLeadNotificationListener] Listeners set up');
  
  return {
    foregroundSubscription,
    responseSubscription,
  };
};

// ============================================================
// Cleanup
// ============================================================

export const cleanupNotificationListeners = () => {
  console.log('🧹 [cleanupNotificationListeners] Cleaning up...');
  
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
  }
  
  console.log('✅ [cleanupNotificationListeners] Cleaned up');
};

// ============================================================
// Test notification
// ============================================================

export const sendTestNotification = async () => {
  console.log('🧪 [sendTestNotification] Sending test notification...');
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification 📱',
      body: 'This is a test notification from BLuxury!',
      sound: 'default',
      data: { type: 'test' },
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: {
      seconds: 2,
    },
  });
  
  console.log('✅ [sendTestNotification] Test notification scheduled');
};