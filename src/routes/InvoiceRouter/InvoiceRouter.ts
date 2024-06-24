import express, { Router } from 'express';
import multer from 'multer';
import InvoiceController from '../../controllers/InvoiceController';
import ValidatorMiddleware from '../../middlewares/ValidatorMiddleware';
import config from '../../config/default';
import dateSchema from '../../schemas/date';

const router: Router = express.Router();
const invoiceController: InvoiceController = new InvoiceController();
const validatorMiddleware: ValidatorMiddleware = new ValidatorMiddleware();

// Initialize Multer with MemoryStorage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_UPLOAD_SIZE_IN_MB,
  },
});

router.post(
  '/invoice',
  upload.single('file'),
  validatorMiddleware.validate(dateSchema),
  invoiceController.processInvoices
);

export default router;
