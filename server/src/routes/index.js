import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { login } from '../controllers/authController.js';
import * as applications from '../controllers/applicationController.js';
import * as ai from '../controllers/aiController.js';
import * as documents from '../controllers/documentController.js';
import * as reports from '../controllers/reportController.js';

const router = Router();

router.post('/login', login); // the only public route
router.use(authenticate);     // everything below needs a valid token

router.get('/applications', applications.list);
router.get('/applications/:id', applications.show);
router.post('/applications/:id/action', applications.act);
router.post('/applications/:id/ai', ai.suggest);
router.post('/applications/:id/documents', documents.upload);
router.post('/documents/:id/confirm', documents.confirm);
router.get('/stats', reports.stats);
router.get('/dashboard', requireRole('tahsildar'), reports.dashboard);

export default router;
