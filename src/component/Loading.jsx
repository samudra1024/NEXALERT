import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";

const Loading = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,                 // Fill the entire screen
    justifyContent: "center", // Center vertically
    alignItems: "center",    // Center horizontally
    backgroundColor: "rgba(0,0,0,0.3)", // Optional transparent overlay
  },
});

export default Loading;
