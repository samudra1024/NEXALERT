import { create } from 'zustand';
import AuthService from '../services/authService';
import ContactStore from '../services/ContactStore';
import { lookupContactName } from '../utils/contactUtils';

const useAppStore = create((set, get) => ({
  isAuthenticated: false,
  isBootstrapping: true,
  userPhone: null,
  userDisplayName: null,
  contactsCache: {},
  contactsCacheTimestamp: 0,
  contactsSyncing: false,

  bootstrap: async () => {
    try {
      const token = await AuthService.getAccessToken();
      const phone = await AuthService.getUserPhone();
      set({
        isAuthenticated: !!token,
        userPhone: phone,
        isBootstrapping: false,
      });
      ContactStore.getLookupMap()
        .then(map => {
          if (map && Object.keys(map).length > 0) {
            set({ contactsCache: map, contactsCacheTimestamp: Date.now() });
          }
        })
        .catch(() => {});
      return !!token;
    } catch {
      set({ isAuthenticated: false, isBootstrapping: false });
      return false;
    }
  },

  login: async (phoneNumber, code) => {
    const result = await AuthService.verifyOtp(phoneNumber, code);
    set({ isAuthenticated: true, userPhone: phoneNumber });
    return result;
  },

  logout: async () => {
    await AuthService.clearSession();
    set({ isAuthenticated: false, userPhone: null, userDisplayName: null });
  },

  setUserDisplayName: name => set({ userDisplayName: name }),

  setContactsCache: (cache) => {
    set({ contactsCache: cache, contactsCacheTimestamp: Date.now() });
  },

  refreshContactsCache: async (force = false) => {
    set({ contactsSyncing: true });
    try {
      await ContactStore.syncDeviceContacts(force);
      const map = await ContactStore.getLookupMap();
      set({ contactsCache: map, contactsCacheTimestamp: Date.now(), contactsSyncing: false });
      return map;
    } catch (error) {
      set({ contactsSyncing: false });
      throw error;
    }
  },

  getContactName: (phoneNumber) => {
    const { contactsCache } = get();
    return lookupContactName(phoneNumber, contactsCache);
  },
}));

export default useAppStore;
