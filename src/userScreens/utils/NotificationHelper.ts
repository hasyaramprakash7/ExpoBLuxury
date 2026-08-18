// src/userScreens/utils/NotificationHelper.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import config from '../../config/config';
import { navigationRef } from './navigationRef';
import { SafeAreaView } from 'react-native-safe-area-context';

// ============================================================
// Configure what happens when a notification arrives WHILE the app is OPEN.
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
  }
};

// ============================================================
// Backend communication for push tokens
// ============================================================

/**
 * Send the push token to your backend server.
 * This stores the token in the PushToken collection for Expo push.
 */
async function sendTokenToBackend(userId, token, platform) {
  console.log('📤 [sendTokenToBackend] Called with:', { userId, token: token?.substring(0, 20) + '...', platform });
  if (!userId || !token) {
    console.warn('⚠️ Cannot register push token: missing userId or token');
    return;
  }
  try {
    const url = `${config.apiUrl}/push/register`;
    console.log('🌐 [sendTokenToBackend] POST to:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token, platform }),
    });
    console.log('📨 [sendTokenToBackend] Response status:', response.status);
    
    const result = await response.json();
    
    if (!response.ok) {
      // Handle specific error cases gracefully
      if (result.error === 'Token already registered') {
        console.log('ℹ️ Push token already registered (this is fine)');
        return; // Not an error, just skip
      }
      console.error('❌ [sendTokenToBackend] Backend error:', result);
      throw new Error(result.error || 'Failed to register push token');
    }
    console.log('✅ [sendTokenToBackend] Push token registered with backend:', result);
  } catch (error) {
    // Don't throw for token already registered - it's not a critical error
    if (error.message?.includes('Token already registered')) {
      console.log('ℹ️ Push token already registered (ignoring)');
      return;
    }
    console.error('❌ Error registering push token with backend:', error);
  }
}

/**
 * Unregister the push token (e.g., on logout).
 */
export async function unregisterPushToken(userId, token) {
  console.log('🗑️ [unregisterPushToken] Called with:', { userId, token: token?.substring(0, 20) + '...' });
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
// Main registration function (now accepts userId)
// ============================================================

export const registerForPushNotificationsAsync = async (userId) => {
  console.log('📱 [registerForPushNotificationsAsync] Called with userId:', userId);
  let token;
  if (!Device.isDevice) {
    console.log('❌ Must use physical device for Push Notifications');
    return null;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('📱 [registerForPushNotificationsAsync] Existing permission status:', existingStatus);
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('📱 [registerForPushNotificationsAsync] Permission requested, new status:', finalStatus);
    }
    if (finalStatus !== 'granted') {
      console.log('❌ Permission not granted for push notifications');
      return null;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    console.log('📱 [registerForPushNotificationsAsync] Project ID:', projectId);
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('🔥 [registerForPushNotificationsAsync] YOUR EXPO PUSH TOKEN:', token);

    if (userId) {
      console.log('📤 [registerForPushNotificationsAsync] UserId provided, sending token to backend...');
      await sendTokenToBackend(userId, token, Platform.OS);
    } else {
      console.warn('⚠️ No userId provided, token NOT sent to backend (will be sent via login/register request)');
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

export const handleNotificationResponse = (response) => {
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
      // Check if vendor is logged in
      const state = navigationRef.current?.getRootState();
      const isVendorLoggedIn = state?.routes?.some(r => r.name === 'VendorDashboard' || r.name === 'VendorLeads');
      
      if (isVendorLoggedIn) {
        navigationRef.current?.navigate('VendorLeads');
      } else {
        navigationRef.current?.navigate('VendorLogin');
      }
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
// Existing notification senders (chat, welcome)
// ============================================================

export const sendChatNotification = async (
  senderName,
  message,
  isGroup = false,
  groupName = ''
) => {
  console.log('💬 [sendChatNotification] Sending chat notification:', { senderName, message, isGroup, groupName });
  const title = isGroup ? `New message in ${groupName}` : `New message from ${senderName} 💬`;
  const body = isGroup ? `${senderName}: ${message}` : message;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { type: 'chat' },
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === 'android' ? { channelId: 'high-priority-chat' } : null,
  });
};

export const sendWelcomeNotification = async (name = 'there', role = 'user') => {
  console.log('👋 [sendWelcomeNotification] Sending welcome notification for:', { name, role });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Welcome Back! 👋',
      body: `Hello ${name}, your luxury ${role} portal is ready.`,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === 'android' ? { channelId: 'high-priority-chat' } : null,
  });
};

// ============================================================
// Lead Notification Listener Setup
// ============================================================

// Store subscription references to clean up later
let foregroundSubscription: any = null;
let responseSubscription: any = null;

export const setupLeadNotificationListener = () => {
  console.log('📱 [setupLeadNotificationListener] Setting up lead notification listener...');
  
  // Remove existing listeners if they exist
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
  }
  
  // Add listener for when notification is received while app is in foreground
  foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('📱 [Foreground Notification] Received:');
      console.log('  Title:', notification.request.content.title);
      console.log('  Body:', notification.request.content.body);
      console.log('  Data:', notification.request.content.data);
    }
  );
  
  // Add listener for when notification is tapped/opened
  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('📱 [Notification Response] Tapped:', response);
      handleNotificationResponse(response);
    }
  );
  
  console.log('✅ [setupLeadNotificationListener] Listeners set up successfully');
  
  return {
    foregroundSubscription,
    responseSubscription,
  };
};

// ============================================================
// Cleanup function for notification listeners
// ============================================================

export const cleanupNotificationListeners = () => {
  console.log('🧹 [cleanupNotificationListeners] Cleaning up notification listeners...');
  
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
  }
  
  console.log('✅ [cleanupNotificationListeners] Listeners cleaned up');
};

// ============================================================
// Test notification (for debugging)
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

// ============================================================
// Send notification to vendor (for testing)
// ============================================================

export const sendVendorNotification = async (vendorId: string, title: string, body: string, data: any = {}) => {
  console.log('📤 [sendVendorNotification] Sending to vendor:', vendorId);
  console.log('  Title:', title);
  console.log('  Body:', body);
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { 
        ...data,
        type: data.type || 'lead',
        vendorId,
        timestamp: new Date().toISOString(),
      },
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: null, // Send immediately
  });
  
  console.log('✅ [sendVendorNotification] Notification scheduled');
};