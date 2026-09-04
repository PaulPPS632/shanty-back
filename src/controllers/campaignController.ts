import { Request, Response } from 'express';
import { CampaignService } from '../services/campaignService';

const campaignService = new CampaignService();

export class CampaignController {
    async getExternalCampaigns(req: Request, res: Response): Promise<void> {
        try {
            const dni = req.query.dni as string || '48810165'; // Default kept from original implementation

            const campaigns = await campaignService.fetchCampaigns(dni);

            if (campaigns && campaigns[0]) {
                res.json(campaigns[0]);
            } else {
                res.status(404).send('No campaigns found');
            }
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
}
