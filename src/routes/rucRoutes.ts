import { Router } from 'express';
import { RucController } from '../controllers/rucController';

const router = Router();
const rucController = new RucController();

router.get('/ruc/:ruc', (req, res) => rucController.getByRuc(req, res));

export default router;
