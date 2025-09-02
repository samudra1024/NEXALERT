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
        ];
        
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
  

}

export default SmsController;