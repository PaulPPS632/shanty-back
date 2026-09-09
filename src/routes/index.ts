import { Router } from 'express';
import campaignRoutes from './campaignRoutes';
import padronRoutes from './padronRoutes';
import fotoRoutes from './fotoRoutes';
import telefonoRoutes from './telefonoRoutes';
import ubigeoRoutes from './ubigeoRoutes';
import rucRoutes from './rucRoutes';
import empresaRoutes from './empresaRoutes';
import couponRoutes from './couponRoutes';
import utpRoutes from './utpRoutes';
import trabajoRoutes from './trabajoRoutes';
import creditosRoutes from './creditosRoutes';

const router = Router();

router.use(campaignRoutes);
router.use(padronRoutes);
router.use(fotoRoutes);
router.use(telefonoRoutes);
router.use(ubigeoRoutes);
router.use(rucRoutes);
router.use(empresaRoutes);
router.use(couponRoutes);
router.use(utpRoutes);
router.use(trabajoRoutes);
router.use(creditosRoutes);

export default router;
