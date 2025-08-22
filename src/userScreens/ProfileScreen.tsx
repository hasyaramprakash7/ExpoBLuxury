// // ---------------------------------------------------------------- //
// // FILE: ../screens/ProfileScreen.tsx
// // ---------------------------------------------------------------- //
// import React, { useState, useEffect } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   ScrollView,
//   Alert,
//   ActivityIndicator,
// } from "react-native";
// import { useSelector, useDispatch } from "react-redux";
// import { logout, updateUserProfile } from "../features/user/authSlice";
// import { Ionicons } from "@expo/vector-icons";
// import { useNavigation } from "@react-navigation/native";
// // import Navbar from "./Navbar";

// export default function ProfileScreen() {
//   const dispatch = useDispatch();
//   const navigation = useNavigation();
//   const { user, loading } = useSelector((state) => state.auth);

//   const [isEditing, setIsEditing] = useState(false);
//   const [formData, setFormData] = useState({
//     name: "",
//     email: "",
//     phone: "",
//     address: { district: "", state: "", country: "", pincode: "" },
//   });

//   useEffect(() => {
//     // This effect synchronizes the form state with the user data from Redux.
//     // It runs whenever the `user` object changes.
//     if (user) {
//       setFormData({
//         name: user.name || "",
//         email: user.email || "", // Email is not editable in the form but good to have in state
//         phone: user.phone || "",
//         address: user.address || {
//           district: "",
//           state: "",
//           country: "",
//           pincode: "",
//         },
//       });
//     }
//   }, [user]);

//   const handleSave = async () => {
//     // Create an object to hold only the fields that have changed.
//     const updatedFields = {};

//     // Compare form data with the original user data from the Redux store.
//     if (formData.name !== user.name) {
//       updatedFields.name = formData.name;
//     }
//     if (formData.phone !== user.phone) {
//       updatedFields.phone = formData.phone;
//     }
//     // For the address object, stringify to easily compare if it has changed.
//     if (JSON.stringify(formData.address) !== JSON.stringify(user.address)) {
//       updatedFields.address = formData.address;
//     }

//     // If no fields have been changed, don't make an unnecessary API call.
//     if (Object.keys(updatedFields).length === 0) {
//       setIsEditing(false); // Simply exit the editing mode.
//       return;
//     }

//     // Dispatch the update action with only the changed fields.
//     const resultAction = await dispatch(updateUserProfile(updatedFields));

//     if (updateUserProfile.fulfilled.match(resultAction)) {
//       Alert.alert("Success", "Profile updated successfully!");
//       setIsEditing(false);
//     } else {
//       // Show a detailed error message from the backend if available.
//       Alert.alert(
//         "Error",
//         (resultAction.payload as string) || "Failed to update profile."
//       );
//     }
//   };

//   const handleLogout = () => {
//     dispatch(logout());
//     // The AppNavigator will see that the user is no longer authenticated
//     // and automatically redirect to the Login screen.
//   };

//   // Show a loading indicator while the user profile is being fetched.
//   if (loading && !user) {
//     return (
//       <View style={profileStyles.container}>
//         <ActivityIndicator size="large" color="#009632" />
//       </View>
//     );
//   }

//   // Fallback for when the user is not found or has logged out.
//   if (!user) {
//     return (
//       <View style={profileStyles.container}>
//         <Text style={profileStyles.infoText}>
//           Please login to see your profile.
//         </Text>
//       </View>
//     );
//   }

//   // Helper function to render rows in the profile display.
//   const renderInfoRow = (icon, label, value) => (
//     <View style={profileStyles.infoRow}>
//       <Ionicons name={icon} size={24} color="#009632" />
//       <View style={profileStyles.infoTextContainer}>
//         <Text style={profileStyles.infoLabel}>{label}</Text>
//         <Text style={profileStyles.infoValue}>{value || "Not provided"}</Text>
//       </View>
//     </View>
//   );

//   return (
//     <ScrollView style={profileStyles.container}>
//       {/* <Navbar /> */}
//       <View style={profileStyles.header}>
//         <Ionicons name="person-circle-outline" size={80} color="#009632" />
//         <Text style={profileStyles.headerTitle}>{user.name}</Text>
//         <Text style={profileStyles.headerSubtitle}>{user.email}</Text>
//       </View>

