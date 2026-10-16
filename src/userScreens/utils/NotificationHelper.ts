// src/userScreens/utils/NotificationHelper.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../config/config';
import { navigationRef } from './navigationRef';

export type PushRole = 'user' | 'vendor';

// ─────────────────────────────────────────────────────────────
// Lazy loaders (avoid circular deps with store.ts)
// ─────────────────────────────────────────────────────────────
function getStore(): any {
  try {
    return require('../../app/store').store;
  } catch {
    return null;
  }
}

function getPerformProfileSwitch(): any {
  try {
    return require('../../utils/switchProfile').performProfileSwitch;
  } catch {
    return null;
  }
}

// ============================================================
// Foreground presentation handler
// ============================================================
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ============================================================
// Android notification channels
// ============================================================
export const setupNotifications = async () => {
  console.log('[NotifSetup] 🚀 starting channel setup. Platform =', Platform.OS);

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
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFFFFF',
        showBadge: true,
        enableVibrate: true,
        enableLights: true,
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
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
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
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync(
        'whatsapp-notifications',
        {
          name: 'WhatsApp Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#25D366',
          showBadge: true,
          enableVibrate: true,
          enableLights: true,
          bypassDnd: true,
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        }
      );

      console.log('[NotifSetup] ✅ Android channels created (5 channels)');
    } catch (error: any) {
      console.error('[NotifSetup] ❌ channel setup failed:', error?.message || error);
    }
  } else {
    console.log('[NotifSetup] iOS — no channels needed');
  }
};

// ============================================================
// Send token to backend (role-aware)
// ============================================================
async function sendTokenToBackend(
  userId: string,
  token: string,
  platform: string,
  role: PushRole
) {
  console.log('──────────────────────────────────────────────');
  console.log('[PushBackend] → register called', {
    userId,
    role,
    platform,
    tokenPreview: token?.slice(0, 30) + '…',
  });

  if (!userId || !token) {
    console.warn('[PushBackend] ❌ missing userId or token — aborting');
    console.log('──────────────────────────────────────────────');
    return;
  }

  const url = `${config.apiUrl}/push/register`;
  const body = {
    userId: String(userId),
    token,
    platform,
    role,
    deviceInfo: {
      model: Device.modelName,
      os: Platform.OS,
      osVersion: Device.osVersion,
      isDevice: Device.isDevice,
    },
  };

  console.log('[PushBackend] POST', url);
  console.log('[PushBackend] request body:', JSON.stringify(body, null, 2));

  try {
    const t0 = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const ms = Date.now() - t0;

    console.log(`[PushBackend] ← status ${response.status} in ${ms}ms`);

    let result: any = null;
    try {
      result = await response.json();
      console.log('[PushBackend] ← response body:', JSON.stringify(result));
    } catch (e) {
      console.warn('[PushBackend] ⚠️ response not JSON');
    }

    if (!response.ok) {
      if (result?.error === 'Token already registered') {
        console.log('[PushBackend] ℹ️ token already registered — ok');
        console.log('──────────────────────────────────────────────');
        return;
      }
      console.error(
        '[PushBackend] ❌ backend rejected registration:',
        result
      );
      console.log('──────────────────────────────────────────────');
      return;
    }

    console.log(`[PushBackend] ✅ registered as role='${role}'`);
    console.log('──────────────────────────────────────────────');
  } catch (err: any) {
    console.error(
      '[PushBackend] ❌ network error:',
      err?.message || err
    );
    console.log('──────────────────────────────────────────────');
  }
}

// ============================================================
// Unregister (role-aware)
// ============================================================
export async function unregisterPushToken(
  userId: string,
  token: string,
  role: PushRole = 'user'
) {
  console.log('──────────────────────────────────────────────');
  console.log('[PushUnregister] → called', {
    userId,
    role,
    tokenPreview: token?.slice(0, 30) + '…',
  });

  if (!userId || !token) {
    console.warn('[PushUnregister] ❌ missing userId or token — aborting');
    console.log('──────────────────────────────────────────────');
    return;
  }

  const url = `${config.apiUrl}/push/unregister`;
  const body = {
    userId: String(userId),
    token,
    role,
  };

  console.log('[PushUnregister] DELETE', url);
  console.log('[PushUnregister] request body:', JSON.stringify(body));

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log(`[PushUnregister] ← status ${response.status}`);

    if (response.ok) {
      console.log(`[PushUnregister] ✅ unregistered role='${role}'`);
    } else {
      const txt = await response.text().catch(() => '');
      console.warn(
        `[PushUnregister] ⚠️ backend said ${response.status}: ${txt}`
      );
    }
  } catch (error: any) {
    console.error(
      '[PushUnregister] ❌ network error:',
      error?.message || error
    );
  }
  console.log('──────────────────────────────────────────────');
}

