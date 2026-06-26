import { getSettings, saveSettings, pickSyncDirectory } from '../lib/storage.js';
import { validateApiKey, getDefaultModel } from '../lib/ai.js';
import { formatDateTime, formatRelativeTime } from '../lib/constants.js';
import { TAB_GROUP_COLORS } from '../lib/tab-context.js';

const fields = {
  idleDays: document.getElementById('idle-days'),
  aiEnabled: document.getElementById('ai-enabled'),
  aiProvider: document.getElementById('ai-provider'),
  apiKey: document.getElementById('api-key'),
  aiModel: document.getElementById('ai-model'),
  azureEndpoint: document.getElementById('azure-endpoint'),
  azureDeployment: document.getElementById('azure-deployment'),
};

async function loadSettings() {
  const settings = await getSettings();
  fields.idleDays.value = settings.idleDays;
  fields.aiEnabled.checked = settings.aiEnabled;
  fields.aiProvider.value = settings.aiProvider;
  fields.apiKey.value = settings.apiKey || '';
  fields.aiModel.value = settings.aiModel || '';

  const stored = await chrome.storage.local.get(['azureEndpoint', 'azureDeployment']);
  fields.azureEndpoint.value = stored.azureEndpoint || '';
  fields.azureDeployment.value = stored.azureDeployment || '';

  toggleAzureFields();
  refreshTrackedTabs();
}

function toggleAzureFields() {
  document.getElementById('azure-fields').hidden = fields.aiProvider.value !== 'azure';
}

function showStatus(el, message, type = 'info') {
  el.textContent = message;
  el.className = `status ${type}`;
  el.hidden = false;
}

async function collectSettings() {
  const settings = {
    idleDays: Math.max(0, Number(fields.idleDays.value) || 2),
    aiEnabled: fields.aiEnabled.checked,
    aiProvider: fields.aiProvider.value,
    apiKey: fields.apiKey.value.trim(),
    aiModel: fields.aiModel.value.trim() || getDefaultModel(fields.aiProvider.value),
  };

  await chrome.storage.local.set({
    azureEndpoint: fields.azureEndpoint.value.trim(),
    azureDeployment: fields.azureDeployment.value.trim(),
  });

  return settings;
}

function formatLastActive(t) {
  if (t.lastAccessedAt != null) {
    return `${formatRelativeTime(t.lastAccessedAt)} (${formatDateTime(t.lastAccessedAt)})`;
  }
  if (t.trackedSince != null) {
    return `Never switched to — tracking since ${formatRelativeTime(t.trackedSince)}`;
  }
  return 'Not tracked yet — switch to this tab once';
}

function formatIdleStatus(t) {
  if (!t.tracked) return 'Pending';
  if (t.neverActivated) return `${t.idleDays}d since tracking`;
  return t.eligible ? 'Ready' : `${t.idleDays}d idle`;
}

function formatTabContext(t) {
  const windowLabel = t.windowId != null ? `Window ${t.windowId}` : 'Window ?';

  if (t.groupId != null) {
    const title = t.groupTitle?.trim() || `Group ${t.groupId}`;
    const color = TAB_GROUP_COLORS[t.groupColor] || TAB_GROUP_COLORS.grey;
    return `<span class="tab-context">${escapeHtml(windowLabel)} · <span class="group-dot" style="background:${color}"></span>${escapeHtml(title)}</span>`;
  }

  return `<span class="tab-context">${escapeHtml(windowLabel)} · Ungrouped</span>`;
}

