// import React, {
//   useRef,
//   useCallback,
//   useState,
//   useMemo,
//   useEffect,
// } from "react";
// import {
//   StyleSheet,
//   View,
//   ActivityIndicator,
//   BackHandler,
//   Platform,
//   TouchableOpacity,
//   Text,
// } from "react-native";
// import { WebView } from "react-native-webview";
// import { useFocusEffect } from "@react-navigation/native";
// import { useDispatch, useSelector } from "react-redux";
// import Ionicons from "@expo/vector-icons/Ionicons";

// import { SafeAreaView } from "react-native-safe-area-context";
// import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
// import { Audio } from "expo-av"; // Needed for background audio

// import { addToHistory } from "../features/browserSlice";

// const InAppBrowserScreen = ({ route, navigation }: any) => {
//   const { url, name, icon } = route?.params || {
//     url: "https://www.google.com",
//     name: "Browser",
//     icon: "https://www.google.com/s2/favicons?domain=google.com&sz=128",
//   };

//   const dispatch = useDispatch();
//   const webViewRef = useRef<WebView>(null);
//   const [canGoBack, setCanGoBack] = useState(false);
//   const canGoBackRef = useRef(false);
//   const lastSavedUrl = useRef("");
//   const initialSource = useMemo(() => ({ uri: url }), [url]);

//   const [camStatus, requestCam] = useCameraPermissions();
//   const [micStatus, requestMic] = useMicrophonePermissions();

//   // Get play state from Redux
//   const isPlaying = useSelector(
//     (state: any) => state.browser?.isPlaying ?? true,
//   );

//   useEffect(() => {
//     if (Platform.OS === "android") {
//       requestCam();
//       requestMic();
//     }

//     // Configure audio to keep playing in the background
//     Audio.setAudioModeAsync({
//       allowsRecordingIOS: true,
//       playsInSilentModeIOS: true,
//       staysActiveInBackground: true,
//       shouldDuckAndroid: true,
//     }).catch(console.warn);
//   }, []);

//   // --- NEW: Watch for Play/Pause changes and inject JavaScript into YouTube ---
//   useEffect(() => {
//     if (webViewRef.current && name.toLowerCase().includes("youtube")) {
//       const script = isPlaying
//         ? `document.querySelectorAll('video').forEach(v => v.play()); true;`
//         : `document.querySelectorAll('video').forEach(v => v.pause()); true;`;

//       webViewRef.current.injectJavaScript(script);
//     }
//   }, [isPlaying, name]);

//   useFocusEffect(
//     useCallback(() => {
//       if (Platform.OS !== "android") return;
//       const onBackPress = () => {
//         if (canGoBackRef.current && webViewRef.current) {
//           webViewRef.current.goBack();
//           return true;
//         }
//         return false;
//       };
//       const backHandler = BackHandler.addEventListener(
//         "hardwareBackPress",
//         onBackPress,
//       );
//       return () => backHandler.remove();
//     }, []),
//   );

//   const handleNavChange = useCallback(
//     (navState: any) => {
//       canGoBackRef.current = navState.canGoBack;
//       if (canGoBack !== navState.canGoBack) setCanGoBack(navState.canGoBack);

//       if (
//         navState.url &&
//         navState.url !== "about:blank" &&
//         navState.url !== lastSavedUrl.current &&
//         !navState.loading
//       ) {
//         lastSavedUrl.current = navState.url;

//         setTimeout(() => {
//           dispatch(
//             addToHistory({
//               url: navState.url,
//               name: name,
//               icon: icon,
//               timestamp: Date.now(),
//             }),
//           );
//         }, 500);
//       }
//     },
//     [canGoBack, dispatch, name, icon],
//   );

//   return (
//     <SafeAreaView style={styles.mainContainer} edges={["top"]}>
//       <View style={styles.header}>
//         <TouchableOpacity
//           onPress={() =>
//             canGoBack ? webViewRef.current?.goBack() : navigation.goBack()
//           }
//           style={styles.backButton}
//         >
//           <Ionicons name="chevron-back" size={24} color="#0A3D2B" />
//           <Text style={styles.backText}>{canGoBack ? "Back" : "Close"}</Text>
//         </TouchableOpacity>
//         <Text style={styles.headerTitle} numberOfLines={1}>
//           {name}
//         </Text>
//         <View style={{ width: 80 }} />
//       </View>

//       <View style={styles.webViewWrapper}>
//         <WebView
//           ref={webViewRef}
//           source={initialSource}
//           style={styles.webView}
//           onNavigationStateChange={handleNavChange}
//           startInLoadingState={true}
//           renderLoading={() => (
//             <View style={styles.loader}>
//               <ActivityIndicator size="small" color="#0A3D2B" />
//             </View>
//           )}
//           androidLayerType={Platform.OS === "android" ? "hardware" : "none"}
//           domStorageEnabled={true}
//           javaScriptEnabled={true}
//           mixedContentMode="always"
//           decelerationRate={Platform.OS === "ios" ? "normal" : 0.998}
//           allowsBackForwardNavigationGestures={true}
//           incognito={false}
//           cacheEnabled={true}
//           cacheMode="LOAD_DEFAULT"
//           allowsInlineMediaPlayback={true}
//           mediaPlaybackRequiresUserAction={false}
//           originWhitelist={["*"]}
//           javaScriptCanOpenWindowsAutomatically={true}
//           mediaCapturePermissionGrantType="grant"
//           geolocationEnabled={true}
//         />
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   mainContainer: { flex: 1, backgroundColor: "#F8F5F0" },
//   header: {
//     height: 44,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: 10,
//     backgroundColor: "#F8F5F0",
//     borderBottomWidth: 1,
//     borderBottomColor: "rgba(0,0,0,0.05)",
//   },
//   backButton: { flexDirection: "row", alignItems: "center", width: 80 },
//   backText: { fontSize: 16, color: "#0A3D2B" },
//   headerTitle: {
//     fontSize: 15,
//     fontWeight: "700",
//     color: "#0A3D2B",
//     flex: 1,
//     textAlign: "center",
//   },
//   webViewWrapper: { flex: 1, marginBottom: 10 },
//   webView: { flex: 1, opacity: 0.99 },
//   loader: {
//     ...StyleSheet.absoluteFillObject,
//     justifyContent: "center",
//     alignItems: "center",
//     backgroundColor: "#F8F5F0",
//   },
// });

// export default InAppBrowserScreen;
