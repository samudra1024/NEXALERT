import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  SafeAreaView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from "axios";
import { BaseURL } from '../config/API';
import { useTheme } from '../context/ThemeContext';

import OTP_ILLUSTRATION from '../assets/images/OTP.png'; // Ensure this path is correct

export default function OtpVerification() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, seterror] = useState(false);
  const navigation = useNavigation();
  const { theme } = useTheme();

  const handleGetOtp = async () => {
    setLoading(true);
    console.log('Requesting OTP for:', mobileNumber);
    if (!mobileNumber || mobileNumber.length < 10) {
      seterror(true);
      Alert.alert('Please enter a mobile number');
      setLoading(false);
      return;
    }

    console.log(mobileNumber)
    // Simulate API call to send OTP
    // IMPORTANT: Ensure you set BaseURL in config/API.js to your computer's local IP, not 'localhost'.
    // Example: export const BaseURL = 'http://192.168.1.50:8000/api'
    // Use imported BaseURL and add diagnostics
    console.log('Sending OTP to:', `${BaseURL}/send-otp`);
    //navigation.navigate('EnterOtp'); // Navigate to InfoOne screen
    try {
      const res = await axios.post(`${BaseURL}/send-otp`, { phoneNumber: `+91${mobileNumber}` });

      console.log('Response from OTP API:', res.data.success);


      if (res.data.success) {
        console.log('OTP sent successfully!')
        Alert.alert('OTP sent successfully!');
        setLoading(false);
        // Navigate to EnterOtp screen with mobileNumber
        navigation.navigate('EnterOtp', { mobileNumber });
      } else {
        console.log('Response from OTP API:', res.data);
        Alert.alert('Failed to send OTP. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
      // Print detailed error diagnostics
      if (error.response) {
        console.error('Error Response:', error.response);
      } else if (error.request) {
        console.error('Error Request:', error.request);
      } else {
        console.error('Error Message:', error.message);
      }
      Alert.alert('An error occurred while sending OTP. Please check network, server, and IP configuration.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Image source={OTP_ILLUSTRATION} style={styles.illustration} />
          <Text style={styles.title}>OTP Verification</Text>
          <Text style={styles.subtitle}>
            We will send you a one Time Password on this mobile number
          </Text>
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.primary }]}>Mobile number</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.primary }]}
              placeholder="1234567891"
              placeholderTextColor="#B5B5B5"
              keyboardType="phone-pad"
              value={mobileNumber}
              onChangeText={setMobileNumber}
            />
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : (
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleGetOtp}>
              <Text style={styles.buttonText}>Get OTP</Text>
            </TouchableOpacity>
          )}
          <View style={styles.footerText}>
            <Text style={styles.footerNormalText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => Alert.alert('Sign Up pressed!')}>
              <Text style={[styles.footerLinkText, { color: theme.primary }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: 40,
    borderRadius: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#828282',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 4,
    fontSize: 14,
    color: '#2F80ED',
    zIndex: 1,
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#2563eb',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: 'black',
  },
  button: {
    width: '100%',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footerText: {
    flexDirection: 'row',
    marginTop: 20,
  },
  footerNormalText: {
    fontSize: 14,
    color: '#828282',
  },
  footerLinkText: {
    fontSize: 14,
    color: '#2F80ED',
    fontWeight: '600',
  },
});