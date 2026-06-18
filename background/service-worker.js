import {
  isArchivableUrl,
  getDomain,
  uuid,
  idleMs,
  DEFAULT_SETTINGS,
} from '../lib/constants.js';
import { addArchive } from '../lib/db.js';
import { summarizeText } from '../lib/ai.js';
import { getTabGroupInfo } from '../lib/tab-context.js';

const ALARM_NAME = 'tabman-archive-check';
const ARCHIVE_CHECK_MINUTES = 30;
let lastActiveTabId = null;

bootstrap();

chrome.runtime.onInstalled.addListener(() => {
  startupTasks();
});

chrome.runtime.onStartup.addListener(() => {
  startupTasks();
});

async function bootstrap() {
  setupAlarm();
  await initTabRegistry();
  try {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (active?.id) lastActiveTabId = active.id;
  } catch {
    // ignore
  }
}

async function touchTabAccessed(tabId, at = Date.now()) {
  const registry = await getTabRegistry();
  if (!registry[tabId]) return;
  registry[tabId].lastAccessedAt = at;
  await saveTabRegistry(registry);
}

function setupAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ARCHIVE_CHECK_MINUTES });
}

async function startupTasks() {
  await bootstrap();
  try {
    await archiveIdleTabs();
  } catch (err) {
    console.error('Tabman startup archive check failed:', err);
  }
}

async function getSettings() {
  const stored = await chrome.storage.local.get(['settings']);
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

async function getTabRegistry() {
  const stored = await chrome.storage.local.get(['tabRegistry']);
  return stored.tabRegistry || {};
}

async function saveTabRegistry(registry) {
  await chrome.storage.local.set({ tabRegistry: registry });
}

async function initTabRegistry() {
  const registry = await getTabRegistry();
  const tabs = await chrome.tabs.query({});
  let changed = false;

  // Only sync metadata for tabs we're already tracking; never bulk-stamp timestamps
  for (const tab of tabs) {
    if (!tab.id || !isArchivableUrl(tab.url)) continue;
    if (registry[tab.id]) {
      registry[tab.id].url = tab.url;
      registry[tab.id].title = tab.title || registry[tab.id].title;
      changed = true;
    }
  }

  const openIds = new Set(tabs.map((t) => t.id));
  for (const id of Object.keys(registry)) {
    if (!openIds.has(Number(id))) {
      delete registry[id];
      changed = true;
    }
  }

  if (changed) await saveTabRegistry(registry);
}

function getTabIdleMs(entry, now = Date.now()) {
  if (entry.lastAccessedAt != null) {
    return now - entry.lastAccessedAt;
  }
  return now - (entry.openedAt ?? now);
}

async function ensureTabEntry(tabId, tab) {
  const registry = await getTabRegistry();
  const now = Date.now();
  if (!registry[tabId]) {
    registry[tabId] = {
      url: tab.url,
      title: tab.title || '',
      openedAt: now,
      // null until the user actually switches to this tab
      lastAccessedAt: null,
      snippet: '',
    };
    await saveTabRegistry(registry);
  }
  return registry[tabId];
}

async function captureSnippet(tabId) {
  try {
    const results = await chrome.tabs.sendMessage(tabId, { action: 'extractSnippet' });
    if (results?.snippet) {
      const registry = await getTabRegistry();
      if (registry[tabId]) {
        registry[tabId].snippet = results.snippet;
        await saveTabRegistry(registry);
      }
    }
  } catch {
    // Content script may not be available on restricted pages
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (lastActiveTabId && lastActiveTabId !== activeInfo.tabId) {
    await captureSnippet(lastActiveTabId);
  }

  const now = Date.now();
  const registry = await getTabRegistry();

  if (registry[activeInfo.tabId]) {
    await touchTabAccessed(activeInfo.tabId, now);
  } else {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (isArchivableUrl(tab.url)) {
        await ensureTabEntry(activeInfo.tabId, tab);
        await touchTabAccessed(activeInfo.tabId, now);
      }
    } catch {
      // Tab may have closed
    }
  }

  lastActiveTabId = activeInfo.tabId;
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.id || !isArchivableUrl(tab.url)) return;
  await ensureTabEntry(tab.id, tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!isArchivableUrl(tab.url)) return;

  const registry = await getTabRegistry();
  if (!registry[tabId]) {
    // Only register after load; don't treat background page loads as user activity
    if (changeInfo.status === 'complete') {
      await ensureTabEntry(tabId, tab);
    }
    return;
  }

  registry[tabId].url = tab.url;
  if (changeInfo.title || tab.title) {
    registry[tabId].title = tab.title || registry[tabId].title;
  }
  await saveTabRegistry(registry);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const registry = await getTabRegistry();
  if (registry[tabId]) {
    delete registry[tabId];
    await saveTabRegistry(registry);
  }
  if (lastActiveTabId === tabId) {
    lastActiveTabId = null;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    archiveIdleTabs();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'archiveNow') {
    archiveIdleTabs({ force: message.force })
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'getTrackedTabs') {
    getTrackedTabsPreview()
      .then((tabs) => sendResponse({ tabs }))
      .catch((err) => sendResponse({ tabs: [], error: err.message }));
    return true;
  }

  if (message.action === 'resetTracking') {
    chrome.storage.local
      .set({ tabRegistry: {} })
      .then(() => {
        lastActiveTabId = null;
        sendResponse({ success: true });
      })
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'syncToFile') {
    sendResponse({ success: true, note: 'Sync handled by archive page' });
    return true;
  }
});

