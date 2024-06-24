import express, { Router } from 'express';
import InvoiceRouter from './InvoiceRouter';

const router: Router = express.Router();

router.use([InvoiceRouter]);

export default router;
