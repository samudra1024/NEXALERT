import { PermissionsAndroid, Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildContactLookupMap,
  applyContactNamesToConversations,
  getCachedContactMap,
  setCachedContactMap,
  formatPhoneNumber,
  normalizePhoneNumber,
  lookupContactName,
  phonesMatch,
} from '../src/utils/contactUtils';
import ContactStore from '../src/services/ContactStore';

const { SmsModule } = NativeModules;

const DEFAULT_PAGE_SIZE = 30;
const SMS_CACHE_TTL_MS = 60 * 1000;
const CONVERSATIONS_CACHE_TTL_MS = 5 * 60 * 1000;

class SmsController {
  static _smsCache = null;
  static _smsCacheTimestamp = 0;
  static _permissionsGranted = false;
  static _conversationsMemoryCache = null;
  static _syncInProgress = false;
  static _syncPromise = null;
  static _contactMapPersisted = false;

  static CONVERSATIONS_CACHE_KEY = 'sms_conversations_cache';
  static CONTACT_MAP_CACHE_KEY = 'contact_lookup_cache';
  static RECYCLE_BIN_META_KEY = 'recycled_sms_meta';

  static clearCache() {
    this._smsCache = null;
    this._smsCacheTimestamp = 0;
  }

  static clearConversationsCache() {
    this._conversationsMemoryCache = null;
  }

