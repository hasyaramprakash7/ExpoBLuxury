// src/navigation/UserTabNavigator.tsx
import React, {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  createContext,
  useContext,
  useState,
} from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ChatScreen from '../navigation/CategoryManagementScreen';
import HomeScreen from '../screens/HomeScreen';
import InsuranceProductsAndDetails from '../navigation/BrowserScreen';
import UserOrderScreen from '../userScreens/UserOrderScreen';
import ProductSearchScreen from '../screens/UserPropertyListScreen';
import Search from '../screens/UserRentalListScreen';
import ShopListings from '../screens/ShopListings';
import AdListScreen from '../screens/AdListScreen';
import VendorLoginScreen from '../userScreens/UserProfileScreen';
import VideoSettingsScreen from '../screens/VideoSettingsScreen';

import { searchDirectoryVendors } from '../features/vendor/vendorAuthSlice';
import { fetchAllVendorProducts } from '../features/vendor/vendorProductSlices';
import { fetchCategories } from '../features/categorySlice';
import { fetchActiveAds } from '../features/adSlice';
import { fetchRentals } from '../features/rentalSlice';

const { width } = Dimensions.get('window');

const TAG = '🧭[TabNav]';
const DEBUG = true;

const log = (...args: any[]) => {
  if (DEBUG) console.log(...args);
};

// ----------------------------------------------------------------
// ⏱️ Timing helpers
// ----------------------------------------------------------------
let tapCycleId = 0;
const tapTimers: Record<number, number> = {};

const now = () =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

const logTapStart = (routeName: string) => {
  tapCycleId += 1;
  tapTimers[tapCycleId] = now();
  log(`${TAG} ▶️ TAP #${tapCycleId} → "${routeName}"`);
  return tapCycleId;
};

const logTapEvent = (cycleId: number, label: string) => {
  const t = tapTimers[cycleId];
  if (t == null) return;
  log(`${TAG}    ⏱️ ${label}: +${(now() - t).toFixed(1)}ms (cycle #${cycleId})`);
};

const logTapDone = (cycleId: number, note = '') => {
  const t = tapTimers[cycleId];
  if (t == null) return;
  log(`${TAG} ✅ TAP #${cycleId} done in ${(now() - t).toFixed(1)}ms ${note}`);
  delete tapTimers[cycleId];
};

// ----------------------------------------------------------------
// Layout constants
// ----------------------------------------------------------------
const scale = (size: number) => (width / 375) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const ROYAL = {
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
  offWhite: '#F4F4F6',
  softWhite: '#F2F2F7',
  textPrimary: '#0B0B0F',
  textSecondary: 'rgba(11,11,15,0.55)',
  borderLight: 'rgba(0,0,0,0.08)',
  shadow: 'rgba(0,0,0,0.10)',
};

const ACTIVE_COLOR = ROYAL.pureBlack;
const INACTIVE_COLOR = ROYAL.textSecondary;
const NAV_BG_COLOR = ROYAL.pureWhite;

export const TAB_BAR_CONTENT_HEIGHT = 64;
const MIN_VISUAL_GAP = 4;

const VISIBLE_ICON_COUNT = 6;
const TAB_ITEM_WIDTH = width / VISIBLE_ICON_COUNT;
const CIRCLE_SIZE = moderateScale(32);
const ICON_SIZE = moderateScale(22);

const PINNED_ROUTE_NAME = 'AdList';
export const ADLIST_INTERNAL_BAR_HEIGHT = 60;

export const RESET_ADLIST_EVENT = 'RESET_ADLIST_TAB';
export const HIDE_USER_TABBAR_EVENT = 'HIDE_USER_TABBAR';
export const SHOW_USER_TABBAR_EVENT = 'SHOW_USER_TABBAR';

// 🎯 AdList → Navigator handoff event
export const ADLIST_REQUEST_SWIPE_EVENT = 'ADLIST_REQUEST_SWIPE';

