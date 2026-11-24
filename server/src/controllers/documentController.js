import { Application, canAct } from '../models/Application.js';
import { Document, KINDS } from '../models/Document.js';
import { readDocument } from '../services/ollamaService.js';
import { compareDocument } from '../services/documentCheck.js';
import { wrap, fail } from '../middleware/errors.js';

// A vision model reads name and birth year; the officer must confirm every photo before the file moves on.
export const upload = wrap(async (req, res) => {
  const { kind, image } = req.body;
  if (!KINDS.includes(kind) || !String(image || '').startsWith('data:image/')) throw fail(400, 'bad document');
  const a = await Application.findRaw(req.params.id);
  if (!a) throw fail(404, 'not found');
  if (a.stage !== 1 || !canAct(a, req.user.role)) throw fail(403, 'not your step');
  const extracted = kind === 'p' ? null : compareDocument(a, kind, await readDocument(image)); // portrait: nothing to read
  await Document.replace(a.id, kind, image, extracted);
  await Application.markDocument(a.id, kind);
  res.json({ ok: true });
});

export const confirm = wrap(async (req, res) => {
  const a = await Application.findByDocument(req.params.id);
  if (!a) throw fail(404, 'not found');
  if (!canAct(a, req.user.role)) throw fail(403, 'not your step');
  await Document.confirm(req.params.id);
  res.json({ ok: true });
});
