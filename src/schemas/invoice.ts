import Joi, { Schema } from '@hapi/joi';
import { InvoiceStatus, ProjectTypes } from '../models/Invoices';

const schema: Schema = Joi.object({
  Customer: Joi.string().required(),
  "Cust No'": Joi.number().required(),
  'Project Type': Joi.string().valid(...Object.values(ProjectTypes)),
  Quantity: Joi.number().required(),
  'Price Per Item': Joi.number().required(),
  'Item Price Currency': Joi.string().required(),
  'Total Price': Joi.number().required(),
  'Invoice Currency': Joi.string().required(),
  Status: Joi.string().valid(...Object.values(InvoiceStatus)),
}).unknown(true);

export default schema;
