import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 3000;

// Bearer token for the external campaigns API (was hardcoded in source before this refactor).
// Set EXTERNAL_CAMPAIGNS_TOKEN in .env.
export const EXTERNAL_CAMPAIGNS_TOKEN = process.env.EXTERNAL_CAMPAIGNS_TOKEN || '';
