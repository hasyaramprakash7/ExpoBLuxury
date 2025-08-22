// CarouselCard.js
import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Ionicons from "@expo/vector-icons/Ionicons";

const { width } = Dimensions.get("window");

const Colors = {
  textDarkBrown: "#4A2C2A",
  grayLight: "#DDDDDD",
  grayText: "#777777",
};

const CarouselCard = ({ name, imageUrl }) => {
  return (
    <View style={styles.imageContainer}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.imageCard}
        />
      ) : (
        <View style={styles.noImageIcon}>
          <Ionicons
            name="image-outline"
            size={width * 0.1}
            color={Colors.grayLight}
          />
          <Text style={styles.noImageText}>No Image</Text>
        </View>
      )}
      <Text style={styles.imageTitle}>{name}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    marginRight: 15,
    width: width * 0.4,
    alignItems: "center",
  },
  imageCard: {
    width: "100%",
    height: width * 0.3,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  imageTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textDarkBrown,
    textAlign: "center",
  },
  noImageIcon: {
    width: "100%",
    height: width * 0.3,
    borderRadius: 10,
    backgroundColor: Colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 10,
    color: Colors.grayText,
    marginTop: 5,
  },
});

export default CarouselCard;