import { InteractionManager, NativeEventEmitter, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildContactLookupMap,
  getCachedContactMap,
  setCachedContactMap,
  normalizePhoneNumber,
  resolveDisplayName,
} from '../utils/contactUtils';

const { SmsModule } = NativeModules;

export const CONTACT_PAGE_SIZE = 30;
export const PREFETCH_THRESHOLD = 0.75;
export const SYNC_STALE_MS = 5 * 60 * 1000;
export const CONTACT_META_KEY = 'contact_store_meta';

function computePaginationMeta(page, pageSize, total) {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const safeTotal = Math.max(0, total);
  const offset = (safePage - 1) * safeSize;
  return {
    page: safePage,
    pageSize: safeSize,
    total: safeTotal,
    offset,
    hasMore: offset + safeSize < safeTotal,
  };
}

function logContactPagination(stage, meta) {
  console.log('[CONTACT PAGINATION]', stage, {
    page: meta.page,
    pageSize: meta.pageSize,
    offset: meta.offset,
    returned: meta.returned,
    total: meta.total,
    hasMore: meta.hasMore,
  });
}

let syncPromise = null;
let observerStarted = false;
let contactsChangedSubscription = null;

const getNativeModule = () => (Platform.OS === 'android' ? SmsModule : null);

async function loadMeta() {
  try {
    const json = await AsyncStorage.getItem(CONTACT_META_KEY);
    return json ? JSON.parse(json) : { lastSync: 0 };
  } catch {
    return { lastSync: 0 };
  }
}

async function saveMeta(meta) {
  try {
    await AsyncStorage.setItem(CONTACT_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.warn('Failed to persist contact meta:', error);
  }
}

function runAfterInteractions(task) {
  return new Promise((resolve, reject) => {
    InteractionManager.runAfterInteractions(() => {
      Promise.resolve(task()).then(resolve).catch(reject);
    });
  });
}

function updateLookupMapFromContacts(contacts) {
  const map = buildContactLookupMap(contacts);
  if (Object.keys(map).length > 0) {
    setCachedContactMap(map);
    AsyncStorage.setItem('contact_lookup_cache', JSON.stringify(map)).catch(() => {});
    try {
      const useAppStore = require('../store/useAppStore').default;
      useAppStore.getState().setContactsCache(map);
    } catch {
      // store not ready during early boot
    }
  }
  return map;
}

function decorateContact(contact) {
  const phone = contact.phone || contact.phoneNumber || contact.id;
  const name = contact.name || resolveDisplayName(contact, phone);
  return {
    ...contact,
    id: contact.id || phone,
    contactId: contact.contactId || contact.id || phone,
    name,
    phone,
    normalizedPhone: contact.normalizedPhone || normalizePhoneNumber(phone),
  };
}

function mergeWithConversations(contacts, conversations = []) {
  const merged = new Map();

  conversations.forEach(conv => {
    merged.set(conv.id, {
      id: conv.id,
      contactId: conv.id,
      name: conv.name,
      phone: conv.id,
      normalizedPhone: normalizePhoneNumber(conv.id),
      source: 'sms',
    });
  });

  contacts.forEach(contact => {
    const decorated = decorateContact(contact);
    const key = decorated.normalizedPhone || decorated.id;
    const existing = merged.get(decorated.id) || merged.get(key);

    if (!existing) {
      merged.set(decorated.id, decorated);
      return;
    }

    merged.set(existing.id, {
      ...existing,
      ...decorated,
      name: decorated.name || existing.name,
      source: existing.source === 'sms' ? 'sms' : decorated.source,
    });
  });

  return Array.from(merged.values()).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
  );
}

async function fallbackLoadAllContacts(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedContactMap();
    if (cached) {
      return Object.entries(cached).map(([phone, name]) => ({
        id: phone,
        contactId: phone,
        name,
        phone,
        normalizedPhone: normalizePhoneNumber(phone),
        source: 'phone',
      }));
    }
  }

  if (!SmsModule?.getAllContacts) {
    return [];
  }

  const deviceContacts = await SmsModule.getAllContacts();
  const decorated = (deviceContacts || []).map(decorateContact);
  updateLookupMapFromContacts(decorated);
  return decorated;
}

