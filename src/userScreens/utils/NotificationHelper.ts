import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device'; 

// 🔥 Configure what happens when a notification arrives WHILE the app is OPEN.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, 
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const setupNotifications = async () => {
  if (Platform.OS === 'android') {
    // ⚠️ CRITICAL: We changed the ID from 'default' to 'high-priority-chat'. 
    // Android caches channel settings permanently. Changing the ID forces Android to 
    // recognize the MAX importance and wake the screen!
    await Notifications.setNotificationChannelAsync('high-priority-chat', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFD700', 
      showBadge: true,
      enableVibrate: true,
      enableLights: true,
      bypassDnd: true, // Forces through "Do Not Disturb"
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, // Shows on Lock Screen
    });
  }
};

export const registerForPushNotificationsAsync = async () => {
  let token;
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("🔥 YOUR EXPO PUSH TOKEN:", token); 
    
    return token;
  } catch (e) {
    console.error("Token Registration Error:", e);
    return null;
  }
};

export const sendChatNotification = async (senderName: string, message: string, isGroup: boolean = false, groupName: string = "") => {
  const title = isGroup ? `New message in ${groupName}` : `New message from ${senderName} 💬`;
  const body = isGroup ? `${senderName}: ${message}` : message;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { type: 'chat' },
      priority: Notifications.AndroidNotificationPriority.MAX, // Force Heads-Up Banner
    },
    // Route it specifically to our new Wake-Screen channel
    trigger: Platform.OS === 'android' ? { channelId: 'high-priority-chat' } : null,
  });
};

export const sendWelcomeNotification = async (name: string = 'there', role: string = 'user') => {
  await Notifications.scheduleNotificationAsync({
    content: { 
      title: "Welcome Back! 👋", 
      body: `Hello ${name}, your luxury ${role} portal is ready.`, 
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === 'android' ? { channelId: 'high-priority-chat' } : null,
  });
};