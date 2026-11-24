// Writes review.md: sample situations + the model's Kannada output, for a Kannada speaker to mark.
// Run: npm run review   (needs Ollama; no database needed)
import fs from 'node:fs';
import { SYSTEM, buildPrompt, PROMPT_VERSION } from './prompts.js';

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const base = { name: 'ಬಸವರಾಜ', age: 68, income: 18000, village: 'ಹೆಬ್ಬಾಳ', field_notes: '' };
const CASES = [
  ['Step 1: everything fine', { ...base, stage: 1 }, []],
  ['Step 1: passbook missing', { ...base, stage: 1 }, ['d_b']],
  ['Step 1: photo and income certificate missing', { ...base, stage: 1 }, ['d_p', 'd_i']],
  ['Step 1: age and income rule failed', { ...base, stage: 1, age: 63, income: 45000 }, ['age', 'income']],
  ['Step 2: field visit questions', { ...base, stage: 2 }, []],
  ['Step 3: notes confirm', { ...base, stage: 3, field_notes: 'ಮನೆಯಲ್ಲೇ ಇದ್ದಾರೆ, ವಯಸ್ಸು ಹೊಂದುತ್ತದೆ, ಬೇರೆ ಪಿಂಚಣಿ ಇಲ್ಲ' }, []],
  ['Step 3: notes empty', { ...base, stage: 3 }, []],
  ['Step 3: notes contradict', { ...base, stage: 3, field_notes: 'ಮಗ ಕೆಲಸ ಮಾಡುತ್ತಾನೆ, ಈಗಾಗಲೇ ಪಿಂಚಣಿ ಬರುತ್ತಿದೆ' }, []],
];

let md = `# Kannada review sheet\nModel: ${MODEL} · prompt ${PROMPT_VERSION}\n\nMark each output: **OK** / **Wrong meaning** / **Awkward wording**, and write the corrected Kannada.\n\n`;
for (const [title, a, failed] of CASES) {
  let out;
  try {
    const r = await fetch(`${OLLAMA}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180000),
      body: JSON.stringify({ model: MODEL, stream: false, options: { num_predict: 160, num_ctx: 1024 },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(a, failed) }] }) });
    out = (await r.json()).message.content.trim();
  } catch (e) { out = `ERROR: ${e.message}`; }
  md += `## ${title}\n\n\`\`\`\n${out}\n\`\`\`\n\nRating: \nCorrection: \n\n`;
  console.log('done:', title);
}
fs.writeFileSync('review.md', md);
console.log('Wrote review.md');
