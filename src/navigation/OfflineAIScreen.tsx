// screens/OfflineAIScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const AI_URL = 'https://peaceful-madeleine-de4db0.netlify.app/';

const OfflineAIScreen = () => {
  const navigation = useNavigation<any>();
  const [error, setError] = useState<string | null>(null);
  const hasOpened = useRef(false);
  const isOpening = useRef(false);

  const openInAppBrowser = useCallback(async () => {
    if (isOpening.current) return;
    isOpening.current = true;

    try {
      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(AI_URL, {
          // iOS
          dismissButtonStyle: 'close',
          preferredBarTintColor: '#0A3D2B',
          preferredControlTintColor: '#FFFFFF',
          readerMode: false,
          animated: true,
          modalPresentationStyle: 'fullScreen',
          modalTransitionStyle: 'coverVertical',
          modalEnabled: true,
          enableBarCollapsing: true,
          // Android
          showTitle: true,
          toolbarColor: '#0A3D2B',
          secondaryToolbarColor: '#0A3D2B',
          navigationBarColor: '#0A3D2B',
          navigationBarDividerColor: '#0A3D2B',
          enableUrlBarHiding: true,
          enableDefaultShare: true,
          forceCloseOnRedirection: false,
          // Shared
          animations: {
            start: 'slide_in',
            exit: 'slide_out',
          },
        });

        // When browser closes, go back to previous screen
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      } else {
        // Fallback: system browser
        const supported = await Linking.canOpenURL(AI_URL);
        if (supported) {
          await Linking.openURL(AI_URL);
          if (navigation.canGoBack()) navigation.goBack();
        } else {
          setError('Cannot open the AI site on this device.');
        }
      }
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      const isCancel =
        msg.includes('cancel') ||
        msg.includes('dismiss') ||
        msg.includes('user did not share');

      if (isCancel) {
        // User closed the browser — just go back
        if (navigation.canGoBack()) navigation.goBack();
      } else {
        console.warn('InAppBrowser error:', err);
        setError('Failed to open the AI site. Please try again.');
      }
    } finally {
      isOpening.current = false;
    }
  }, [navigation]);

  // Open immediately when screen mounts
  useEffect(() => {
    if (!hasOpened.current) {
      hasOpened.current = true;
      // tiny delay so navigation transition finishes before browser slides up
      const t = setTimeout(() => openInAppBrowser(), 150);
      return () => clearTimeout(t);
    }
  }, [openInAppBrowser]);

  // If user comes back to this screen, re-open
  useFocusEffect(
    useCallback(() => {
      if (hasOpened.current && !error && !isOpening.current) {
        const t = setTimeout(() => openInAppBrowser(), 150);
        return () => clearTimeout(t);
      }
    }, [openInAppBrowser, error])
  );

  // ----- Error screen (only shown if opening fails) -----
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContent}>
          <Ionicons name="cloud-offline-outline" size={64} color="#CCCCCC" />
          <Text style={styles.errorTitle}>Can't open the AI</Text>
          <Text style={styles.errorMessage}>{error}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              openInAppBrowser();
            }}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ----- Blank white screen while browser is opening (no spinner, no placeholder) -----
  return (
    <View style={styles.blank}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    </View>
  );
};

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  errorContent: {
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0A3D2B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#0A3D2B',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default OfflineAIScreen;