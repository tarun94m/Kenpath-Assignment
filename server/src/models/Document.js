import { pool } from '../db/pool.js';

export const KINDS = ['a', 'i', 'b', 'p']; // age proof, income certificate, bank passbook, portrait

export const Document = {
  async forApplication(id) {
    return (await pool.query('SELECT id,kind,data,extracted,confirmed FROM documents WHERE application_id=$1 ORDER BY kind', [id])).rows;
  },
  async countUnconfirmed(c, id) {
    return +(await c.query('SELECT count(*) n FROM documents WHERE application_id=$1 AND NOT confirmed', [id])).rows[0].n;
  },
  async replace(applicationId, kind, image, extracted) { // one photo per document type
    await pool.query('DELETE FROM documents WHERE application_id=$1 AND kind=$2', [applicationId, kind]);
    await pool.query('INSERT INTO documents (application_id,kind,data,extracted) VALUES ($1,$2,$3,$4)', [applicationId, kind, image, extracted]);
  },
  confirm: (id) => pool.query('UPDATE documents SET confirmed=true WHERE id=$1', [id]),
};
