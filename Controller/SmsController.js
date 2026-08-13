import { PermissionsAndroid, Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { SmsModule } = NativeModules;

const DEFAULT_PAGE_SIZE = 25;
const SMS_CACHE_TTL_MS = 60 * 1000;

class SmsController {
  static _smsCache = null;
  static _smsCacheTimestamp = 0;
  static _permissionsGranted = false;

  static clearCache() {
    this._smsCache = null;
    this._smsCacheTimestamp = 0;
  }

  static async requestAllSmsPermissions() {
    if (Platform.OS === 'android') {
      try {
        const smsPermissions = [
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.SEND_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_MMS,
        ];

        if (Platform.Version >= 33) {
          smsPermissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }

        const allPermissions = [...smsPermissions, PermissionsAndroid.PERMISSIONS.READ_CONTACTS];
        const granted = await PermissionsAndroid.requestMultiple(allPermissions);
        const smsGranted = smsPermissions.every(
          p => granted[p] === PermissionsAndroid.RESULTS.GRANTED,
        );

        this._permissionsGranted = smsGranted;
        return smsGranted;
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    this._permissionsGranted = true;
    return true;
  }

  static async ensurePermissions() {
    if (this._permissionsGranted) {
      return true;
    }
    return this.requestAllSmsPermissions();
  }

  static async fetchSmsMessages(forceRefresh = false) {
    try {
      const now = Date.now();
      if (
        !forceRefresh &&
        this._smsCache &&
        now - this._smsCacheTimestamp < SMS_CACHE_TTL_MS
      ) {
        return this._smsCache;
      }

      const hasPermission = await this.ensurePermissions();
      if (!hasPermission) {
        throw new Error('SMS permissions denied');
      }

      const messages = await SmsModule.getSmsMessages();
      const normalized = messages.map(msg => ({
        ...msg,
        _id: msg._id || msg.id,
        date: parseInt(msg.date, 10),
        type: parseInt(msg.type, 10),
        read: parseInt(msg.read, 10),
      }));

      this._smsCache = normalized;
      this._smsCacheTimestamp = now;
      return normalized;
    } catch (error) {
      console.error('Error fetching SMS:', error);
      throw error;
    }
  }

  static getAvatarColor(address) {
    const colors = ['#2563eb', '#fd79a8', '#fdcb6e', '#e17055', '#1d4ed8', '#00b894'];
    const index = (address || '?').charCodeAt(0) % colors.length;
    return colors[index];
  }

  static decorateConversation(conv) {
    return {
      ...conv,
      avatarColor: this.getAvatarColor(conv.id),
      category: conv.category ?? 'unknown',
    };
  }

  static async getExcludedAddresses() {
    const [recycledIds, archivedIds, blockedIds] = await Promise.all([
      this.getRecycledMessageIds(),
      this.getArchivedMessageIds(),
      this.getBlockedNumbers(),
    ]);
    return [...new Set([...recycledIds, ...archivedIds, ...blockedIds])];
  }

  static BLOCKED_KEY = 'blocked_sms_numbers';
  static STARRED_KEY = 'starred_sms_ids';
  static DRAFTS_KEY = 'sms_drafts';
  static PINNED_KEY = 'pinned_conversations';

  static async getBlockedNumbers() {
    try {
      const json = await AsyncStorage.getItem(this.BLOCKED_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  static async blockNumber(address) {
    const blocked = await this.getBlockedNumbers();
    if (!blocked.includes(address)) {
      blocked.push(address);
      await AsyncStorage.setItem(this.BLOCKED_KEY, JSON.stringify(blocked));
    }
    return true;
  }

  static async unblockNumber(address) {
    const blocked = (await this.getBlockedNumbers()).filter(id => id !== address);
    await AsyncStorage.setItem(this.BLOCKED_KEY, JSON.stringify(blocked));
    return true;
  }

  static async getStarredMessageIds() {
    try {
      const json = await AsyncStorage.getItem(this.STARRED_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  static async starMessage(messageId) {
    const starred = await this.getStarredMessageIds();
    if (!starred.includes(messageId)) {
      starred.push(messageId);
      await AsyncStorage.setItem(this.STARRED_KEY, JSON.stringify(starred));
    }
    return true;
  }

  static async unstarMessage(messageId) {
    const starred = (await this.getStarredMessageIds()).filter(id => id !== messageId);
    await AsyncStorage.setItem(this.STARRED_KEY, JSON.stringify(starred));
    return true;
  }

  static async getDraft(address) {
    try {
      const json = await AsyncStorage.getItem(this.DRAFTS_KEY);
      const drafts = json ? JSON.parse(json) : {};
      return drafts[address] || '';
    } catch {
      return '';
    }
  }

  static async saveDraft(address, text) {
    try {
      const json = await AsyncStorage.getItem(this.DRAFTS_KEY);
      const drafts = json ? JSON.parse(json) : {};
      if (text && text.trim()) {
        drafts[address] = text.trim();
      } else {
        delete drafts[address];
      }
      await AsyncStorage.setItem(this.DRAFTS_KEY, JSON.stringify(drafts));
      return true;
    } catch {
      return false;
    }
  }

  static async getPinnedConversations() {
    try {
      const json = await AsyncStorage.getItem(this.PINNED_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  static async pinConversation(address) {
    const pinned = await this.getPinnedConversations();
    if (!pinned.includes(address)) {
      pinned.unshift(address);
      await AsyncStorage.setItem(this.PINNED_KEY, JSON.stringify(pinned));
    }
    return true;
  }

  static async unpinConversation(address) {
    const pinned = (await this.getPinnedConversations()).filter(id => id !== address);
    await AsyncStorage.setItem(this.PINNED_KEY, JSON.stringify(pinned));
    return true;
  }

  static async markAsUnread(address) {
    if (SmsModule.markAsUnread) {
      await SmsModule.markAsUnread(address);
      return true;
    }
    return false;
  }

  static async deleteConversation(address) {
    const messages = await this.fetchSmsMessages(true);
    const ids = messages.filter(m => m.address === address).map(m => m._id);
    if (ids.length > 0) {
      await this.deleteSms(ids);
    }
    await this.unpinConversation(address);
    await this.saveDraft(address, '');
    return true;
  }

  static async getAllContacts() {
    await this.ensurePermissions();
    if (SmsModule.getAllContacts) {
      return SmsModule.getAllContacts();
    }
    return [];
  }

  static async searchMessages(query, limit = 50) {
    await this.ensurePermissions();
    if (SmsModule.searchMessages) {
      const results = await SmsModule.searchMessages(query, limit);
      return results.map(msg => ({
        ...msg,
        _id: msg._id || msg.id,
        date: parseInt(msg.date, 10),
        type: parseInt(msg.type, 10),
        read: parseInt(msg.read, 10),
      }));
    }
    const messages = await this.fetchSmsMessages();
    const lower = query.toLowerCase();
    return messages
      .filter(m => (m.body || '').toLowerCase().includes(lower) || (m.address || '').includes(query))
      .slice(0, limit);
  }

  static async getInitialIntentData() {
    if (SmsModule.getInitialIntentData) {
      return SmsModule.getInitialIntentData();
    }
    return {};
  }

  static applyConversationFilters(conversations, filter, blocked, pinned) {
    let result = conversations;

    if (filter === 'spam') {
      result = result.filter(c => c.isSpam);
    } else if (filter === 'inbox') {
      result = result.filter(c => !c.isSpam);
    }

    if (filter !== 'blocked') {
      result = result.filter(c => !blocked.includes(c.id));
    }

    const pinSet = new Set(pinned);
    return [...result].sort((a, b) => {
      const aPinned = pinSet.has(a.id) ? 1 : 0;
      const bPinned = pinSet.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      return (b.rawTime || 0) - (a.rawTime || 0);
    });
  }

  static async getConversations(page = 1, limit = DEFAULT_PAGE_SIZE, filter = 'inbox') {
    try {
      const hasPermission = await this.ensurePermissions();
      if (!hasPermission) {
        throw new Error('SMS permissions denied');
      }

      const excludeAddresses = await this.getExcludedAddresses();

      if (SmsModule.getConversationsPaginated) {
        const result = await SmsModule.getConversationsPaginated(
          page,
          limit,
          excludeAddresses,
        );

        const conversations = this.applyConversationFilters(
          (result.conversations || []).map(conv =>
            this.decorateConversation({
              ...conv,
              rawTime: conv.rawTime ?? 0,
              unread: conv.unread ?? 0,
              isSpam: !!conv.isSpam,
            }),
          ),
          filter,
          await this.getBlockedNumbers(),
          await this.getPinnedConversations(),
        );

        return {
          conversations: await this.resolveContactNames(conversations),
          hasMore: !!result.hasMore,
          page: result.page ?? page,
        };
      }

      const messages = await this.fetchSmsMessages();
      const excluded = new Set(excludeAddresses);
      const conversationsMap = {};

      messages
        .sort((a, b) => b.date - a.date)
        .forEach(msg => {
          const address = msg.address;
          if (!address || excluded.has(address) || conversationsMap[address]) {
            return;
          }

          conversationsMap[address] = this.decorateConversation({
            id: address,
            name: address,
            avatar: address[0] || '?',
            lastMessage: msg.body,
            time: new Date(msg.date).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            rawTime: msg.date,
            unread: 0,
            category: msg.category ?? 'unknown',
          });
        });

      const sortedConversations = Object.values(conversationsMap).sort(
        (a, b) => b.rawTime - a.rawTime,
      );
      sortedConversations.forEach(conv => {
        conv.unread = messages.filter(
          msg => msg.address === conv.id && msg.read === 0 && msg.type === 1,
        ).length;
      });

      const startIndex = (page - 1) * limit;
      const paginatedConversations = sortedConversations.slice(
        startIndex,
        startIndex + limit,
      );

      return {
        conversations: await this.resolveContactNames(paginatedConversations),
        hasMore: startIndex + limit < sortedConversations.length,
        page,
      };
    } catch (error) {
      console.error('Error getting conversations:', error);
      throw error;
    }
  }

  static async getChatMessages(contactId, page = 1, limit = DEFAULT_PAGE_SIZE) {
    try {
      const hasPermission = await this.ensurePermissions();
      if (!hasPermission) {
        throw new Error('SMS permissions denied');
      }

      if (SmsModule.getChatMessagesPaginated) {
        const result = await SmsModule.getChatMessagesPaginated(contactId, page, limit);
        const messages = (result.messages || []).map(msg => ({
          ...msg,
          _id: msg._id || msg.id,
          date: parseInt(msg.date, 10),
          type: parseInt(msg.type, 10),
          read: parseInt(msg.read, 10),
        }));

        return {
          messages,
          hasMore: !!result.hasMore,
          page: result.page ?? page,
        };
      }

      const messages = await this.fetchSmsMessages();
      const chatMessages = messages
        .filter(msg => msg.address === contactId)
        .sort((a, b) => b.date - a.date);

      const startIndex = (page - 1) * limit;
      const paginatedMessages = chatMessages.slice(startIndex, startIndex + limit);

      return {
        messages: paginatedMessages,
        hasMore: startIndex + limit < chatMessages.length,
        page,
      };
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  }

  static async getStarredMessages() {
    return this.getStarredMessageIds();
  }

  static async getBlockedConversations() {
    const blocked = await this.getBlockedNumbers();
    if (blocked.length === 0) {
      return [];
    }
    const messages = await this.fetchSmsMessages();
    const blockedSet = new Set(blocked);
    return this.buildConversationMap(messages, address => blockedSet.has(address));
  }

  static async getSpamConversations(page = 1, limit = DEFAULT_PAGE_SIZE) {
    return this.getConversations(page, limit, 'spam');
  }

  static async sendSms(phoneNumber, message) {
    try {
      const hasPermission = await this.ensurePermissions();
      if (!hasPermission) {
        throw new Error('SMS permissions denied');
      }

      await SmsModule.sendSms(phoneNumber, message);
      this.clearCache();
      return true;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  static async markAsRead(address) {
    try {
      await SmsModule.markAsRead(address);
      return true;
    } catch (error) {
      console.error('Error marking as read:', error);
      throw error;
    }
  }

  static async getUnreadCount() {
    try {
      return await SmsModule.getUnreadCount();
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  static async isDefaultSmsApp() {
    try {
      return await SmsModule.isDefaultSmsApp();
    } catch (error) {
      console.error('Error checking default SMS app:', error);
      return false;
    }
  }

  static async shouldShowDefaultPrompt() {
    try {
      const isDefault = await this.isDefaultSmsApp();
      return !isDefault;
    } catch (error) {
      console.error('Error checking if should show prompt:', error);
      return true;
    }
  }

  static async requestDefaultSmsApp() {
    try {
      await SmsModule.requestDefaultSmsApp();
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

  static async openSmsAppSettings() {
    try {
      await SmsModule.openSmsAppSettings();
      return true;
    } catch (error) {
      console.error('Error opening SMS app settings:', error);
      throw error;
    }
  }

  static async deleteSms(ids) {
    try {
      const count = await SmsModule.deleteSms(ids);
      this.clearCache();
      return count;
    } catch (error) {
      console.error('Error deleting SMS:', error);
      throw error;
    }
  }

  static ARCHIVE_KEY = 'archived_sms_ids';

  static async getArchivedMessageIds() {
    try {
      const json = await AsyncStorage.getItem(this.ARCHIVE_KEY);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      console.error('Error getting archived IDs', e);
      return [];
    }
  }

  static async archiveConversation(address) {
    try {
      const archived = await this.getArchivedMessageIds();
      if (!archived.includes(address)) {
        archived.push(address);
        await AsyncStorage.setItem(this.ARCHIVE_KEY, JSON.stringify(archived));
      }
      return true;
    } catch (e) {
      console.error('Error archiving conversation', e);
      return false;
    }
  }

  static async unarchiveConversation(address) {
    try {
      let archived = await this.getArchivedMessageIds();
      archived = archived.filter(id => id !== address);
      await AsyncStorage.setItem(this.ARCHIVE_KEY, JSON.stringify(archived));
      return true;
    } catch (e) {
      console.error('Error unarchiving conversation', e);
      return false;
    }
  }

  static buildConversationMap(messages, filterFn) {
    const conversationsMap = {};

    messages.forEach(msg => {
      const address = msg.address;
      if (!filterFn(address)) {
        return;
      }

      if (!conversationsMap[address]) {
        conversationsMap[address] = {
          id: address,
          name: address,
          avatar: address[0] || '?',
          avatarColor: this.getAvatarColor(address),
          lastMessage: msg.body,
          time: new Date(msg.date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          date: new Date(msg.date).toLocaleDateString(),
          rawTime: msg.date,
          unread: 0,
          category: msg.category ?? 'unknown',
        };
      }

      if (msg.read === 0 && msg.type === 1) {
        conversationsMap[address].unread++;
      }
    });

    const sorted = Object.values(conversationsMap);
    sorted.sort((a, b) => b.rawTime - a.rawTime);
    return sorted;
  }

  static async getArchivedConversations() {
    try {
      const archivedIds = await this.getArchivedMessageIds();
      if (archivedIds.length === 0) {
        return [];
      }

      const archivedSet = new Set(archivedIds);
      const messages = await this.fetchSmsMessages();
      const sorted = this.buildConversationMap(messages, address => archivedSet.has(address));
      return this.resolveContactNames(sorted);
    } catch (error) {
      console.error('Error getting archived conversations:', error);
      return [];
    }
  }

  static RECYCLE_BIN_KEY = 'recycled_sms_ids';

  static async getRecycledMessageIds() {
    try {
      const json = await AsyncStorage.getItem(this.RECYCLE_BIN_KEY);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      console.error('Error getting recycled IDs', e);
      return [];
    }
  }

  static async recycleConversation(threadId) {
    try {
      const recycled = await this.getRecycledMessageIds();
      if (!recycled.includes(threadId)) {
        recycled.push(threadId);
        await AsyncStorage.setItem(this.RECYCLE_BIN_KEY, JSON.stringify(recycled));
      }
      return true;
    } catch (e) {
      console.error('Error recycling conversation', e);
      return false;
    }
  }

  static async restoreConversation(threadId) {
    try {
      let recycled = await this.getRecycledMessageIds();
      recycled = recycled.filter(id => id !== threadId);
      await AsyncStorage.setItem(this.RECYCLE_BIN_KEY, JSON.stringify(recycled));
      return true;
    } catch (e) {
      console.error('Error restoring conversation', e);
      return false;
    }
  }

  static async permanentDeleteConversation(threadId) {
    try {
      await this.restoreConversation(threadId);
      const messages = await this.fetchSmsMessages(true);
      const idsToDelete = messages
        .filter(msg => msg.address === threadId)
        .map(msg => msg._id);

      if (idsToDelete.length > 0) {
        await this.deleteSms(idsToDelete);
      }
      return true;
    } catch (e) {
      console.error('Error permanently deleting conversation', e);
      return false;
    }
  }

  static async resolveContactNames(conversations) {
    try {
      const phoneNumbers = conversations.map(c => c.id);
      if (phoneNumbers.length === 0) {
        return conversations;
      }

      const contactNameMap = await SmsModule.getContactNames(phoneNumbers);
      return conversations.map(conv => {
        const savedName = contactNameMap[conv.id];
        if (savedName) {
          return {
            ...conv,
            name: savedName,
            avatar: savedName.charAt(0).toUpperCase(),
          };
        }
        return conv;
      });
    } catch (error) {
      console.warn('Contact name resolution failed, using numbers:', error);
      return conversations;
    }
  }

  static async getRecycledConversations() {
    try {
      const recycledIds = await this.getRecycledMessageIds();
      if (recycledIds.length === 0) {
        return [];
      }

      const recycledSet = new Set(recycledIds);
      const messages = await this.fetchSmsMessages();
      return this.buildConversationMap(messages, address => recycledSet.has(address));
    } catch (error) {
      console.error('Error getting recycled conversations:', error);
      return [];
    }
  }

  static async markAllAsRead() {
    try {
      if (SmsModule.markAllAsRead) {
        await SmsModule.markAllAsRead();
        return true;
      }

      const conversations = await this.getConversations(1, 100);
      const unreadConvos = conversations.conversations.filter(c => c.unread > 0);
      await Promise.all(unreadConvos.map(c => this.markAsRead(c.id)));
      return true;
    } catch (error) {
      console.error('Error marking all as read:', error);
      return false;
    }
  }
}

export default SmsController;