// 🎯 Order of top-level tabs for boundary-crossing swipe
const TOP_SWIPE_ORDER = [
  'Shops',
  'Rental',
  'AdList',
  'RealEstate',
  'Order',
  'Pay',
  'VendorLogin',
  'Home',
];

// 🎯 Module-level tracker of the currently active top-level tab.
// Updated by the tab bar (which has the real tab state).
const currentTabRef: { name: string } = { name: 'Shops' };

const Tab = createBottomTabNavigator();
const AdListStack = createNativeStackNavigator();

// ================================================================
// 🚀 Inline context
// ================================================================
type TabBarVisCtx = {
  hidden: boolean;
  hide: () => void;
  show: () => void;
  toggle: () => void;
};

const TabBarVisibilityContext = createContext<TabBarVisCtx | null>(null);

const TabBarVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hidden, setHidden] = useState(false);

  const hide = useCallback(() => setHidden(true), []);
  const show = useCallback(() => setHidden(false), []);
  const toggle = useCallback(() => setHidden((h) => !h), []);

  const value = useMemo(
    () => ({ hidden, hide, show, toggle }),
    [hidden, hide, show, toggle]
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
};

export const useTabBarVisibility = () => {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx)
    throw new Error(
      'useTabBarVisibility must be used inside TabBarVisibilityProvider'
    );
  return ctx;
};

// ================================================================
// 🚀 STABLE screenOptions / listeners
// ================================================================
const SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'none' as const,
  lazy: true,
  detachInactiveScreens: true,
};

const SCREEN_LISTENERS = DEBUG
  ? {
      state: (e: any) => {
        const routeName =
          e?.data?.state?.routes?.[e?.data?.state?.index]?.name || '?';
        log(`${TAG} 📢 state event → active="${routeName}"`);
      },
      focus: (e: any) => log(`${TAG} 🎯 FOCUS event → "${e.target}"`),
      blur: (e: any) => log(`${TAG} 💤 BLUR event → "${e.target}"`),
    }
  : undefined;

const makeScreenListeners = (name: string) =>
  DEBUG
    ? {
        focus: () => log(`${TAG} 🎬 SCREEN FOCUS "${name}"`),
        blur: () => log(`${TAG} ⏸️ SCREEN BLUR "${name}"`),
      }
    : undefined;

const renderTabBar = (props: any) => <ScrollableUnderCartTabBar {...props} />;

