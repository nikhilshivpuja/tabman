import { getAllArchives, deleteArchive, mergeArchives } from '../lib/db.js';
import { groupByWindowAndTabGroup, formatDateTime, formatRelativeFuture } from '../lib/constants.js';
import { TAB_GROUP_COLORS } from '../lib/tab-context.js';
import { recordArchiveDeletion } from '../lib/sync.js';
import {
  exportArchivesToFile,
  importArchivesFromFile,
  autoSyncArchives,
} from '../lib/storage.js';

const searchInput = document.getElementById('search');
const domainFilter = document.getElementById('domain-filter');
const archiveList = document.getElementById('archive-list');
const emptyState = document.getElementById('empty-state');
const statsEl = document.getElementById('stats');
const scheduleEl = document.getElementById('schedule-info');

let allArchives = [];
let scheduleTimer = null;

async function init() {
  await autoSyncArchives().catch(() => {});
  allArchives = await getAllArchives();
  populateDomainFilter();
  render();
  bindEvents();
  await updateScheduleInfo();
  scheduleTimer = setInterval(updateScheduleInfo, 60_000);
}

async function updateScheduleInfo() {
  try {
    const schedule = await chrome.runtime.sendMessage({ action: 'getArchiveSchedule' });
    if (schedule?.error || schedule?.nextCheckAt == null) {
      scheduleEl.textContent = 'Next automatic archive check: not scheduled yet.';
      scheduleEl.hidden = false;
      return;
    }

    const relative = formatRelativeFuture(schedule.nextCheckAt);
    const absolute = formatDateTime(schedule.nextCheckAt);
    const idleLabel = schedule.idleDays === 1 ? '1 day' : `${schedule.idleDays} days`;

    scheduleEl.innerHTML =
      `Next automatic archive check: <strong>${relative}</strong> (${absolute}). ` +
      `Repeats every ${schedule.intervalMinutes} minutes. ` +
      `Also runs on browser startup and when settings are saved. ` +
      `Idle threshold: ${idleLabel}. Archives auto-sync to your linked folder when configured.`;
    scheduleEl.hidden = false;
  } catch {
    scheduleEl.textContent = 'Could not load archive schedule.';
    scheduleEl.hidden = false;
  }
}

async function removeArchiveEntry(id) {
  const item = allArchives.find((a) => a.id === id);
  if (item) await recordArchiveDeletion(item);
  await deleteArchive(id);
  await autoSyncArchives().catch(() => {});
  allArchives = await getAllArchives();
  populateDomainFilter();
  render();
}

function populateDomainFilter() {
  const domains = [...new Set(allArchives.map((a) => a.domain).filter(Boolean))].sort();
  domainFilter.innerHTML = '<option value="">All domains</option>';
  for (const domain of domains) {
    const opt = document.createElement('option');
    opt.value = domain;
    opt.textContent = domain;
    domainFilter.appendChild(opt);
  }
}

function getFilteredArchives() {
  const query = searchInput.value.trim().toLowerCase();
  const domain = domainFilter.value;

  return allArchives.filter((a) => {
    if (domain && a.domain !== domain) return false;
    if (!query) return true;
    const haystack = [
      a.title,
      a.url,
      a.snippet,
      a.summary,
      a.domain,
      a.groupTitle,
      a.windowId != null ? String(a.windowId) : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function render() {
  const filtered = getFilteredArchives();
  statsEl.textContent = `${filtered.length} of ${allArchives.length} archived tabs`;
  archiveList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.hidden = allArchives.length > 0;
    return;
  }

  emptyState.hidden = true;
  const windows = groupByWindowAndTabGroup(filtered);

  for (const windowEntry of windows) {
    const windowSection = document.createElement('section');
    windowSection.className = 'window-group';
    windowSection.innerHTML = `<h2 class="window-heading">${escapeHtml(formatWindowLabel(windowEntry.windowId))}</h2>`;

    for (const group of windowEntry.groups) {
      const groupSection = document.createElement('div');
      groupSection.className = 'tab-group-section';
      groupSection.innerHTML = formatGroupHeading(group);

      for (const item of group.items) {
        groupSection.appendChild(renderItem(item));
      }
      windowSection.appendChild(groupSection);
    }

    archiveList.appendChild(windowSection);
  }
}

function formatWindowLabel(windowId) {
  if (windowId == null) return 'Unknown window';
  return `Window ${windowId}`;
}

function formatGroupHeading(group) {
  if (group.groupId == null) {
    return '<h3 class="group-heading ungrouped">Ungrouped</h3>';
  }

  const title = group.groupTitle?.trim() || `Group ${group.groupId}`;
  const color = TAB_GROUP_COLORS[group.groupColor] || TAB_GROUP_COLORS.grey;
  return `<h3 class="group-heading"><span class="group-dot" style="background:${color}"></span>${escapeHtml(title)}</h3>`;
}

function renderItem(item) {
  const card = document.createElement('article');
  card.className = 'card archive-item';

  const preview = item.summary || item.snippet || '';
  const badge =
    item.summarySource && item.summarySource !== 'snippet'
      ? `<span class="badge">${item.summarySource}</span>`
      : '';

  card.innerHTML = `
    <h3><a href="${escapeAttr(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a> ${badge}</h3>
    <div class="archive-meta">${escapeHtml(item.domain)} · Opened ${formatDateTime(item.openedAt)} · Archived ${formatDateTime(item.archivedAt)}</div>
    <div class="archive-preview">${escapeHtml(preview)}</div>
    <div class="archive-actions">
      <button type="button" data-action="open" data-url="${escapeAttr(item.url)}">Open</button>
      <button type="button" class="primary" data-action="open-remove" data-url="${escapeAttr(item.url)}" data-id="${escapeAttr(item.id)}">Open &amp; remove</button>
      <button type="button" data-action="copy" data-url="${escapeAttr(item.url)}">Copy URL</button>
      <button type="button" class="danger" data-action="delete" data-id="${escapeAttr(item.id)}">Delete</button>
    </div>
  `;

  card.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'open') {
      chrome.tabs.create({ url: btn.dataset.url });
    } else if (action === 'open-remove') {
      chrome.tabs.create({ url: btn.dataset.url });
      await removeArchiveEntry(btn.dataset.id);
    } else if (action === 'copy') {
      await navigator.clipboard.writeText(btn.dataset.url);
    } else if (action === 'delete') {
      if (confirm('Delete this archive entry?')) {
        await removeArchiveEntry(btn.dataset.id);
      }
    }
  });

  return card;
}

function bindEvents() {
  searchInput.addEventListener('input', render);
  domainFilter.addEventListener('change', render);

  document.getElementById('export-btn').addEventListener('click', async () => {
    try {
      await exportArchivesToFile(allArchives);
    } catch (err) {
      if (err.name !== 'AbortError') alert(`Export failed: ${err.message}`);
    }
  });

  document.getElementById('import-btn').addEventListener('click', async () => {
    try {
      const imported = await importArchivesFromFile();
      allArchives = await mergeArchives(imported);
      await autoSyncArchives().catch(() => {});
      allArchives = await getAllArchives();
      populateDomainFilter();
      render();
      alert(`Imported. ${allArchives.length} total archives.`);
    } catch (err) {
      if (err.name !== 'AbortError') alert(`Import failed: ${err.message}`);
    }
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

init();
