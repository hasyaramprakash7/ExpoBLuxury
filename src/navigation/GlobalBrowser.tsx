import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Text,
  Animated,
  Dimensions,
  AppState,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";

import {
  hideBrowser,
  addToHistory,
  saveSong,
  clearBrowserCommand,
  setNowPlaying,
} from "../features/browserSlice";

const { height } = Dimensions.get("window");

// --- ADVANCED TRACKER: SCREEN-OFF BYPASS & OS SYNC ---
const MEDIA_TRACKER_SCRIPT = `
  (function() {
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { get: () => false });
    window.addEventListener('visibilitychange', function(e) { e.stopImmediatePropagation(); }, true);
    document.addEventListener('visibilitychange', function(e) { e.stopImmediatePropagation(); }, true);

    var style = document.createElement('style');
    style.innerHTML = '.video-ads, .ytp-ad-module, .ytp-ad-image-overlay, .ytm-promoted-video-renderer, ad-slot-renderer { display: none !important; }';
    document.head.appendChild(style);

    var lastTitle = '';
    var lastThumb = '';
    var lastUpNextStr = '';

    setInterval(function() {
      try {
        var skipBtn = document.querySelector('.ytp-ad-skip-button') || document.querySelector('.ytp-ad-skip-button-modern') || document.querySelector('.ytm-custom-control-skip-ad') || document.querySelector('.ytp-ad-overlay-close-button');
        if (skipBtn) { skipBtn.click(); }

        var titleText = document.title ? document.title.replace(' - YouTube', '').replace(/^\\(\\d+\\)\\s*/, '') : 'YouTube Music';
        var url = window.location.href;
        
        // --- IMPROVED IMAGE SCRAPING (Fixed for YouTube Music) ---
        var thumbUrl = null;
        
        // Method 1: MediaSession API (Best for YT Music)
        if (navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.artwork && navigator.mediaSession.metadata.artwork.length > 0) {
            var artworks = navigator.mediaSession.metadata.artwork;
            thumbUrl = artworks[artworks.length - 1].src; // Gets highest quality image
        }
        
        // Method 2: Extract from URL as fallback
        if (!thumbUrl) {
            var videoIdMatch = url.match(/(?:[?&]v=|\\/shorts\\/|youtu\\.be\\/)([^&?\\/]+)/);
            if (videoIdMatch && videoIdMatch[1]) {
                thumbUrl = 'https://img.youtube.com/vi/' + videoIdMatch[1] + '/hqdefault.jpg';
            }
        }
        
        // Method 3: Fallback to Meta Tags
        if (!thumbUrl) {
            var ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) thumbUrl = ogImage.content;
        }

        var upNext = [];
        var items = document.querySelectorAll('ytm-compact-video-renderer, ytm-video-with-context-renderer');
        for(var i = 0; i < Math.min(items.length, 15); i++) {
            var a = items[i].querySelector('a.compact-media-item-image') || items[i].querySelector('a');
            var h4 = items[i].querySelector('h4');
            if(a && h4) {
                var href = a.getAttribute('href');
                var vIdMatch = href ? href.match(/(?:[?&]v=|\\/shorts\\/)([^&?\\/]+)/) : null;
                upNext.push({ 
                    title: h4.innerText, 
                    url: 'https://m.youtube.com' + href, 
                    thumbnail: vIdMatch ? 'https://img.youtube.com/vi/' + vIdMatch[1] + '/hqdefault.jpg' : '' 
                });
            }
        }
        var currentUpNextStr = JSON.stringify(upNext);

        if (titleText !== lastTitle || thumbUrl !== lastThumb || currentUpNextStr !== lastUpNextStr) {
          lastTitle = titleText;
          lastThumb = thumbUrl;
          lastUpNextStr = currentUpNextStr;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MEDIA_META', title: titleText, thumbnail: thumbUrl, upNext: upNext }));
        }
      } catch(e) {}
    }, 1000);
  })();
  true;
`;

