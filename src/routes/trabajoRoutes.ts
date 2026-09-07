import { Router } from 'express';
import { TrabajoController } from '../controllers/trabajoController';

const router = Router();
const trabajoController = new TrabajoController();

router.get('/trabajo', (req, res) => trabajoController.getEmpleos(req, res));

export default router;
