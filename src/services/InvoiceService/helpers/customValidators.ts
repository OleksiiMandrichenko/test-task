import { CustomHelpers, ErrorReport } from '@hapi/joi';
import moment from 'moment';
import { Invoice } from '../../../models/Invoices';

const momentValidator = (
  value: string,
  helpers: CustomHelpers
): ErrorReport | string => {
  const formats = ['YYYY-MM', 'MMM YYYY'];
  const isValidFormat = formats.some((format) =>
    moment(value, format, true).isValid()
  );

  if (!isValidFormat) {
    return helpers.error('any.invalid');
  }

  return value;
};

const invoiceValidator = (
  value: Invoice,
  helpers: CustomHelpers<Invoice>
): ErrorReport | Invoice => {
  const {
    Quantity: quantity,
    'Price Per Item': pricePerItem,
    'Total Price': totalPrice,
  } = value;

  if (quantity * pricePerItem !== totalPrice) {
    return helpers.error('any.invalid', {
      message:
        'Multiplication of "Quantity" and "Price Per Item" must be equal "Total Price"',
    });
  }

  return value;
};

export default {
  INVOICE_VALIDATOR: invoiceValidator,
  MOMENT_VALIDATOR: momentValidator,
};
