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

  // Helper to get avatar color
  static getAvatarColor(address) {
    const colors = ['#2563eb', '#fd79a8', '#fdcb6e', '#e17055', '#1d4ed8', '#00b894'];
    const index = address.charCodeAt(0) % colors.length;
    return colors[index];
  }

  // Get conversations (grouped by address) with pagination
  static async getConversations(page = 1, limit = 20) {
    try {
      const messages = await this.fetchSmsMessages();

      // Group by address
      const conversationsMap = {};

      // Sort messages by date descending first to ensuring we capture the latest
      messages.sort((a, b) => b.date - a.date);

      messages.forEach(msg => {
        const address = msg.address;

        if (!conversationsMap[address]) {
          conversationsMap[address] = {
            id: address,
            name: address, // In a real app, resolve contact name here
            avatar: address[0] || '?',
            avatarColor: this.getAvatarColor(address),
            lastMessage: msg.body,
            time: new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: msg.date,
            unread: 0,
          };
        }

        // Count unread (type 1 is received)
        if (msg.read === 0 && msg.type === 1) {
          conversationsMap[address].unread++;
        }
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

  // --- RECYCLE BIN FEATURES ---

  static RECYCLE_BIN_KEY = 'recycled_sms_ids';

  // Get recycled message IDs
  static async getRecycledMessageIds() {
    try {
      const json = await AsyncStorage.getItem(this.RECYCLE_BIN_KEY);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      console.error("Error getting recycled IDs", e);
      return [];
    }
  }

  // Recycle a conversation (hide from main list, show in recycle bin)
  static async recycleConversation(threadId) {
    try {
      const recycled = await this.getRecycledMessageIds();
      if (!recycled.includes(threadId)) {
        recycled.push(threadId);
        await AsyncStorage.setItem(this.RECYCLE_BIN_KEY, JSON.stringify(recycled));
      }
      return true;
    } catch (e) {
      console.error("Error recycling conversation", e);
      return false;
    }
  }

  // Restore a conversation
  static async restoreConversation(threadId) {
    try {
      let recycled = await this.getRecycledMessageIds();
      recycled = recycled.filter(id => id !== threadId);
      await AsyncStorage.setItem(this.RECYCLE_BIN_KEY, JSON.stringify(recycled));
      return true;
    } catch (e) {
      console.error("Error restoring conversation", e);
      return false;
    }
  }

  // Permanently delete a conversation
  static async permanentDeleteConversation(threadId) {
    try {
      // 1. Remove from recycled list
      await this.restoreConversation(threadId);

      // 2. Delete using Native Module (not implemented in mock usually, but let's assume usage of deleteSms)
      // NOTE: 'threadId' here is actually the 'address' in our logic because we group by address. 
      // Real deletion by thread_id would require mapping address -> thread_id or deleting all msgs from address.
      // For now, we will just delete from our local "recycled" view effectively if we wanted to mimic it, 
      // BUT the requirement implies "Recycle bin functionality".

      // If we want to actually delete from phone:
      // const messages = await this.fetchSmsMessages();
      // const idsToDelete = messages.filter(m => m.address === threadId).map(m => m._id);
      // await this.deleteSms(idsToDelete);

      // For this task, "Recycle bin" usually implies a staging area. 
      // "Permanent delete" implies it's gone for good. 

      // Fetch messages for this contact to get their IDs
      const messages = await this.fetchSmsMessages();
      const idsToDelete = messages
        .filter(msg => msg.address === threadId)
        .map(msg => msg._id);

      if (idsToDelete.length > 0) {
        await this.deleteSms(idsToDelete);
      }
      return true;

    } catch (e) {
      console.error("Error permanently deleting conversation", e);
      return false;
    }
  }

  // Get conversations but EXCLUDE recycled ones
  static async getConversations(page = 1, limit = 20) {
    try {
      const messages = await this.fetchSmsMessages();
      const recycledIds = await this.getRecycledMessageIds();

      // Group by address
      const conversationsMap = {};

      // Sort messages by date descending first to ensuring we capture the latest
      messages.sort((a, b) => b.date - a.date);

      messages.forEach(msg => {
        const address = msg.address;

        // SKIP if this conversation is recycled
        if (recycledIds.includes(address)) return;

        if (!conversationsMap[address]) {
          conversationsMap[address] = {
            id: address,
            name: address, // In a real app, resolve contact name here
            avatar: address[0] || '?',
            avatarColor: this.getAvatarColor(address),
            lastMessage: msg.body,
            time: new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: msg.date,
            unread: 0,
          };
        }

        // Count unread (type 1 is received)
        if (msg.read === 0 && msg.type === 1) {
          conversationsMap[address].unread++;
        }
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

  // Get ONLY recycled conversations
  static async getRecycledConversations() {
    try {
      const messages = await this.fetchSmsMessages();
      const recycledIds = await this.getRecycledMessageIds();

      if (recycledIds.length === 0) return [];

      const conversationsMap = {};

      // Sort for latest message
      messages.sort((a, b) => b.date - a.date);

      messages.forEach(msg => {
        const address = msg.address;

        // ONLY include if recycled
        if (!recycledIds.includes(address)) return;

        if (!conversationsMap[address]) {
          conversationsMap[address] = {
            id: address,
            name: address,
            avatar: address[0] || '?',
            avatarColor: this.getAvatarColor(address),
            lastMessage: msg.body,
            time: new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: msg.date,
            unread: 0, // Unread count might not matter in trash, but good to have
          };
        }
        // Count unread (type 1 is received)
        if (msg.read === 0 && msg.type === 1) {
          conversationsMap[address].unread++;
        }
      });

      const sortedConversations = Object.values(conversationsMap);
      sortedConversations.sort((a, b) => b.rawTime - a.rawTime);
      return sortedConversations;

    } catch (error) {
      console.error('Error getting recycled conversations:', error);
      return [];
    }
  }


  // Mark ALL conversations as read
  static async markAllAsRead() {
    try {
      // Since the native module markAsRead usually takes an address/threadId, 
      // we need to find all unread conversations and mark them.
      // OR if the native module supports a global "mark all", use that.
      // Assuming we need to iterate for now given the existing `markAsRead(address)`.

      const conversations = await this.getConversations(1, 1000); // Get a large batch
      const unreadConvos = conversations.conversations.filter(c => c.unread > 0);

      const promises = unreadConvos.map(c => this.markAsRead(c.id));
      await Promise.all(promises);

      return true;
    } catch (error) {
      console.error('Error marking all as read:', error);
      return false;
    }
  }

}

export default SmsController;