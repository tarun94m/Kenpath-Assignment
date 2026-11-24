// Idempotent migration + demo seed, so an existing database upgrades without being reset.
import { pool } from './pool.js';
import { User } from '../models/User.js';

export async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('gao','ri','tahsildar')), pw TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ai_log (id SERIAL PRIMARY KEY, application_id INT REFERENCES applications(id), stage INT, model TEXT,
      prompt_version TEXT, user_id INT, suggestion TEXT, text TEXT, final TEXT, agreed BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT now(), decided_at TIMESTAMPTZ);
    ALTER TABLE history ADD COLUMN IF NOT EXISTS user_name TEXT; ALTER TABLE history ADD COLUMN IF NOT EXISTS role TEXT;
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS phone TEXT;
    UPDATE applications SET phone = '90000' || lpad(id::text, 5, '0') WHERE phone IS NULL; -- demo numbers only
    CREATE TABLE IF NOT EXISTS documents (id SERIAL PRIMARY KEY, application_id INT NOT NULL REFERENCES applications(id), kind TEXT NOT NULL, data TEXT NOT NULL, extracted JSONB, confirmed BOOLEAN NOT NULL DEFAULT false, at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, application_id INT NOT NULL REFERENCES applications(id), phone TEXT, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', at TIMESTAMPTZ DEFAULT now());`);

  for (const [username, name, role] of [['gao1', 'ಲಕ್ಷ್ಮೀ ನಾರಾಯಣ', 'gao'], ['ri1', 'ಮಂಜುನಾಥ', 'ri'], ['tah1', 'ಶ್ವೇತಾ', 'tahsildar']])
    await User.createIfMissing({ username, name, role, password: 'demo123' });

  const { rows: [{ n }] } = await pool.query(`SELECT count(*) n FROM applications WHERE status IN ('approved','rejected')`);
  if (+n === 0) // a few finished cases so the dashboard has history to show
    for (const [ref, name, v, st, days] of [['SSY-0090', 'ಮಲ್ಲಮ್ಮ', 'ಹೆಬ್ಬಾಳ', 'approved', 14], ['SSY-0094', 'ಈರಣ್ಣ', 'ಕೆಂಗೇರಿ', 'approved', 21], ['SSY-0097', 'ಪಾರ್ವತಮ್ಮ', 'ಯಲಹಂಕ', 'rejected', 28]]) {
      const { rows: [a] } = await pool.query(`INSERT INTO applications (ref_no,name,age,village,income,bpl,docs,stage,status,submitted_at,due_at)
        VALUES ($1,$2,70,$3,10000,true,'{"a":true,"i":true,"b":true,"p":true}',3,$4,CURRENT_DATE-$5::int-1,CURRENT_DATE-1) ON CONFLICT (ref_no) DO NOTHING RETURNING id`, [ref, name, v, st, days]);
      if (a) await pool.query(`INSERT INTO history (application_id,stage,action,ai_used,at,user_name,role) VALUES ($1,3,$2,true,now()-interval '1 day','ಶ್ವೇತಾ','tahsildar')`, [a.id, st === 'approved' ? 'approve' : 'reject']);
      if (a && ref === 'SSY-0094') await pool.query(`INSERT INTO history (application_id,stage,action,remark,at,user_name,role) VALUES ($1,1,'return','ಪಾಸ್‌ಬುಕ್ ಇಲ್ಲ',now()-interval '15 day','ಲಕ್ಷ್ಮೀ ನಾರಾಯಣ','gao')`, [a.id]);
    }
}
