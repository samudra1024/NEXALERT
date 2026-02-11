import { PermissionsAndroid, Platform, NativeModules } from 'react-native';

const { SmsModule } = NativeModules;

class SmsController {

  // Request all SMS permissions
  static async requestAllSmsPermissions() {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.SEND_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_MMS,
        ];

        // Add notification permission for Android 13+
        if (Platform.Version >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        return Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  }

  // Fetch SMS messages
  static async fetchSmsMessages() {
    try {
      const hasPermission = await this.requestAllSmsPermissions();
      if (!hasPermission) {
        throw new Error('SMS permissions denied');
      }

      const messages = await SmsModule.getSmsMessages();
      return messages.map(msg => ({
        ...msg,
        date: parseInt(msg.date),
        type: parseInt(msg.type),
        read: parseInt(msg.read)
      }));
    } catch (error) {
      console.error('Error fetching SMS:', error);
      throw error;
    }
  }

  // Send SMS
  static async sendSms(phoneNumber, message) {
    try {
      const hasPermission = await this.requestAllSmsPermissions();
      if (!hasPermission) {
        throw new Error('SMS permissions denied');
      }

      await SmsModule.sendSms(phoneNumber, message);
      return true;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  // Mark messages as read
  static async markAsRead(address) {
    try {
      await SmsModule.markAsRead(address);
      return true;
    } catch (error) {
      console.error('Error marking as read:', error);
      throw error;
    }
  }

  // Get unread count
  static async getUnreadCount() {
    try {
      const count = await SmsModule.getUnreadCount();
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Check if app is default SMS app
  static async isDefaultSmsApp() {
    try {
      const isDefault = await SmsModule.isDefaultSmsApp();
      return isDefault;
    } catch (error) {
      console.error('Error checking default SMS app:', error);
      return false;
    }
  }

  // Check if we should show default SMS prompt
  static async shouldShowDefaultPrompt() {
    try {
      const isDefault = await this.isDefaultSmsApp();
      return !isDefault;
    } catch (error) {
      console.error('Error checking if should show prompt:', error);
      return true; // Show prompt on error to be safe
    }
  }

  // Request to become default SMS app (proper order: role first, then permissions)
  static async requestDefaultSmsApp() {
    try {
      // First request ROLE_SMS (modern approach for Android 11+)
      await SmsModule.requestDefaultSmsApp();

      // Then request runtime permissions after role is granted
      setTimeout(async () => {
        try {
          await this.requestAllSmsPermissions();
        } catch (permError) {
          console.warn('Runtime permissions request failed:', permError);
        }
      }, 1000);

      return true;
    } catch (error) {
      console.error('Error requesting default SMS app:', error);
      throw error;
    }
  }

  // Open SMS app settings
  static async openSmsAppSettings() {
    try {
      await SmsModule.openSmsAppSettings();
      return true;
    } catch (error) {
      console.error('Error opening SMS app settings:', error);
      throw error;
    }
  }

  // Delete SMS messages
  static async deleteSms(ids) {
    try {
      const count = await SmsModule.deleteSms(ids);
      return count;
    } catch (error) {
      console.error('Error deleting SMS:', error);
      throw error;
    }
  }

}

export default SmsController;