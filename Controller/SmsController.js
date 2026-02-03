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

  // Fetch formatted chat messages with pagination
  static async getChatMessages(contactId, page = 1, pageSize = 50) {
    try {
      const smsMessages = await this.fetchSmsMessages();

      // Filter and sort all messages for this contact (Oldest to Newest)
      const allMessages = smsMessages
        .filter(sms => sms.address === contactId)
        .sort((a, b) => a.date - b.date);

      // Calculate pagination indices
      const totalMessages = allMessages.length;

      // We want the last N messages based on the page number.
      // Page 1: Last 50 messages. (total - 50) to (total)
      // Page 2: Previous 50. (total - 100) to (total - 50)

      let start = totalMessages - (page * pageSize);
      let end = totalMessages - ((page - 1) * pageSize);

      // Adjust boundaries
      if (end > totalMessages) end = totalMessages;
      if (start < 0) start = 0;
      if (end < 0) end = 0;

      // Slice the messages for the current page
      // Note: slice(start, end) where end is exclusive.
      // If start >= end (e.g. both 0), we get empty array.
      const pagedMessages = allMessages.slice(start, end);

      // Format messages
      const formattedMessages = pagedMessages.map((sms) => ({
        id: sms.id,
        sender: parseInt(sms.type) === 2 ? 'me' : sms.address,
        text: sms.body,
        time: new Date(parseInt(sms.date)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: parseInt(sms.date),
        status: parseInt(sms.type) === 2 ? (parseInt(sms.read) === 1 ? 'seen' : parseInt(sms.status) === 0 ? 'sent' : 'pending') : null,
        reaction: null
      }));

      return {
        messages: formattedMessages,
        hasMore: start > 0,
        page: page
      };

    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  }


  // Fetch formatted chat messages with pagination
  static async getConversations(page = 1, pageSize = 50) {
    try {
      const messages = await this.fetchSmsMessages();

      // Group messages by contact
      const contactsMap = {};

      messages.forEach(msg => {
        const address = msg.address;
        if (!contactsMap[address]) {
          contactsMap[address] = {
            id: address,
            name: address,
            messages: [],
            avatar: address.charAt(0).toUpperCase(),
            // avatarColor logic needs to be moved or duplicated if we want to do it here, 
            // but for now let's just pass the basic data and let frontend handle color if needed, 
            // OR keep it consistent. Let's add the util function here or inside the map.
            // For simplicity, we'll keep color logic in frontend or simple hash here.
            avatarColor: '#2563eb' // Placeholder or we can move the color logic here.
          };
        }
        contactsMap[address].messages.push(msg);
      });

      // Process each contact to get last message and sort
      const contactsList = Object.values(contactsMap).map(contact => {
        const sortedMessages = contact.messages.sort((a, b) => b.date - a.date);
        const latestMessage = sortedMessages[0];

        // Calculate unread count for this contact
        const unreadMessages = contact.messages.filter(msg => parseInt(msg.type) === 1 && parseInt(msg.read) === 0);

        return {
          id: contact.id,
          name: contact.name,
          avatar: contact.avatar,
          avatarColor: contact.avatarColor,
          lastMessage: latestMessage.body,
          time: new Date(latestMessage.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: latestMessage.date, // for sorting
          unread: unreadMessages.length,
          messageCount: contact.messages.length
        };
      }).sort((a, b) => b.date - a.date); // Sort by latest message date (Newest first)

      // Pagination
      const totalConversations = contactsList.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;

      const pagedConversations = contactsList.slice(start, end);

      return {
        conversations: pagedConversations,
        hasMore: end < totalConversations,
        page: page
      };

    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  // Delete SMS
  static async deleteMessage(messageId) {
    try {
      if (SmsModule.deleteSms) {
        await SmsModule.deleteSms(messageId);
      } else {
        console.warn("Delete SMS not implemented in native module");
        // Assuming success for UI if not critical, or throw error
      }
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Star Message (Local Only)
  static async toggleStarMessage(messageId) {
    try {
      const stored = await AsyncStorage.getItem('starred_messages');
      let starred = stored ? JSON.parse(stored) : [];

      let isStarred = false;
      if (starred.includes(messageId)) {
        starred = starred.filter(id => id !== messageId);
        isStarred = false;
      } else {
        starred.push(messageId);
        isStarred = true;
      }

      await AsyncStorage.setItem('starred_messages', JSON.stringify(starred));
      return isStarred;
    } catch (error) {
      console.error('Error toggling star:', error);
      return false;
    }
  }

  static async getStarredMessages() {
    try {
      const stored = await AsyncStorage.getItem('starred_messages');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  // Forward Message
  static async forwardMessage(text) {
    try {
      await Share.share({
        message: text,
      });
      return true;
    } catch (error) {
      console.error('Error forwarding message:', error);
      throw error;
    }
  }

}


export default SmsController;