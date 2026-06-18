import { DEFAULT_SETTINGS } from './constants.js';

export async function getSettings() {
  const stored = await chrome.storage.local.get(['settings']);
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function getTabRegistry() {
  const stored = await chrome.storage.local.get(['tabRegistry']);
  return stored.tabRegistry || {};
}

export async function saveTabRegistry(registry) {
  await chrome.storage.local.set({ tabRegistry: registry });
}

export async function exportArchivesToFile(archives) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    archives,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });

  if ('showSaveFilePicker' in window) {
    const handle = await window.showSaveFilePicker({
      suggestedName: `tabman-archive-${Date.now()}.json`,
      types: [
        {
          description: 'Tabman Archive',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { method: 'picker' };
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tabman-archive-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { method: 'download' };
}

export async function importArchivesFromFile() {
  let file;
  if ('showOpenFilePicker' in window) {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Tabman Archive',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    file = await handle.getFile();
  } else {
    file = await pickFileViaInput();
  }

  const text = await file.text();
  const data = JSON.parse(text);
  const archives = data.archives || data;
  if (!Array.isArray(archives)) {
    throw new Error('Invalid archive file format');
  }
  return archives;
}

function pickFileViaInput() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) resolve(file);
      else reject(new Error('No file selected'));
    };
    input.click();
  });
}

const SYNC_HANDLE_KEY = 'syncDirHandle';

export async function getSyncDirectoryHandle() {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const request = tx.objectStore('handles').get(SYNC_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSyncDirectoryHandle(handle) {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    const request = tx.objectStore('handles').put(handle, SYNC_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function pickSyncDirectory() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveSyncDirectoryHandle(handle);
  return handle;
}

export async function syncArchivesToDirectory(archives) {
  const handle = await getSyncDirectoryHandle();
  if (!handle) return false;

  const permission = await handle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') return false;

  const fileHandle = await handle.getFileHandle('tabman-archive.json', {
    create: true,
  });
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    archives,
  };
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
  return true;
}

export async function loadArchivesFromSyncDirectory() {
  const handle = await getSyncDirectoryHandle();
  if (!handle) return null;

  const permission = await handle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') return null;

  try {
    const fileHandle = await handle.getFileHandle('tabman-archive.json');
    const file = await fileHandle.getFile();
    const data = JSON.parse(await file.text());
    return data.archives || null;
  } catch {
    return null;
  }
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tabman-handles', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
  });
}
