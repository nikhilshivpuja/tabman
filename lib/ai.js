const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  azure: 'gpt-4o-mini',
};

export function getDefaultModel(provider) {
  return DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;
}

export async function validateApiKey(provider, apiKey, model) {
  if (!apiKey?.trim()) {
    return { valid: false, error: 'API key is required' };
  }

  try {
    const summary = await summarizeText(provider, apiKey, model, 'Reply with exactly: OK');
    if (summary) {
      return { valid: true };
    }
    return { valid: false, error: 'Empty response from API' };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export async function summarizeText(provider, apiKey, model, text) {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  const content = trimmed.slice(0, 12000);
  const resolvedModel = model || getDefaultModel(provider);

  switch (provider) {
    case 'openai':
      return callOpenAI(apiKey, resolvedModel, content);
    case 'gemini':
      return callGemini(apiKey, resolvedModel, content);
    case 'azure':
      return callAzure(apiKey, resolvedModel, content);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOpenAI(apiKey, model, text) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following web page content in 2-3 concise sentences. Focus on the main topic and key points.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(apiKey, model, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Summarize the following web page content in 2-3 concise sentences. Focus on the main topic and key points.\n\n${text}`,
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 200 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini error ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function callAzure(apiKey, model, text) {
  const stored = await chrome.storage.local.get(['azureEndpoint', 'azureDeployment']);
  const endpoint = stored.azureEndpoint?.replace(/\/$/, '');
  const deployment = stored.azureDeployment || model;

  if (!endpoint) {
    throw new Error('Azure endpoint is required (set in settings)');
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following web page content in 2-3 concise sentences. Focus on the main topic and key points.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Azure error ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}
