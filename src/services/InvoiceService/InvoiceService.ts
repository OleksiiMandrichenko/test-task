import XLSX from 'xlsx';
import moment from 'moment';
import Joi from '@hapi/joi';
import { exchangeRatePatterns, invoicesPatterns } from './patterns';
import removeSubstringFromKeys from './helpers/removeSubstringFromKeys';
import ValidationError from '../../errors/ValidationError';
import {
  Invoice,
  InvoiceStatus,
  ProcessedInvoices,
  Subtable,
} from '../../models/Invoices';
import areDatesEqual from './helpers/areDatesEqual';
import validators from './helpers/customValidators';
import invoiceSchema from '../../schemas/invoice';

export default class InvoiceService {
  private exchangeRates: Record<string, number> | undefined;

  async processInvoices({
    file,
    invoicingMonth: invoicingMonthFromParams,
  }: {
    file: { buffer: Buffer };
    invoicingMonth: string;
  }): Promise<ProcessedInvoices> {
    let normalizedInvoicingMonth;
    let finalInvoices;

    try {
      const workbook: XLSX.WorkBook = XLSX.read(file.buffer);
      // Assuming we only interested in the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];

      const invoicingMonthFromFile = this.getInvoicingMonth(firstSheet);
      normalizedInvoicingMonth = this.normalizeInvoicingMonth(
        invoicingMonthFromFile,
      );

      this.ensureInvoicingMonthsAreEqual({
        invoicingMonthFromFile,
        invoicingMonthFromParams,
      });

      const exchangeRates = this.getExchangeRatesData({
        firstSheet,
        subtablePattern: exchangeRatePatterns,
      });

      const validatedExchangeRates = this.validateExchangeRates(exchangeRates);
      this.exchangeRates = this.normalizeExchangeRates(validatedExchangeRates);

      const invoices = this.getInvoicesData({
        firstSheet,
        subtablePattern: invoicesPatterns,
      });

      const relevantInvoices = this.extractRelevantInvoices(invoices);
      const validatedInvoices = this.validateInvoices(relevantInvoices);
      finalInvoices = this.enrichWithInvoiceTotal(validatedInvoices);
    } catch (e) {
      if (e instanceof ValidationError) {
        throw e;
      } else {
        throw new ValidationError(
          `File structure is invalid. Please check that you've uploaded the correct file format.`,
        );
      }
    }

    return {
      invoicingMonth: normalizedInvoicingMonth,
      currencyRates: this.exchangeRates,
      invoicesData: finalInvoices,
    };
  }

  getInvoicingMonth(firstSheet: XLSX.WorkSheet): string {
    // Assuming InvoicingMonth MUST be placed on the A1 of the first sheet
    if (typeof firstSheet?.A1?.v !== 'string')
      throw new Error(`InvoicingMonth must be a string`);
    return firstSheet?.A1?.v.toString();
  }

  findExchangeRatesTableRange({
    rows,
    subtablePattern,
  }: {
    rows: Array<unknown>;
    subtablePattern: Subtable;
  }): Array<number | null> {
    const [firstRowIndex, endCol] = this.getFirstRowAndEndColIndicies({
      rows,
      subtablePattern,
    });

    const subtableDataRowsAmount = this.countRowsAmountTillPatternChange({
      rows,
      pattern: subtablePattern.dataPattern,
    });

    // Assuming data must be placed in the next line right after the header
    const firstDataRowIndex = firstRowIndex + 1;
    const lastRowIndex = firstRowIndex + subtableDataRowsAmount;

    return [firstDataRowIndex, lastRowIndex, endCol];
  }

  findInvoicesTableRange({
    rows,
    subtablePattern,
  }: {
    rows: Array<unknown>;
    subtablePattern: Subtable;
  }): Array<number | null> {
    const [firstRowIndex, endCol] = this.getFirstRowAndEndColIndicies({
      rows,
      subtablePattern,
    });

    const subtableDataRowsAmount = this.countRowsAmountTillBlankLine({
      rows,
      headerRowIndex: firstRowIndex,
    });
    const lastRowIndex = firstRowIndex + subtableDataRowsAmount;

    return [firstRowIndex, lastRowIndex, endCol];
  }

