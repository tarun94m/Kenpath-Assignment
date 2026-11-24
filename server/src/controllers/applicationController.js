import { Application, visibleTo } from '../models/Application.js';
import { History } from '../models/History.js';
import { Document } from '../models/Document.js';
import { Notification } from '../models/Notification.js';
import * as view from '../views/applicationView.js';
import * as workflow from '../services/workflowService.js';
import { wrap, fail } from '../middleware/errors.js';

export const list = wrap(async (req, res) => {
  const rows = await Application.all();
  res.json(rows.filter((a) => visibleTo(a, req.user.role)).map(view.listItem));
});

export const show = wrap(async (req, res) => {
  const a = await Application.find(req.params.id);
  if (!a) throw fail(404, 'not found');
  const [history, photos, notes] = await Promise.all([History.forApplication(a.id), Document.forApplication(a.id), Notification.forApplication(a.id)]);
  res.json(view.detail(a, { history, photos, notes, role: req.user.role }));
});

export const act = wrap(async (req, res) => {
  await workflow.perform({ id: req.params.id, user: req.user, body: req.body });
  res.json({ ok: true });
});
