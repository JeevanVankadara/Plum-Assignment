import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { createClaim, listClaims, getClaim, overrideDecision, updateAdminText } from '../controllers/claimsController.js';

const router = Router();

router.post('/', upload.array('files', 10), createClaim);
router.get('/', listClaims);
router.get('/:id', getClaim);
router.patch('/:id/decision', overrideDecision);
router.patch('/:id/admin-text', updateAdminText);

export default router;
