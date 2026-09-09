import { Request, Response } from 'express';
import { CampaignService } from '../services/campaignService';
import { PdfService } from '../services/pdfService';
import { SpecialCouponService } from '../services/specialCouponService';
import { Root } from '../types';
import { logFallo } from '../middlewares/logMeta';

const campaignService = new CampaignService();
const pdfService = new PdfService();
const specialCouponService = new SpecialCouponService();

export class CouponController {
    async getCouponsPdf(req: Request, res: Response): Promise<void> {
        try {
            const dni = req.query.dni as string || '48810165';

            const campaigns = await campaignService.fetchCampaigns(dni);

            if (!campaigns || !campaigns[0]) {
                res.status(404).send('No campaigns found');
                return;
            }

            const data: Root = campaigns[0];
            const pdfBytes = await pdfService.generateCouponsPdf(data);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename=coupons.pdf');
            res.send(pdfBytes);
        } catch (error: any) {
            logFallo(req, res, error);
            res.status(500).json({ error: error.message });
        }
    }

    async getSpecialCoupons50(req: Request, res: Response): Promise<void> {
        try {
            const pdfBytes = await specialCouponService.generateCouponsPdfForValue50();

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=special_coupons_50.pdf');
            res.send(pdfBytes);
        } catch (error: any) {
            logFallo(req, res, error);
            if (error.message === 'No coupons found with value 50') {
                res.status(404).json({ error: error.message });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    }
}
