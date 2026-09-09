import { Router } from 'express';
import { CreditosController } from '../controllers/creditosController';

const router = Router();
const creditosController = new CreditosController();

router.get('/creditos', (req, res) => creditosController.getSaldo(req, res));

export default router;
