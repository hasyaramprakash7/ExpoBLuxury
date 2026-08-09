import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import config from '../../config/config';

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
    console.log('✅ [setupNotifications] Android channel created.');
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
  console.log('📤 [sendTokenToBackend] Called with:', { userId, token, platform });
  if (!userId || !token) {
    console.warn('⚠️ Cannot register push token: missing userId or token');
    return;
  }
  try {
    // ✅ Fixed URL: no duplicate /api
    const url = `${config.apiUrl}/push/register`;
    console.log('🌐 [sendTokenToBackend] POST to:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token, platform }),
    });
    console.log('📨 [sendTokenToBackend] Response status:', response.status);
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [sendTokenToBackend] Backend error:', errorData);
      throw new Error(errorData.error || 'Failed to register push token');
    }
    const result = await response.json();
    console.log('✅ [sendTokenToBackend] Push token registered with backend:', result);
  } catch (error) {
    console.error('❌ Error registering push token with backend:', error);
  }
}

/**
 * Unregister the push token (e.g., on logout).
 */
export async function unregisterPushToken(userId, token) {
  console.log('🗑️ [unregisterPushToken] Called with:', { userId, token });
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

    // Send token to backend ONLY if userId is provided
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