async function getTrackedTabsPreview() {
  const settings = await getSettings();
  const registry = await getTabRegistry();
  const threshold = idleMs(settings.idleDays);
  const now = Date.now();
  const tabs = [];

  const openTabs = await chrome.tabs.query({});
  for (const tab of openTabs) {
    if (!tab.id || !isArchivableUrl(tab.url)) continue;

    const entry = registry[tab.id];
    const idle = entry ? getTabIdleMs(entry, now) : 0;
    const groupInfo = await getTabGroupInfo(tab);

    tabs.push({
      tabId: tab.id,
      title: tab.title || entry?.title || 'Untitled',
      url: tab.url || entry?.url,
      windowId: tab.windowId ?? null,
      groupId: groupInfo?.groupId ?? null,
      groupTitle: groupInfo?.title ?? null,
      groupColor: groupInfo?.color ?? null,
      lastAccessedAt: entry?.lastAccessedAt ?? null,
      trackedSince: entry?.openedAt ?? null,
      neverActivated: !!entry && entry.lastAccessedAt == null,
      tracked: !!entry,
      idleDays: (idle / (24 * 60 * 60 * 1000)).toFixed(1),
      eligible: !!entry && idle >= threshold,
    });
  }

  return tabs.sort((a, b) => {
    const winA = a.windowId ?? 0;
    const winB = b.windowId ?? 0;
    if (winA !== winB) return winA - winB;

    const grpA = a.groupId ?? -1;
    const grpB = b.groupId ?? -1;
    if (grpA !== grpB) return grpA - grpB;

    const aSort = a.lastAccessedAt ?? a.trackedSince ?? Number.MAX_SAFE_INTEGER;
    const bSort = b.lastAccessedAt ?? b.trackedSince ?? Number.MAX_SAFE_INTEGER;
    return aSort - bSort;
  });
}

async function archiveIdleTabs({ force = false } = {}) {
  const settings = await getSettings();
  const registry = await getTabRegistry();
  const threshold = force ? 0 : idleMs(settings.idleDays);
  const now = Date.now();

  const results = { archived: [], skipped: [], errors: [] };

  for (const [tabIdStr, entry] of Object.entries(registry)) {
    const tabId = Number(tabIdStr);
    const idle = getTabIdleMs(entry, now);

    if (idle < threshold) {
      results.skipped.push({ tabId, title: entry.title, reason: 'not idle enough' });
      continue;
    }

    try {
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab || !isArchivableUrl(tab.url)) {
        results.skipped.push({ tabId, title: entry.title, reason: 'tab gone or restricted' });
        delete registry[tabId];
        continue;
      }

      let snippet = entry.snippet || '';
      if (!snippet) {
        await captureSnippet(tabId);
        const updated = await getTabRegistry();
        snippet = updated[tabId]?.snippet || '';
      }

      let summary = null;
      let summarySource = 'snippet';

      if (settings.aiEnabled && settings.apiKey?.trim()) {
        try {
          const textForAi = snippet || tab.title || tab.url;
          summary = await summarizeText(
            settings.aiProvider,
            settings.apiKey,
            settings.aiModel,
            textForAi
          );
          if (summary) summarySource = settings.aiProvider;
        } catch (err) {
          results.errors.push({ tabId, title: entry.title, error: `AI: ${err.message}` });
        }
      }

      const groupInfo = await getTabGroupInfo(tab);

      const record = {
        id: uuid(),
        title: tab.title || entry.title || 'Untitled',
        url: tab.url || entry.url,
        domain: getDomain(tab.url || entry.url),
        windowId: tab.windowId ?? null,
        groupId: groupInfo?.groupId ?? null,
        groupTitle: groupInfo?.title ?? null,
        groupColor: groupInfo?.color ?? null,
        openedAt: new Date(entry.openedAt).toISOString(),
        archivedAt: new Date().toISOString(),
        lastAccessedAt: new Date(entry.lastAccessedAt ?? entry.openedAt).toISOString(),
        snippet,
        summary,
        summarySource,
      };

      await addArchive(record);
      delete registry[tabId];
      await chrome.tabs.remove(tabId);

      results.archived.push({ tabId, title: record.title, id: record.id });
    } catch (err) {
      results.errors.push({ tabId, title: entry.title, error: err.message });
    }
  }

  await saveTabRegistry(registry);
  return results;
}
