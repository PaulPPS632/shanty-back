import { Router } from 'express';
import { FotoController } from '../controllers/fotoController';

const router = Router();
const fotoController = new FotoController();

router.get('/foto', (req, res) => fotoController.getFoto(req, res));
router.get('/padron/photo-cached/:dni', (req, res) => fotoController.getCachedPhoto(req, res));

export default router;
