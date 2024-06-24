export enum InvoiceStatus {
  READY = 'Ready',
  DONE = 'Done',
}

export enum ProjectTypes {
  DEVELOPMENT = 'Development',
  FINANCE = 'Finance',
  MARKETING = 'Marketing',
  SUPPORT = '24/7 Support',
}

export interface Subtable {
  firstLinePattern: RegExp;
  dataPattern: RegExp;
  includeHeaderInRange: boolean;
}

export interface Invoice {
  Customer: string;
  "Cust No'": number;
  'Project Type': string;
  Quantity: number;
  'Price Per Item': number;
  'Item Price Currency': string;
  'Total Price': number;
  'Invoice Currency': string;
  Status: InvoiceStatus;
  invoiceTotal?: number | null;
  validationErrors?: Array<string>;
}

export interface ProcessedInvoices {
  invoicingMonth: string;
  currencyRates: Record<string, unknown>;
  invoicesData: Array<Invoice>;
}
