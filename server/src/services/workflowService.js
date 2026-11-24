// The application workflow: who may do what, in which order, and everything that must happen together.
import { withTransaction } from '../db/pool.js';
import { Application, canAct } from '../models/Application.js';
import { Document } from '../models/Document.js';
import { History } from '../models/History.js';
import { AiLog } from '../models/AiLog.js';
import { fail } from '../middleware/errors.js';
import { queueFor, deliver } from './notificationService.js';

const FINAL = { advance: 'CONTINUE', approve: 'APPROVE', reject: 'REJECT', return: 'RETURN' };

export async function perform({ id, user, body }) {
  const { action, remark = '', aiUsed = false, aiLogId = null, fieldNotes } = body;
  const notificationId = await withTransaction(async (c) => {
    const a = await Application.lockForUpdate(c, id);
    if (!a) throw fail(404, 'not found');
    if (!canAct(a, user.role)) throw fail(403, 'not your step');

    if (action === 'reopen') {
      if (a.status !== 'returned') throw fail(409, 'not returned');
      await Application.reopen(c, a.id);
    } else {
      if (a.status !== 'pending') throw fail(409, 'already closed');
      if (['reject', 'return'].includes(action) && !remark.trim()) throw fail(400, 'remark required');
      if (action === 'advance') {
        if (a.stage >= 3) throw fail(400, 'use approve/reject at the last stage');
        if (a.stage === 1 && (await Document.countUnconfirmed(c, a.id)) > 0) throw fail(400, 'confirm documents'); // every photo must be checked by the officer
        if (a.stage === 2 && !(fieldNotes || a.field_notes || '').trim()) throw fail(400, 'field notes required');
        await Application.advance(c, a.id, fieldNotes);
      } else if (action === 'approve') {
        if (a.stage !== 3) throw fail(400, 'approve only at the final stage');
        await Application.setStatus(c, a.id, 'approved');
      } else if (action === 'reject') await Application.setStatus(c, a.id, 'rejected');
      else if (action === 'return') await Application.setStatus(c, a.id, 'returned');
      else throw fail(400, 'bad action');
    }

    // Close the loop: record what the officer finally did next to what the AI suggested.
    if (aiLogId && FINAL[action]) await AiLog.recordDecision(c, { id: aiLogId, applicationId: a.id, final: FINAL[action] });
    await History.add(c, { applicationId: a.id, stage: a.stage, action, remark, aiUsed: !!(aiUsed || aiLogId), userName: user.name, role: user.role });
    return queueFor(c, a, action, remark);
  });
  if (notificationId) deliver(notificationId); // after commit, not awaited
}
