const CONTACT_CACHE_TTL_MS = 10 * 60 * 1000;

let contactCache = {};
let cacheTimestamp = 0;

export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function formatPhoneNumber(phone) {
  if (!phone) return '';
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length === 10) {
    return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
  }
  return phone;
}

export function resolveDisplayName(contact, fallbackPhone) {
  if (!contact) {
    return formatPhoneNumber(fallbackPhone) || fallbackPhone || 'Unknown';
  }

  const displayName =
    contact.displayName ||
    contact.name ||
    `${contact.givenName || ''} ${contact.familyName || ''}`.trim();

  if (displayName) return displayName;
  return formatPhoneNumber(contact.phoneNumber || contact.phone || contact.id || fallbackPhone);
}

export function buildContactLookupMap(contacts) {
  const map = {};
  (contacts || []).forEach(contact => {
    const phone = contact.id || contact.phone || contact.phoneNumber;
    const name = resolveDisplayName(contact, phone);
    if (!phone) return;

    map[phone] = name;
    const normalized = normalizePhoneNumber(phone);
    if (normalized) {
      map[normalized] = name;
      map[`+91${normalized}`] = name;
      map[`91${normalized}`] = name;
    }
  });
  return map;
}

export function isCacheValid() {
  return cacheTimestamp > 0 && Date.now() - cacheTimestamp < CONTACT_CACHE_TTL_MS;
}

export function getCachedContactMap() {
  return isCacheValid() ? contactCache : null;
}

export function setCachedContactMap(map) {
  contactCache = map || {};
  cacheTimestamp = Date.now();
}

export function lookupContactName(phoneNumber, contactMap) {
  if (!phoneNumber || !contactMap) return null;
  return (
    contactMap[phoneNumber] ||
    contactMap[normalizePhoneNumber(phoneNumber)] ||
    contactMap[`+91${normalizePhoneNumber(phoneNumber)}`] ||
    null
  );
}

export function phonesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;

  const normA = normalizePhoneNumber(a);
  const normB = normalizePhoneNumber(b);
  if (normA && normB && normA === normB) {
    return true;
  }

  return false;
}

export function applyContactNamesToConversations(conversations, contactMap) {
  return conversations.map(conv => {
    const savedName = lookupContactName(conv.id, contactMap);
    if (savedName) {
      return {
        ...conv,
        name: savedName,
        avatar: savedName.charAt(0).toUpperCase(),
      };
    }
    return {
      ...conv,
      name: conv.name && !/^\d+$/.test(conv.name.replace(/\D/g, ''))
        ? conv.name
        : formatPhoneNumber(conv.id),
    };
  });
}
