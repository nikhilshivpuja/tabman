import { DEFAULT_SETTINGS } from './constants.js';
import {
  getSyncDirectoryHandle,
  saveSyncDirectoryHandle,
} from './sync-handle.js';
import { autoSyncArchives } from './sync.js';

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
    version: 2,
    exportedAt: new Date().toISOString(),
    archives,
    deletedIds: [],
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

export async function pickSyncDirectory() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveSyncDirectoryHandle(handle);
  return autoSyncArchives();
}

export { getSyncDirectoryHandle, autoSyncArchives };
