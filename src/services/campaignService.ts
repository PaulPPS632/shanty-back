import axios from 'axios';
import { EXTERNAL_CAMPAIGNS_TOKEN } from '../config/env';
import { Root } from '../types';

export class CampaignService {
    async fetchCampaigns(dni: string): Promise<Root[]> {
        const response = await axios.get(
            `https://bf78lhnz4a.execute-api.ca-central-1.amazonaws.com/PRD/campaigns/GetCampaniasDisponiblesByNumeroDocumento?numeroDocumento=${dni}&tagId=0`,
            {
                headers: {
                    'Authorization': `Bearer ${EXTERNAL_CAMPAIGNS_TOKEN}`
                }
            }
        );

        return response.data;
    }
}