  static async getCachedConversationsSnapshot() {
    if (this._conversationsMemoryCache) {
      return this._conversationsMemoryCache;
    }

    try {
      const json = await AsyncStorage.getItem(this.CONVERSATIONS_CACHE_KEY);
      if (!json) return null;
      const parsed = JSON.parse(json);
      this._conversationsMemoryCache = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  static async persistConversationsSnapshot(snapshot) {
    this._conversationsMemoryCache = snapshot;
    try {
      await AsyncStorage.setItem(this.CONVERSATIONS_CACHE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Failed to persist conversations cache:', error);
    }
  }

  static mergeConversations(existing, incoming) {
    if (!existing?.length) return incoming;
    if (!incoming?.length) return existing;

    const incomingMap = new Map(incoming.map(item => [item.id, item]));
    const merged = [];
    const seen = new Set();

    existing.forEach(item => {
      const updated = incomingMap.get(item.id);
      if (updated) {
        merged.push({ ...item, ...updated });
        seen.add(item.id);
      }
    });

    incoming.forEach(item => {
      if (!seen.has(item.id)) {
        merged.push(item);
      }
    });

    merged.sort((a, b) => (b.rawTime || 0) - (a.rawTime || 0));
    return merged;
  }

  static async persistContactMap(map) {
    if (!map || Object.keys(map).length === 0) return;
    setCachedContactMap(map);
    try {
      await AsyncStorage.setItem(this.CONTACT_MAP_CACHE_KEY, JSON.stringify(map));
    } catch (error) {
      console.warn('Failed to persist contact map:', error);
    }
  }

  static async loadPersistedContactMap() {
    if (this._contactMapPersisted && getCachedContactMap()) {
      return getCachedContactMap();
    }

    try {
      const json = await AsyncStorage.getItem(this.CONTACT_MAP_CACHE_KEY);
      if (json) {
        const map = JSON.parse(json);
        setCachedContactMap(map);
        this._contactMapPersisted = true;
        return map;
      }
    } catch (error) {
      console.warn('Failed to load persisted contact map:', error);
    }
    return null;
  }

  static applyStoredDisplayNames(conversations, metaMap = {}) {
    return conversations.map(conv => {
      const stored = metaMap[conv.id];
      const storedName = stored?.displayName;
      if (
        storedName &&
        !/^\d+$/.test(String(storedName).replace(/\D/g, ''))
      ) {
        return {
          ...conv,
          name: storedName,
          avatar: storedName.charAt(0).toUpperCase(),
        };
      }
      return conv;
    });
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
        is_spam: msg.is_spam === true,
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

  static decorateConversation(conv) {
    const isSpam = conv.isSpam === true || conv.is_spam === true;
    return {
      ...conv,
      avatarColor: this.getAvatarColor(conv.id),
      category: conv.category ?? 'unknown',
      isSpam,
      is_spam: isSpam,
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
    if (SmsModule.getContactsPaginated) {
      const result = await SmsModule.getContactsPaginated(1, 500, '');
      return result.contacts || [];
    }
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

  static async getConversations(page = 1, limit = DEFAULT_PAGE_SIZE, filter = 'inbox', options = {}) {
    const { background = false, forceRefresh = false } = options;

    if (page === 1 && !forceRefresh && !background) {
      const snapshot = await this.getCachedConversationsSnapshot();
      if (snapshot?.conversations?.length) {
        const age = Date.now() - (snapshot.timestamp || 0);
        if (age < CONVERSATIONS_CACHE_TTL_MS) {
          this.syncConversationsInBackground(limit, filter).catch(() => {});
          return {
            conversations: snapshot.conversations,
            hasMore: snapshot.hasMore ?? true,
            page: snapshot.page ?? 1,
            fromCache: true,
          };
        }
      }
    }

    if (this._syncInProgress && page === 1 && background) {
      return this._syncPromise || { conversations: [], hasMore: false, page: 1, fromCache: true };
    }

    const fetchPromise = this._fetchConversations(page, limit, filter, forceRefresh);

    if (page === 1 && background) {
      this._syncInProgress = true;
      this._syncPromise = fetchPromise
        .finally(() => {
          this._syncInProgress = false;
          this._syncPromise = null;
        });
      return this._syncPromise;
    }

    return fetchPromise;
  }

  static async syncConversationsInBackground(limit = DEFAULT_PAGE_SIZE, filter = 'inbox') {
    if (this._syncInProgress) {
      return this._syncPromise;
    }
    return this.getConversations(1, limit, filter, { background: true, forceRefresh: true });
  }

  static async _fetchConversations(page, limit, filter, forceRefresh) {
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

        const resolved = await this.resolveContactNames(conversations, { skipNativeLookup: page > 1 });
        const payload = {
          conversations: resolved,
          hasMore: !!result.hasMore,
          page: result.page ?? page,
        };

        if (page === 1) {
          await this.persistConversationsSnapshot({
            ...payload,
            timestamp: Date.now(),
          });
        }

        return payload;
      }

      const messages = await this.fetchSmsMessages(forceRefresh);
      const excluded = new Set(excludeAddresses);
      const messagesByAddress = {};

      messages.forEach(msg => {
        const address = msg.address;
        if (!address || excluded.has(address)) {
          return;
        }
        if (!messagesByAddress[address]) {
          messagesByAddress[address] = [];
        }
        messagesByAddress[address].push(msg);
      });

      const conversationsMap = {};
      Object.entries(messagesByAddress).forEach(([address, addressMessages]) => {
        addressMessages.sort((a, b) => b.date - a.date);
        const newest = addressMessages[0];
        conversationsMap[address] = this.decorateConversation({
          id: address,
          name: address,
          avatar: address[0] || '?',
          lastMessage: newest.body,
          time: new Date(newest.date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          rawTime: newest.date,
          unread: addressMessages.filter(msg => msg.read === 0 && msg.type === 1).length,
          category: this.pickConversationCategory(addressMessages),
          isSpam: addressMessages.some(msg => msg.is_spam === true),
        });
      });

      const sortedConversations = this.applyConversationFilters(
        Object.values(conversationsMap),
        filter,
        await this.getBlockedNumbers(),
        await this.getPinnedConversations(),
      );

      const startIndex = (page - 1) * limit;
      const paginatedConversations = sortedConversations.slice(
        startIndex,
        startIndex + limit,
      );

      const resolved = await this.resolveContactNames(paginatedConversations);
      const payload = {
        conversations: resolved,
        hasMore: startIndex + limit < sortedConversations.length,
        page,
      };

      if (page === 1) {
        await this.persistConversationsSnapshot({
          ...payload,
          timestamp: Date.now(),
        });
      }

      return payload;
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
        .filter(msg => phonesMatch(msg.address, contactId))
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
    const conversations = this.buildConversationMap(messages, address => blockedSet.has(address));
    return this.resolveContactNames(conversations);
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
      this.clearConversationsCache();
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
    const messagesByAddress = {};

    messages.forEach(msg => {
      const address = msg.address;
      if (!address || !filterFn(address)) {
        return;
      }
      if (!messagesByAddress[address]) {
        messagesByAddress[address] = [];
      }
      messagesByAddress[address].push(msg);
    });

    const conversations = Object.entries(messagesByAddress).map(([address, addressMessages]) => {
      addressMessages.sort((a, b) => b.date - a.date);
      const newest = addressMessages[0];
      return this.decorateConversation({
        id: address,
        name: address,
        avatar: address[0] || '?',
        lastMessage: newest.body,
        time: new Date(newest.date).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        date: new Date(newest.date).toLocaleDateString(),
        rawTime: newest.date,
        unread: addressMessages.filter(msg => msg.read === 0 && msg.type === 1).length,
        category: this.pickConversationCategory(addressMessages),
        isSpam: addressMessages.some(msg => msg.is_spam === true),
      });
    });

    conversations.sort((a, b) => b.rawTime - a.rawTime);
    return conversations;
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

  static async getRecycledMeta() {
    try {
      const json = await AsyncStorage.getItem(this.RECYCLE_BIN_META_KEY);
      return json ? JSON.parse(json) : {};
    } catch {
      return {};
    }
  }

  static async setRecycledMeta(meta) {
    try {
      await AsyncStorage.setItem(this.RECYCLE_BIN_META_KEY, JSON.stringify(meta));
    } catch (error) {
      console.warn('Failed to persist recycle bin metadata:', error);
    }
  }

  static async recycleConversation(threadId, metadata = {}) {
    try {
      const recycled = await this.getRecycledMessageIds();
      if (!recycled.includes(threadId)) {
        recycled.push(threadId);
        await AsyncStorage.setItem(this.RECYCLE_BIN_KEY, JSON.stringify(recycled));
      }

      const meta = await this.getRecycledMeta();
      meta[threadId] = {
        displayName: metadata.displayName || null,
        normalizedPhone: normalizePhoneNumber(threadId),
        recycledAt: Date.now(),
      };
      await this.setRecycledMeta(meta);
      this.clearConversationsCache();
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

      const meta = await this.getRecycledMeta();
      delete meta[threadId];
      await this.setRecycledMeta(meta);
      this.clearConversationsCache();
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

  static async loadContactCache(forceRefresh = false) {
    if (!forceRefresh) {
      const memoryMap = getCachedContactMap();
      if (memoryMap) {
        return memoryMap;
      }

      const persisted = await this.loadPersistedContactMap();
      if (persisted) {
        return persisted;
      }

      const storeMap = await ContactStore.getLookupMap();
      if (storeMap && Object.keys(storeMap).length > 0) {
        return storeMap;
      }
    }

    try {
      await this.ensurePermissions();
      await ContactStore.syncDeviceContacts(forceRefresh);
      const map = await ContactStore.getLookupMap();
      if (map && Object.keys(map).length > 0) {
        await this.persistContactMap(map);
        return map;
      }

      const deviceContacts = await this.getAllContacts();
      const builtMap = buildContactLookupMap(deviceContacts);
      await this.persistContactMap(builtMap);
      return builtMap;
    } catch (error) {
      console.warn('Failed to load contact cache:', error);
      return getCachedContactMap() || (await this.loadPersistedContactMap()) || {};
    }
  }

  static async preloadContacts() {
    return ContactStore.preload();
  }

  static async getContactsPaginated(page = 1, pageSize = 30, searchQuery = '') {
    return ContactStore.loadContacts({
      page,
      pageSize,
      searchQuery,
      includeConversations: false,
      backgroundSync: page === 1,
    });
  }

  static async searchLocalContacts(query, limit = 50) {
    return ContactStore.searchContacts(query, limit);
  }

  static async resolveContactNames(conversations, options = {}) {
    const { skipNativeLookup = false } = options;

    try {
      const contactMap = await this.loadContactCache();
      let mergedMap = { ...contactMap };

      if (!skipNativeLookup && conversations.length > 0 && SmsModule.getContactNames) {
        const unresolved = conversations
          .filter(conv => !lookupContactName(conv.id, mergedMap))
          .map(conv => conv.id);

        if (unresolved.length > 0) {
          const nativeMap = await SmsModule.getContactNames(unresolved);
          Object.keys(nativeMap || {}).forEach(key => {
            if (nativeMap[key]) {
              mergedMap[key] = nativeMap[key];
            }
          });
          await this.persistContactMap(mergedMap);
        }
      }

      return applyContactNamesToConversations(conversations, mergedMap);
    } catch (error) {
      console.warn('Contact name resolution failed, using numbers:', error);
      return conversations.map(conv => ({
        ...conv,
        name: conv.name && !/^\d+$/.test(String(conv.name).replace(/\D/g, ''))
          ? conv.name
          : formatPhoneNumber(conv.id),
      }));
    }
  }

  static async searchConversations(query, limit = 50) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return [];
    }

    const messages = await this.searchMessages(trimmed, limit);
    if (messages.length === 0) {
      return [];
    }

    const contactMap = await this.loadContactCache();
    const conversationMap = new Map();

    messages.forEach(msg => {
      const address = msg.address;
      if (!address || conversationMap.has(address)) {
        return;
      }

      const savedName = lookupContactName(address, contactMap);
      const name = savedName || (
        /^\d+$/.test(String(address).replace(/\D/g, ''))
          ? formatPhoneNumber(address)
          : address
      );

      conversationMap.set(address, this.decorateConversation({
        id: address,
        name,
        avatar: name.charAt(0).toUpperCase(),
        lastMessage: msg.body || '',
        time: new Date(msg.date).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        rawTime: msg.date,
        unread: msg.read === 0 && msg.type === 1 ? 1 : 0,
        category: msg.category ?? 'unknown',
      }));
    });

    return Array.from(conversationMap.values()).sort(
      (a, b) => (b.rawTime || 0) - (a.rawTime || 0),
    );
  }

  static async getRecycledConversations() {
    try {
      const recycledIds = await this.getRecycledMessageIds();
      if (recycledIds.length === 0) {
        return [];
      }

      const recycledSet = new Set(recycledIds);
      const meta = await this.getRecycledMeta();
      const messages = await this.fetchSmsMessages();
      const conversations = this.buildConversationMap(
        messages,
        address => recycledSet.has(address),
      );
      const withStoredNames = this.applyStoredDisplayNames(conversations, meta);
      return this.resolveContactNames(withStoredNames, { skipNativeLookup: false });
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
