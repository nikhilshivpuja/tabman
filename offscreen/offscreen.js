import { autoSyncArchives } from '../lib/sync.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'runAutoSync') {
    autoSyncArchives()
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ synced: false, error: err.message }));
    return true;
  }
});
