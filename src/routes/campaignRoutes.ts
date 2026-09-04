import { Router } from 'express';
import { CampaignController } from '../controllers/campaignController';

const router = Router();
const campaignController = new CampaignController();

router.get('/external-campaigns', (req, res) => campaignController.getExternalCampaigns(req, res));

export default router;
