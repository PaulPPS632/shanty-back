import { Router } from 'express';
import { UbigeoController } from '../controllers/ubigeoController';

const router = Router();
const ubigeoController = new UbigeoController();

router.get('/ubigeo/departamentos', (req, res) => ubigeoController.getDepartamentos(req, res));
router.get('/ubigeo/provincias', (req, res) => ubigeoController.getProvincias(req, res));
router.get('/ubigeo/distritos', (req, res) => ubigeoController.getDistritos(req, res));

export default router;
