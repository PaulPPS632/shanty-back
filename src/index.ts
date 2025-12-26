import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { pool } from './db';
import { PdfService } from './services/pdfService';
import { SpecialCouponService } from './services/specialCouponService';
import { Root } from './types';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const pdfService = new PdfService();
const specialCouponService = new SpecialCouponService();

const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjRFNEVCQTlCMUVEQzQ4QTdGRjlENDU3QTg2RkJFQjEyMDUwODg0QzUiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJUazY2bXg3Y1NLZl9uVVY2aHZ2ckVnVUloTVUifQ.eyJuYmYiOjE3NjY2OTk5NTQsImV4cCI6MTc2Njg3Mjg1NCwiaXNzIjoiaHR0cDovL3ByZGxiaWRlbnRpdHktMTE1NTI0NDA5Mi5jYS1jZW50cmFsLTEuZWxiLmFtYXpvbmF3cy5jb20iLCJhdWQiOlsiaHR0cDovL3ByZGxiaWRlbnRpdHktMTE1NTI0NDA5Mi5jYS1jZW50cmFsLTEuZWxiLmFtYXpvbmF3cy5jb20vcmVzb3VyY2VzIiwiYXBpQ2FtcGFpZ25zIl0sImNsaWVudF9pZCI6Im12YyIsInNjb3BlIjpbImFwaUNhbXBhaWducyJdfQ.rWxQJxIt6rX5bbHZE84x0TvIiv17omXiFzdUHH95I7BPbz9Y0Hja7rqh0KPahgN6nN-xe4l66mlPZVo9KdvLRE_WDD96wVWdOD2tdaSkgtNsZpDg9py5xTAExojKm-cothdtD1YSeHG9byzeSsUwWRkjpedYxsJEjndNSVxDsOxvyqAbZRmHEpmRnYT48m9p00vrWARie4erMQIdtfEAlwi0NM_sIHgkdm29d31ByhrfVsrC76GHxkx12aDVjR66wWYELaVCXYvqMD2sCMNi-2u_GMVWjLHN1WFnBm1LFH8oSaKtMmulCnfDChFicHRqbPPcGj7sj-pO-bc3Hs7SCw';