async function queryLocalContacts(page, pageSize, searchQuery = '') {
  const native = getNativeModule();
  if (!native?.getContactsPaginated) {
    const all = await fallbackLoadAllContacts(false);
    const trimmed = (searchQuery || '').trim().toLowerCase();
    const filtered = trimmed
      ? all.filter(c =>
          (c.name || '').toLowerCase().includes(trimmed) ||
          (c.phone || '').includes(trimmed) ||
          (c.normalizedPhone || '').includes(trimmed.replace(/\D/g, '')),
        )
      : all;
    const offset = (page - 1) * pageSize;
    const contacts = filtered.slice(offset, offset + pageSize);
    const pagination = computePaginationMeta(page, pageSize, filtered.length);
    logContactPagination('queryLocalContacts(fallback)', {
      ...pagination,
      returned: contacts.length,
    });
    return {
      contacts,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      hasMore: pagination.hasMore,
      fromCache: true,
      lastSync: 0,
    };
  }

  const result = await native.getContactsPaginated(page, pageSize, searchQuery || '');
  const resolvedPage = result.page ?? page;
  const resolvedPageSize = result.pageSize ?? pageSize;
  const resolvedTotal = result.total ?? 0;
  const pagination = computePaginationMeta(resolvedPage, resolvedPageSize, resolvedTotal);
  const contacts = (result.contacts || []).map(decorateContact);
  logContactPagination('queryLocalContacts(native)', {
    ...pagination,
    returned: contacts.length,
  });
  return {
    contacts,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    hasMore: pagination.hasMore,
    fromCache: true,
    lastSync: result.lastSync ?? 0,
  };
}

