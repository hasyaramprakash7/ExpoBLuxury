// screens/WebViewScreen.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
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
  };

  return (
    <View style={styles.container}>
      {/* Custom header with navigation controls */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'Browser'}
        </Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleOpenInBrowser} style={styles.headerButton}>
            <Ionicons name="open-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Ionicons name="share-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation controls */}
      <View style={styles.navBar}>
        <TouchableOpacity 
          onPress={() => webViewRef.current?.goBack()} 
          disabled={!canGoBack}
          style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}
        >
          <Ionicons name="chevron-back" size={24} color={canGoBack ? '#007AFF' : '#CCCCCC'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => webViewRef.current?.goForward()} 
          disabled={!canGoForward}
          style={[styles.navButton, !canGoForward && styles.navButtonDisabled]}
        >
          <Ionicons name="chevron-forward" size={24} color={canGoForward ? '#007AFF' : '#CCCCCC'} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={styles.navButton}>
          <Ionicons name="refresh-outline" size={22} color="#007AFF" />
        </TouchableOpacity>
        
        <View style={styles.urlContainer}>
          <Text style={styles.urlText} numberOfLines={1}>
            {currentUrl.replace(/^https?:\/\//, '')}
          </Text>
        </View>
      </View>

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
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsBackForwardNavigationGestures={true}
        onError={(error) => {
          Alert.alert('Error', 'Failed to load page');
          console.error('WebView error:', error);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  navButton: {
    padding: 6,
    marginRight: 4,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  urlContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 4,
  },
  urlText: {
    fontSize: 12,
    color: '#666666',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default WebViewScreen;