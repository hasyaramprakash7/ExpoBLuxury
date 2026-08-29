// screens/WebViewScreen.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DIR = (FileSystem.documentDirectory || '') + 'webview_cache/';
const CACHE_META_KEY = 'webview_cache_meta';

const WebViewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { url, title } = route.params as { url: string; title?: string };
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [cachedHtml, setCachedHtml] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Throttle progress updates
  const lastProgress = useRef(0);

  // ---- Initialize cache directory ----
  useEffect(() => {
    const initCache = async () => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        }
      } catch (e) {
        console.warn('Cache init error:', e);
      }
    };
    initCache();
  }, []);

  // ---- Load cached HTML ----
  useEffect(() => {
    const loadCache = async () => {
      try {
        const fileName = encodeURIComponent(url) + '.html';
        const filePath = CACHE_DIR + fileName;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists) {
          const html = await FileSystem.readAsStringAsync(filePath, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          setCachedHtml(html);
          setIsCached(true);
          setLoading(false);
        } else {
          setLoading(true);
        }
      } catch (error) {
        console.warn('Cache read error:', error);
        setLoading(true);
      }
    };
    loadCache();
  }, [url]);

  // ---- Save HTML to cache ----
  const saveHtmlToCache = async (html: string) => {
    try {
      const fileName = encodeURIComponent(url) + '.html';
      const filePath = CACHE_DIR + fileName;
      await FileSystem.writeAsStringAsync(filePath, html, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await AsyncStorage.setItem(CACHE_META_KEY + url, Date.now().toString());
      console.log('✅ HTML cached to file');
    } catch (error) {
      console.warn('Cache save error:', error);
    }
  };

  // ---- Get HTML from WebView (only once) ----
  const extractHtml = () => {
    // Only extract if not already cached
    if (isCached) return;
    const script = `
      (function() {
        const html = document.documentElement.outerHTML;
        window.ReactNativeWebView.postMessage(html);
      })();
    `;
    webViewRef.current?.injectJavaScript(script);
  };

  // ---- Handle messages ----
  const handleMessage = (event: any) => {
    const data = event.nativeEvent.data;
    if (data && (data.startsWith('<!DOCTYPE') || data.startsWith('<html'))) {
      saveHtmlToCache(data);
      setIsCached(true);
    }
  };

  // ---- WebView events ----
  const onLoadStart = () => {
    if (!isCached) setLoading(true);
  };

  const onLoadEnd = () => {
    setLoading(false);
    setIsRefreshing(false);
    if (!isCached) {
      extractHtml();
    }
  };

  const onNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setCurrentUrl(navState.url);
  };

  const onLoadProgress = (event: any) => {
    const newProgress = event.nativeEvent.progress;
    // Only update if progress changed significantly (avoid excessive re-renders)
    if (Math.abs(newProgress - lastProgress.current) > 0.05) {
      setProgress(newProgress);
      lastProgress.current = newProgress;
    }
  };

  // ---- Navigation ----
  const handleBack = () => {
    if (canGoBack) {
      webViewRef.current?.goBack();
    } else {
      navigation.goBack();
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check this out: ${currentUrl}`, url: currentUrl });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const handleOpenInBrowser = async () => {
    try {
      const supported = await Linking.canOpenURL(currentUrl);
      if (supported) await Linking.openURL(currentUrl);
    } catch (error) {
      Alert.alert('Error', 'Failed to open in browser');
    }
  };

  const handleReload = () => {
    setIsRefreshing(true);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.webViewContainer}>
        {(loading || isRefreshing) && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={
            isCached && cachedHtml
              ? { html: cachedHtml, baseUrl: url }
              : { uri: url }
          }
          startInLoadingState={false}
          onLoadStart={onLoadStart}
          onLoadEnd={onLoadEnd}
          onNavigationStateChange={onNavigationStateChange}
          onLoadProgress={onLoadProgress}
          onMessage={handleMessage}
          userAgent="Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
          thirdPartyCookiesEnabled={true}
          cacheEnabled={true}
          cacheMode={Platform.OS === 'android' ? 'LOAD_CACHE_ELSE_NETWORK' : undefined}
          mixedContentMode="always"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsBackForwardNavigationGestures={true}
          onError={(error) => {
            Alert.alert('Error', `Failed to load page: ${error.nativeEvent.description || ''}`);
            console.error('WebView error:', error.nativeEvent);
          }}
          onGeolocationPermissionRequest={(event) => event.grant()}
          renderLoading={() => (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          )}
        />
      </View>

      {/* Bottom Toolbar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={handleBack} style={styles.toolButton}>
          <Ionicons name="arrow-back" size={24} color="#0f141a" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => webViewRef.current?.goForward()}
          disabled={!canGoForward}
          style={[styles.toolButton, !canGoForward && styles.disabled]}
        >
          <Ionicons name="arrow-forward" size={24} color={canGoForward ? '#0f141a' : '#CCCCCC'} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleReload} style={styles.toolButton}>
          <Ionicons name="refresh" size={24} color="#0f141a" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleShare} style={styles.toolButton}>
          <Ionicons name="share-outline" size={24} color="#0f141a" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleOpenInBrowser} style={styles.toolButton}>
          <Ionicons name="open-outline" size={24} color="#0f141a" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 20,
  },
  progressBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#E0E0E0',
    zIndex: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0f141a',
  },
  bottomBar: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 248, 248, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 30,
  },
  toolButton: {
    padding: 8,
    borderRadius: 24,
    minWidth: 44,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});

export default WebViewScreen;