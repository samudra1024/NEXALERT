jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => null),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: { SmsModule: {} },
  NativeEventEmitter: jest.fn(() => ({ addListener: jest.fn(() => ({ remove: jest.fn() })) })),
  InteractionManager: { runAfterInteractions: task => Promise.resolve(task()) },
}));

import { computePaginationMeta, CONTACT_PAGE_SIZE } from '../src/services/ContactStore';

describe('contact pagination', () => {
  test('page 1 uses offset 0', () => {
    const meta = computePaginationMeta(1, CONTACT_PAGE_SIZE, 100);
    expect(meta.offset).toBe(0);
    expect(meta.hasMore).toBe(true);
  });

  test('page 2 uses offset 30', () => {
    const meta = computePaginationMeta(2, CONTACT_PAGE_SIZE, 100);
    expect(meta.offset).toBe(30);
    expect(meta.hasMore).toBe(true);
  });

  test('page 3 uses offset 60', () => {
    const meta = computePaginationMeta(3, CONTACT_PAGE_SIZE, 100);
    expect(meta.offset).toBe(60);
    expect(meta.hasMore).toBe(true);
  });

  test('page 4 stops at 100 total contacts', () => {
    const meta = computePaginationMeta(4, CONTACT_PAGE_SIZE, 100);
    expect(meta.offset).toBe(90);
    expect(meta.hasMore).toBe(false);
  });

  test('21 total contacts stops after page 1', () => {
    const meta = computePaginationMeta(1, CONTACT_PAGE_SIZE, 21);
    expect(meta.hasMore).toBe(false);
  });

  test('31 total contacts requires page 2', () => {
    expect(computePaginationMeta(1, CONTACT_PAGE_SIZE, 31).hasMore).toBe(true);
    expect(computePaginationMeta(2, CONTACT_PAGE_SIZE, 31).hasMore).toBe(false);
  });

  test('exactly 30 contacts fits in one page', () => {
    expect(computePaginationMeta(1, CONTACT_PAGE_SIZE, 30).hasMore).toBe(false);
  });

  test('hasMore uses total rather than returned page size', () => {
    const partialFirstPage = computePaginationMeta(1, CONTACT_PAGE_SIZE, 100);
    expect(partialFirstPage.hasMore).toBe(true);
  });
});
