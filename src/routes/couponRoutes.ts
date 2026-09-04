import { Router } from 'express';
import { CouponController } from '../controllers/couponController';

const router = Router();
const couponController = new CouponController();

router.get('/coupons-pdf', (req, res) => couponController.getCouponsPdf(req, res));
router.get('/coupons/special-50', (req, res) => couponController.getSpecialCoupons50(req, res));

export default router;
