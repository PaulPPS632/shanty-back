import { Router } from 'express';
import { PadronController } from '../controllers/padronController';

const router = Router();
const padronController = new PadronController();

router.get('/padron/specific-name', (req, res) => padronController.getSpecificName(req, res));
router.get('/padron/search', (req, res) => padronController.search(req, res));
router.get('/padron/dni/:dni', (req, res) => padronController.getByDni(req, res));

export default router;