  getExchangeRatesData({
    firstSheet,
    subtablePattern,
  }: {
    firstSheet: XLSX.WorkSheet;
    subtablePattern: Subtable;
  }): Record<string, number> {
    const START_COL = 0;

    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
    });

    const [startRow, endRow, endCol] = this.findExchangeRatesTableRange({
      rows,
      subtablePattern,
    });

    const range = {
      s: { r: startRow, c: START_COL },
      e: { r: endRow, c: endCol },
    };

    const subtableData = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      range,
    });

    return Object.fromEntries(subtableData as Array<[string, number]>);
  }

  getInvoicesData({
    firstSheet,
    subtablePattern,
  }: {
    firstSheet: XLSX.WorkSheet;
    subtablePattern: Subtable;
  }): Array<Invoice> {
    const START_COL = 0;
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
    });

    const [startRow, endRow, endCol] = this.findInvoicesTableRange({
      rows,
      subtablePattern,
    });

    const range = {
      s: { r: startRow, c: START_COL },
      e: { r: endRow, c: endCol },
    };

    return XLSX.utils.sheet_to_json(firstSheet, {
      header: 0,
      range,
    });
  }

  extractRelevantInvoices(invoices: Array<Invoice>): Array<Invoice> {
    return invoices.filter(
      (invoice) =>
        invoice?.Status === InvoiceStatus.READY ||
        Object.hasOwnProperty.call(invoice, 'Invoice #'),
    );
  }

  validateInvoices(invoices: Array<Invoice>): Array<Invoice> {
    const extendedSchema = invoiceSchema.custom(
      validators.INVOICE_VALIDATOR,
      'invoice validation',
    );

    return invoices.map((invoice) => {
      const { error } = extendedSchema.validate(invoice, {
        abortEarly: false, // Add all validation errors
      });

      let validationErrors: Array<string> = [];

      if (error) {
        validationErrors = error.details.map(
          (err) =>
            err.type === 'any.invalid' ? err?.context?.message : err?.message, // Regular errors in err.message while custom validation errors in the err?.context?.message
        );
      }

      return {
        ...invoice,
        validationErrors,
      };
    });
  }

  enrichWithInvoiceTotal(invoices: Array<Invoice>): Array<Invoice> {
    return invoices.map((invoice) => {
      let invoiceTotal;
      let validationErrors = invoice?.validationErrors || [];

      try {
        invoiceTotal = this.calcInvoiceTotal(invoice);
      } catch (e) {
        invoiceTotal = null; // Set null in case calculation can't be performed for some reason

        if (e instanceof ValidationError) {
          validationErrors = [...validationErrors, e?.message];
        } else {
          throw e;
        }
      }

      return {
        ...invoice,
        invoiceTotal,
        validationErrors,
      };
    });
  }

  calcInvoiceTotal(invoice: Invoice): number | null {
    const ILS_RATE = 1; // Default currency exchange rate of 1 for the base currency ILS

    if (!this.exchangeRates) throw new Error('Exchange rates required');

    // Ensure that "Invoice Currency" is present in the exchange rates
    if (
      invoice['Invoice Currency'] !== 'ILS' &&
      !Object.keys(this.exchangeRates).includes(invoice['Invoice Currency'])
    )
      throw new ValidationError(
        '"Invoice Currency" must be present in exchange rates',
      );

    // Ensure that "Item Price Currency" is present in the exchange rates
    if (
      invoice['Item Price Currency'] !== 'ILS' &&
      !Object.keys(this.exchangeRates).includes(invoice['Item Price Currency'])
    )
      throw new ValidationError(
        '"Item Price Currency" must be present in exchange rates',
      );

    const totalPriceCurrencyRate =
      invoice['Item Price Currency'] === 'ILS'
        ? ILS_RATE
        : this.exchangeRates[invoice['Item Price Currency']];

    const invoiceCurrencyRate =
      invoice['Invoice Currency'] === 'ILS'
        ? ILS_RATE
        : this.exchangeRates[invoice['Invoice Currency']];

    return (
      (invoice['Total Price'] * totalPriceCurrencyRate) / invoiceCurrencyRate
    );
  }

  normalizeInvoicingMonth(invoicingMonthFromFile: string): string {
    return moment(invoicingMonthFromFile, ['MMM YYYY', 'YYYY-MM']).format(
      'YYYY-MM',
    );
  }

  ensureInvoicingMonthsAreEqual({
    invoicingMonthFromFile,
    invoicingMonthFromParams,
  }: {
    invoicingMonthFromFile: string;
    invoicingMonthFromParams: string;
  }): void {
    let invoicingMonthDatesEqual;
    try {
      invoicingMonthDatesEqual = areDatesEqual(
        invoicingMonthFromFile,
        invoicingMonthFromParams,
      );
    } catch (error) {
      throw new Error('Unknown error while comparing dates');
    }

    if (!invoicingMonthDatesEqual)
      throw new ValidationError('Invoice dates not equal!');
  }

  validateExchangeRates(
    exchangeRates: Record<string, number>,
  ): Record<string, number> {
    const numberOrFloatObjectSchema = Joi.object().pattern(
      /^[A-Z]{3} Rate$/,
      Joi.number().required(),
    );

    const { error } = numberOrFloatObjectSchema.validate(exchangeRates);
    if (error) {
      throw new ValidationError(`Validation error: ${error.message}`);
    }

    return exchangeRates;
  }

  normalizeExchangeRates(
    exchangeRates: Record<string, number>,
  ): Record<string, number> {
    return removeSubstringFromKeys(exchangeRates, ' Rate');
  }

  findRowByStringPattern({
    rows,
    pattern,
  }: {
    rows: Array<unknown>;
    pattern: RegExp;
  }): unknown | undefined {
    return rows.find((row) => {
      if (!Array.isArray(row)) return false;
      // Assuming data must be placed in the first column
      const firstCol = row[0];

      return typeof firstCol === 'string' && pattern.test(firstCol);
    });
  }

  countRowsAmountTillPatternChange({
    rows,
    pattern,
  }: {
    rows: Array<unknown>;
    pattern: RegExp;
  }): number {
    // Assuming exchange rates must be placed in the next line right after the invoice date
    const FIRST_DATA_ROW_INDEX = 1;
    let dataRowAmount = 0;

    for (let i = FIRST_DATA_ROW_INDEX; i < rows.length; i += 1) {
      const row = rows[i];

      if (!Array.isArray(row)) break;
      // Assuming data must be placed in the first column
      const firstCol = row[0];

      if (!pattern.test(firstCol)) return dataRowAmount;

      dataRowAmount += 1;
    }

    return dataRowAmount;
  }

  countRowsAmountTillBlankLine({
    rows,
    headerRowIndex,
  }: {
    rows: Array<unknown>;
    headerRowIndex: number;
  }): number {
    // Assuming data must be placed in the next line right after the header
    const FIRST_DATA_ROW_INDEX = headerRowIndex + 1;
    let dataRowAmount = 0;

    for (let i = FIRST_DATA_ROW_INDEX; i < rows.length; i += 1) {
      const row = rows[i];

      if (!Array.isArray(row)) break;
      const rowHasValues = row.length > 0;

      if (!rowHasValues) return dataRowAmount;

      dataRowAmount += 1;
    }

    return dataRowAmount;
  }

  getFirstRowAndEndColIndicies({
    rows,
    subtablePattern,
  }: {
    rows: Array<unknown>;
    subtablePattern: Subtable;
  }): Array<number> {
    // Find the first row of the subtable
    const firstRow = this.findRowByStringPattern({
      rows,
      pattern: subtablePattern.firstLinePattern,
    });

    const firstRowIndex = rows.indexOf(firstRow);
    if (firstRowIndex === -1) throw new Error('firstRow not found');
    const endCol = (Array.isArray(firstRow) && firstRow.length) || 0;

    return [firstRowIndex, endCol];
  }
}
