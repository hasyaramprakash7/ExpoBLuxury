// screens/WebViewScreen.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
  StatusBar,
  SafeAreaView,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

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

  // Handle hardware back button on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [canGoBack]);

  const handleBack = () => {
    if (canGoBack) {
      webViewRef.current?.goBack();
    } else {
      navigation.goBack();
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check this out: ${currentUrl}`,
        url: currentUrl,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const handleOpenInBrowser = async () => {
    try {
      const supported = await Linking.canOpenURL(currentUrl);
      if (supported) {
        await Linking.openURL(currentUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open in browser');
    }
  };

  const onNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setCurrentUrl(navState.url);
    setLoading(navState.loading);
  };

  const onLoadProgress = (event: any) => {
    setProgress(event.nativeEvent.progress);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* WebView – fills entire space */}
      <View style={styles.webViewContainer}>
        {/* Progress bar at top */}
        {loading && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          )}
          onNavigationStateChange={onNavigationStateChange}
          onLoadProgress={onLoadProgress}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsBackForwardNavigationGestures={true}
          onError={(error) => {
            Alert.alert('Error', 'Failed to load page');
            console.error('WebView error:', error);
          }}
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

        <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={styles.toolButton}>
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
    marginTop:30
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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