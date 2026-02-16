import { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { BaseURL } from '../config/API';
import { useTheme } from '../context/ThemeContext';

import OTP_ILLUSTRATION from '../assets/images/OTP.png';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  // ── shared state ──
  const [currentStep, setCurrentStep] = useState(0); // 0 = phone, 1 = OTP
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Step 1 (Phone) state ──
  const [mobileNumber, setMobileNumber] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  // ── Step 2 (OTP) state ──
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [timer, setTimer] = useState(120);
  const [resendActive, setResendActive] = useState(false);
  const otpInputs = useRef([]);

  // ── Timer effect (only runs while on Step 2) ──
  useEffect(() => {
    if (currentStep !== 1) return;
    if (timer === 0) {
      setResendActive(true);
      return;
    }
    setResendActive(false);
    const interval = setInterval(() => {
      setTimer(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, currentStep]);

  // ── Fade helper ──
  const animateToStep = (nextStep) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  // ────────────────────────────── Step 1 handlers ──────────────────────────────

  const handleGetOtp = async () => {
    setPhoneLoading(true);
    if (!mobileNumber || mobileNumber.length < 10) {
      Alert.alert('Please enter a valid mobile number');
      setPhoneLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${BaseURL}/send-otp`, {
        phoneNumber: `+91${mobileNumber}`,
      });

      if (res.data.success) {
        Alert.alert('OTP sent successfully!');
        setPhoneLoading(false);
        setTimer(120); // reset timer
        animateToStep(1); // fade to OTP step
      } else {
        Alert.alert('Failed to send OTP. Please try again.');
        setPhoneLoading(false);
      }
    } catch (error) {
      setPhoneLoading(false);
      if (error.response) {
        console.error('Error Response:', error.response);
      } else if (error.request) {
        console.error('Error Request:', error.request);
      } else {
        console.error('Error Message:', error.message);
      }
      Alert.alert(
        'An error occurred while sending OTP. Please check network, server, and IP configuration.',
      );
    }
  };

  // ────────────────────────────── Step 2 handlers ──────────────────────────────

  const handleOtpChange = (text, index) => {
    if (text.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < otp.length - 1) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleResend = async () => {
    try {
      setTimer(120);
      setResendActive(false);
      await axios.post(`${BaseURL}/resend-otp`, {
        phoneNumber: `+91${mobileNumber}`,
      });
      Alert.alert('OTP resent!');
    } catch (error) {
      console.error(error);
      Alert.alert('Failed to resend OTP. Please try again.');
    }
  };

  const handleVerifyOtp = async () => {
    setOtpLoading(true);
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      Alert.alert('Please enter a complete OTP');
      setOtpLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${BaseURL}/verify-otp`, {
        phoneNumber: `+91${mobileNumber}`,
        code: otpCode,
      });

      if (response.data.success) {
        Alert.alert('OTP verified successfully!');
        // Navigate to ChatsList after successful verification
        navigation.navigate('ChatsList');
      } else {
        Alert.alert('Failed to verify OTP. Please try again.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Something went wrong. Please try again later.');
    } finally {
      setOtpLoading(false);
    }
  };

  // ────────────────────────────── Render ──────────────────────────────

  const renderPhoneStep = () => (
    <View style={styles.content}>
      <Image source={OTP_ILLUSTRATION} style={styles.illustration} />
      <Text style={styles.title}>OTP Verification</Text>
      <Text style={styles.subtitle}>
        We will send you a one Time Password on this mobile number
      </Text>
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.primary }]}>
          Mobile number
        </Text>
        <TextInput
          style={[styles.input, { borderColor: theme.primary }]}
          placeholder="1234567891"
          placeholderTextColor="#B5B5B5"
          keyboardType="phone-pad"
          value={mobileNumber}
          onChangeText={setMobileNumber}
        />
      </View>
      {phoneLoading ? (
        <ActivityIndicator size="large" color={theme.primary} />
      ) : (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleGetOtp}>
          <Text style={styles.buttonText}>Get OTP</Text>
        </TouchableOpacity>
      )}
      <View style={styles.footerText}>
        <Text style={styles.footerNormalText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => Alert.alert('Sign Up pressed!')}>
          <Text style={[styles.footerLinkText, { color: theme.primary }]}>
            Sign Up
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOtpStep = () => (
    <View style={styles.otpContent}>
      <View style={styles.card}>
        <Image source={OTP_ILLUSTRATION} style={styles.otpImage} />
        <Text style={styles.otpTitle}>OTP Verification</Text>
        <Text style={styles.otpSubtitle}>
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
              onChangeText={text => handleOtpChange(text, idx)}
              ref={ref => (otpInputs.current[idx] = ref)}
              editable={!otpLoading}
              selectionColor="black"
              placeholderTextColor="#999"
            />
          ))}
        </View>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: theme.primary },
            otpLoading && { backgroundColor: '#cccccc' },
          ]}
          onPress={handleVerifyOtp}
          disabled={otpLoading}>
          <Text style={styles.submitText}>
            {otpLoading ? 'Loading...' : 'Verify'}
          </Text>
        </TouchableOpacity>

        {/* RESEND OTP */}
        <View style={{ alignItems: 'center', width: '100%' }}>
          {resendActive ? (
            <TouchableOpacity onPress={handleResend} disabled={otpLoading}>
              <Text style={[styles.resendLink, { color: theme.primary }]}>
                Resend OTP
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendText}>
              Resend OTP in {Math.floor(timer / 60)}:
              {(timer % 60).toString().padStart(2, '0')}
            </Text>
          )}
        </View>

        {/* BACK TO CHANGE NUMBER */}
        <TouchableOpacity
          style={styles.changeNumberBtn}
          onPress={() => {
            setOtp(['', '', '', '', '', '']);
            animateToStep(0);
          }}>
          <Text style={[styles.changeNumberText, { color: theme.primary }]}>
            Change Number
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.animatedWrap, { opacity: fadeAnim }]}>
          {currentStep === 0 ? renderPhoneStep() : renderOtpStep()}
        </Animated.View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ────────────────────────────── Styles ──────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  safeArea: {
    flex: 1,
  },
  animatedWrap: {
    flex: 1,
  },

  /* ── Step 1 (Phone) ── */
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

  /* ── Step 2 (OTP) ── */
  otpContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: Math.min(380, width - 40),
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  otpImage: {
    width: 140,
    height: 140,
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  otpTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#222',
  },
  otpSubtitle: {
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
  changeNumberBtn: {
    marginTop: 12,
  },
  changeNumberText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
