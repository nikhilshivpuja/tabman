const OFFSCREEN_URL = 'offscreen/offscreen.html';

export async function requestAutoSync() {
  if (!(await hasSyncFolderConfigured())) {
    return { synced: false, reason: 'no-folder' };
  }

  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ action: 'runAutoSync' });
}

async function hasSyncFolderConfigured() {
  const { getSyncDirectoryHandle } = await import('./sync-handle.js');
  return !!(await getSyncDirectoryHandle());
}

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (existing.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['DOM_PARSER'],
    justification: 'Automatically sync merged archives to the linked folder',
  });
}
