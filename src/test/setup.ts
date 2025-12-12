import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

// Mock IndexedDB for testing
const store: { [key: string]: any } = {};

const MockDexie = {
  stores: () => MockDexie,
  version: () => MockDexie,
  transaction: () => Promise.resolve(),
  delete: () => Promise.resolve(),
  get: (key: string) => Promise.resolve(store[key]),
  put: (value: any, key: string) => {
    store[key] = value;
    return Promise.resolve(key);
  },
  toArray: () => Promise.resolve(Object.values(store)),
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
    return Promise.resolve();
  },
};

// Mock crypto.randomUUID if not available
if (!global.crypto?.randomUUID) {
  global.crypto = {
    ...global.crypto,
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      }) as `${string}-${string}-${string}-${string}-${string}`
    }
  };
}

// Before each test, clear the mock store
beforeEach(() => {
  for (const key in store) {
    delete store[key];
  }
});