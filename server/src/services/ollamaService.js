// Everything that talks to Ollama.
import { config } from '../config/index.js';

const post = (path, body, ms) => fetch(`${config.ollamaUrl}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  ...(ms && { signal: AbortSignal.timeout(ms) }),
});

// Streaming chat: the caller reads tokens as they are produced.
export async function chatStream(messages) {
  const r = await post('/api/chat', { model: config.model, stream: true, keep_alive: '30m', options: { num_predict: 160, num_ctx: 1024 }, messages }, 120000);
  if (!r.ok) throw new Error(`ollama ${r.status}: ${await r.text()}`);
  return r;
}

// Vision: read name and birth year from a document photo. Returns null if unreadable or Ollama is down.
export async function readDocument(dataUrl) {
  try {
    const r = await post('/api/chat', { model: config.visionModel, stream: false, format: 'json', keep_alive: '30m', options: { num_predict: 100 },
      messages: [{ role: 'user', images: [dataUrl.split(',')[1]],
        content: 'Read this Indian ID, certificate or bank document. Reply JSON only: {"name": string or null, "birth_year": number or null}. Use null for anything not clearly visible. Never guess.' }] }, 120000);
    if (!r.ok) throw new Error(`ollama ${r.status}`);
    return JSON.parse((await r.json()).message.content);
  } catch (e) { console.error('Vision error:', e.message); return null; }
}

// Load the model into memory at start-up, so the first AI click is not slow.
export const warmUp = () => post('/api/generate', { model: config.model, keep_alive: '30m' }).catch(() => {});