// Endpoint that executes the logic from the original index.ts
app.get('/api/external-campaigns', async (req: Request, res: Response) => {
    try {
        const dni = req.query.dni as string || '48810165'; // Default to the one in original file if not provided
        
        const response = await axios.get(
            `https://bf78lhnz4a.execute-api.ca-central-1.amazonaws.com/PRD/campaigns/GetCampaniasDisponiblesByNumeroDocumento?numeroDocumento=${dni}&tagId=0`,                
            {
                headers:{
                    'Authorization': `Bearer ${TOKEN}`
                }
            }
        );

        if(response.status){
            res.json(response.data[0]);
        } else {
            res.status(response.status).send('Error in external API');
        }
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 1: Specific Name Query (Hardcoded requirement from prompt)
app.get('/api/padron/specific-name', async (req: Request, res: Response) => {
    try {
        const query = `
            SELECT * FROM padron_raw pr 
            WHERE pr.nombres = 'ABRAHAM STEVE' 
            AND pr.paterno = 'CANEZ' 
            AND pr.materno = 'GIL'
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 2: Specific DNI Query (Parameterizable as per standard practice, but defaulting to prompt requirement if needed)
// "realiza otro endpoint que realize el siguiente tipo de consulta: select * from padron_raw pr where pr.dni = '48810165'"
// I will make it accept a param but test with that value.
app.get('/api/padron/dni/:dni', async (req: Request, res: Response) => {
    try {
        const { dni } = req.params;
        const query = `SELECT * FROM padron_raw pr WHERE pr.dni = $1`;
        const result = await pool.query(query, [dni]);
        res.json(result.rows);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint 3: Flexible Query
// "realize un enpoint que sea flexible que realize la consulta dependiendo de lo que se le mande si nombre si apellidos o dni"
app.get('/api/padron/search', async (req: Request, res: Response) => {
    try {
        const { nombres, paterno, materno, dni } = req.query;
        
        let query = 'SELECT * FROM padron_raw pr WHERE 1=1';
        const params: any[] = [];
        let paramCount = 1;

        if (dni) {
            query += ` AND pr.dni LIKE $${paramCount}`;
            params.push(`%${dni}%`);
            paramCount++;
        }

        if (nombres) {
            query += ` AND pr.nombres ILIKE $${paramCount}`;
            params.push(`%${nombres}%`);
            paramCount++;
        }

        if (paterno) {
            query += ` AND pr.paterno ILIKE $${paramCount}`;
            params.push(`%${paterno}%`);
            paramCount++;
        }

        if (materno) {
            query += ` AND pr.materno ILIKE $${paramCount}`;
            params.push(`%${materno}%`);
            paramCount++;
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/foto', async (req: Request, res: Response) => {
    try {
        const { dni } = req.query; // Client sends 'valor1' (DNI)

        if (!dni) {
            res.status(400).json({ error: "Missing 'valor1' query parameter" });
            return;
        }

        const params = new URLSearchParams();
        params.append('action', 'dni');
        params.append('valor1', dni as string);

        const response = await axios.post(
            'https://sis.itp.gob.pe/FormITP_SSIPRO/ApiPideReniecServlet',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const externalData = response.data as {
            apPrimer: string;
            apSegundo: string;
            direccion: string;
            estadoCivil: string;
            foto: string;
            prenombres: string;
            restriccion: string;
            ubigeo: string;
        };

        if (externalData && externalData.foto) {
             // Update the database with the photo
            const updateQuery = 'UPDATE padron_raw SET foto = $1 WHERE dni = $2';
            await pool.query(updateQuery, [externalData.foto, dni]);
            
            // Return only the photo base64 string
            res.json({ foto: externalData.foto });
        } else {
            // Handle case where photo or data is missing
            res.status(404).json({ error: "Photo not found in external API response" });
        }

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/padron/photo-cached/:dni', async (req: Request, res: Response) => {
    try {
        const { dni } = req.params;

        // 1. Check DB for existing photo using DNI (Primary Key)
        const userQuery = 'SELECT foto FROM padron_raw WHERE dni = $1';
        const userResult = await pool.query(userQuery, [dni]);

        if (userResult.rows.length === 0) {
            res.status(404).json({ error: 'User not found in padron' });
            return;
        }

        const user = userResult.rows[0];

        // 2. Return existing photo if available
        if (user.foto && user.foto.trim() !== '') {
            res.json({ foto: user.foto });
            return;
        }

        // 3. Fetch from External API if photo is missing
        const params = new URLSearchParams();
        params.append('action', 'dni');
        params.append('valor1', dni);

        const response = await axios.post(
            'https://sis.itp.gob.pe/FormITP_SSIPRO/ApiPideReniecServlet',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const externalData = response.data as { foto?: string };

        if (externalData && externalData.foto) {
             // 4. Update DB using DNI
            const updateQuery = 'UPDATE padron_raw SET foto = $1 WHERE dni = $2';
            await pool.query(updateQuery, [externalData.foto, dni]);
            
            res.json({ foto: externalData.foto });
        } else {
            res.status(404).json({ error: "Photo not found in external API" });
        }

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/coupons-pdf', async (req: Request, res: Response) => {
    try {
        const dni = req.query.dni as string || '48810165';
        
        const response = await axios.get(
            `https://bf78lhnz4a.execute-api.ca-central-1.amazonaws.com/PRD/campaigns/GetCampaniasDisponiblesByNumeroDocumento?numeroDocumento=${dni}&tagId=0`,                
            {
                headers:{
                    'Authorization': `Bearer ${TOKEN}`
                }
            }
        );

        if(!response.data || !response.data[0]) {
             res.status(404).send('No campaigns found');
             return;
        }

        const data: Root = response.data[0];
        const pdfBytes = await pdfService.generateCouponsPdf(data);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=coupons.pdf');
        res.send(pdfBytes);

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/coupons/special-50', async (req: Request, res: Response) => {
    try {
        const pdfBytes = await specialCouponService.generateCouponsPdfForValue50();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=special_coupons_50.pdf');
        res.send(pdfBytes);
    } catch (error: any) {
        console.error(error);
        if (error.message === 'No coupons found with value 50') {
            res.status(404).json({ error: error.message });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});