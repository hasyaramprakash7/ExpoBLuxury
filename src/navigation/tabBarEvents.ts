// src/navigation/tabBarEvents.ts
// Shared navigation event constants + tab-bar visibility hook.
// Contains no imports from UserTabNavigator / AdListScreen,
// so it can be required from either side without creating a cycle.

import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

export const RESET_ADLIST_EVENT = 'RESET_ADLIST_TAB';
export const HIDE_USER_TABBAR_EVENT = 'HIDE_USER_TABBAR';
export const SHOW_USER_TABBAR_EVENT = 'SHOW_USER_TABBAR';
export const ADLIST_REQUEST_SWIPE_EVENT = 'ADLIST_REQUEST_SWIPE';

/**
 * Hook — emits tab-bar visibility events on the current navigator.
 * Safe to call from any screen inside the UserTab navigator tree.
 */
export function useTabBarVisibility() {
  const navigation = useNavigation<any>();

  const hide = useCallback(() => {
    navigation?.emit?.({
      type: HIDE_USER_TABBAR_EVENT,
      canPreventDefault: false,
    });
  }, [navigation]);

  const show = useCallback(() => {
    navigation?.emit?.({
      type: SHOW_USER_TABBAR_EVENT,
      canPreventDefault: false,
    });
  }, [navigation]);

  return { hide, show };
}