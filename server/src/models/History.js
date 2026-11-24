import { pool } from '../db/pool.js';

export const History = {
  async forApplication(id) { return (await pool.query('SELECT * FROM history WHERE application_id=$1 ORDER BY at DESC', [id])).rows; },
  add: (c, h) => c.query('INSERT INTO history (application_id,stage,action,remark,ai_used,user_name,role) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [h.applicationId, h.stage, h.action, h.remark, h.aiUsed, h.userName, h.role]),
};
