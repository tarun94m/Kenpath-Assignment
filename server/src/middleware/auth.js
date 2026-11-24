import { verifyToken } from '../services/tokenService.js';
import { User } from '../models/User.js';

export async function authenticate(req, res, next) {
  try {
    const p = verifyToken((req.headers.authorization || '').slice(7));
    const u = p ? await User.findById(p.id) : null;
    if (!u) return res.status(401).json({ error: 'login required' });
    req.user = u;
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export const requireRole = (role) => (req, res, next) => (req.user.role === role ? next() : res.status(403).json({ error: 'forbidden' }));
