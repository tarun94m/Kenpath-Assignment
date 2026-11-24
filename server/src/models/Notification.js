import { pool } from '../db/pool.js';

export const Notification = {
  async forApplication(id) { return (await pool.query('SELECT body,status,at FROM notifications WHERE application_id=$1 ORDER BY at DESC', [id])).rows; },
  async create(c, { applicationId, phone, body }) {
    return (await c.query('INSERT INTO notifications (application_id,phone,body) VALUES ($1,$2,$3) RETURNING id', [applicationId, phone, body])).rows[0].id;
  },
  async find(id) { return (await pool.query('SELECT * FROM notifications WHERE id=$1', [id])).rows[0]; },
  setStatus: (id, status) => pool.query('UPDATE notifications SET status=$2 WHERE id=$1', [id, status]),
};