const GlobalBrowser = () => {
  const dispatch = useDispatch();

  const history = useSelector((state: any) => state.browser.history) || [];
  const activeApp = useSelector((state: any) => state.browser.activeApp);
  const isVisible = useSelector((state: any) => state.browser.isBrowserVisible);
  const isPlaying = useSelector((state: any) => state.browser.isPlaying);
  const isMuted = useSelector((state: any) => state.browser.isMuted);
  const nowPlaying = useSelector((state: any) => state.browser.nowPlaying);
  const savedSongs =
    useSelector((state: any) => state.browser.savedSongs) || [];
  const browserCommand = useSelector(
    (state: any) => state.browser.browserCommand,
  );

  const webViewRefs = useRef<{ [key: string]: WebView | null }>({});
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentTitle, setCurrentTitle] = useState("Loading...");

  const slideAnim = useRef(new Animated.Value(height)).current;

  const [camStatus, requestCam] = useCameraPermissions();
  const [micStatus, requestMic] = useMicrophonePermissions();

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {}
    };
    setupAudio();
    if (Platform.OS === "android") {
      requestCam();
      requestMic();
    }
  }, []);

  const videoApp = history.find(
    (app: any) =>
      app.name.toLowerCase().includes("youtube") ||
      app.url.includes("youtube.com"),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState.match(/inactive|background/) && isPlaying && videoApp) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: "🎵 Playing in BLuxury",
            body: nowPlaying?.title || currentTitle,
            sound: false,
            data: { url: currentUrl },
          },
          trigger: null,
        });
      } else if (nextAppState === "active") {
        Notifications.dismissAllNotificationsAsync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isPlaying, currentTitle, nowPlaying, currentUrl, videoApp]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : height,
      useNativeDriver: true,
      friction: 8,
      tension: 65,
    }).start();
  }, [isVisible]);

  useEffect(() => {
    if (videoApp && webViewRefs.current[videoApp.name]) {
      const script = isPlaying
        ? `document.querySelectorAll('video').forEach(v => v.play()); true;`
        : `document.querySelectorAll('video').forEach(v => v.pause()); true;`;
      webViewRefs.current[videoApp.name]?.injectJavaScript(script);
    }
  }, [isPlaying, history]);

  useEffect(() => {
    if (videoApp && webViewRefs.current[videoApp.name]) {
      const script = `document.querySelectorAll('video').forEach(v => { v.muted = ${isMuted ? "true" : "false"}; }); true;`;
      webViewRefs.current[videoApp.name]?.injectJavaScript(script);
    }
  }, [isMuted, history]);

  // --- FIXED NEXT & PREVIOUS COMMANDS ---
  useEffect(() => {
    if (browserCommand && videoApp && webViewRefs.current[videoApp.name]) {
      let script = "";

      if (browserCommand.startsWith("play_url|||")) {
        const targetUrl = browserCommand.split("|||")[1];
        script = `window.location.href = "${targetUrl}"; true;`;
      } else if (browserCommand === "next") {
        // Virtually click YouTube's actual Next button instead of routing
        script = `
          var nextBtn = document.querySelector('.ytm-custom-control-next') || document.querySelector('.ytp-next-button') || document.querySelector('.next-button');
          if (nextBtn) { 
            nextBtn.click(); 
          } else {
            var upNext = document.querySelector('ytm-compact-video-renderer a');
            if(upNext) { window.location.href = upNext.href; } else { window.history.forward(); }
          }
          true;
        `;
      } else if (browserCommand === "prev") {
        // Rewind if played more than 5s, otherwise virtually click YouTube's Prev button
        script = `
          var v = document.querySelector('video');
          if (v && v.currentTime > 5) { 
            v.currentTime = 0; 
          } else { 
            var prevBtn = document.querySelector('.ytm-custom-control-prev') || document.querySelector('.ytp-prev-button') || document.querySelector('.previous-button');
            if (prevBtn) { prevBtn.click(); } else { window.history.back(); }
          }
          true;
        `;
      }

      if (script) {
        webViewRefs.current[videoApp.name]?.injectJavaScript(script);
      }
      dispatch(clearBrowserCommand());
    }
  }, [browserCommand, nowPlaying]);

  const handleNavChange = useCallback(
    (navState: any, app: any) => {
      setCurrentUrl(navState.url);
      const cleanTitle = navState.title
        ? navState.title
            .replace(" - YouTube", "")
            .replace(/^\\(\\d+\\)\\s*/, "")
        : "Loading...";
      setCurrentTitle(cleanTitle);

      if (navState.url && navState.url !== "about:blank" && !navState.loading) {
        if (navState.url !== app.url) {
          dispatch(
            addToHistory({
              url: navState.url,
              name: app.name,
              icon:
                app.icon ||
                `https://www.google.com/s2/favicons?domain=${navState.url}&sz=128`,
              timestamp: Date.now(),
            }),
          );
        }
      }
    },
    [dispatch],
  );

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "MEDIA_META") {
        const cleanTitle = data.title
          ? data.title.replace(" - YouTube", "").replace(/^\\(\\d+\\)\\s*/, "")
          : "Now Playing";
        dispatch(
          setNowPlaying({
            title: cleanTitle,
            thumbnail: data.thumbnail,
            upNext: data.upNext || [],
          }),
        );
      }
    } catch (error) {}
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch(hideBrowser());
  };

  const handleSaveSong = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dispatch(
      saveSong({
        id: Date.now().toString(),
        title: currentTitle,
        url: currentUrl,
        timestamp: Date.now(),
      }),
    );
  };

  if (!activeApp) return null;
  const isSaved = savedSongs.some((s: any) => s.url === currentUrl);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="chevron-down" size={26} color="#0A3D2B" />
            <Text style={styles.backText}>Minimize</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeApp.name === "YouTube" ? currentTitle : activeApp.name}
            </Text>
          </View>

          <View style={styles.rightHeaderActions}>
            {currentUrl.includes("youtube.com/watch") && (
              <TouchableOpacity
                onPress={handleSaveSong}
                disabled={isSaved}
                style={styles.saveBtn}
              >
                <Ionicons
                  name={isSaved ? "cloud-done" : "cloud-download-outline"}
                  size={24}
                  color={isSaved ? "#28a745" : "#0A3D2B"}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.webViewWrapper}>
          {history.map((app: any) => {
            const isActive = activeApp.name === app.name;
            return (
              <View
                key={app.name}
                style={[
                  StyleSheet.absoluteFill,
                  { opacity: isActive ? 1 : 0, zIndex: isActive ? 10 : 0 },
                ]}
                pointerEvents={isActive ? "auto" : "none"}
              >
                <WebView
                  ref={(el) => (webViewRefs.current[app.name] = el)}
                  source={{ uri: app.url }}
                  style={styles.webView}
                  onNavigationStateChange={(state) =>
                    handleNavChange(state, app)
                  }
                  injectedJavaScript={MEDIA_TRACKER_SCRIPT}
                  onMessage={handleMessage}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.loader}>
                      <ActivityIndicator size="large" color="#0A3D2B" />
                    </View>
                  )}
                  androidLayerType={
                    Platform.OS === "android" ? "hardware" : "none"
                  }
                  domStorageEnabled={true}
                  javaScriptEnabled={true}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                  allowsFullscreenVideo={true}
                  originWhitelist={["*"]}
                  userAgent={
                    Platform.OS === "android"
                      ? "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
                      : undefined
                  }
                />
              </View>
            );
          })}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: "#F8F5F0",
  },
  safeArea: { flex: 1 },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    backgroundColor: "#F8F5F0",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  backButton: { flexDirection: "row", alignItems: "center", minWidth: 100 },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A3D2B",
    marginLeft: -4,
  },
  titleContainer: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 14, fontWeight: "700", color: "#0A3D2B" },
  rightHeaderActions: { minWidth: 100, alignItems: "flex-end" },
  saveBtn: {
    padding: 8,
    backgroundColor: "rgba(10, 61, 43, 0.05)",
    borderRadius: 12,
  },
  webViewWrapper: { flex: 1 },
  webView: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F5F0",
  },
});

export default GlobalBrowser;