// ================================================================
// Tab Bar
// ================================================================
const ScrollableUnderCartTabBar = ({ state, navigation }: any) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const renderCountRef = useRef(0);
  const lastRenderAtRef = useRef(now());

  const activeRouteName = state.routes[state.index].name;

  // 🎯 Update the module-level tracker
  useEffect(() => {
    if (currentTabRef.name !== activeRouteName) {
      log(`${TAG} 🧭 currentTabRef → ${activeRouteName}`);
      currentTabRef.name = activeRouteName;
    }
  }, [activeRouteName]);

  const { hidden } = useTabBarVisibility();

  useEffect(() => {
    if (!DEBUG) return;
    renderCountRef.current += 1;
    const delta = now() - lastRenderAtRef.current;
    log(
      `${TAG} 🔄 TabBar render #${renderCountRef.current} ` +
        `(active="${activeRouteName}", index=${state.index}, ` +
        `since last render: ${delta.toFixed(1)}ms)`
    );
    lastRenderAtRef.current = now();
  });

  const systemBottom = insets.bottom;
  const bottomPadding = systemBottom + MIN_VISUAL_GAP;
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomPadding;

  const pinnedIndex = state.routes.findIndex(
    (r: any) => r.name === PINNED_ROUTE_NAME
  );
  const pinnedRoute = pinnedIndex >= 0 ? state.routes[pinnedIndex] : null;

  const scrollRoutes: { route: any; index: number }[] = state.routes
    .map((route: any, index: number) => ({ route, index }))
    .filter((item: any) => item.route.name !== PINNED_ROUTE_NAME);

  const activeScrollPos = scrollRoutes.findIndex(
    (item: any) => item.index === state.index
  );

  const handleTabPress = useCallback(
    (routeName: string, targetIndex: number) => {
      const cycleId = DEBUG ? logTapStart(routeName) : 0;

      if (targetIndex === state.index) {
        log(
          `${TAG} 🔁 Re-tap on active "${routeName}" — emitting ${RESET_ADLIST_EVENT}`
        );

        if (routeName === PINNED_ROUTE_NAME) {
          navigation.emit({
            type: RESET_ADLIST_EVENT,
            target: state.routes[targetIndex].key,
            canPreventDefault: false,
          });
        }

        if (DEBUG) logTapDone(cycleId, '(re-tap, no nav)');
        return;
      }

      navigation.jumpTo(routeName);
      if (DEBUG) logTapEvent(cycleId, 'navigation.jumpTo() returned');

      if (DEBUG) {
        Promise.resolve().then(() =>
          logTapEvent(cycleId, 'microtask after jumpTo')
        );
        requestAnimationFrame(() => {
          logTapEvent(cycleId, 'next animation frame');
          logTapDone(cycleId, '(frame painted)');
        });
      }
    },
    [navigation, state.index, state.routes]
  );

  useEffect(() => {
    const viewportWidth = width - TAB_ITEM_WIDTH;

    if (activeScrollPos < 0) {
      scrollViewRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }

    const centerOffset = Math.max(0, (viewportWidth - TAB_ITEM_WIDTH) / 2);

    const targetX = Math.max(
      0,
      activeScrollPos * TAB_ITEM_WIDTH - centerOffset
    );

    scrollViewRef.current?.scrollTo({ x: targetX, animated: true });
  }, [activeScrollPos]);

  const renderTabButton = useCallback(
    (route: any, index: number) => {
      const isFocused = state.index === index;
      const iconColor = isFocused ? ROYAL.pureWhite : INACTIVE_COLOR;

      return (
        <TouchableOpacity
          key={route.key}
          onPress={() => handleTabPress(route.name, index)}
          activeOpacity={0.7}
          delayPressIn={0}
          delayPressOut={0}
          style={[tabStyles.tabItem, { width: TAB_ITEM_WIDTH }]}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <View
            style={[
              tabStyles.iconCircle,
              isFocused
                ? tabStyles.iconCircleActive
                : tabStyles.iconCircleInactive,
            ]}
          >
            <Ionicons
              name={getIcon(route.name, isFocused)}
              size={ICON_SIZE}
              color={iconColor}
            />
          </View>
          <Text
            style={[
              tabStyles.tabLabel,
              { color: isFocused ? ACTIVE_COLOR : INACTIVE_COLOR },
            ]}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {getLabel(route.name)}
          </Text>
        </TouchableOpacity>
      );
    },
    [state.index, handleTabPress]
  );

  if (hidden) return null;

  return (
    <View
      style={[
        tabStyles.mainContainer,
        {
          backgroundColor: NAV_BG_COLOR,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {pinnedRoute && (
        <View style={tabStyles.pinnedZone}>
          {renderTabButton(pinnedRoute, pinnedIndex)}
        </View>
      )}

      <View style={tabStyles.scrollZone}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={tabStyles.scrollContent}
          decelerationRate="fast"
          keyboardShouldPersistTaps="always"
          snapToInterval={TAB_ITEM_WIDTH}
          snapToAlignment="start"
        >
          {scrollRoutes.map(({ route, index }) =>
            renderTabButton(route, index)
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const getIcon = (name: string, focused: boolean) => {
  const icons: Record<string, any> = {
    Shops: focused ? 'storefront' : 'storefront-outline',
    Rental: focused ? 'key' : 'key-outline',
    Order: focused ? 'bag' : 'bag-outline',
    RealEstate: focused ? 'home' : 'home-outline',
    Pay: focused ? 'wallet' : 'wallet-outline',
    AdList: focused ? 'list' : 'list-outline',
    Home: focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline',
    Vendor: focused ? 'business' : 'business-outline',
    VendorLogin: focused ? 'person' : 'person-outline',
  };
  return icons[name] || 'apps-outline';
};

const getLabel = (name: string) => {
  const labels: Record<string, string> = {
    Shops: 'Shops',
    Rental: 'Rental',
    Order: 'Shop',
    RealEstate: 'Property',
    Pay: 'Pay',
    AdList: 'Posts',
    Home: 'Chat',
    Vendor: 'Vendor',
    VendorLogin: 'Profile',
  };
  return labels[name] || name;
};

// ================================================================
// 🚀 AdList wrapper — Stack Navigator
// Wraps AdListScreen so it can push VideoSettings, etc.
// ================================================================
const AdListTabScreen = (props: any) => {
  return (
    <AdListStack.Navigator screenOptions={{ headerShown: false }}>
      <AdListStack.Screen name="AdListMain">
        {(screenProps) => <AdListScreen {...screenProps} {...props} />}
      </AdListStack.Screen>
      <AdListStack.Screen
        name="VideoSettings"
        component={VideoSettingsScreen}
      />
    </AdListStack.Navigator>
  );
};

// ================================================================
// 🚀 Static screen definitions
// ================================================================
const BASE_SCREENS = [
  { name: 'Shops', component: ShopListings },
  { name: 'Rental', component: Search },
  { name: 'AdList', component: AdListTabScreen },
  { name: 'RealEstate', component: ProductSearchScreen },
  { name: 'Order', component: HomeScreen },
  { name: 'Pay', component: UserOrderScreen },
  { name: 'VendorLogin', component: VendorLoginScreen },
];

const SCREEN_LISTENERS_MAP: Record<string, any> = {
  Shops: makeScreenListeners('Shops'),
  Rental: makeScreenListeners('Rental'),
  AdList: makeScreenListeners('AdList'),
  RealEstate: makeScreenListeners('RealEstate'),
  Order: makeScreenListeners('Order'),
  Pay: makeScreenListeners('Pay'),
  VendorLogin: makeScreenListeners('VendorLogin'),
  Home: makeScreenListeners('Home'),
};

// ================================================================
// 🎯 SwipeBridge — receives handoff events from AdList
// ================================================================
const SwipeBridge: React.FC<{
  children: React.ReactNode;
  navigationRef: React.MutableRefObject<any>;
}> = ({ children, navigationRef }) => {
  const [navReady, setNavReady] = useState(false);

  // Poll until navigationRef.current is set
  useEffect(() => {
    let cancelled = false;
    let rafId: any = null;

    const check = () => {
      if (cancelled) return;
      if (navigationRef.current) {
        log(`${TAG} 🧭 SwipeBridge: navigation ready`);
        setNavReady(true);
        return;
      }
      rafId = requestAnimationFrame(check);
    };
    check();

    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [navigationRef]);

  useEffect(() => {
    if (!navReady) return;
    const navigation = navigationRef.current;
    if (!navigation) return;

    log(`${TAG} 🧭 SwipeBridge: attaching ADLIST_REQUEST_SWIPE listener`);

    const unsubSwipe = navigation.addListener(
      ADLIST_REQUEST_SWIPE_EVENT as any,
      (payload: any) => {
        const dir = payload?.direction === 'prev' ? 'prev' : 'next';
        const current = currentTabRef.name;
        const idx = TOP_SWIPE_ORDER.indexOf(current);
        if (idx < 0) {
          log(`${TAG} 🧭 handoff: unknown route ${current}`);
          return;
        }
        const nextIdx = dir === 'next' ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= TOP_SWIPE_ORDER.length) {
          log(`${TAG} 🧭 handoff ${dir}: no more tabs (${current})`);
          return;
        }
        const target = TOP_SWIPE_ORDER[nextIdx];
        log(`${TAG} 🧭 handoff ${dir}: ${current} → ${target}`);
        try {
          navigation.navigate(target as never);
        } catch (err) {
          log(`${TAG} 🧭 handoff navigate failed:`, err);
        }
      }
    );

    return () => {
      unsubSwipe?.();
    };
  }, [navReady, navigationRef]);

  return <View style={{ flex: 1 }}>{children}</View>;
};

// ================================================================
// Navigator
// ================================================================
const UserTabNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigationRef = useRef<any>(null);

  const user = useSelector((state: RootState) => state.auth.user);
  const selectedAddress = useSelector(
    (state: RootState) => state.location.selectedAddress
  );
  const userLocation = useSelector(
    (state: RootState) => state.location.location
  );

  const rawPhone = user?.phone || user?.mobile || '';
  let normalizedPhone = rawPhone.replace(/\D/g, '');
  if (normalizedPhone.startsWith('91')) {
    normalizedPhone = normalizedPhone.substring(2);
  }
  const isSpecialUser = normalizedPhone === '7893828468';

  const screens = useMemo(() => {
    if (isSpecialUser) {
      return [...BASE_SCREENS, { name: 'Home', component: ChatScreen }];
    }
    return BASE_SCREENS;
  }, [isSpecialUser]);

  const prefetchDoneRef = useRef(false);
  useEffect(() => {
    if (prefetchDoneRef.current) return;
    prefetchDoneRef.current = true;

    const handle = setTimeout(() => {
      const t0 = now();
      log(`${TAG} 🚀 Prefetching tab data (background)…`);

      const lat = selectedAddress?.latitude ?? userLocation?.latitude;
      const lng = selectedAddress?.longitude ?? userLocation?.longitude;

      dispatch(fetchCategories());
      dispatch(fetchActiveAds({ page: 1, limit: 20 }));
      dispatch(fetchAllVendorProducts());
      if (lat && lng) {
        dispatch(searchDirectoryVendors({ lat, lng, radius: 10 }));
      } else {
        dispatch(searchDirectoryVendors({ radius: 10 }));
      }

      dispatch(
        fetchRentals({
          page: 1,
          limit: 10,
          isAvailable: true,
          city: selectedAddress?.city || undefined,
          state: selectedAddress?.state || undefined,
          locality: selectedAddress?.locality || undefined,
          pincode: selectedAddress?.pincode || undefined,
        })
      );

      log(`${TAG} 🚀 Prefetch dispatched in ${(now() - t0).toFixed(1)}ms`);
    }, 400);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TabBarVisibilityProvider>
      <View style={{ flex: 1, backgroundColor: ROYAL.offWhite }}>
        <SwipeBridge navigationRef={navigationRef}>
          <Tab.Navigator
            initialRouteName="Shops"
            tabBar={renderTabBar}
            screenOptions={SCREEN_OPTIONS}
            screenListeners={SCREEN_LISTENERS}
            ref={(nav) => {
              navigationRef.current = nav;
            }}
          >
            {screens.map(({ name, component }) => (
              <Tab.Screen
                key={name}
                name={name}
                component={component}
                listeners={SCREEN_LISTENERS_MAP[name]}
              />
            ))}
          </Tab.Navigator>
        </SwipeBridge>
      </View>
    </TabBarVisibilityProvider>
  );
};

// ================================================================
// Styles
// ================================================================
const tabStyles = StyleSheet.create({
  mainContainer: {
    width: width,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: ROYAL.borderLight,
    paddingTop: 6,
    shadowColor: ROYAL.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 20,
    overflow: 'visible',
  },
  pinnedZone: {
    width: TAB_ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ROYAL.pureWhite,
    zIndex: 2,
    overflow: 'visible',
  },
  scrollZone: {
    flex: 1,
    overflow: 'visible',
  },
  scrollContent: {
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingTop: 4,
    marginRight: 6,
    paddingBottom: 2,
    overflow: 'visible',
    width: TAB_ITEM_WIDTH,
  },
  iconCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    overflow: 'hidden',
  },
  iconCircleActive: {
    backgroundColor: ROYAL.pureBlack,
  },
  iconCircleInactive: {
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 0,
    paddingBottom: 4,
    textAlign: 'center',
    flexShrink: 0,
  },
});

export default UserTabNavigator;