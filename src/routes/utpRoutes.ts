import { Router } from 'express';
import { utpController } from '../controllers/utpController';

const router = Router();
const utpControllerInstance = new utpController();

router.get('/utpalumno/:dni', (req, res) => utpControllerInstance.getalumno(req, res));

export default router;
