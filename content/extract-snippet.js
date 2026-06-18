function extractTextLines() {
  const selectors = ['article', 'main', '[role="main"]', '.post-content', '.article-body'];
  let root = null;

  for (const sel of selectors) {
    root = document.querySelector(sel);
    if (root) break;
  }
  if (!root) root = document.body;

  const clone = root.cloneNode(true);
  clone.querySelectorAll('script, style, nav, header, footer, aside, noscript').forEach((el) => el.remove());

  const text = clone.innerText || clone.textContent || '';
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);

  return lines.slice(0, 3).join('\n');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'extractSnippet') {
    try {
      const snippet = extractTextLines();
      sendResponse({ snippet });
    } catch (err) {
      sendResponse({ snippet: '', error: err.message });
    }
    return true;
  }
});
