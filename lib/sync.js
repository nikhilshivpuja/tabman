import { getAllArchives, replaceAllArchives } from './db.js';

export const SYNC_FILENAME = 'tabman-archive.json';

export function archiveKey(record) {
  return `${record.url}|${record.openedAt}`;
}

export function mergeArchiveLists(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const record of list || []) {
      if (record?.id) byId.set(record.id, record);
    }
  }
  return [...byId.values()];
}

export async function getDeletedArchiveIds() {
  const stored = await chrome.storage.local.get(['syncDeletedIds']);
  return new Set(stored.syncDeletedIds || []);
}

export async function recordArchiveDeletion(record) {
  if (!record?.id) return;
  const deleted = await getDeletedArchiveIds();
  deleted.add(record.id);
  await chrome.storage.local.set({ syncDeletedIds: [...deleted] });
}

function applyDeletedFilter(archives, deletedIds) {
  return archives.filter((r) => !deletedIds.has(r.id));
}

export async function readSyncPayload(dirHandle) {
  try {
    const fileHandle = await dirHandle.getFileHandle(SYNC_FILENAME);
    const file = await fileHandle.getFile();
    const data = JSON.parse(await file.text());
    return {
      archives: data.archives || [],
      deletedIds: data.deletedIds || [],
    };
  } catch {
    return { archives: [], deletedIds: [] };
  }
}

export async function writeSyncPayload(dirHandle, archives, deletedIds) {
  const fileHandle = await dirHandle.getFileHandle(SYNC_FILENAME, { create: true });
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    archives,
    deletedIds: [...deletedIds],
  };
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

export async function ensureDirPermission(dirHandle) {
  const current = await dirHandle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return true;
  const requested = await dirHandle.requestPermission({ mode: 'readwrite' });
  return requested === 'granted';
}

export async function autoSyncArchives() {
  const { getSyncDirectoryHandle } = await import('./sync-handle.js');
  const handle = await getSyncDirectoryHandle();
  if (!handle) return { synced: false, reason: 'no-folder' };

  if (!(await ensureDirPermission(handle))) {
    return { synced: false, reason: 'no-permission' };
  }

  const local = await getAllArchives();
  const localDeleted = await getDeletedArchiveIds();
  const remote = await readSyncPayload(handle);

  const mergedDeleted = new Set([...localDeleted, ...remote.deletedIds]);
  if (mergedDeleted.size > 0) {
    await chrome.storage.local.set({ syncDeletedIds: [...mergedDeleted] });
  }

  const merged = applyDeletedFilter(
    mergeArchiveLists(remote.archives, local),
    mergedDeleted
  );

  await writeSyncPayload(handle, merged, mergedDeleted);
  await replaceAllArchives(merged);

  return {
    synced: true,
    count: merged.length,
    addedFromRemote: merged.length - local.length,
  };
}
