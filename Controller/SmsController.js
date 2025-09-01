import { PermissionsAndroid, Platform, NativeModules } from 'react-native';

const { SmsModule } = NativeModules;

class SmsController {
  // Request SMS permission
  static async requestSmsPermission() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: 'SMS Permission',
            message: 'This app needs access to read SMS messages',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  }

  // Fetch SMS messages using native module
  static async fetchSmsMessages() {
    try {
      const hasPermission = await this.requestSmsPermission();
      if (!hasPermission) {
        throw new Error('SMS permission denied');
      }

      const messages = await SmsModule.getSmsMessages();
      return messages.map(msg => ({
        ...msg,
        date: parseInt(msg.date),
        type: parseInt(msg.type)
      }));
    } catch (error) {
      console.error('Error fetching SMS:', error);
      throw error;
    }
  }
}

export default SmsController;