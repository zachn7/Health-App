import '@testing-library/jest-dom';

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
    randomUUID: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  };
}

// Before each test, clear the mock store
beforeEach(() => {
  for (const key in store) {
    delete store[key];
  }
});