async function refreshTrackedTabs() {
  const listEl = document.getElementById('tracked-list');
  listEl.textContent = 'Loading...';

  const response = await chrome.runtime.sendMessage({ action: 'getTrackedTabs' });
  const tabs = response?.tabs || [];

  if (tabs.length === 0) {
    listEl.textContent = 'No tracked tabs.';
    return;
  }

  listEl.innerHTML = tabs
    .map(
      (t) => `
      <div class="tracked-item">
        <div>
          <strong>${escapeHtml(t.title || 'Untitled')}</strong>
          <span class="muted tab-id">#${t.tabId}</span><br>
          <span class="muted">${escapeHtml(t.url)}</span><br>
          ${formatTabContext(t)}<br>
          <span class="muted">Last active: ${formatLastActive(t)}</span>
        </div>
        <div class="${t.eligible ? 'eligible' : 'waiting'}">
          ${formatIdleStatus(t)}
        </div>
      </div>
    `
    )
    .join('');
}

async function runArchive({ force = false } = {}) {
  const statusEl = document.getElementById('archive-status');
  showStatus(statusEl, 'Archiving...', 'info');

  await saveSettings(await collectSettings());

  const response = await chrome.runtime.sendMessage({ action: 'archiveNow', force });

  if (!response?.success) {
    showStatus(statusEl, response?.error || 'Archive failed', 'error');
    return;
  }

  const { archived, skipped, errors } = response;
  let msg = `Archived ${archived.length} tab(s).`;
  if (skipped.length) msg += ` Skipped ${skipped.length}.`;
  if (errors.length) msg += ` ${errors.length} error(s): ${errors.map((e) => e.error).join('; ')}`;

  showStatus(statusEl, msg, errors.length ? 'error' : 'success');
  refreshTrackedTabs();
}

document.getElementById('save-settings').addEventListener('click', async () => {
  const settings = await collectSettings();
  await saveSettings(settings);

  const response = await chrome.runtime.sendMessage({ action: 'archiveNow', force: false });
  let msg = 'Settings saved.';
  if (response?.success && response.archived?.length > 0) {
    msg += ` Archived ${response.archived.length} idle tab(s).`;
    refreshTrackedTabs();
  }

  showStatus(document.getElementById('save-status'), msg, 'success');
});

document.getElementById('archive-now').addEventListener('click', () => runArchive({ force: false }));
document.getElementById('archive-test').addEventListener('click', async () => {
  if (!confirm('Archive and close ALL tracked tabs right now? This cannot be undone.')) return;
  await runArchive({ force: true });
});

document.getElementById('refresh-tracked').addEventListener('click', refreshTrackedTabs);

document.getElementById('reset-tracking').addEventListener('click', async () => {
  if (!confirm('Clear all tab activity tracking? Archives are not deleted. Tabs will be re-tracked as you switch to them.')) return;
  const response = await chrome.runtime.sendMessage({ action: 'resetTracking' });
  if (response?.success) {
    showStatus(document.getElementById('archive-status'), 'Tracking cleared. Switch to tabs you use — only those will get a last-active time.', 'success');
    refreshTrackedTabs();
  }
});

document.getElementById('validate-key').addEventListener('click', async () => {
  const statusEl = document.getElementById('ai-status');
  const settings = await collectSettings();
  await saveSettings(settings);

  if (!settings.apiKey) {
    showStatus(statusEl, 'Enter an API key first.', 'error');
    return;
  }

  showStatus(statusEl, 'Validating...', 'info');
  const result = await validateApiKey(settings.aiProvider, settings.apiKey, settings.aiModel);

  if (result.valid) {
    showStatus(statusEl, 'API key is valid.', 'success');
  } else {
    showStatus(statusEl, result.error, 'error');
  }
});

fields.aiProvider.addEventListener('change', toggleAzureFields);

document.getElementById('pick-folder').addEventListener('click', async () => {
  const statusEl = document.getElementById('sync-status');
  try {
    const result = await pickSyncDirectory();
    showStatus(
      statusEl,
      `Sync folder linked. ${result?.count ?? 0} archive(s) merged and synced automatically.`,
      'success'
    );
  } catch (err) {
    if (err.name !== 'AbortError') showStatus(statusEl, err.message, 'error');
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

loadSettings();