//       {isEditing ? (
//         // --- EDITING VIEW ---
//         <View style={profileStyles.card}>
//           <TextInput
//             style={profileStyles.input}
//             placeholder="Full Name"
//             value={formData.name}
//             onChangeText={(text) => setFormData({ ...formData, name: text })}
//           />
//           <TextInput
//             style={profileStyles.input}
//             placeholder="Phone"
//             value={formData.phone}
//             onChangeText={(text) => setFormData({ ...formData, phone: text })}
//             keyboardType="phone-pad"
//           />
//           <TextInput
//             style={profileStyles.input}
//             placeholder="District"
//             value={formData.address.district}
//             onChangeText={(text) =>
//               setFormData({
//                 ...formData,
//                 address: { ...formData.address, district: text },
//               })
//             }
//           />
//           <TextInput
//             style={profileStyles.input}
//             placeholder="State"
//             value={formData.address.state}
//             onChangeText={(text) =>
//               setFormData({
//                 ...formData,
//                 address: { ...formData.address, state: text },
//               })
//             }
//           />
//           <TextInput
//             style={profileStyles.input}
//             placeholder="Country"
//             value={formData.address.country}
//             onChangeText={(text) =>
//               setFormData({
//                 ...formData,
//                 address: { ...formData.address, country: text },
//               })
//             }
//           />
//           <TextInput
//             style={profileStyles.input}
//             placeholder="Pincode"
//             value={formData.address.pincode}
//             onChangeText={(text) =>
//               setFormData({
//                 ...formData,
//                 address: { ...formData.address, pincode: text },
//               })
//             }
//             keyboardType="number-pad"
//           />
//           <View style={profileStyles.buttonContainer}>
//             <TouchableOpacity
//               style={[profileStyles.button, profileStyles.saveButton]}
//               onPress={handleSave}
//               disabled={loading}
//             >
//               {loading ? (
//                 <ActivityIndicator color="#fff" />
//               ) : (
//                 <Text style={profileStyles.buttonText}>Save</Text>
//               )}
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={[profileStyles.button, profileStyles.cancelButton]}
//               onPress={() => setIsEditing(false)}
//             >
//               <Text style={profileStyles.buttonText}>Cancel</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       ) : (
//         // --- DISPLAY VIEW ---
//         <View style={profileStyles.card}>
//           {renderInfoRow("person-outline", "Name", user.name)}
//           {renderInfoRow("mail-outline", "Email", user.email)}
//           {renderInfoRow("call-outline", "Phone", user.phone)}
//           {renderInfoRow(
//             "location-outline",
//             "Address",
//             user.address?.district && user.address?.pincode
//               ? `${user.address.district}, ${user.address.state}, ${user.address.country} - ${user.address.pincode}`
//               : "Not provided"
//           )}
//           <TouchableOpacity
//             style={[profileStyles.button, profileStyles.editButton]}
//             onPress={() => setIsEditing(true)}
//           >
//             <Ionicons name="pencil" size={20} color="#fff" />
//             <Text style={profileStyles.buttonText}>Edit Profile</Text>
//           </TouchableOpacity>
//         </View>
//       )}

//       <View style={profileStyles.card}>
//         <TouchableOpacity
//           style={[profileStyles.button, profileStyles.logoutButton]}
//           onPress={handleLogout}
//         >
//           <Ionicons name="log-out-outline" size={20} color="#fff" />
//           <Text style={profileStyles.buttonText}>Logout</Text>
//         </TouchableOpacity>
//       </View>
//     </ScrollView>
//   );
// }

// const profileStyles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#f0f2f5",
//   },
//   card: {
//     backgroundColor: "#fff",
//     borderRadius: 10,
//     padding: 20,
//     marginHorizontal: 15,
//     marginVertical: 10,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//     elevation: 3,
//   },
//   header: {
//     alignItems: "center",
//     paddingVertical: 20,
//     backgroundColor: "#fff",
//     borderBottomWidth: 1,
//     borderBottomColor: "#e0e0e0",
//   },
//   headerTitle: {
//     fontSize: 22,
//     fontWeight: "bold",
//     marginTop: 10,
//   },
//   headerSubtitle: {
//     fontSize: 16,
//     color: "#666",
//   },
//   infoRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 20,
//   },
//   infoTextContainer: {
//     marginLeft: 15,
//   },
//   infoLabel: {
//     fontSize: 14,
//     color: "#666",
//   },
//   infoValue: {
//     fontSize: 16,
//     fontWeight: "500",
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: "#ddd",
//     padding: 10,
//     borderRadius: 5,
//     marginBottom: 10,
//     fontSize: 16,
//   },
//   buttonContainer: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginTop: 10,
//   },
//   button: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     padding: 15,
//     borderRadius: 8,
//   },
//   editButton: {
//     backgroundColor: "#007BFF",
//   },
//   saveButton: {
//     backgroundColor: "#28a745",
//     flex: 1,
//     marginRight: 5,
//   },
//   cancelButton: {
//     backgroundColor: "#dc3545",
//     flex: 1,
//     marginLeft: 5,
//   },
//   logoutButton: {
//     backgroundColor: "#dc3545",
//   },
//   buttonText: {
//     color: "#fff",
//     fontWeight: "bold",
//     marginLeft: 10,
//     fontSize: 16,
//   },
//   infoText: {
//     textAlign: "center",
//     fontSize: 18,
//     marginTop: 50,
//   },
// });