// ============================================================
// Register device token with backend
// ============================================================
export const registerForPushNotificationsAsync = async (
  userId?: string,
  role: PushRole = 'user'
): Promise<string | null> => {
  console.log('══════════════════════════════════════════════');
  console.log('[PushReg] 🚀 called', { userId, role });

  if (!Device.isDevice) {
    console.log('[PushReg] ❌ not a physical device — aborting');
    console.log('══════════════════════════════════════════════');
    return null;
  }

  try {
    // ── Permission ──
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[PushReg] existing permission status:', existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      console.log('[PushReg] requesting permission…');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[PushReg] permission after request:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.log('[PushReg] ❌ permission not granted — aborting');
      console.log('══════════════════════════════════════════════');
      return null;
    }

    // ── Project ID ──
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    console.log('[PushReg] projectId =', projectId ?? '(missing)');
    console.log('[PushReg] expoConfig.extra.eas =', JSON.stringify(
      Constants?.expoConfig?.extra?.eas ?? null
    ));
    console.log('[PushReg] easConfig =', JSON.stringify(
      Constants?.easConfig ?? null
    ));

    if (!projectId) {
      console.error(
        '[PushReg] ❌ no projectId found — check app.json → extra.eas.projectId'
      );
      console.log('══════════════════════════════════════════════');
      return null;
    }

    // ── Expo token ──
    let token: string | null = null;
    try {
      const t0 = Date.now();
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const ms = Date.now() - t0;
      token = tokenResponse.data;
      console.log(`[PushReg] 🎟️ Expo token obtained in ${ms}ms:`, token);
    } catch (fcmError: any) {
      console.warn(
        '[PushReg] ⚠️ getExpoPushTokenAsync failed:',
        fcmError?.message || fcmError
      );
      console.warn(
        '[PushReg] hint: Android needs google-services.json + FCM configured in EAS.'
      );
      console.log('══════════════════════════════════════════════');
      return null;
    }

    if (!token) {
      console.warn('[PushReg] ⚠️ token is null — aborting');
      console.log('══════════════════════════════════════════════');
      return null;
    }

    // ── Cache device-level token ──
    await AsyncStorage.setItem('expoPushToken', token);
    console.log('[PushReg] 💾 saved expoPushToken to AsyncStorage');

    // ── Backend register (only if userId supplied) ──
    if (userId) {
      console.log(
        `[PushReg] 📡 sending to backend → ownerId=${userId} role='${role}'`
      );
      await sendTokenToBackend(userId, token, Platform.OS, role);
      console.log('[PushReg] ✅ backend register complete');
    } else {
      console.warn(
        '[PushReg] ⚠️ no userId supplied — skipping backend register',
        { userId }
      );
    }

    console.log(
      '[PushReg] 🏁 returning token:',
      token.slice(0, 30) + '…'
    );
    console.log('══════════════════════════════════════════════');
    return token;
  } catch (e: any) {
    console.error('[PushReg] ❌ outer catch:', e?.message || e);
    console.log('══════════════════════════════════════════════');
    return null;
  }
};

