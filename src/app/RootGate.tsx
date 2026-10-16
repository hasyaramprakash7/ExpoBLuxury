// src/app/RootGate.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { persistor, RootState, AppDispatch, setHydrated } from './store';
import {
  setActiveRole,
  clearActiveRole,
} from '../features/session/sessionSlice';
import { hydrateVendor } from '../features/vendor/vendorAuthSlice';
import { setUser } from '../features/user/authSlice';

interface Props {
  children: React.ReactNode;
}

const RootGate: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const hydrated = useSelector((s: RootState) => s.bootstrap.hydrated);
  const [ready, setReady] = useState(hydrated);

  // 1. Wait for redux-persist
  useEffect(() => {
    if (hydrated) {
      setReady(true);
      return;
    }
    const { bootstrapped } = persistor.getState();
    if (bootstrapped) {
      dispatch(setHydrated(true));
      setReady(true);
      return;
    }
    const unsub = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        dispatch(setHydrated(true));
        setReady(true);
      }
    });
    return () => unsub();
  }, [hydrated, dispatch]);

  // 2. Top-up + role decision
  useEffect(() => {
    if (!ready) return;

    (async () => {
      const store = (await import('./store')).store;
      const before = store.getState() as RootState;

      console.log('══════════════════════════════════════════════');
      console.log('[RootGate] ── TOP-UP START ──');
      console.log('[RootGate] Redux before top-up:', {
        activeRole: before.session?.activeRole ?? null,
        hasUser: !!before.auth?.user,
        hasUserToken: !!before.auth?.user?.token,
        hasVendor: !!before.vendorAuth?.vendor,
        hasVendorToken: !!before.vendorAuth?.token,
        isVendorAuthed: !!before.vendorAuth?.isAuthenticated,
      });

      // ── Read both sources ──
      const [
        diskUser,
        diskUserToken,
        diskVendor,
        diskVendorToken,
        diskPersist,
      ] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('vendor'),
        AsyncStorage.getItem('vendorToken'),
        AsyncStorage.getItem('persist:root'),
      ]);

      // Parse persist:root once so we can use it as fallback evidence.
      let persistVendor: any = null;
      let persistVendorToken: string | null = null;
      let persistUser: any = null;
      let persistUserToken: string | null = null;
      if (diskPersist) {
        try {
          const parsed = JSON.parse(diskPersist);
          if (parsed?.vendorAuth) {
            const va = JSON.parse(parsed.vendorAuth);
            persistVendor = va?.vendor ?? null;
            persistVendorToken = va?.token ?? null;
          }
          if (parsed?.auth) {
            const a = JSON.parse(parsed.auth);
            persistUser = a?.user ?? null;
            persistUserToken = a?.user?.token ?? null;
          }
        } catch (e) {
          console.warn('[RootGate] persist:root parse failed:', e);
        }
      }

      // ── Evidence of a session, from Redux OR legacy keys OR persist blob ──
      const reduxHasUserToken = !!before.auth?.user?.token;
      const reduxHasUserRecord = !!before.auth?.user;
      const reduxHasVendorToken = !!before.vendorAuth?.token;
      const reduxHasVendorRecord = !!before.vendorAuth?.vendor;

      const legacyHasUserToken = !!diskUserToken && diskUserToken !== 'null';
      const legacyHasVendorToken =
        !!diskVendorToken && diskVendorToken !== 'null';
      const legacyHasUserRecord = !!diskUser;
      const legacyHasVendorRecord = !!diskVendor;

      const persistHasUserToken =
        !!persistUserToken && persistUserToken !== 'null';
      const persistHasVendorToken =
        !!persistVendorToken && persistVendorToken !== 'null';
      const persistHasUserRecord = !!persistUser;
      const persistHasVendorRecord = !!persistVendor;

      const hasUserToken =
        reduxHasUserToken || legacyHasUserToken || persistHasUserToken;
      const hasVendorToken =
        reduxHasVendorToken || legacyHasVendorToken || persistHasVendorToken;
      const hasUserRecord =
        reduxHasUserRecord || legacyHasUserRecord || persistHasUserRecord;
      const hasVendorRecord =
        reduxHasVendorRecord || legacyHasVendorRecord || persistHasVendorRecord;

      console.log('[RootGate] Session evidence:', {
        hasUser: hasUserRecord,
        hasUserToken,
        hasVendor: hasVendorRecord,
        hasVendorToken,
        sources: {
          reduxVendor: reduxHasVendorRecord && reduxHasVendorToken,
          legacyVendor: legacyHasVendorRecord && legacyHasVendorToken,
          persistVendor: persistHasVendorRecord && persistHasVendorToken,
        },
      });

      // ── Rehydrate Redux only if it has neither token nor vendor object ──
      // Prefer the persist blob when the legacy keys are gone.
      if (!before.vendorAuth.vendor && hasVendorRecord && hasVendorToken) {
        try {
          const vendor =
            reduxHasVendorRecord && before.vendorAuth.vendor
              ? before.vendorAuth.vendor
              : persistHasVendorRecord
              ? persistVendor
              : JSON.parse(diskVendor as string);
          const token =
            before.vendorAuth.token ||
            (persistHasVendorToken ? persistVendorToken : diskVendorToken) ||
            '';
          if (vendor && token) {
            dispatch(hydrateVendor({ vendor, token }));
            console.log('[RootGate] ✅ vendor rehydrated');
          }
        } catch (e) {
          console.warn('[RootGate] ❌ vendor rehydrate failed:', e);
        }
      }

      if (!before.auth.user && hasUserRecord && hasUserToken) {
        try {
          const user =
            persistHasUserRecord
              ? persistUser
              : JSON.parse(diskUser as string);
          const token =
            before.auth.user?.token ||
            (persistHasUserToken ? persistUserToken : diskUserToken) ||
            '';
          if (user && token) {
            dispatch(setUser({ ...user, token }));
            console.log('[RootGate] ✅ user rehydrated');
          }
        } catch (e) {
          console.warn('[RootGate] ❌ user rehydrate failed:', e);
        }
      }

      // ── ROLE DECISION ──
      const userExists = hasUserToken && hasUserRecord;
      const vendorExists = hasVendorToken && hasVendorRecord;

      const preferred = before.session?.activeRole ?? null;
      let role: 'user' | 'vendor' | null = null;

      console.log('[RootGate] ── ROLE DECISION ──', {
        preferred,
        userExists,
        vendorExists,
      });

      if (preferred === 'vendor' && vendorExists) {
        role = 'vendor';
      } else if (preferred === 'user' && userExists) {
        role = 'user';
      } else if (vendorExists && !userExists) {
        role = 'vendor';
      } else if (userExists && !vendorExists) {
        role = 'user';
      } else if (userExists && vendorExists) {
        role = null;
      } else {
        role = null;
      }

      if (role) {
        dispatch(setActiveRole(role));
      } else {
        dispatch(clearActiveRole());
      }

      console.log('[RootGate] FINAL role =', role);
      console.log('[RootGate] ── TOP-UP END ──');
      console.log('══════════════════════════════════════════════');
    })();
  }, [ready, dispatch]);

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00A651" />
        <Text style={styles.text}>Loading your session…</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  text: { color: '#A0A0A0', fontSize: 13, letterSpacing: 0.5 },
});

export default RootGate;