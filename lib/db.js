import { DB_NAME, DB_VERSION, ARCHIVES_STORE } from './constants.js';

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(ARCHIVES_STORE)) {
          const store = db.createObjectStore(ARCHIVES_STORE, { keyPath: 'id' });
          store.createIndex('archivedAt', 'archivedAt', { unique: false });
          store.createIndex('openedAt', 'openedAt', { unique: false });
          store.createIndex('domain', 'domain', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function getAllArchives() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVES_STORE, 'readonly');
    const request = tx.objectStore(ARCHIVES_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function addArchive(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVES_STORE, 'readwrite');
    const request = tx.objectStore(ARCHIVES_STORE).put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteArchive(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVES_STORE, 'readwrite');
    const request = tx.objectStore(ARCHIVES_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function replaceAllArchives(records) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVES_STORE, 'readwrite');
    const store = tx.objectStore(ARCHIVES_STORE);
    store.clear();
    for (const record of records) {
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function mergeArchives(incoming) {
  const { mergeArchiveLists } = await import('./sync.js');
  const existing = await getAllArchives();
  const merged = mergeArchiveLists(existing, incoming);
  await replaceAllArchives(merged);
  return merged;
}
