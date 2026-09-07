import { Router } from 'express';
import campaignRoutes from './campaignRoutes';
import padronRoutes from './padronRoutes';
import fotoRoutes from './fotoRoutes';
import couponRoutes from './couponRoutes';
import utpRoutes from './utpRoutes';
import trabajoRoutes from './trabajoRoutes';

const router = Router();

router.use(campaignRoutes);
router.use(padronRoutes);
router.use(fotoRoutes);
router.use(couponRoutes);
router.use(utpRoutes);
router.use(trabajoRoutes);

export default router;
