import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BaseURL } from '../config/API';

const AUTH_TOKEN_KEY = '@nexalert_auth_token';
const REFRESH_TOKEN_KEY = '@nexalert_refresh_token';
const TOKEN_EXPIRY_KEY = '@nexalert_token_expiry';
const USER_PHONE_KEY = '@nexalert_user_phone';
const ONBOARDING_COMPLETE_KEY = '@nexalert_onboarding_complete';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

class AuthService {
  static async saveSession({ accessToken, refreshToken, expiresIn, phoneNumber }) {
    const expiry = Date.now() + (expiresIn || 3600) * 1000;
    await AsyncStorage.multiSet([
      [AUTH_TOKEN_KEY, accessToken],
      [REFRESH_TOKEN_KEY, refreshToken || ''],
      [TOKEN_EXPIRY_KEY, String(expiry)],
      [USER_PHONE_KEY, phoneNumber || ''],
    ]);
    return { accessToken, refreshToken, expiry, phoneNumber };
  }

  static async getStoredSession() {
    const [[, token], [, refreshToken], [, expiry], [, phone]] =
      await AsyncStorage.multiGet([
        AUTH_TOKEN_KEY,
        REFRESH_TOKEN_KEY,
        TOKEN_EXPIRY_KEY,
        USER_PHONE_KEY,
      ]);
    if (!token) return null;
    return {
      accessToken: token,
      refreshToken: refreshToken || '',
      expiry: parseInt(expiry || '0', 10),
      phoneNumber: phone || '',
    };
  }

  static async isSessionValid() {
    const session = await this.getStoredSession();
    if (!session?.accessToken) return false;
    return session.expiry > Date.now();
  }

  static async getAccessToken() {
    const session = await this.getStoredSession();
    if (!session) return null;

    if (session.expiry - Date.now() < REFRESH_BUFFER_MS && session.refreshToken) {
      try {
        const refreshed = await this.refreshToken(session.refreshToken);
        return refreshed.accessToken;
      } catch {
        return session.expiry > Date.now() ? session.accessToken : null;
      }
    }

    return session.expiry > Date.now() ? session.accessToken : null;
  }

  static async refreshToken(refreshToken) {
    const token = refreshToken || (await this.getStoredSession())?.refreshToken;
    if (!token) throw new Error('No refresh token available');

    const response = await axios.post(`${BaseURL}/refresh-token`, { refreshToken: token });
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Token refresh failed');
    }

    const session = await this.getStoredSession();
    return this.saveSession({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken || token,
      expiresIn: response.data.expiresIn || 3600,
      phoneNumber: session?.phoneNumber,
    });
  }

  static async verifyOtp(phoneNumber, code) {
    const response = await axios.post(`${BaseURL}/verify-otp`, { phoneNumber, code });
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'OTP verification failed');
    }

    await this.saveSession({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      expiresIn: response.data.expiresIn || 86400,
      phoneNumber,
    });

    return response.data;
  }

  static async sendOtp(phoneNumber) {
    const response = await axios.post(`${BaseURL}/send-otp`, { phoneNumber });
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to send OTP');
    }
    return response.data;
  }

  static async resendOtp(phoneNumber) {
    const response = await axios.post(`${BaseURL}/resend-otp`, { phoneNumber });
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Failed to resend OTP');
    }
    return response.data;
  }

  static async getUserPhone() {
    const session = await this.getStoredSession();
    return session?.phoneNumber || null;
  }

  static async clearSession() {
    await AsyncStorage.multiRemove([
      AUTH_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      TOKEN_EXPIRY_KEY,
      USER_PHONE_KEY,
    ]);
  }

  static async setOnboardingComplete(complete = true) {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, complete ? 'true' : 'false');
  }

  static async isOnboardingComplete() {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === 'true';
  }

  static async getInitialRoute() {
    const [onboardingDone, sessionValid] = await Promise.all([
      this.isOnboardingComplete(),
      this.isSessionValid(),
    ]);

    if (sessionValid) return 'ChatsList';
    if (onboardingDone) return 'AuthScreen';
    return 'Onboarding';
  }
}

export default AuthService;
