import { Request, Response } from 'express';
import InvoiceService from '../../services/InvoiceService';
import ValidationError from '../../errors/ValidationError';

export default class InvoiceController {
  private invoiceService: InvoiceService = new InvoiceService();

  constructor() {
    this.processInvoices = this.processInvoices.bind(this);
  }

  async processInvoices(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).send('No file uploaded.');
        return;
      }

      const processedInvoices = await this.invoiceService.processInvoices({
        file: req?.file,
        invoicingMonth: req?.query?.invoicingMonth as string,
      });

      res.json(processedInvoices);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).send({
          code: 400,
          message: `${err?.message}`,
        });
      } else {
        res.status(500).send('Error processing file.');
      }
    }
  }
}
