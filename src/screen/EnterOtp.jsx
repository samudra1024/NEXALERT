import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import axios from "axios";
import { useNavigation, useRoute } from '@react-navigation/native';
import { BaseURL } from '../config/API';

import OtpImage from '../assets/images/OTP.png'; // ✅ keep image import at the bottom of imports

export default function EnterOtp() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(120); // 120 seconds timer
  const [resendActive, setResendActive] = useState(false);

  const inputs = useRef([]);
  const navigation = useNavigation();
  const route = useRoute();
  const mobileNumber = route.params?.mobileNumber;

  // ✅ Timer effect
  useEffect(() => {
    if (timer === 0) {
      setResendActive(true);
      return;
    }

    setResendActive(false);
    const interval = setInterval(() => {
      setTimer(t => (t > 0 ? t - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  // ✅ OTP input handler
  const handleChange = (text, index) => {
    if (text.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < otp.length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  // ✅ Resend OTP
  const handleResend = async () => {
    try {
      setTimer(120);
      setResendActive(false);
      // example API call (optional)
      await axios.post(`${BaseURL}/resend-otp`, { phoneNumber: mobileNumber });
      Alert.alert('OTP resent!');
    } catch (error) {
      console.error(error);
      Alert.alert('Failed to resend OTP. Please try again.');
    }
  };

  // ✅ Submit OTP
  const handleSubmit = async () => {
    setLoading(true);
    const otpCode = otp.join('');

    if (otpCode.length < 6) {
      Alert.alert('Please enter a complete OTP');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${BaseURL}/verify-otp`, { phoneNumber: mobileNumber, code: otpCode });

      if (response.data.success) {
        // OTP verified successfully
        Alert.alert('OTP verified successfully!');
        navigation.navigate('ChatsList');
      } else {
        Alert.alert('Failed to verify OTP. Please try again.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Something went wrong. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Defensive check for missing mobile number
  if (!mobileNumber) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: 'red' }]}>Mobile number is missing!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Verifying OTP</Text>
      <View style={styles.card}>
        <Image source={OtpImage} style={styles.image} />
        <Text style={styles.title}>OTP Verification</Text>
        <Text style={styles.subtitle}>
          Enter the OTP sent to <Text style={styles.bold}>{mobileNumber}</Text>
        </Text>

        {/* OTP INPUT FIELDS */}
        <View style={styles.otpContainer}>
          {otp.map((digit, idx) => (
            <TextInput
              key={idx}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={text => handleChange(text, idx)}
              ref={ref => (inputs.current[idx] = ref)}
              editable={!loading}
              selectionColor="black" // ✅ black cursor
              placeholderTextColor="#999" // ✅ optional
            />
          ))}
        </View>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { backgroundColor: '#cccccc' }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>{loading ? 'Loading...' : 'Submit'}</Text>
        </TouchableOpacity>

        {/* RESEND OTP */}
        <View style={{ alignItems: 'center', width: '100%' }}>
          {resendActive ? (
            <TouchableOpacity onPress={handleResend} disabled={loading}>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendText}>
              Resend OTP in {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    color: '#888',
    fontSize: 18,
    position: 'absolute',
    top: 40,
    left: 30,
    opacity: 0.7,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: 380,
    alignItems: 'center',
    elevation: 5,
  },
  image: {
    width: 140,
    height: 140,
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#222',
  },
  subtitle: {
    fontSize: 15,
    color: '#444',
    marginBottom: 22,
    textAlign: 'center',
  },
  bold: {
    fontWeight: 'bold',
    color: '#222',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    width: '100%',
  },
  otpInput: {
    borderWidth: 2,
    borderColor: '#bcd0ff',
    borderRadius: 8,
    width: 40,
    height: 45,
    textAlign: 'center',
    fontSize: 18,
    backgroundColor: '#f7faff',
    marginHorizontal: 5,
   
  },
  submitBtn: {
    backgroundColor: '#298cff',
    borderRadius: 8,
    paddingVertical: 12,
    width: '90%',
    alignItems: 'center',
    marginBottom: 18,
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendText: {
    color: '#888',
    fontSize: 14,
  },
  resendLink: {
    color: '#298cff',
    fontWeight: 'bold',
  },
});
