export const DB_NAME = 'tabman';
export const DB_VERSION = 1;
export const ARCHIVES_STORE = 'archives';

export const DEFAULT_SETTINGS = {
  idleDays: 2,
  aiEnabled: false,
  aiProvider: 'openai',
  apiKey: '',
  aiModel: '',
};

export function isArchivableUrl(url) {
  if (!url) return false;
  const blocked = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'devtools://',
    'view-source:',
  ];
  return !blocked.some((prefix) => url.startsWith(prefix));
}

export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function uuid() {
  return crypto.randomUUID();
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'unknown';
  const ms = Date.now() - Number(timestamp);
  if (ms < 0) return 'just now';

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function formatRelativeFuture(timestamp) {
  if (!timestamp) return 'unknown';
  const ms = Number(timestamp) - Date.now();
  if (ms <= 0) return 'any moment now';

  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `in ${seconds}s`;

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours}h`;

  const days = Math.ceil(hours / 24);
  if (days === 1) return 'in 1 day';
  return `in ${days} days`;
}

export function groupByWindowAndTabGroup(items) {
  const byWindow = new Map();

  for (const item of items) {
    const windowKey = item.windowId != null ? String(item.windowId) : 'unknown';
    if (!byWindow.has(windowKey)) {
      byWindow.set(windowKey, {
        windowId: item.windowId ?? null,
        groups: new Map(),
      });
    }

    const windowEntry = byWindow.get(windowKey);
    const groupKey =
      item.groupId != null && item.groupId !== -1 ? String(item.groupId) : 'ungrouped';

    if (!windowEntry.groups.has(groupKey)) {
      windowEntry.groups.set(groupKey, {
        groupId: groupKey === 'ungrouped' ? null : item.groupId,
        groupTitle: item.groupTitle || null,
        groupColor: item.groupColor || null,
        items: [],
      });
    }

    windowEntry.groups.get(groupKey).items.push(item);
  }

  const sortByArchived = (a, b) => new Date(b.archivedAt) - new Date(a.archivedAt);
  const windows = [...byWindow.values()];

  for (const windowEntry of windows) {
    for (const group of windowEntry.groups.values()) {
      group.items.sort(sortByArchived);
    }
    windowEntry.groups = [...windowEntry.groups.values()].sort((a, b) => {
      const aTime = a.items[0]?.archivedAt ?? 0;
      const bTime = b.items[0]?.archivedAt ?? 0;
      return new Date(bTime) - new Date(aTime);
    });
    windowEntry.latestArchivedAt = windowEntry.groups[0]?.items[0]?.archivedAt ?? 0;
  }

  windows.sort(
    (a, b) => new Date(b.latestArchivedAt) - new Date(a.latestArchivedAt)
  );

  return windows;
}

export function idleMs(idleDays) {
  return idleDays * 24 * 60 * 60 * 1000;
}
