import { pool } from '../db/pool.js';

// Every AI suggestion is logged, then closed with what the officer actually did.
export const AiLog = {
  async start({ applicationId, stage, model, promptVersion, userId }) {
    return (await pool.query('INSERT INTO ai_log (application_id,stage,model,prompt_version,user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [applicationId, stage, model, promptVersion, userId])).rows[0].id;
  },
  finish: (id, text, suggestion) => pool.query('UPDATE ai_log SET text=$2, suggestion=$3 WHERE id=$1', [id, text, suggestion]),
  remove: (id) => pool.query('DELETE FROM ai_log WHERE id=$1', [id]),
  recordDecision: (c, { id, applicationId, final }) => c.query(`UPDATE ai_log SET final=$1, decided_at=now(),
    agreed = CASE WHEN suggestion IS NULL THEN NULL ELSE suggestion = $1 END
    WHERE id=$2 AND application_id=$3 AND decided_at IS NULL`, [final, id, applicationId]),
};
