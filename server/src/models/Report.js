import { pool } from '../db/pool.js';

// Impact metrics: backlog, overdue, average days to decision, share of actions where AI was used.
const STATS = `SELECT
  count(*) FILTER (WHERE status='pending')::int AS pending,
  count(*) FILTER (WHERE status='pending' AND due_at < CURRENT_DATE)::int AS overdue,
  count(*) FILTER (WHERE status IN ('approved','rejected'))::int AS closed,
  (SELECT round(100.0*count(*) FILTER (WHERE ai_used)/NULLIF(count(*),0)) FROM history)::int AS ai_pct,
  (SELECT round(avg(h.at::date - a.submitted_at)) FROM history h JOIN applications a ON a.id=h.application_id
     WHERE h.action IN ('approve','reject'))::int AS avg_days FROM applications`;
const rows = async (sql) => (await pool.query(sql)).rows;

export const Report = {
  async stats() { return (await pool.query(STATS)).rows[0]; },
  async dashboard() {
    return {
      kpi: await Report.stats(),
      by_stage: await rows(`SELECT stage, count(*)::int n FROM applications WHERE status='pending' GROUP BY stage ORDER BY stage`),
      by_village: await rows(`SELECT village, count(*)::int n, (count(*) FILTER (WHERE due_at < CURRENT_DATE))::int late
        FROM applications WHERE status='pending' GROUP BY village ORDER BY late DESC, n DESC`),
      returns: await rows(`SELECT stage, count(*)::int n FROM history WHERE action='return' GROUP BY stage ORDER BY stage`),
      outcomes: await rows(`SELECT status, count(*)::int n FROM applications WHERE status IN ('approved','rejected') GROUP BY status`),
      ai: await rows(`SELECT stage, count(*)::int total, (count(*) FILTER (WHERE agreed IS NOT NULL))::int decided,
        (count(*) FILTER (WHERE agreed))::int agreed FROM ai_log GROUP BY stage ORDER BY stage`),
      ai_diff: await rows(`SELECT l.stage, l.suggestion, l.final, a.name FROM ai_log l JOIN applications a ON a.id=l.application_id
        WHERE l.agreed = false ORDER BY l.decided_at DESC LIMIT 5`),
    };
  },
};
