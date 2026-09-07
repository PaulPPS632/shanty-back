import { Router } from 'express';
import { TelefonoController } from '../controllers/telefonoController';

const router = Router();
const telefonoController = new TelefonoController();

router.get('/telefonos/buscar', (req, res) => telefonoController.buscar(req, res));
router.get('/telefonos/dni/:dni', (req, res) => telefonoController.getByDni(req, res));
router.get('/telefonos/ruc/:ruc', (req, res) => telefonoController.getByRuc(req, res));

export default router;