// ============================================================
// Handle notification tap → role switch + navigation
// ============================================================
export const handleNotificationResponse = async (
  response: Notifications.NotificationResponse
) => {
  const data = response.notification.request.content.data as any;
  console.log('══════════════════════════════════════════════');
  console.log('[NotifTap] 🔔 tapped. data =', JSON.stringify(data));

  if (!data) {
    console.warn('[NotifTap] ❌ no data — aborting');
    console.log('══════════════════════════════════════════════');
    return;
  }

  const targetRole: PushRole | undefined =
    data.role === 'vendor'
      ? 'vendor'
      : data.role === 'user'
      ? 'user'
      : undefined;

  const store = getStore();
  const currentRole = store?.getState()?.session?.activeRole ?? null;

  console.log('[NotifTap] targetRole =', targetRole, '| currentRole =', currentRole);

  if (targetRole && targetRole !== currentRole) {
    console.log(
      `[NotifTap] 🔄 switching profile from '${currentRole}' → '${targetRole}'`
    );
    const performProfileSwitch = getPerformProfileSwitch();
    if (typeof performProfileSwitch === 'function') {
      try {
        const result = await performProfileSwitch(targetRole);
        console.log('[NotifTap] switch result =', JSON.stringify(result));
        if (!result?.success) {
          console.warn(
            `[NotifTap] ⚠️ notification for role '${targetRole}' but no session`
          );
        }
      } catch (e: any) {
        console.warn('[NotifTap] ❌ switch threw:', e?.message || e);
      }
    } else {
      console.warn('[NotifTap] ⚠️ performProfileSwitch unavailable');
    }
  } else if (targetRole && targetRole === currentRole) {
    console.log('[NotifTap] role already active — no switch needed');
  }

  if (!data.type) {
    console.warn('[NotifTap] ⚠️ no data.type — routing by role default');
    if (targetRole === 'vendor') {
      navigationRef.current?.navigate('VendorDashboard' as never);
    } else if (targetRole === 'user') {
      navigationRef.current?.navigate('UserTabs' as never);
    }
    console.log('══════════════════════════════════════════════');
    return;
  }

  console.log(`[NotifTap] ➡️ routing by data.type = '${data.type}'`);

  switch (data.type) {
    case 'chat':
    case 'message':
      if (data.conversationId) {
        navigationRef.current?.navigate('Messages' as never, {
          conversationId: data.conversationId,
        } as never);
      } else {
        navigationRef.current?.navigate('Messages' as never);
      }
      break;

    case 'like':
    case 'comment':
    case 'follow':
    case 'story_reaction':
      navigationRef.current?.navigate('AdList' as never);
      break;

    case 'review':
      if (data.vendorId) {
        navigationRef.current?.navigate('ShopDetails' as never, {
          vendorId: data.vendorId,
        } as never);
      }
      break;

    case 'view':
      if (data.vendorId) {
        navigationRef.current?.navigate('ShopDetails' as never, {
          vendorId: data.vendorId,
        } as never);
      } else {
        navigationRef.current?.navigate('ShopListings' as never);
      }
      break;

    case 'lead':
    case 'call':
    case 'whatsapp':
      navigationRef.current?.navigate('VendorLeads' as never);
      break;

    case 'product':
      if (data.id) {
        navigationRef.current?.navigate('ProductDetails' as never, {
          productId: data.id,
        } as never);
      }
      break;

    case 'property':
      if (data.id) {
        navigationRef.current?.navigate('PropertyDetailScreen' as never, {
          propertyId: data.id,
        } as never);
      }
      break;

    case 'rental':
      if (data.id) {
        navigationRef.current?.navigate('RentalDetail' as never, {
          rentalId: data.id,
        } as never);
      }
      break;

    case 'daily_update':
      navigationRef.current?.navigate('VendorDashboard' as never);
      break;

    default:
      navigationRef.current?.navigate('UserTabs' as never);
      break;
  }
  console.log('══════════════════════════════════════════════');
};

// ============================================================
// Listeners
// ============================================================
let foregroundSubscription: Notifications.Subscription | null = null;
let responseSubscription: Notifications.Subscription | null = null;

export const setupLeadNotificationListener = () => {
  console.log('[NotifListen] 🚀 setting up listeners…');

  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
    console.log('[NotifListen] removed old foreground listener');
  }
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
    console.log('[NotifListen] removed old response listener');
  }

  foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const c = notification.request.content;
      console.log('──────────────────────────────────────────────');
      console.log('[NotifForeground] 📩 received');
      console.log('  title:', c.title);
      console.log('  body :', c.body);
      console.log('  data :', JSON.stringify(c.data));
      console.log('──────────────────────────────────────────────');
    }
  );

  responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[NotifListen] 👆 response listener fired');
      handleNotificationResponse(response).catch((e) =>
        console.warn('[NotifListen] handleNotificationResponse failed:', e)
      );
    });

  console.log('[NotifListen] ✅ listeners registered');

  return { foregroundSubscription, responseSubscription };
};

export const cleanupNotificationListeners = () => {
  console.log('[NotifListen] 🧹 cleaning up…');

  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
  }

  console.log('[NotifListen] ✅ cleaned up');
};

export const sendTestNotification = async () => {
  console.log('[NotifTest] 🧪 scheduling test notification in 2s…');

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

  console.log('[NotifTest] ✅ scheduled');
};