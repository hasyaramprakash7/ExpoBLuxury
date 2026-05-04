// import React, { useState } from "react";
// import { View, StyleSheet, TextInput } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// // Adjust the path below to wherever your InstamartHeader is stored!
// import InstamartHeader from "../components/InstamartHeader";

// const AllAppsScreen = () => {
//   const [search, setSearch] = useState("");

//   return (
//     <SafeAreaView style={styles.container}>
//       <View style={styles.searchContainer}>
//         <TextInput
//           style={styles.searchInput}
//           placeholder="Search for an app or brand..."
//           value={search}
//           onChangeText={setSearch}
//           placeholderTextColor="#888"
//         />
//       </View>

//       {/* Your massive list of icons loads here! */}
//       <InstamartHeader searchQuery={search} />
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#F8F5F0",
//   },
//   searchContainer: {
//     padding: 15,
//     paddingTop: 20,
//   },
//   searchInput: {
//     backgroundColor: "#FFF",
//     paddingHorizontal: 15,
//     paddingVertical: 12,
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: "rgba(0,0,0,0.1)",
//     fontSize: 14,
//     color: "#000",
//   },
// });

// export default AllAppsScreen;
