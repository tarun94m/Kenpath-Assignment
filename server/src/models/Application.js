import { pool } from '../db/pool.js';
import { config } from '../config/index.js';

const WITH_DAYS = `SELECT *, (due_at - CURRENT_DATE) AS days_left FROM applications`;

// ---- Domain rules (plain code, not AI: the officer sees exactly what failed) ----
export const checks = (a) => [
  { k: 'age', ok: a.age >= config.rules.minAge },
  { k: 'income', ok: a.income <= config.rules.maxIncome },
  { k: 'bpl', ok: a.bpl },
  { k: 'd_a', ok: !!a.docs.a }, { k: 'd_i', ok: !!a.docs.i },
  { k: 'd_b', ok: !!a.docs.b }, { k: 'd_p', ok: !!a.docs.p },
];
// An officer may act only on applications waiting at their own step (returned ones go back to the first officer).
export const canAct = (a, role) => (a.status === 'returned' ? role === 'gao' : a.status === 'pending' && config.stageRole[a.stage] === role);
// Each officer sees their own queue; the Tahsildar sees every open file; closed files are visible to all.
export const visibleTo = (a, role) => !['pending', 'returned'].includes(a.status) || role === 'tahsildar' || canAct(a, role);

// ---- Persistence ----
export const Application = {
  // Open items by nearest deadline first, closed ones last.
  async all() {
    return (await pool.query(`${WITH_DAYS} ORDER BY (status IN ('pending','returned')) DESC, due_at ASC`)).rows;
  },
  async find(id) { return (await pool.query(`${WITH_DAYS} WHERE id=$1`, [id])).rows[0]; },
  async findRaw(id) { return (await pool.query('SELECT * FROM applications WHERE id=$1', [id])).rows[0]; },
  async findByDocument(documentId) {
    return (await pool.query('SELECT a.* FROM documents d JOIN applications a ON a.id=d.application_id WHERE d.id=$1', [documentId])).rows[0];
  },
  async lockForUpdate(c, id) { return (await c.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE', [id])).rows[0]; },
  advance: (c, id, fieldNotes) => c.query('UPDATE applications SET stage=stage+1, field_notes=COALESCE($2,field_notes) WHERE id=$1', [id, fieldNotes ?? null]),
  setStatus: (c, id, status) => c.query('UPDATE applications SET status=$2 WHERE id=$1', [id, status]),
  reopen: (c, id) => c.query(`UPDATE applications SET status='pending', stage=1, due_at=CURRENT_DATE+30 WHERE id=$1`, [id]),
  // a photographed document ticks that item on the checklist
  markDocument: (id, kind) => pool.query(`UPDATE applications SET docs = docs || jsonb_build_object($2::text, true) WHERE id=$1`, [id, kind]),
};
