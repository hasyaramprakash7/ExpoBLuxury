// // src/components/MapScreen.tsx
// import React, { useEffect, useState, useRef } from "react";
// import {
//   StyleSheet,
//   View,
//   Text,
//   ActivityIndicator,
//   Alert,
//   Platform,
//   Linking,
// } from "react-native";
// import MapView, { Marker, PROVIDER_GOOGLE, LatLng } from "react-native-maps";
// import { useDispatch, useSelector } from "react-redux";
// import { RootState } from "../app/store"; // Adjust path as per your store setup
// import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
// import * as Location from "expo-location"; // Import expo-location

// // Assume you have a config file like this
// import config from "../config/config"; // Imported, but not directly used for MapView API key

// // Define the Vendor interface if not already globally available or for clarity
// interface Vendor {
//   _id: string;
//   name: string;
//   shopName: string;
//   email: string;
//   phone: string;
//   address: {
//     latitude?: number;
//     longitude?: number;
//     pincode: string;
//     state: string;
//     district: string;
//     country: string;
//   };
//   isOnline: boolean;
//   deliveryRange?: number;
//   shopImage?: string;
//   businessType?: string;
//   gstNo?: string;
//   // Add a distance property for calculated distance to user
//   distance?: number;
// }

// const calculateDistance = (
//   lat1: number,
//   lon1: number,
//   lat2: number,
//   lon2: number
// ) => {
//   const R = 6371; // Radius of Earth in kilometers
//   const dLat = (lat2 - lat1) * (Math.PI / 180);
//   const dLon = (lon2 - lon1) * (Math.PI / 180);
//   const a =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(lat1 * (Math.PI / 180)) *
//       Math.cos(lat2 * (Math.PI / 180)) *
//       Math.sin(dLon / 2) *
//       Math.sin(dLon / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   const distance = R * c; // Distance in km
//   return distance;
// };

// const MapScreen: React.FC = () => {
//   const dispatch = useDispatch();
//   const { allVendors, error } = useSelector(
//     (state: RootState) => state.vendorAuth
//   );

//   const [userLocation, setUserLocation] = useState<LatLng | null>(null);
//   const [loadingLocation, setLoadingLocation] = useState(true);
//   const [vendorsWithDistance, setVendorsWithDistance] = useState<Vendor[]>([]);

//   const mapRef = useRef<MapView>(null);

//   const requestLocationPermissionsAndGetLocation = async () => {
//     setLoadingLocation(true);
//     let { status } = await Location.requestForegroundPermissionsAsync();
//     if (status !== "granted") {
//       Alert.alert(
//         "Location Permission Denied",
//         "Permission to access location was denied. Cannot show nearby vendors."
//       );
//       setLoadingLocation(false);
//       return;
//     }

//     try {
//       let location = await Location.getCurrentPositionAsync({});
//       const { latitude, longitude } = location.coords;
//       setUserLocation({ latitude, longitude });

//       // Optionally center map on user location
//       if (mapRef.current) {
//         mapRef.current.animateToRegion(
//           {
//             latitude,
//             longitude,
//             latitudeDelta: 0.05,
//             longitudeDelta: 0.05,
//           },
//           1000
//         );
//       }
//     } catch (err: any) {
//       Alert.alert(
//         "Location Error",
//         err.message || "Failed to get current location."
//       );
//       console.error("Error getting location:", err);
//     } finally {
//       setLoadingLocation(false);
//     }
//   };

//   useEffect(() => {
//     requestLocationPermissionsAndGetLocation();
//     dispatch(fetchAllVendors() as any); // Dispatch action to fetch all vendors
//   }, [dispatch]);

//   // Effect to calculate distances when user location or vendors change
//   useEffect(() => {
//     if (userLocation && allVendors.length > 0) {
//       const updatedVendors = allVendors.map((vendor) => {
//         if (vendor.address?.latitude && vendor.address?.longitude) {
//           const distance = calculateDistance(
//             userLocation.latitude,
//             userLocation.longitude,
//             vendor.address.latitude,
//             vendor.address.longitude
//           );
//           return { ...vendor, distance: parseFloat(distance.toFixed(2)) };
//         }
//         return vendor;
//       });
//       setVendorsWithDistance(updatedVendors);
//     } else {
//       setVendorsWithDistance(allVendors); // If no user location, just show vendors without distance
//     }
//   }, [userLocation, allVendors]);

