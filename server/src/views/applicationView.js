// "Views" for a JSON API: the exact shape the React client receives.
import { checks, canAct } from '../models/Application.js';

export const listItem = (a) => ({ ...a, failed: checks(a).filter((c) => !c.ok).length });

export const detail = (a, { history, photos, notes, role }) => ({
  ...a, checks: checks(a), history, photos, notes, can_act: canAct(a, role),
});

export const loginResult = (token, u) => ({ token, user: { username: u.username, name: u.name, role: u.role } });
