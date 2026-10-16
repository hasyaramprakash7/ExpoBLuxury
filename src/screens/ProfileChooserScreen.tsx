// src/screens/ProfileChooserScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../app/store';
import { setActiveRole } from '../features/session/sessionSlice';

const { width } = Dimensions.get('window');

const Colors = {
  background: '#0A0A0A',
  card: '#151515',
  cardBorder: '#2A2A2A',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  royalGreen: '#00A651',
  gold: '#FFD700',
  onlineGreen: '#34C759',
};

const ProfileChooserScreen = ({ navigation }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);
  const { vendor, isAuthenticated: vendorAuthed } = useSelector(
    (s: RootState) => s.vendorAuth
  );
  const hasHydrated = useSelector((s: RootState) => s.session.hasHydrated);

  const hasUser = !!user?.token;
  const hasVendor = !!vendor?._id || vendorAuthed;

  const pickUser = () => {
    if (hasUser) {
      dispatch(setActiveRole('user'));
    } else {
      navigation.navigate('Login');
    }
  };

  const pickVendor = () => {
    if (hasVendor) {
      dispatch(setActiveRole('vendor'));
    } else {
      navigation.navigate('VendorLogin');
    }
  };

  const goDeliveryBoy = () => navigation.navigate('DeliveryBoyLogin');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>BLUXURY</Text>
          <Text style={styles.title}>Who's using the app?</Text>
          <Text style={styles.subtitle}>
            Tap a profile to continue. You can switch anytime without logging
            out.
          </Text>
        </View>

        <View style={styles.grid}>
          {/* ────── USER TILE ────── */}
          <TouchableOpacity
            style={[styles.tile, hasUser ? styles.tileActiveUser : null]}
            onPress={pickUser}
            activeOpacity={0.85}
          >
            <View style={[styles.tileIconWrap, styles.tileIconUser]}>
              <Ionicons name="person" size={42} color={Colors.royalGreen} />
            </View>

            <Text style={styles.tileTitle}>User</Text>

            {hasUser ? (
              <>
                <Text style={styles.tileName} numberOfLines={1}>
                  {user?.name || 'Member'}
                </Text>
                <View style={styles.statusBadge}>
                  <View style={styles.dotOnline} />
                  <Text style={styles.statusText}>Signed in</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.tileNameMuted}>Not signed in</Text>
                <View style={styles.loginCta}>
                  <Text style={styles.loginCtaText}>Tap to Login</Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* ────── VENDOR TILE ────── */}
          <TouchableOpacity
            style={[styles.tile, hasVendor ? styles.tileActiveVendor : null]}
            onPress={pickVendor}
            activeOpacity={0.85}
          >
            <View style={[styles.tileIconWrap, styles.tileIconVendor]}>
              <Ionicons name="storefront" size={42} color={Colors.gold} />
            </View>

            <Text style={styles.tileTitle}>Vendor</Text>

            {hasVendor ? (
              <>
                <Text style={styles.tileName} numberOfLines={1}>
                  {vendor?.shopName || vendor?.name || 'Shop'}
                </Text>
                <View style={styles.statusBadge}>
                  <View style={styles.dotOnline} />
                  <Text style={styles.statusText}>Signed in</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.tileNameMuted}>Not signed in</Text>
                <View style={styles.loginCta}>
                  <Text style={styles.loginCtaText}>Tap to Login</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={goDeliveryBoy} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Delivery Boy? Sign in here</Text>
          </TouchableOpacity>

          <Text style={styles.footerHint}>
            Both accounts stay signed in on this device.
            {hasHydrated ? '' : '  (loading…)'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 30,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', marginBottom: 40 },
  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 5,
    color: Colors.royalGreen,
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  tile: {
    flex: 1,
    minHeight: (width - 54) / 2 + 80,
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActiveUser: {
    borderColor: 'rgba(0, 166, 81, 0.65)',
    shadowColor: Colors.royalGreen,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tileActiveVendor: {
    borderColor: 'rgba(255, 215, 0, 0.65)',
    shadowColor: Colors.gold,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tileIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  tileIconUser: { backgroundColor: 'rgba(0, 166, 81, 0.12)' },
  tileIconVendor: { backgroundColor: 'rgba(255, 215, 0, 0.12)' },
  tileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  tileName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tileNameMuted: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  dotOnline: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.onlineGreen,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.onlineGreen,
    letterSpacing: 0.3,
  },
  loginCta: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  loginCtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  footer: { alignItems: 'center', marginTop: 40, gap: 10 },
  footerLink: {
    fontSize: 13,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  footerHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

export default ProfileChooserScreen;