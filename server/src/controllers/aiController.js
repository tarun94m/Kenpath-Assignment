import { PROMPT_VERSION, SYSTEM, TAG_KN, ALLOWED, buildPrompt } from '../../prompts.js';
import { Application, checks } from '../models/Application.js';
import { AiLog } from '../models/AiLog.js';
import { chatStream } from '../services/ollamaService.js';
import { config } from '../config/index.js';
import { wrap, fail } from '../middleware/errors.js';

// The model's first line is a machine-readable suggestion (APPROVE / RETURN / ...). We strip it, show it in Kannada,
// and store it in ai_log so it can later be compared with what the officer actually decided.
const TAG_RE = /^\W*(CONTINUE|APPROVE|REJECT|RETURN|NONE)\b[^\n]*\n?([\s\S]*)$/i;

export const suggest = wrap(async (req, res) => {
  const a = await Application.findRaw(req.params.id);
  if (!a) throw fail(404, 'not found');
  const failed = checks(a).filter((c) => !c.ok).map((c) => c.k);
  const logId = await AiLog.start({ applicationId: a.id, stage: a.stage, model: config.model, promptVersion: PROMPT_VERSION, userId: req.user.id });

  let wrote = false, full = '', head = '', tagDone = false, tag = null;
  const out = (t) => { if (t) { res.write(t); wrote = true; } };
  const settle = () => { // called once the first line is complete (or the stream ended)
    tagDone = true;
    const m = head.match(TAG_RE);
    const t = m && m[1].toUpperCase();
    if (m && (t === 'NONE' || ALLOWED[a.stage].includes(t))) {
      if (t !== 'NONE') { tag = t; out(`ಸಲಹೆ: ${TAG_KN[t]}\n`); }
      out(m[2]);
    } else out(head); // model ignored the format: show its text, log no suggestion
  };

  try {
    // Stream tokens as they are produced, so the officer reads while the model is still writing.
    const r = await chatStream([{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(a, failed) }]);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-AI-Log', String(logId));
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) {
        const t = l.trim() && JSON.parse(l).message?.content;
        if (!t) continue;
        full += t;
        if (tagDone) out(t);
        else { head += t; if (head.includes('\n') || head.length > 60) settle(); }
      }
    }
    if (!tagDone) settle();
    await AiLog.finish(logId, full, tag);
    res.end();
  } catch (e) {
    console.error('Ollama error:', e.cause?.code || e.message);
    if (wrote) res.end();
    else { await AiLog.remove(logId); res.status(503).end(); } // UI shows "AI not available"
  }
});
