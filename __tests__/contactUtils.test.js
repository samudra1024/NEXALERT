import {
  normalizePhoneNumber,
  formatPhoneNumber,
  resolveDisplayName,
  buildContactLookupMap,
  lookupContactName,
} from '../src/utils/contactUtils';

describe('contactUtils', () => {
  test('normalizePhoneNumber extracts last 10 digits', () => {
    expect(normalizePhoneNumber('+919876543210')).toBe('9876543210');
    expect(normalizePhoneNumber('9876543210')).toBe('9876543210');
  });

  test('formatPhoneNumber formats Indian numbers', () => {
    expect(formatPhoneNumber('9876543210')).toBe('+91 98765 43210');
  });

  test('resolveDisplayName prefers displayName', () => {
    expect(resolveDisplayName({ displayName: 'John Doe' }, '9876543210')).toBe('John Doe');
  });

  test('resolveDisplayName falls back to given and family name', () => {
    expect(resolveDisplayName({ givenName: 'John', familyName: 'Doe' }, '9876543210')).toBe('John Doe');
  });

  test('resolveDisplayName falls back to formatted phone', () => {
    expect(resolveDisplayName({}, '9876543210')).toBe('+91 98765 43210');
  });

  test('buildContactLookupMap indexes multiple phone variants', () => {
    const map = buildContactLookupMap([{ id: '9876543210', name: 'Alice' }]);
    expect(map['9876543210']).toBe('Alice');
    expect(map['+919876543210']).toBe('Alice');
  });

  test('lookupContactName finds by normalized number', () => {
    const map = buildContactLookupMap([{ id: '+919876543210', name: 'Bob' }]);
    expect(lookupContactName('9876543210', map)).toBe('Bob');
  });

  test('phonesMatch compares normalized numbers', () => {
    const { phonesMatch } = require('../src/utils/contactUtils');
    expect(phonesMatch('+919876543210', '9876543210')).toBe(true);
    expect(phonesMatch('AD-SENDER', 'AD-SENDER')).toBe(true);
    expect(phonesMatch('+919876543210', 'AD-SENDER')).toBe(false);
  });

  test('normalizePhoneNumber handles short codes', () => {
    expect(normalizePhoneNumber('AD-SENDER')).toBe('');
    expect(normalizePhoneNumber('12345')).toBe('12345');
  });
});
