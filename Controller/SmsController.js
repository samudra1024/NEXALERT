import { PermissionsAndroid, Platform, NativeModules, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        read: parseInt(msg.read),
        is_spam: msg.is_spam === true,
      }));
    } catch (error) {
      console.error('Error fetching SMS:', error);
      throw error;
    }
  }

  // Helper to get avatar color
  static getAvatarColor(address) {
    const colors = ['#2563eb', '#fd79a8', '#fdcb6e', '#e17055', '#1d4ed8', '#00b894'];
    const index = address.charCodeAt(0) % colors.length;
    return colors[index];
  }

  static pickConversationCategory(messages) {
    const validCategories = ['personal', 'otp', 'banking', 'subscription', 'recharge_data'];
    const classified = messages
      .filter(msg => !msg.is_spam && validCategories.includes(msg.category))
      .sort((a, b) => b.date - a.date);

    if (classified.length > 0) {
      return classified[0].category;
    }

    return messages[0]?.category ?? 'unknown';
  }

  // Get conversations (grouped by address) with pagination
  static async getConversations(page = 1, limit = 20) {
    try {
      const messages = await this.fetchSmsMessages();

      // Group all messages by address
      const messagesByAddress = {};

      messages.forEach(msg => {
        const address = msg.address;
        if (!messagesByAddress[address]) {
          messagesByAddress[address] = [];
        }
        messagesByAddress[address].push(msg);
      });

      const conversationsMap = {};

      Object.entries(messagesByAddress).forEach(([address, addressMessages]) => {
        addressMessages.sort((a, b) => b.date - a.date);
        const newest = addressMessages[0];

        conversationsMap[address] = {
          id: address,
          name: address, // In a real app, resolve contact name here
          avatar: address[0] || '?',
          avatarColor: this.getAvatarColor(address),
          lastMessage: newest.body,
          time: new Date(newest.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          rawTime: newest.date,
          unread: addressMessages.filter(msg => msg.read === 0 && msg.type === 1).length,
          category: this.pickConversationCategory(addressMessages),
          is_spam: addressMessages.some(msg => msg.is_spam === true),
        };
      });

      // Convert to array
      const sortedConversations = Object.values(conversationsMap);
      // Ensure conversations are sorted by latest message
      sortedConversations.sort((a, b) => b.rawTime - a.rawTime);

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedConversations = sortedConversations.slice(startIndex, endIndex);

      return {
        conversations: paginatedConversations,
        hasMore: endIndex < sortedConversations.length,
        page: page
      };

    } catch (error) {
      console.error('Error getting conversations:', error);
      throw error;
    }
  }

  // Get messages for a specific chat
  static async getChatMessages(contactId, page = 1, limit = 20) {
    try {
      const messages = await this.fetchSmsMessages();

      const chatMessages = messages.filter(msg => msg.address === contactId);

      // Sort by date descending (newest first)
      chatMessages.sort((a, b) => b.date - a.date); // or b.date - a.date depending on UI needs. ChatScreen seems to expect newest first.

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedMessages = chatMessages.slice(startIndex, endIndex);

      return {
        messages: paginatedMessages,
        hasMore: endIndex < chatMessages.length,
        page: page
      };
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  }

  // Get starred messages
  static async getStarredMessages() {
    // Mock implementation as native module generally doesn't support starring
    return [];
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