// src/utils/getActiveToken.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { RootState } from '../app/store';

/**
 * Returns the bearer token for the currently active role.
 * ⚠️ This is ASYNC because SecureStore + AsyncStorage are async.
 *    Always `await getActiveToken(...)`.
 */
export async function getActiveToken(
  state: RootState
): Promise<string | null> {
  const role = state.session?.activeRole ?? 'user';

  if ((role as string) === 'admin') {
    return SecureStore.getItemAsync('adminToken').catch(() => null);
  }

  if ((role as string) === 'deliveryBoy') {
    return SecureStore.getItemAsync('deliveryBoyToken').catch(() => null);
  }

  if (role === 'vendor') {
    const t = await AsyncStorage.getItem('vendorToken');
    return t && t !== 'null' ? t : null;
  }

  const t = await AsyncStorage.getItem('token');
  return t && t !== 'null' ? t : null;
}

/**
 * Async variant that does NOT need the Redux state — reads the store
 * directly. Useful inside thunks and interceptors.
 */
export async function getActiveTokenFromStore(): Promise<{
  token: string | null;
  role: string;
}> {
  let role: string = 'user';
  try {
    // Lazy require to avoid circular import at module load time.
    const { store } = require('../app/store');
    role = store?.getState?.()?.session?.activeRole ?? 'user';
  } catch {
    role = 'user';
  }

  if (role === 'admin') {
    const token = await SecureStore.getItemAsync('adminToken').catch(
      () => null
    );
    return { token, role };
  }
  if (role === 'deliveryBoy') {
    const token = await SecureStore.getItemAsync('deliveryBoyToken').catch(
      () => null
    );
    return { token, role };
  }
  if (role === 'vendor') {
    const token = await AsyncStorage.getItem('vendorToken');
    return { token: token && token !== 'null' ? token : null, role };
  }
  const token = await AsyncStorage.getItem('token');
  return { token: token && token !== 'null' ? token : null, role };
}