import { Subtable } from '../../models/Invoices';
import escapeRegExp from './helpers/escapeRegExp';

// Regex pattern for "Jan 2023", "Feb 2023", ..., "Dec 2023"
const monthYearRegex =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;

// Regex pattern for "2023-01", "2023-02", ..., "2023-12"
const yearMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const exchangeRatePatterns: Subtable = {
  // Combine both regex patterns using the alternation (|) operator
  firstLinePattern: new RegExp(
    `(${monthYearRegex.source})|(${yearMonthRegex.source})`
  ),
  dataPattern: /^[A-Z]{3} Rate/,
  includeHeaderInRange: false,
};

export const INVOICE_MANDATORY_FIELDS = [
  'Customer',
  "Cust No'",
  'Project Type',
  'Quantity',
  'Price Per Item',
  'Item Price Currency',
  'Total Price',
  'Invoice Currency',
  'Status',
];

export const invoicesPatterns: Subtable = {
  firstLinePattern: new RegExp(
    INVOICE_MANDATORY_FIELDS.map((field) => escapeRegExp(field)).join('|')
  ),
  dataPattern: /.*/,
  includeHeaderInRange: true,
};
