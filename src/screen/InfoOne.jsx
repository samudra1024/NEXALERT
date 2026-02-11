import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const shieldLockIcon = require('../assets/images/img1.png'); // Ensure this path is correct

const InfoOne = () => {

  const navigation = useNavigation();
  const { theme } = useTheme();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('OtpVerification')}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Image
          // Use require for local images.
          source={shieldLockIcon}
          style={styles.image}
        />
        <Text style={styles.title}>Your Shield Against SMS Scams!</Text>
        <View style={styles.paginationContainer}>
          <View style={[styles.dot, styles.activeDot, { backgroundColor: theme.primary }]} />
          <View style={[styles.dot, styles.inactiveDot]} />
          <View style={[styles.dot, styles.inactiveDot]} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.nextButton, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('InfoTwo')}>
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1E3C', // Dark blue background color
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    maxWidth: width * 0.8,
  },
  image: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40, // Space between title and dots
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 25, // Increased width to make it a bar
    height: 8, // Adjust height
    borderRadius: 4, // Rounded corners
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#007AFF', // Blue color for the active dot
  },
  inactiveDot: {
    backgroundColor: '#F5F5DC', // Beige color for inactive dots
  },
  nextButton: {
    width: '80%',
    paddingVertical: 15,
    backgroundColor: '#007AFF', // A shade of blue for the button
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3, // For Android shadow
    shadowColor: '#000', // For iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default InfoOne;
