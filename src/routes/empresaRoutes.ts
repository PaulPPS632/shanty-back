import { Router } from 'express';
import { EmpresaController } from '../controllers/empresaController';

const router = Router();
const empresaController = new EmpresaController();

router.get('/empresas', (req, res) => empresaController.listar(req, res));

export default router;
