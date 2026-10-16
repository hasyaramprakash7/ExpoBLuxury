// src/utils/switchProfile.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Role = 'user' | 'vendor' | 'deliveryBoy' | 'admin';

export type SwitchResult =
  | { success: true; role: Role }
  | { success: false; reason: 'NO_SESSION'; role: Role };

function getStore(): any {
  try {
    return require('../app/store').store;
  } catch (e) {
    console.warn('[SwitchProfile] ❌ cannot load store', e);
    return null;
  }
}

function getSetActiveRole(): any {
  try {
    return require('../features/session/sessionSlice').setActiveRole;
  } catch (e) {
    console.warn('[SwitchProfile] ❌ cannot load setActiveRole', e);
    return null;
  }
}

function getHydrateVendor(): any {
  try {
    return require('../features/vendor/vendorAuthSlice').hydrateVendor;
  } catch (e) {
    console.warn('[SwitchProfile] ❌ cannot load hydrateVendor', e);
    return null;
  }
}

function getSetUser(): any {
  try {
    return require('../features/user/authSlice').setUser;
  } catch (e) {
    console.warn('[SwitchProfile] ❌ cannot load setUser', e);
    return null;
  }
}

function getSocket(): any {
  try {
    return require('../userScreens/utils/socket').default;
  } catch {
    return null;
  }
}

function getRegisterPushFn(): any {
  try {
    return require('../userScreens/utils/NotificationHelper')
      .registerForPushNotificationsAsync;
  } catch (e) {
    console.warn(
      '[SwitchProfile] ❌ cannot load registerForPushNotificationsAsync',
      e
    );
    return null;
  }
}

function getSetSwitchingProfile(): any {
  try {
    return require('../userScreens/utils/api').setSwitchingProfile;
  } catch (e) {
    console.warn('[SwitchProfile] ❌ cannot load setSwitchingProfile', e);
    return null;
  }
}

/**
 * Switches the active profile WITHOUT logging out the other role.
 *
 * Guarantees:
 *   1. Target role's token + user/vendor is hydrated into Redux BEFORE
 *      activeRole flips → no screen mounts with an empty slice.
 *   2. 'activeRole' is written to AsyncStorage and AWAITED before the
 *      dispatch → api.ts disk-first lookup is race-free.
 *   3. A 'switching' flag is raised on api.ts so a stale 401 from the
 *      old role can't wipe the token we just hydrated.
 */