const ContactStore = {
  PAGE_SIZE: CONTACT_PAGE_SIZE,

  async getCachedContactsPage(page = 1, pageSize = CONTACT_PAGE_SIZE, searchQuery = '') {
    return queryLocalContacts(page, pageSize, searchQuery);
  },

  async searchContacts(query, limit = 50) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return [];
    }
    const result = await queryLocalContacts(1, limit, trimmed);
    return result.contacts;
  },

  async syncDeviceContacts(force = false) {
    const native = getNativeModule();
    if (!native?.syncDeviceContacts) {
      await runAfterInteractions(() => fallbackLoadAllContacts(force));
      return { inserted: 0, updated: 0, deleted: 0, skipped: true };
    }

    const meta = await loadMeta();
    const age = Date.now() - (meta.lastSync || 0);
    if (!force && age < SYNC_STALE_MS && syncPromise) {
      return syncPromise;
    }
    if (!force && age < SYNC_STALE_MS && meta.lastSync > 0) {
      return { inserted: 0, updated: 0, deleted: 0, skipped: true, timestamp: meta.lastSync };
    }

    if (syncPromise) {
      return syncPromise;
    }

    syncPromise = runAfterInteractions(async () => {
      try {
        const result = await native.syncDeviceContacts();
        const allContacts = await queryLocalContacts(1, 1000, '');
        updateLookupMapFromContacts(allContacts.contacts);
        await saveMeta({ lastSync: result.timestamp || Date.now() });
        return result;
      } finally {
        syncPromise = null;
      }
    });

    return syncPromise;
  },

  async getPaginationMeta(page = 1, pageSize = CONTACT_PAGE_SIZE, searchQuery = '') {
    const localResult = await queryLocalContacts(page, pageSize, searchQuery);
    return computePaginationMeta(localResult.page, localResult.pageSize, localResult.total);
  },

  async loadContacts(options = {}) {
    const {
      page = 1,
      pageSize = CONTACT_PAGE_SIZE,
      searchQuery = '',
      includeConversations = false,
      forceSync = false,
      backgroundSync = true,
      onSyncComplete,
    } = options;

    const localResult = await queryLocalContacts(page, pageSize, searchQuery);
    let contacts = localResult.contacts;
    const sqliteReturned = contacts.length;

    if (includeConversations && page === 1 && !searchQuery.trim()) {
      const SmsController = require('../../Controller/SmsController').default;
      const conversationsResult = await SmsController.getConversations(1, 100, 'inbox', {
        background: false,
      });
      contacts = mergeWithConversations(localResult.contacts, conversationsResult.conversations || []);
    }

    const pagination = computePaginationMeta(localResult.page, localResult.pageSize, localResult.total);
    logContactPagination('loadContacts', {
      ...pagination,
      returned: sqliteReturned,
      displayed: contacts.length,
      merged: contacts.length !== sqliteReturned,
    });

    const shouldSync =
      backgroundSync &&
      (forceSync || localResult.total === 0 || Date.now() - (localResult.lastSync || 0) > SYNC_STALE_MS);

    if (shouldSync) {
      this.syncDeviceContacts(forceSync)
        .then(async () => {
          const freshMeta = await this.getPaginationMeta(page, pageSize, searchQuery);
          logContactPagination('loadContacts(post-sync)', {
            ...freshMeta,
            returned: sqliteReturned,
          });
          onSyncComplete?.(freshMeta);
        })
        .catch(error => console.warn('Background contact sync failed:', error));
    }

    return {
      contacts,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      hasMore: pagination.hasMore,
      fromCache: localResult.total > 0 || localResult.fromCache,
      isEmpty: localResult.total === 0 && contacts.length === 0,
    };
  },

  async preload() {
    const native = getNativeModule();
    if (native?.startContactsObserver && !observerStarted) {
      observerStarted = true;
      native.startContactsObserver().catch(() => {});
    }

    const cached = await queryLocalContacts(1, CONTACT_PAGE_SIZE, '');
    if (cached.total > 0) {
      updateLookupMapFromContacts(cached.contacts);
      this.syncDeviceContacts(false).catch(() => {});
      return cached.contacts;
    }

    await this.syncDeviceContacts(true);
    const fresh = await queryLocalContacts(1, CONTACT_PAGE_SIZE, '');
    updateLookupMapFromContacts(fresh.contacts);
    return fresh.contacts;
  },

  subscribe(onChange) {
    const native = getNativeModule();
    if (!native || !onChange) {
      return () => {};
    }

    if (native.startContactsObserver && !observerStarted) {
      observerStarted = true;
      native.startContactsObserver().catch(() => {});
    }

    const emitter = new NativeEventEmitter(native);
    contactsChangedSubscription = emitter.addListener('onContactsChanged', () => {
      this.syncDeviceContacts(true)
        .then(() => onChange())
        .catch(() => onChange());
    });

    return () => {
      contactsChangedSubscription?.remove();
      contactsChangedSubscription = null;
    };
  },

  async getLookupMap() {
    const cached = getCachedContactMap();
    if (cached) {
      return cached;
    }

    const persisted = await AsyncStorage.getItem('contact_lookup_cache');
    if (persisted) {
      const map = JSON.parse(persisted);
      setCachedContactMap(map);
      return map;
    }

    const page = await queryLocalContacts(1, 500, '');
    if (page.contacts.length > 0) {
      return updateLookupMapFromContacts(page.contacts);
    }

    const fallback = await fallbackLoadAllContacts(false);
    return updateLookupMapFromContacts(fallback);
  },

  prefetchImages(contacts = []) {
    contacts
      .filter(c => c.photoUri)
      .slice(0, 10)
      .forEach(c => {
        try {
          const Image = require('react-native').Image;
          Image.prefetch(c.photoUri).catch(() => {});
        } catch {
          // ignore prefetch failures
        }
      });
  },
};

export default ContactStore;
export { computePaginationMeta };
