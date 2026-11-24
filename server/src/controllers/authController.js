import { User } from '../models/User.js';
import { checkPassword, signToken } from '../services/tokenService.js';
import { loginResult } from '../views/applicationView.js';
import { wrap, fail } from '../middleware/errors.js';

export const login = wrap(async (req, res) => {
  const u = await User.findByUsername(String(req.body.username || ''));
  if (!u || !checkPassword(String(req.body.password || ''), u.pw)) throw fail(401, 'bad login');
  res.json(loginResult(signToken(u), u));
});