export const performProfileSwitch = async (
  targetRole: Role
): Promise<SwitchResult> => {
  console.log('════════════════════════════════════════════════════');
  console.log(`[SwitchProfile] 🚀 START → target='${targetRole}'`);
  console.log('════════════════════════════════════════════════════');

  const store = getStore();
  const setActiveRole = getSetActiveRole();
  const hydrateVendor = getHydrateVendor();
  const setUser = getSetUser();
  const socket = getSocket();
  const registerPush = getRegisterPushFn();
  const setSwitchingProfile = getSetSwitchingProfile();

  console.log('[SwitchProfile] Deps resolved:', {
    hasStore: !!store,
    hasSetActiveRole: typeof setActiveRole === 'function',
    hasHydrateVendor: typeof hydrateVendor === 'function',
    hasSetUser: typeof setUser === 'function',
    hasSocket: !!socket,
    hasRegisterPush: typeof registerPush === 'function',
    hasSetSwitchingProfile: typeof setSwitchingProfile === 'function',
  });

  if (!store || !setActiveRole) {
    console.warn(
      '[SwitchProfile] ❌ ABORT — store or setActiveRole unavailable'
    );
    return { success: false, reason: 'NO_SESSION', role: targetRole };
  }

  if (typeof setSwitchingProfile === 'function') {
    setSwitchingProfile(true);
  }

  try {
    const state = store.getState() as any;
    const prevRole = state?.session?.activeRole ?? null;
    console.log(`[SwitchProfile] 📍 current activeRole = '${prevRole}'`);

    // ═════════════════════════════════════════════════════════
    // SWITCH TO VENDOR
    // ═════════════════════════════════════════════════════════
    if (targetRole === 'vendor') {
      console.log('[SwitchProfile] → branch = VENDOR');

      const vendorToken = await AsyncStorage.getItem('vendorToken');
      console.log('[SwitchProfile] vendorToken in storage:', {
        exists: !!vendorToken,
        preview: vendorToken ? vendorToken.slice(0, 20) + '…' : null,
      });

      if (!vendorToken || vendorToken === 'null') {
        console.warn(
          '[SwitchProfile] ❌ ABORT — no vendorToken stored on this device'
        );
        return { success: false, reason: 'NO_SESSION', role: 'vendor' };
      }

      // ✅ Hydrate Redux vendorAuth BEFORE flipping activeRole.
      const vendorAuthState = state?.vendorAuth;
      if (!vendorAuthState?.token || !vendorAuthState?.vendor) {
        try {
          const rawVendor = await AsyncStorage.getItem('vendor');
          const vendor =
            rawVendor && rawVendor !== 'null'
              ? JSON.parse(rawVendor)
              : null;

          if (vendor && typeof hydrateVendor === 'function') {
            store.dispatch(hydrateVendor({ vendor, token: vendorToken }));
            console.log(
              '[SwitchProfile] ✅ vendor hydrated into Redux before role flip'
            );
          } else {
            console.warn(
              '[SwitchProfile] ⚠️ no cached vendor object on disk to hydrate'
            );
          }
        } catch (e) {
          console.warn('[SwitchProfile] ⚠️ failed to hydrate vendor:', e);
        }
      } else {
        console.log(
          '[SwitchProfile] vendor already present in Redux — skip hydrate'
        );
      }

      // ── Socket ──
      try {
        const userId = state?.auth?.user?._id;
        const vendorId = state?.vendorAuth?.vendor?._id;
        console.log('[SwitchProfile] Socket IDs:', {
          userId: userId ?? null,
          vendorId: vendorId ?? null,
        });

        if (userId && socket?.emit) {
          socket.emit('leave', userId);
          console.log(`[SwitchProfile] socket.emit('leave', user=${userId})`);
        }
        if (vendorId && socket?.emit) {
          socket.emit('join', vendorId);
          console.log(
            `[SwitchProfile] socket.emit('join', vendor=${vendorId})`
          );
        }
      } catch (e) {
        console.warn('[SwitchProfile] ⚠️ socket join/leave failed:', e);
      }

      // ── Re-register device push token against vendor ──
      const vendorIdForPush =
        state?.vendorAuth?.vendor?._id || state?.vendorAuth?.vendor?.id;
      console.log('[SwitchProfile] Push re-register target:', {
        vendorId: vendorIdForPush ?? null,
        registerPushAvailable: typeof registerPush === 'function',
      });

      if (vendorIdForPush && typeof registerPush === 'function') {
        try {
          console.log(
            `[SwitchProfile] 📡 Calling registerPush(vendorId=${vendorIdForPush}, role='vendor')…`
          );
          const t0 = Date.now();
          const result = await registerPush(
            String(vendorIdForPush),
            'vendor'
          );
          const ms = Date.now() - t0;
          console.log(
            `[SwitchProfile] ✅ registerPush resolved in ${ms}ms. Token:`,
            result ? result.slice(0, 30) + '…' : '(null)'
          );
        } catch (e: any) {
          console.warn(
            '[SwitchProfile] ❌ registerPush THREW for vendor:',
            e?.message || e
          );
        }
      } else {
        if (!vendorIdForPush) {
          console.warn(
            '[SwitchProfile] ⚠️ Skipping registerPush — vendorId is missing in Redux state.'
          );
        }
        if (typeof registerPush !== 'function') {
          console.warn(
            '[SwitchProfile] ⚠️ Skipping registerPush — helper not loaded'
          );
        }
      }

      // ✅ Await the AsyncStorage write BEFORE dispatching.
      await AsyncStorage.setItem('activeRole', 'vendor').catch((e) =>
        console.warn('[SwitchProfile] ⚠️ activeRole write failed:', e)
      );

      console.log("[SwitchProfile] 🔄 dispatch(setActiveRole('vendor'))");
      store.dispatch(setActiveRole('vendor'));

      const after = store.getState() as any;
      console.log(
        `[SwitchProfile] ✔️ DONE — new activeRole='${after?.session?.activeRole}'`,
        '| vendorToken in redux:',
        !!after?.vendorAuth?.token,
        '| vendor in redux:',
        !!after?.vendorAuth?.vendor
      );
      console.log('════════════════════════════════════════════════════');
      return { success: true, role: 'vendor' };
    }

    // ═════════════════════════════════════════════════════════
    // SWITCH TO USER
    // ═════════════════════════════════════════════════════════
    if (targetRole === 'user') {
      console.log('[SwitchProfile] → branch = USER');

      const userToken = await AsyncStorage.getItem('token');
      console.log('[SwitchProfile] user token in storage:', {
        exists: !!userToken,
        preview: userToken ? userToken.slice(0, 20) + '…' : null,
      });

      if (!userToken || userToken === 'null') {
        console.warn(
          '[SwitchProfile] ❌ ABORT — no user token stored on this device'
        );
        return { success: false, reason: 'NO_SESSION', role: 'user' };
      }

      const authState = state?.auth;
      if (!authState?.user?.token || !authState?.user) {
        try {
          const rawUser = await AsyncStorage.getItem('user');
          const user =
            rawUser && rawUser !== 'null' ? JSON.parse(rawUser) : null;

          if (user && typeof setUser === 'function') {
            store.dispatch(setUser({ ...user, token: userToken }));
            console.log(
              '[SwitchProfile] ✅ user hydrated into Redux before role flip'
            );
          } else {
            console.warn(
              '[SwitchProfile] ⚠️ no cached user object on disk to hydrate'
            );
          }
        } catch (e) {
          console.warn('[SwitchProfile] ⚠️ failed to hydrate user:', e);
        }
      } else {
        console.log(
          '[SwitchProfile] user already present in Redux — skip hydrate'
        );
      }

      try {
        const userId = state?.auth?.user?._id;
        const vendorId = state?.vendorAuth?.vendor?._id;
        console.log('[SwitchProfile] Socket IDs:', {
          userId: userId ?? null,
          vendorId: vendorId ?? null,
        });

        if (vendorId && socket?.emit) {
          socket.emit('leave', vendorId);
          console.log(
            `[SwitchProfile] socket.emit('leave', vendor=${vendorId})`
          );
        }
        if (userId && socket?.emit) {
          socket.emit('join', userId);
          console.log(`[SwitchProfile] socket.emit('join', user=${userId})`);
        }
      } catch (e) {
        console.warn('[SwitchProfile] ⚠️ socket join/leave failed:', e);
      }

      const userIdForPush = state?.auth?.user?._id || state?.auth?.user?.id;
      console.log('[SwitchProfile] Push re-register target:', {
        userId: userIdForPush ?? null,
        registerPushAvailable: typeof registerPush === 'function',
      });

      if (userIdForPush && typeof registerPush === 'function') {
        try {
          console.log(
            `[SwitchProfile] 📡 Calling registerPush(userId=${userIdForPush}, role='user')…`
          );
          const t0 = Date.now();
          const result = await registerPush(String(userIdForPush), 'user');
          const ms = Date.now() - t0;
          console.log(
            `[SwitchProfile] ✅ registerPush resolved in ${ms}ms. Token:`,
            result ? result.slice(0, 30) + '…' : '(null)'
          );
        } catch (e: any) {
          console.warn(
            '[SwitchProfile] ❌ registerPush THREW for user:',
            e?.message || e
          );
        }
      } else {
        if (!userIdForPush) {
          console.warn(
            '[SwitchProfile] ⚠️ Skipping registerPush — userId is missing in Redux state.'
          );
        }
        if (typeof registerPush !== 'function') {
          console.warn(
            '[SwitchProfile] ⚠️ Skipping registerPush — helper not loaded'
          );
        }
      }

      await AsyncStorage.setItem('activeRole', 'user').catch((e) =>
        console.warn('[SwitchProfile] ⚠️ activeRole write failed:', e)
      );

      console.log("[SwitchProfile] 🔄 dispatch(setActiveRole('user'))");
      store.dispatch(setActiveRole('user'));

      const after = store.getState() as any;
      console.log(
        `[SwitchProfile] ✔️ DONE — new activeRole='${after?.session?.activeRole}'`,
        '| userToken in redux:',
        !!after?.auth?.user?.token,
        '| user in redux:',
        !!after?.auth?.user
      );
      console.log('════════════════════════════════════════════════════');
      return { success: true, role: 'user' };
    }

    console.warn(`[SwitchProfile] ❌ Unknown targetRole='${targetRole}'`);
    console.log('════════════════════════════════════════════════════');
    return { success: false, reason: 'NO_SESSION', role: targetRole };
  } finally {
    if (typeof setSwitchingProfile === 'function') {
      setTimeout(() => {
        try {
          setSwitchingProfile(false);
          console.log('[SwitchProfile] 🔓 switching flag lowered');
        } catch {}
      }, 800);
    }
  }
};

/** Does the *other* role currently have a stored session? */
export const hasOtherSession = async (
  currentRole: Role
): Promise<boolean> => {
  if (currentRole === 'vendor') {
    return !!(await AsyncStorage.getItem('token'));
  }
  return !!(await AsyncStorage.getItem('vendorToken'));
};