import { Report } from '../models/Report.js';
import { wrap } from '../middleware/errors.js';

export const stats = wrap(async (_req, res) => res.json(await Report.stats()));
export const dashboard = wrap(async (_req, res) => res.json(await Report.dashboard()));