//   const openMapsForNavigation = (
//     latitude: number,
//     longitude: number,
//     label: string
//   ) => {
//     const scheme = Platform.select({
//       ios: "maps://0,0?q=",
//       android: "geo:0,0?q=",
//     });
//     const latLng = `${latitude},${longitude}`;
//     const url = Platform.select({
//       ios: `${scheme}${label}@${latLng}`,
//       android: `${scheme}${latLng}(${label})`,
//     });

//     if (url) {
//       Linking.openURL(url).catch((err) =>
//         console.error("An error occurred opening map:", err)
//       );
//     }
//   };

//   if (loadingLocation || !userLocation) {
//     return (
//       <View style={styles.centered}>
//         <ActivityIndicator size="large" color="#0000ff" />
//         <Text>Fetching your location...</Text>
//       </View>
//     );
//   }

//   if (error) {
//     return (
//       <View style={styles.centered}>
//         <Text style={styles.errorText}>Error: {error}</Text>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <MapView
//         ref={mapRef}
//         provider={PROVIDER_GOOGLE} // Use Google Maps if available
//         style={styles.map}
//         initialRegion={{
//           latitude: userLocation.latitude,
//           longitude: userLocation.longitude,
//           latitudeDelta: 0.0922,
//           longitudeDelta: 0.0421,
//         }}
//         showsUserLocation={true}
//         followsUserLocation={true}
//         zoomEnabled={true}
//         pitchEnabled={true}
//       >
//         {vendorsWithDistance.map((vendor) => {
//           if (vendor.address?.latitude && vendor.address?.longitude) {
//             return (
//               <Marker
//                 key={vendor._id}
//                 coordinate={{
//                   latitude: vendor.address.latitude,
//                   longitude: vendor.address.longitude,
//                 }}
//                 title={vendor.name}
//                 description={vendor.shopName}
//                 pinColor="red" // Vendor marker color
//               >
//                 <MapView.Callout
//                   onPress={() =>
//                     openMapsForNavigation(
//                       vendor.address!.latitude!,
//                       vendor.address!.longitude!,
//                       vendor.shopName
//                     )
//                   }
//                 >
//                   <View>
//                     <Text style={styles.calloutTitle}>{vendor.shopName}</Text>
//                     <Text>{vendor.name}</Text>
//                     {vendor.distance !== undefined && (
//                       <Text>Distance: {vendor.distance} km</Text>
//                     )}
//                     <Text style={styles.getDirectionsText}>
//                       Tap to get directions
//                     </Text>
//                   </View>
//                 </MapView.Callout>
//               </Marker>
//             );
//           }
//           return null;
//         })}
//       </MapView>
//       {vendorsWithDistance.length === 0 && !loadingLocation && (
//         <View style={styles.overlayTextContainer}>
//           <Text style={styles.overlayText}>
//             No vendors found or locations unavailable.
//           </Text>
//         </View>
//       )}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   map: {
//     flex: 1,
//   },
//   centered: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   errorText: {
//     color: "red",
//     fontSize: 16,
//     textAlign: "center",
//     margin: 20,
//   },
//   calloutTitle: {
//     fontWeight: "bold",
//     fontSize: 16,
//     marginBottom: 5,
//   },
//   getDirectionsText: {
//     color: "blue",
//     marginTop: 5,
//   },
//   overlayTextContainer: {
//     position: "absolute",
//     top: "50%",
//     left: 0,
//     right: 0,
//     alignItems: "center",
//     justifyContent: "center",
//     padding: 20,
//     backgroundColor: "rgba(255,255,255,0.8)",
//     borderRadius: 10,
//     marginHorizontal: 20,
//   },
//   overlayText: {
//     fontSize: 16,
//     textAlign: "center",
//     color: "#333",
//   },
// });

// export default MapScreen;
import React from 'react'

const MapScreen = () => {
  return (
    <div>
      
    </div>
  )
}

export default MapScreen
