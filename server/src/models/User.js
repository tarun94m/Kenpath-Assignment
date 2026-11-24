import { pool } from '../db/pool.js';
import { hashPassword } from '../services/tokenService.js';

export const User = {
  async findByUsername(username) {
    return (await pool.query('SELECT * FROM users WHERE username=$1', [username])).rows[0];
  },
  async findById(id) { // public fields only: never the password hash
    return (await pool.query('SELECT id,username,name,role FROM users WHERE id=$1', [id])).rows[0];
  },
  async createIfMissing({ username, name, role, password }) {
    await pool.query('INSERT INTO users (username,name,role,pw) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [username, name, role, hashPassword(password)]);
  },
};
