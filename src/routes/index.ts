import { Router } from 'express';
import campaignRoutes from './campaignRoutes';
import padronRoutes from './padronRoutes';
import fotoRoutes from './fotoRoutes';
import couponRoutes from './couponRoutes';

const router = Router();

router.use(campaignRoutes);
router.use(padronRoutes);
router.use(fotoRoutes);
router.use(couponRoutes);

export default router;
