// scrypt password hashes + HMAC-signed 12h token (no extra dependencies)
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { config } from '../config/index.js';

export const hashPassword = (p, salt = randomBytes(8).toString('hex')) => `${salt}:${scryptSync(p, salt, 32).toString('hex')}`;
export const checkPassword = (p, h) => { const [salt, hx] = h.split(':'); return timingSafeEqual(scryptSync(p, salt, 32), Buffer.from(hx, 'hex')); };

const mac = (b) => createHmac('sha256', config.secret).update(b).digest('base64url');
export const signToken = (u) => {
  const b = Buffer.from(JSON.stringify({ id: u.id, exp: Date.now() + 12 * 36e5 })).toString('base64url');
  return `${b}.${mac(b)}`;
};
export const verifyToken = (t = '') => {
  const [b, sig] = t.split('.');
  if (!b || !sig) return null;
  const ok = mac(b);
  if (sig.length !== ok.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(ok))) return null;
  const p = JSON.parse(Buffer.from(b, 'base64url').toString());
  return p.exp > Date.now() ? p : null;
};
